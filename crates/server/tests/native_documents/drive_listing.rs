use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
async fn request(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn list(f: &Fixture, user: &str, input: Value) -> Value {
    let r = request(f, user, input).await;
    let status = r.status();
    let v: Value = r.json().await.unwrap();
    assert_eq!(status, 200, "{v}");
    v
}
fn ids(v: &Value) -> Vec<&str> {
    v["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["id"].as_str().unwrap())
        .collect()
}
async fn file(f: &Fixture, id: &str, name: &str, location: Location) {
    let value = json!({"operation_id":format!("new-{id}"),"document_id":id,"change":{"kind":"create","app":"map","name":name,"content_base64":"e30="},"location":location});
    let input: Mutation = serde_json::from_value(value).unwrap();
    f.docs.mutate(&token("alice"), &input).await.unwrap();
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_roots_folders_search_and_recents_use_existing_authority() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Models")
        .await
        .unwrap();
    file(&f, "z", "zeta", Location::default()).await;
    file(&f, "a", "Alpha", Location::default()).await;
    file(
        &f,
        "nested",
        "100%_detail",
        Location {
            parent: Some("folder".into()),
            ..Location::default()
        },
    )
    .await;
    file(
        &f,
        "shared",
        "Workspace model",
        Location {
            workspace: Some("shared".into()),
            ..Location::default()
        },
    )
    .await;
    let root = list(&f, "alice", json!({})).await;
    assert_eq!(ids(&root), ["folder", "a", "z"]);
    assert_eq!(root["files"][1]["owner_id"], "alice");
    assert_eq!(root["files"][1]["role"], "owner");
    assert_eq!(root["files"][1]["manageable"], true);
    assert_eq!(root["files"][1]["size"], 2);
    assert_eq!(root["files"][1]["favorite"], false);
    assert!(root["files"][1].get("modified_by").is_none());
    let child = list(&f, "alice", json!({"parent":"folder"})).await;
    assert_eq!(ids(&child), ["nested"]);
    assert_eq!(child["path"], json!([{"id":"folder","name":"Models"}]));
    assert_eq!(
        ids(&list(&f, "alice", json!({"query":"%_"})).await),
        ["nested"]
    );
    assert_eq!(
        ids(&list(&f, "alice", json!({"query":"  ALPHA  "})).await),
        ["a"]
    );
    assert_eq!(
        ids(&list(
            &f,
            "alice",
            json!({"view":"workspace","workspace":"shared"})
        )
        .await),
        ["shared"]
    );
    assert!(ids(&list(&f, "alice", json!({"view":"recent"})).await).is_empty());
    for id in ["a", "z"] {
        assert_eq!(
            f.library("alice", "read", json!({"app":"map","id":id}))
                .await
                .status(),
            200
        );
    }
    assert_eq!(
        ids(&list(&f, "alice", json!({"view":"recent"})).await),
        ["z", "a"]
    );
    let c = f.pool.get().await.unwrap();
    let before: Value = c
        .query_one(
            "SELECT jsonb_agg(to_jsonb(r) ORDER BY resource) FROM aether_access.library_recents r",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    list(&f, "alice", json!({})).await;
    let after: Value = c
        .query_one(
            "SELECT jsonb_agg(to_jsonb(r) ORDER BY resource) FROM aether_access.library_recents r",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(before, after);
    std::fs::remove_dir_all(f._objects.path()).unwrap();
    assert_eq!(ids(&list(&f, "alice", json!({})).await), ids(&root));
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_hides_private_ancestry_and_rechecks_apps_and_grants() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(
            &token("alice"),
            "secret",
            &Location::default(),
            "Secret parent",
        )
        .await
        .unwrap();
    f.docs
        .create_named_folder(
            &token("alice"),
            "sub",
            &Location {
                parent: Some("secret".into()),
                ..Location::default()
            },
            "Shared folder",
        )
        .await
        .unwrap();
    file(
        &f,
        "visible",
        "Shared drawing",
        Location {
            parent: Some("sub".into()),
            ..Location::default()
        },
    )
    .await;
    f.docs
        .grant(&token("alice"), "sub", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let page = list(&f, "bob", json!({"parent":"sub"})).await;
    assert_eq!(ids(&page), ["visible"]);
    assert_eq!(page["path"], json!([{"id":"sub","name":"Shared folder"}]));
    assert_eq!(page["files"][0]["manageable"], false);
    assert!(!page.to_string().contains("Secret parent"));
    assert_eq!(
        request(&f, "admin", json!({"parent":"sub"})).await.status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert!(ids(&list(&f, "bob", json!({"parent":"sub"})).await).is_empty());
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "sub", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        request(&f, "bob", json!({"parent":"sub"})).await.status(),
        404
    );
    f.docs
        .grant(&token("alice"), "visible", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let page = list(&f, "bob", json!({"view":"search","query":"drawing"})).await;
    assert!(page["files"][0]["parent"].is_null());
    assert_eq!(page["files"][0]["parent_hidden"], true);
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE tenant='company' AND id='secret'")
        .await;
    assert!(ids(&list(&f, "bob", json!({"view":"search","query":"drawing"})).await).is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_readonly_empty_accounts_and_strict_unsupported_requests() {
    let f = Fixture::new().await;
    assert!(ids(&list(&f, "eve", json!({"organization":"all"})).await).is_empty());
    assert_eq!(request(&f, "eve", json!({})).await.status(), 404);
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.enrolled WHERE user_id='eve'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    for input in [
        json!({"user":"alice"}),
        json!({"view":"invented"}),
        json!({"view":"workspace"}),
        json!({"view":"workspace","workspace":"shared","organization":"all"}),
        json!({"query":"bad\nquery"}),
        json!({"query":"x".repeat(1025)}),
        json!({"shared_scope":"other"}),
        json!([]),
    ] {
        assert_eq!(request(&f, "alice", input).await.status(), 400);
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_descriptor_size_hash_and_versions_do_not_expose_content() {
    use aether_protocol_core::storage::{DocumentChange, DocumentMutation};
    use aether_store::hosted::AuthorizedScope;
    let f = Fixture::new().await;
    file(&f, "seed", "Seed", Location::default()).await;
    let sha = format!("{:x}", Sha256::digest(b"actual attachment"));
    let descriptor = STANDARD
        .encode(serde_json::to_vec(&json!({"aether_drive_blob":sha,"size":100001})).unwrap());
    let store = HostedStore::new(
        f.pool.clone(),
        ContentStore::local(f._objects.path()).unwrap(),
    );
    store
        .mutate(
            &AuthorizedScope::new("company", "alice").unwrap(),
            &DocumentMutation {
                actor: "alice".into(),
                document_id: "image".into(),
                operation_id: "import-image".into(),
                change: DocumentChange::Create {
                    app: "drive".into(),
                    name: "Image.PNG".into(),
                    content_base64: descriptor,
                },
            },
        )
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app) VALUES('company','image','default','alice','document','drive')").await;
    assert_eq!(f.library("alice","version",json!({"app":"map","id":"seed","operation_id":"label","expected_revision":1,"name":"Checkpoint"})).await.status(),200);
    let page = list(&f, "alice", json!({})).await;
    let image = page["files"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["id"] == "image")
        .unwrap();
    assert_eq!(image["size"], 100001);
    assert_eq!(image["sha256"], sha);
    assert_eq!(image["mime"], "image/png");
    assert!(!page.to_string().contains("aether_drive_blob"));
    assert!(!page.to_string().contains("data_base64"));
    let seed = page["files"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["id"] == "seed")
        .unwrap();
    assert_eq!(seed["versions"], 1);
    // A corrupt trusted descriptor must not turn into a misleading successful list.
    store
        .mutate(
            &AuthorizedScope::new("company", "alice").unwrap(),
            &DocumentMutation {
                actor: "alice".into(),
                document_id: "image".into(),
                operation_id: "corrupt-import".into(),
                change: DocumentChange::Save {
                    expected_revision: 1,
                    content_base64: STANDARD.encode(br#"{"aether_drive_blob":"invalid","size":3}"#),
                },
            },
        )
        .await
        .unwrap();
    assert_eq!(request(&f, "alice", json!({})).await.status(), 503);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_queued_revocation_is_not_replaced_by_enrollment() {
    let f = Fixture::new().await;
    file(&f, "private", "Secret", Location::default()).await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute(
        "DELETE FROM aether_access.members WHERE tenant='company' AND user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    let req = f
        .client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({}));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_bounded_failure_never_returns_a_partial_directory() {
    let f = Fixture::new().await;
    file(&f, "seed", "Seed", Location::default()).await;
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,folder_name) SELECT 'company','folder-'||n,'default','alice','folder','drive','Folder '||n FROM generate_series(1,2049)n").await;
    let r = request(&f, "alice", json!({})).await;
    assert_eq!(r.status(), 501);
    assert_eq!(r.json::<Value>().await.unwrap()["execution"], "rejected");
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_matching_tenant_ids_cannot_change_names_roles_or_recents() {
    let f = Fixture::new().await;
    file(&f, "same", "Our document", Location::default()).await;
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('other','alice','Other Alice','unused','member',false); INSERT INTO aether_access.organizations VALUES('other','default','Other organization'); INSERT INTO aether_access.members VALUES('other','default','alice','owner'); INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,folder_name) VALUES('other','same','default','alice','folder','drive','Other secret'); INSERT INTO aether_access.library_recents(tenant,user_id,resource) VALUES('other','alice','same');").await;
    let page = list(&f, "alice", json!({})).await;
    assert_eq!(ids(&page), ["same"]);
    assert_eq!(page["files"][0]["name"], "Our document");
    assert_eq!(page["files"][0]["kind"], "file");
    assert!(page["files"][0]["opened"].is_null());
    assert!(!page.to_string().contains("Other"));
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    assert_eq!(request(&f, "alice", json!({})).await.status(), 404);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_preserves_imported_app_folder_identity_and_permissions() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(
            &token("alice"),
            "legacy-folder",
            &Location::default(),
            "Imported models",
        )
        .await
        .unwrap();
    // Legacy folders used their owning app; import deliberately preserves it.
    f.sql("UPDATE aether_access.resources SET app='map',structure_revision=2 WHERE tenant='company' AND id='legacy-folder'").await;
    file(
        &f,
        "child",
        "Model",
        Location {
            parent: Some("legacy-folder".into()),
            ..Location::default()
        },
    )
    .await;
    let root = list(&f, "alice", json!({})).await;
    assert_eq!(ids(&root), ["legacy-folder"]);
    assert_eq!(root["files"][0]["app"], "map");
    assert_eq!(root["files"][0]["revision"], 2);
    assert_eq!(root["files"][0]["size"], 0);
    let state = f
        .docs
        .resource_state(&token("alice"), "legacy-folder")
        .await
        .unwrap();
    assert_eq!(state.app, "map");
    assert_eq!(state.structure_revision, 2);
    let child = list(&f, "alice", json!({"parent":"legacy-folder"})).await;
    assert_eq!(ids(&child), ["child"]);
    assert_eq!(
        child["path"],
        json!([{"id":"legacy-folder","name":"Imported models"}])
    );
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'",
    )
    .await;
    assert!(ids(&list(&f, "alice", json!({})).await).is_empty());
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    let library = f.library("alice", "list", json!({"app":"cad"})).await;
    assert_eq!(library.status(), 200);
    assert!(
        library.json::<Value>().await.unwrap()["files"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        f.library(
            "alice",
            "list",
            json!({"app":"cad","parent":"legacy-folder"})
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        request(&f, "alice", json!({"parent":"legacy-folder"}))
            .await
            .status(),
        404
    );
    assert!(
        f.docs
            .resource_state(&token("alice"), "legacy-folder")
            .await
            .is_err()
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_imported_timestamps_survive_edits_without_changing_history() {
    let f = Fixture::new().await;
    file(&f, "imported", "Original", Location::default()).await;
    f.sql("INSERT INTO aether_access.legacy_file_metadata VALUES('company','imported',1,1700000000.123456,1700000001.654321)").await;
    let first = list(&f, "alice", json!({})).await;
    assert_eq!(first["files"][0]["created"], 1700000000.123456_f64);
    assert_eq!(first["files"][0]["modified"], 1700000001.654321_f64);
    let renamed = f.library("alice", "rename", json!({"app":"map","id":"imported","expected_revision":1,"name":"Changed","operation_id":"rename-imported"})).await;
    assert_eq!(renamed.status(), 200, "{}", renamed.text().await.unwrap());
    let after = list(&f, "alice", json!({})).await;
    assert_eq!(after["files"][0]["created"], first["files"][0]["created"]);
    assert_eq!(after["files"][0]["revision"], 2);
    assert!(after["files"][0]["modified"].as_f64().unwrap() > 1700000001.654321);
    let client = f.pool.get().await.unwrap();
    let original: f64 = client.query_one("SELECT modified FROM aether_access.legacy_file_metadata WHERE tenant='company' AND document_id='imported'", &[]).await.unwrap().get(0);
    assert_eq!(original, 1700000001.654321);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_listing_schema10_upgrade_is_explicit_atomic_and_retains_existing_documents() {
    let f = Fixture::new().await;
    file(&f, "existing", "Before upgrade", Location::default()).await;
    let previous = [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
        include_str!("../../src/documents/006-legacy-history.sql"),
        include_str!("../../src/documents/007-named-versions.sql"),
        include_str!("../../src/documents/008-collaboration.sql"),
        include_str!("../../src/documents/009-workspace-preferences.sql"),
    ]
    .concat();
    let checksum = format!("{:x}", Sha256::digest(previous.as_bytes()));
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; DROP TABLE aether_access.legacy_file_metadata; UPDATE aether_access.schema_state SET version=9,checksum='{checksum}'; CREATE VIEW aether_access.legacy_file_metadata AS SELECT 1 AS conflict")).await;
    assert!(matches!(
        f.docs.check_schema().await,
        Err(Error::Incompatible)
    ));
    assert!(f.docs.migrate().await.is_err());
    let version: i32 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT version FROM aether_access.schema_state", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(version, 9);
    f.sql("DROP VIEW aether_access.legacy_file_metadata").await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(ids(&list(&f, "alice", json!({})).await), ["existing"]);
}
