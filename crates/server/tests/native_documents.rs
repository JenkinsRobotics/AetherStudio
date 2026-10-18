//! Real PostgreSQL/HTTP acceptance, private fixture sessions in the actual
//! identity tables. No production database or mocked permission authority.
use aether_identity::Identity;
use aether_server::{
    documents::{Documents, Error, Location, Mutation, Role},
    native::{COOKIE, NativeHost, router},
};
use aether_store::hosted::{ContentStore, HostedStore};
use deadpool_postgres::{Manager, Pool, Runtime};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    net::SocketAddr,
    sync::atomic::{AtomicU32, Ordering},
    time::Duration,
};
use tokio_postgres::{Config, NoTls};
#[path = "native_documents/agents.rs"]
mod agents;
#[path = "native_documents/automation.rs"]
mod automation;
#[path = "native_documents/mcp_access.rs"]
mod mcp_access;
#[path = "native_documents/live_editors.rs"]
mod live_editors;
static NEXT: AtomicU32 = AtomicU32::new(1);
#[path = "native_documents/admin_apps.rs"]
mod admin_apps;
#[path = "native_documents/admin_directory.rs"]
mod admin_directory;
#[path = "native_documents/animation.rs"]
mod animation;
#[path = "native_documents/backup.rs"]
mod backup;
#[path = "native_documents/browsing.rs"]
mod browsing;
#[path = "native_documents/cad_assembly_products.rs"]
mod cad_assembly_products;
#[path = "native_documents/cad_browser_products.rs"]
mod cad_browser_products;
#[path = "native_documents/cad_products.rs"]
mod cad_products;
#[path = "native_documents/cad_project_products.rs"]
mod cad_project_products;
#[path = "native_documents/cad_settings_products.rs"]
mod cad_settings_products;
#[path = "native_documents/change_stream.rs"]
mod change_stream;
#[path = "native_documents/collaboration.rs"]
mod collaboration;
#[path = "native_documents/directory.rs"]
mod directory;
#[path = "native_documents/download.rs"]
mod download;
#[path = "native_documents/drive_activity.rs"]
mod drive_activity;
#[path = "native_documents/drive_context.rs"]
mod drive_context;
#[path = "native_documents/drive_copy.rs"]
mod drive_copy;
#[path = "native_documents/drive_create.rs"]
mod drive_create;
#[path = "native_documents/drive_edits.rs"]
mod drive_edits;
#[path = "native_documents/drive_grants.rs"]
mod drive_grants;
#[path = "native_documents/drive_items.rs"]
mod drive_items;
#[path = "native_documents/drive_links.rs"]
mod drive_links;
#[path = "native_documents/drive_listing.rs"]
mod drive_listing;
#[path = "native_documents/drive_membership.rs"]
mod drive_membership;
#[path = "native_documents/drive_provisioning.rs"]
mod drive_provisioning;
#[path = "native_documents/drive_recycle.rs"]
mod drive_recycle;
#[path = "native_documents/drive_sharing.rs"]
mod drive_sharing;
#[path = "native_documents/file_favorites.rs"]
mod file_favorites;
#[path = "native_documents/frontends.rs"]
mod frontends;
#[path = "native_documents/library.rs"]
mod library;
#[path = "native_documents/library_branches.rs"]
mod library_branches;
#[path = "native_documents/library_compare.rs"]
mod library_compare;
#[path = "native_documents/library_history.rs"]
mod library_history;
#[path = "native_documents/library_home.rs"]
mod library_home;
#[path = "native_documents/library_listing.rs"]
mod library_listing;
#[path = "native_documents/library_restore.rs"]
mod library_restore;
#[path = "native_documents/library_versions.rs"]
mod library_versions;
#[path = "native_documents/listing.rs"]
mod listing;
#[path = "native_documents/mail.rs"]
mod mail;
#[path = "native_documents/maintenance.rs"]
mod maintenance;
#[path = "native_documents/map_devices.rs"]
mod map_devices;
#[path = "native_documents/map_media.rs"]
mod map_media;
#[path = "native_documents/map_search.rs"]
mod map_search;
#[path = "native_documents/network.rs"]
mod network;
#[path = "native_documents/preferences.rs"]
mod preferences;
#[path = "native_documents/products.rs"]
mod products;
#[path = "native_documents/release_lifecycle.rs"]
mod release_lifecycle;
#[path = "native_documents/resources.rs"]
mod resources;
#[path = "native_documents/revision_notifications.rs"]
mod revision_notifications;
#[path = "native_documents/services.rs"]
mod services;
#[path = "native_documents/settings.rs"]
mod settings;
#[path = "native_documents/setup.rs"]
mod setup;
#[path = "native_documents/status.rs"]
mod status;
#[path = "native_documents/uploads.rs"]
mod uploads;
#[path = "native_documents/workspace_assets.rs"]
mod workspace_assets;
#[path = "native_documents/workspace_preferences.rs"]
mod workspace_preferences;
struct Fixture {
    pool: Pool,
    pg_config: Config,
    docs: Documents,
    identity: Identity,
    _objects: tempfile::TempDir,
    client: reqwest::Client,
    url: String,
    task: tokio::task::JoinHandle<()>,
}
fn token(user: &str) -> String {
    format!("{:x}", Sha256::digest(format!("fixture-only-{user}")))
}
fn mutation(value: Value) -> Mutation {
    serde_json::from_value(value).unwrap()
}
fn create(id: &str) -> Mutation {
    mutation(
        json!({"operation_id":format!("create-{id}"),"document_id":id,"change":{"kind":"create","app":"map","name":"Show","content_base64":"e30="}}),
    )
}
fn save(id: &str, op: &str, revision: u32) -> Mutation {
    mutation(
        json!({"operation_id":op,"document_id":id,"change":{"kind":"save","expected_revision":revision,"content_base64":"eyJhIjoyfQ=="}}),
    )
}
impl Fixture {
    async fn new() -> Self {
        Self::with_stream_capacity(512).await
    }
    async fn with_stream_capacity(capacity: usize) -> Self {
        Self::configured(capacity, None).await
    }
    async fn configured(
        capacity: usize,
        products: Option<aether_server::products::Products>,
    ) -> Self {
        let mut config: Config = std::env::var("AETHER_TEST_PG")
            .expect("Use disposable PostgreSQL runner")
            .parse()
            .unwrap();
        fn pool(config: Config) -> Pool {
            Pool::builder(Manager::new(config, NoTls))
                .max_size(16)
                .runtime(Runtime::Tokio1)
                .wait_timeout(Some(Duration::from_secs(5)))
                .build()
                .unwrap()
        }
        let admin = pool(config.clone());
        let name = format!(
            "aether_docs_{}_{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        );
        admin
            .get()
            .await
            .unwrap()
            .batch_execute(&format!("CREATE DATABASE {name}"))
            .await
            .unwrap();
        admin.close();
        config.dbname(&name);
        // A deployment default must not turn lock waits into stale ACL snapshots.
        config.options("-c default_transaction_isolation=serializable");
        let pool = pool(config.clone());
        let identity = Identity::new(pool.clone(), "company", 2).unwrap();
        identity.migrate().await.unwrap();
        for user in ["admin", "alice", "bob", "eve"] {
            let role = if user == "admin" { "admin" } else { "member" };
            let c = pool.get().await.unwrap();
            c.execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('company',$1,$1,'unused-fixture-hash',$2,false)",&[&user,&role]).await.unwrap();
            c.execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES('company',$1,$2,clock_timestamp()+interval '1 hour')",&[&format!("{:x}",Sha256::digest(token(user))),&user]).await.unwrap();
        }
        let objects = tempfile::tempdir().unwrap();
        let store = HostedStore::new(pool.clone(), ContentStore::local(objects.path()).unwrap());
        let docs = Documents::new(pool.clone(), identity.clone(), store);
        let docs = if let Some(products) = products {
            docs.with_products(products)
        } else {
            docs
        };
        assert!(docs.check_schema().await.is_err());
        docs.migrate().await.unwrap();
        docs.migrate().await.unwrap();
        docs.check_schema().await.unwrap();
        for app in ["map", "drive"] {
            docs.configure_app(&token("admin"), app, true, false)
                .await
                .unwrap();
        }
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let signals =
            aether_server::native::revision_signals::RevisionSignals::connect_local(config.clone())
                .await
                .unwrap();
        let host = NativeHost::new(identity.clone(), &url, 64, Duration::from_secs(30))
            .unwrap()
            .with_documents(docs.clone())
            .with_revision_signals(signals)
            .with_change_stream_capacity(capacity)
            .unwrap();
        let task = tokio::spawn(async move {
            axum::serve(
                listener,
                router(host).into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await
            .unwrap();
        });
        let client = reqwest::Client::builder()
            .no_proxy()
            .retry(reqwest::retry::never())
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap();
        Self {
            pool,
            pg_config: config,
            docs,
            identity,
            _objects: objects,
            client,
            url,
            task,
        }
    }
    async fn post(&self, user: &str, path: &str, value: Value) -> reqwest::Response {
        self.client
            .post(format!("{}/api/v1/documents/{path}", self.url))
            .header("origin", &self.url)
            .header("cookie", format!("{COOKIE}={}", token(user)))
            .json(&value)
            .send()
            .await
            .unwrap()
    }
    // Test-only rollback of the additive schema17/16 shapes; all fixtures here have
    // Main-only checkpoints. Production downgrades are not supported.
    async fn access_before_branch_metadata(&self) {
        self.sql("DROP TABLE aether_access.live_editor_calls,aether_access.live_editors,aether_access.workspace_files, aether_access.team_labels, aether_access.map_media_refs, aether_access.map_media, aether_access.map_cast, aether_access.map_devices, aether_access.map_device_limits, aether_access.automation_receipts")
            .await;
        self.sql("ALTER TABLE aether_access.named_versions DROP CONSTRAINT named_versions_branch_identity; ALTER TABLE aether_access.named_versions DROP CONSTRAINT named_versions_branch_check; ALTER TABLE aether_access.named_versions DROP COLUMN branch_id; ALTER TABLE aether_access.named_versions ADD CONSTRAINT named_versions_branch_check CHECK(branch='Main')").await;
    }
    async fn sql(&self, sql: &str) {
        self.pool
            .get()
            .await
            .unwrap()
            .batch_execute(sql)
            .await
            .unwrap();
    }
    async fn waiting(&self, query: &str) {
        tokio::time::timeout(Duration::from_secs(2),async {
            loop {let n:i64=self.pool.get().await.unwrap().query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",&[&format!("%{query}%")]).await.unwrap().get(0);if n>0{break;}tokio::time::sleep(Duration::from_millis(5)).await;}
        }).await.expect("Operation must reach the database lock barrier");
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        self.task.abort();
        self.pool.close();
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn private_grants_revisions_replay_and_revocation() {
    let f = Fixture::new().await;
    let d = &f.docs;
    let initial = d.mutate(&token("alice"), &create("private")).await.unwrap();
    assert_eq!(initial.document.actor, "alice");
    assert!(matches!(
        d.read(&token("admin"), "private", None).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        d.grant(&token("admin"), "private", "bob", Some(Role::Editor))
            .await,
        Err(Error::Denied)
    ));
    d.grant(&token("alice"), "private", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        d.read(&token("bob"), "private", None)
            .await
            .unwrap()
            .content_base64,
        "e30="
    );
    assert!(matches!(
        d.mutate(&token("bob"), &save("private", "s1", 1)).await,
        Err(Error::Denied)
    ));
    d.grant(&token("alice"), "private", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let saved = save("private", "s1", 1);
    assert_eq!(
        d.mutate(&token("bob"), &saved)
            .await
            .unwrap()
            .document
            .revision,
        2
    );
    assert!(d.mutate(&token("bob"), &saved).await.unwrap().replayed);
    assert!(matches!(
        d.grant(&token("bob"), "private", "eve", Some(Role::Editor))
            .await,
        Err(Error::Denied)
    ));
    for (op, change) in [
        (
            "rename",
            json!({"kind":"rename","expected_revision":2,"name":"New name"}),
        ),
        (
            "restore",
            json!({"kind":"restore","expected_revision":3,"source_revision":1}),
        ),
    ] {
        d.mutate(
            &token("bob"),
            &mutation(json!({"operation_id":op,"document_id":"private","change":change})),
        )
        .await
        .unwrap();
    }
    assert_eq!(
        d.history(&token("bob"), "private", 0, 10)
            .await
            .unwrap()
            .len(),
        4
    );
    d.grant(&token("alice"), "private", "bob", None)
        .await
        .unwrap();
    assert!(matches!(
        d.read(&token("bob"), "private", None).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        d.history(&token("bob"), "private", 0, 10).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        d.mutate(&token("bob"), &saved).await,
        Err(Error::Denied)
    ));
    d.grant(&token("alice"), "private", "bob", Some(Role::Editor))
        .await
        .unwrap();
    d.set_organization_member(&token("admin"), "default", "bob", None)
        .await
        .unwrap();
    assert!(matches!(
        d.read(&token("bob"), "private", None).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        d.mutate(&token("bob"), &create("rejoin")).await,
        Err(Error::Denied)
    ));
    d.set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    assert!(matches!(
        d.read(&token("bob"), "private", None).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        d.set_organization_member(&token("admin"), "default", "admin", None)
            .await,
        Err(Error::Conflict)
    ));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn inherited_folder_access_links_and_invalid_chains() {
    let f = Fixture::new().await;
    let d = &f.docs;
    d.create_folder(&token("alice"), "folder", &Location::default())
        .await
        .unwrap();
    assert!(matches!(
        d.create_folder(&token("bob"), "folder", &Location::default())
            .await,
        Err(Error::Denied)
    ));
    let mut c = create("child");
    c.location = Some(Location {
        parent: Some("folder".into()),
        ..Location::default()
    });
    d.mutate(&token("alice"), &c).await.unwrap();
    d.grant(&token("alice"), "folder", "bob", Some(Role::Editor))
        .await
        .unwrap();
    d.mutate(&token("bob"), &save("child", "child-save", 1))
        .await
        .unwrap();
    d.grant(&token("alice"), "folder", "bob", None)
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.links VALUES('company','link','folder','viewer',clock_timestamp()+interval '1 hour',false); INSERT INTO aether_access.link_visits VALUES('company','link','bob')").await;
    d.read(&token("bob"), "child", None).await.unwrap();
    f.sql("UPDATE aether_access.links SET expires=clock_timestamp()-interval '1 second'")
        .await;
    assert!(matches!(
        d.read(&token("bob"), "child", None).await,
        Err(Error::Denied)
    ));
    f.sql(
        "UPDATE aether_access.links SET expires=clock_timestamp()+interval '1 hour',revoked=true",
    )
    .await;
    assert!(matches!(
        d.read(&token("bob"), "child", None).await,
        Err(Error::Denied)
    ));
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE id='folder'")
        .await;
    assert!(matches!(
        d.read(&token("alice"), "child", None).await,
        Err(Error::Denied)
    ));
    f.sql("UPDATE aether_access.resources SET trashed=false,parent='child' WHERE id='folder'")
        .await;
    assert!(matches!(
        d.read(&token("alice"), "child", None).await,
        Err(Error::Denied)
    ));
    f.sql("UPDATE aether_access.resources SET parent='folder' WHERE id='folder'")
        .await;
    assert!(matches!(
        d.read(&token("alice"), "child", None).await,
        Err(Error::Denied)
    ));
    f.sql("UPDATE aether_access.resources SET parent=NULL,workspace='shared' WHERE id='folder'")
        .await;
    assert!(matches!(
        d.read(&token("alice"), "child", None).await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn shared_workspace_and_team_application_rules() {
    let f = Fixture::new().await;
    let d = &f.docs;
    let mut c = create("shared");
    c.location = Some(Location {
        workspace: Some("shared".into()),
        ..Location::default()
    });
    d.mutate(&token("alice"), &c).await.unwrap();
    d.read(&token("admin"), "shared", None).await.unwrap();
    assert!(matches!(
        d.mutate(&token("admin"), &save("shared", "admin-save", 1))
            .await,
        Err(Error::Denied)
    ));
    d.configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    assert!(matches!(
        d.read(&token("alice"), "shared", None).await,
        Err(Error::Denied)
    ));
    d.configure_team(
        &token("admin"),
        "design",
        &["alice".into()],
        &["map".into()],
    )
    .await
    .unwrap();
    d.read(&token("alice"), "shared", None).await.unwrap();
    d.configure_team(&token("admin"), "design", &[], &["map".into()])
        .await
        .unwrap();
    assert!(matches!(
        d.read(&token("alice"), "shared", None).await,
        Err(Error::Denied)
    ));
    d.configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert!(matches!(
        d.read(&token("admin"), "shared", None).await,
        Err(Error::Denied)
    ));
    d.configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.workspaces VALUES('company','engineering','default',true); INSERT INTO aether_access.workspace_members VALUES('company','engineering','alice','editor')").await;
    let mut c = create("team-doc");
    c.location = Some(Location {
        workspace: Some("engineering".into()),
        ..Location::default()
    });
    d.mutate(&token("alice"), &c).await.unwrap();
    // Native enrollment supplies org membership; default workspace grants viewer.
    d.mutate(&token("bob"), &create("bob-private"))
        .await
        .unwrap();
    d.read(&token("bob"), "team-doc", None).await.unwrap();
    assert!(matches!(
        d.mutate(&token("bob"), &save("team-doc", "bob-save", 1))
            .await,
        Err(Error::Denied)
    ));
    // Creator is not automatically an owner in a managed workspace.
    assert!(matches!(
        d.grant(&token("alice"), "team-doc", "bob", Some(Role::Editor))
            .await,
        Err(Error::Denied)
    ));
    f.sql("DELETE FROM aether_access.workspace_members WHERE workspace='engineering' AND user_id='alice'; UPDATE aether_access.workspaces SET is_default=false WHERE id='engineering'").await;
    assert!(matches!(
        d.read(&token("alice"), "team-doc", None).await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn authorization_and_save_commit_are_one_transaction() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("race"))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "race", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let mut blocker = f.pool.get().await.unwrap();
    let tx = blocker.transaction().await.unwrap();
    tx.batch_execute("LOCK TABLE aether_store.revisions IN SHARE MODE")
        .await
        .unwrap();
    let docs = f.docs.clone();
    let save_task = tokio::spawn(async move {
        docs.mutate(&token("bob"), &save("race", "race-save", 1))
            .await
    });
    f.waiting("INSERT INTO aether_store.revisions").await;
    let docs = f.docs.clone();
    let revoke =
        tokio::spawn(async move { docs.grant(&token("alice"), "race", "bob", None).await });
    f.waiting("pg_advisory_xact_lock(hashtextextended($1,1095062604))")
        .await;
    tx.commit().await.unwrap();
    save_task.await.unwrap().unwrap();
    revoke.await.unwrap().unwrap();
    assert!(matches!(
        f.docs
            .mutate(&token("bob"), &save("race", "race-save", 1))
            .await,
        Err(Error::Denied)
    ));
    f.docs
        .grant(&token("alice"), "race", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let tx = blocker.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let docs = f.docs.clone();
    let after = tokio::spawn(async move {
        docs.mutate(&token("bob"), &save("race", "after-revoke", 2))
            .await
    });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))")
        .await;
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='race' AND user_id='bob'",&[]).await.unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(after.await.unwrap(), Err(Error::Denied)));
    assert_eq!(
        f.docs
            .read(&token("alice"), "race", None)
            .await
            .unwrap()
            .document
            .revision,
        2
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn rollback_concurrent_create_and_session_revocation() {
    let f = Fixture::new().await;
    let mut bad = create("bad");
    if let aether_protocol_core::storage::DocumentChange::Create { content_base64, .. } =
        &mut bad.change
    {
        *content_base64 = "invalid!".into();
    }
    assert!(f.docs.mutate(&token("alice"), &bad).await.is_err());
    let n: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_access.resources WHERE id='bad'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(n, 0);
    f.sql("CREATE FUNCTION reject_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_save BEFORE INSERT ON aether_store.revisions FOR EACH ROW EXECUTE FUNCTION reject_revision()").await;
    assert!(
        f.docs
            .mutate(&token("alice"), &create("atomic"))
            .await
            .is_err()
    );
    let n: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_access.resources WHERE id='atomic'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(n, 0);
    f.sql("DROP TRIGGER reject_save ON aether_store.revisions")
        .await;
    let alice = token("alice");
    let request = create("atomic");
    let (a, b) = tokio::join!(
        f.docs.mutate(&alice, &request),
        f.docs.mutate(&alice, &request)
    );
    let (a, b) = (a.unwrap(), b.unwrap());
    assert_ne!(a.replayed, b.replayed);
    f.docs
        .grant(&token("alice"), "atomic", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("CREATE TRIGGER reject_acl BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_revision()").await;
    assert!(
        f.docs
            .grant(&token("alice"), "atomic", "bob", None)
            .await
            .is_err()
    );
    f.docs.read(&token("bob"), "atomic", None).await.unwrap();
    assert!(
        f.docs
            .create_folder(&token("alice"), "failed-folder", &Location::default())
            .await
            .is_err()
    );
    let n: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_access.resources WHERE id='failed-folder'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(n, 0);
    f.sql("DROP TRIGGER reject_acl ON aether_access.audit")
        .await;
    f.identity
        .revoke_sessions(&token("admin"), "alice")
        .await
        .unwrap();
    assert!(matches!(
        f.docs.read(&token("alice"), "atomic", None).await,
        Err(Error::Identity(aether_identity::Error::Unauthorized))
    ));
    assert!(matches!(
        f.docs.mutate(&token("alice"), &create("atomic")).await,
        Err(Error::Identity(aether_identity::Error::Unauthorized))
    ));
    let other_identity = Identity::new(f.pool.clone(), "other-company", 2).unwrap();
    let other = Documents::new(
        f.pool.clone(),
        other_identity,
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    assert!(matches!(
        other.read(&token("admin"), "atomic", None).await,
        Err(Error::Identity(aether_identity::Error::Unauthorized))
    ));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn http_boundary_derived_identity_limits_and_history() {
    let f = Fixture::new().await;
    let input = json!({"operation_id":"http-create","document_id":"http","change":{"kind":"create","app":"map","name":"HTTP show","content_base64":"e30="}});
    let mut spoof = input.clone();
    spoof["actor"] = json!("admin");
    assert_eq!(f.post("alice", "mutate", spoof).await.status(), 400);
    let mut spoof = input.clone();
    spoof["tenant"] = json!("other");
    assert_eq!(f.post("alice", "mutate", spoof).await.status(), 400);
    let r = f.post("alice", "mutate", input).await;
    assert_eq!(r.status(), 200);
    assert_eq!(
        r.json::<Value>().await.unwrap()["document"]["actor"],
        "alice"
    );
    let r = f.post("admin", "read", json!({"id":"http"})).await;
    assert_eq!(r.status(), 404);
    assert_eq!(r.headers()["cache-control"], "no-store");
    assert_eq!(
        f.post(
            "alice",
            "grant",
            json!({"id":"http","user":"bob","role":"viewer"})
        )
        .await
        .status(),
        200
    );
    assert_eq!(
        f.post("bob", "read", json!({"id":"http"})).await.status(),
        200
    );
    let history = f
        .post("bob", "history", json!({"id":"http","after":0,"limit":100}))
        .await;
    assert_eq!(history.status(), 200);
    assert_eq!(
        history
            .json::<Value>()
            .await
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        1
    );
    let no_origin = f
        .client
        .post(format!("{}/api/v1/documents/read", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({"id":"http"}))
        .send()
        .await
        .unwrap();
    assert_eq!(no_origin.status(), 403);
    assert_eq!(
        f.post(
            "eve",
            "admin",
            json!({"action":"app","app":"map","enabled":false,"restricted":false})
        )
        .await
        .status(),
        404
    );
    // Document mutation accepts >16KiB; account/read/control routes remain small.
    let large = json!({"operation_id":"large","document_id":"large","change":{"kind":"create","app":"map","name":"Large","content_base64":"AAAA".repeat(6000)}});
    assert_eq!(f.post("alice", "mutate", large).await.status(), 200);
    assert_eq!(
        f.post("alice", "read", json!({"id":"x".repeat(17000)}))
            .await
            .status(),
        413
    );
    let too_large = json!({"operation_id":"oversize","document_id":"oversize","change":{"kind":"create","app":"map","name":"Large","content_base64":"AAAA".repeat(24*1024*1024/4)}});
    assert_eq!(f.post("alice", "mutate", too_large).await.status(), 413);
    f.docs
        .grant(&token("alice"), "http", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        f.post("bob", "history", json!({"id":"http","after":0,"limit":100}))
            .await
            .status(),
        404
    );
    let r = f
        .client
        .get(format!("{}/readyz", f.url))
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(r["documents_ready"], true);
    assert_eq!(r["applications_ready"], false);

    // Exercise the operator executable too: the optional object authority must
    // survive explicit provisioning and be attached to the served router.
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};
    let database: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get(0);
    let dsn = format!(
        "{} dbname={database}",
        std::env::var("AETHER_TEST_PG").unwrap()
    );
    let mut command = tokio::process::Command::new(env!("CARGO_BIN_EXE_aether-native-host"));
    command
        .env("AETHER_NATIVE_PG", &dsn)
        .env("AETHER_NATIVE_TENANT", "company")
        .env("AETHER_NATIVE_OBJECTS", f._objects.path())
        .env("AETHER_NATIVE_LISTEN", "127.0.0.1:0")
        .kill_on_drop(true);
    assert!(
        command
            .arg("migrate")
            .output()
            .await
            .unwrap()
            .status
            .success()
    );
    let mut command = tokio::process::Command::new(env!("CARGO_BIN_EXE_aether-native-host"));
    command
        .env("AETHER_NATIVE_PG", &dsn)
        .env("AETHER_NATIVE_TENANT", "company")
        .env("AETHER_NATIVE_OBJECTS", f._objects.path())
        .env("AETHER_NATIVE_LISTEN", "127.0.0.1:0")
        .kill_on_drop(true)
        .stderr(Stdio::piped())
        .stdout(Stdio::null());
    let mut child = command.arg("serve").spawn().unwrap();
    let mut lines = BufReader::new(child.stderr.take().unwrap()).lines();
    let line = tokio::time::timeout(Duration::from_secs(5), lines.next_line())
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    let origin = line
        .split_whitespace()
        .find(|s| s.starts_with("http://"))
        .expect("native origin");
    let readiness = f
        .client
        .get(format!("{origin}/readyz"))
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(readiness["documents_ready"], true);
    let actual = f
        .client
        .post(format!("{origin}/api/v1/documents/read"))
        .header("origin", origin)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({"id":"http"}))
        .send()
        .await
        .unwrap();
    assert_eq!(actual.status(), 200);
    assert_eq!(
        actual.json::<Value>().await.unwrap()["document"]["actor"],
        "alice"
    );
    child.kill().await.unwrap();
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn identity_revocation_orders_with_in_flight_saves() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("session-race"))
        .await
        .unwrap();
    let mut blocker = f.pool.get().await.unwrap();
    let tx = blocker.transaction().await.unwrap();
    tx.batch_execute("LOCK TABLE aether_store.revisions IN SHARE MODE")
        .await
        .unwrap();
    let docs = f.docs.clone();
    let saving = tokio::spawn(async move {
        docs.mutate(&token("alice"), &save("session-race", "before-logout", 1))
            .await
    });
    f.waiting("INSERT INTO aether_store.revisions").await;
    let identity = f.identity.clone();
    let revoking =
        tokio::spawn(async move { identity.revoke_sessions(&token("admin"), "alice").await });
    f.waiting("pg_advisory_xact_lock(hashtextextended($1,1095062603))")
        .await;
    tx.commit().await.unwrap();
    saving.await.unwrap().unwrap();
    revoking.await.unwrap().unwrap();
    assert!(matches!(
        f.docs
            .mutate(&token("alice"), &save("session-race", "before-logout", 1))
            .await,
        Err(Error::Identity(aether_identity::Error::Unauthorized))
    ));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn authenticated_tenant_isolation_forced_password_and_metadata_consistency() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("private"))
        .await
        .unwrap();
    // Even a valid same-ID session and same operation ID in another tenant are
    // a different authority; reads cannot use the first tenant's ACL or content.
    f.sql("INSERT INTO aether_identity.users SELECT 'other',id,username,password,role,active,must_change,full_name,email,email_verified FROM aether_identity.users; INSERT INTO aether_identity.sessions SELECT 'other',token_hash,user_id,created,expires FROM aether_identity.sessions").await;
    let other = Documents::new(
        f.pool.clone(),
        Identity::new(f.pool.clone(), "other", 2).unwrap(),
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    other
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    assert!(matches!(
        other.read(&token("alice"), "private", None).await,
        Err(Error::Denied)
    ));
    assert!(
        !other
            .mutate(&token("alice"), &create("private"))
            .await
            .unwrap()
            .replayed
    );
    other
        .mutate(&token("alice"), &save("private", "s1", 1))
        .await
        .unwrap();
    assert_eq!(
        f.docs
            .read(&token("alice"), "private", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    f.sql(
        "UPDATE aether_identity.users SET must_change=true WHERE tenant='company' AND id='alice'",
    )
    .await;
    assert_eq!(
        f.post("alice", "read", json!({"id":"private"}))
            .await
            .status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET must_change=false WHERE tenant='company' AND id='alice'; UPDATE aether_access.resources SET app='drive' WHERE tenant='company' AND id='private'").await;
    assert!(matches!(
        f.docs.read(&token("alice"), "private", None).await,
        Err(Error::Incompatible)
    ));
    assert!(matches!(
        f.docs.history(&token("alice"), "private", 0, 10).await,
        Err(Error::Incompatible)
    ));
    assert!(matches!(
        f.docs
            .mutate(&token("alice"), &save("private", "mismatch", 1))
            .await,
        Err(Error::Incompatible)
    ));
    f.sql("UPDATE aether_access.resources SET app='map' WHERE tenant='company' AND id='private'")
        .await;
    assert_eq!(
        f.docs
            .read(&token("alice"), "private", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
}
