use super::*;

fn place(parent: Option<&str>) -> Location {
    Location {
        organization: "default".into(),
        workspace: None,
        parent: parent.map(str::to_owned),
    }
}
fn query(parent: Option<&str>, limit: u32) -> Value {
    json!({"organization":"default","parent":parent,"limit":limit})
}
async fn browse(f: &Fixture, user: &str, input: Value) -> Value {
    let response = f.post(user, "browse", input).await;
    let status = response.status();
    let value: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
async fn folder(f: &Fixture, id: &str, name: &str, parent: Option<&str>) {
    let r = f
        .post(
            "alice",
            "folder",
            json!({"id":id,"name":name,"location":place(parent)}),
        )
        .await;
    assert_eq!(r.status(), 200, "{}", r.text().await.unwrap());
}
async fn document(f: &Fixture, id: &str, parent: Option<&str>) {
    let mut input = create(id);
    input.location = Some(place(parent));
    f.docs.mutate(&token("alice"), &input).await.unwrap();
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn browsing_mixes_folders_documents_without_content_or_private_cursors() {
    let f = Fixture::new().await;
    folder(&f, "a-folder", "  Drawings  ", None).await;
    f.docs
        .create_folder(&token("bob"), "b-private-folder", &place(None))
        .await
        .unwrap();
    document(&f, "c-file", None).await;
    document(&f, "child", Some("a-folder")).await;
    f.docs
        .create_folder(&token("bob"), "z-private-folder", &place(None))
        .await
        .unwrap();
    let first = browse(&f, "alice", query(None, 1)).await;
    assert_eq!(
        first["entries"][0],
        json!({"kind":"folder","folder":{"id":"a-folder","name":"Drawings"}})
    );
    assert_eq!(first["next_after"], "a-folder");
    let mut next = query(None, 1);
    next["after"] = first["next_after"].clone();
    let last = browse(&f, "alice", next).await;
    assert_eq!(last["entries"][0]["document"]["document_id"], "c-file");
    assert!(last["next_after"].is_null());
    for forbidden in [
        "private-folder",
        "child",
        "content_sha256",
        "actor",
        "content_base64",
    ] {
        assert!(!last.to_string().contains(forbidden));
    }
    assert!(
        browse(&f, "admin", query(None, 10)).await["entries"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    // Folder browsing must not download contents to determine file metadata.
    std::fs::remove_dir_all(f._objects.path()).unwrap();
    assert_eq!(
        browse(&f, "alice", query(None, 10)).await["entries"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(f.docs.read(&token("alice"), "c-file", None).await.is_err());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn browsing_navigation_keeps_private_ancestors_and_locations_private() {
    let f = Fixture::new().await;
    folder(&f, "secret-parent", "Private parent", None).await;
    folder(&f, "shared-child", "Shared child", Some("secret-parent")).await;
    folder(&f, "grandchild", "Grandchild", Some("shared-child")).await;
    document(&f, "model", Some("grandchild")).await;
    f.docs
        .grant(&token("alice"), "shared-child", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let page = browse(&f, "bob", query(Some("grandchild"), 10)).await;
    assert_eq!(
        page["path"],
        json!([{"id":"shared-child","name":"Shared child"},{"id":"grandchild","name":"Grandchild"}])
    );
    assert_eq!(page["entries"][0]["document"]["document_id"], "model");
    assert!(!page.to_string().contains("secret-parent"));
    assert_eq!(
        f.post("bob", "browse", query(Some("secret-parent"), 10))
            .await
            .status(),
        404
    );
    let mut wrong = query(Some("shared-child"), 10);
    wrong["workspace"] = json!("shared");
    assert_eq!(f.post("bob", "browse", wrong).await.status(), 404);
    assert_eq!(
        f.post("alice", "browse", query(Some("model"), 10))
            .await
            .status(),
        404
    );
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE id='secret-parent'")
        .await;
    assert_eq!(
        f.post("bob", "browse", query(Some("shared-child"), 10))
            .await
            .status(),
        404
    );
    f.sql("UPDATE aether_access.resources SET trashed=false,parent='grandchild' WHERE id='secret-parent'").await;
    assert_eq!(
        f.post("alice", "browse", query(Some("shared-child"), 10))
            .await
            .status(),
        404
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn browsing_search_app_rules_and_current_revision_names() {
    let f = Fixture::new().await;
    folder(&f, "folder", "100%_Drawings", None).await;
    document(&f, "drawing", None).await;
    let rename = mutation(
        json!({"operation_id":"rename","document_id":"drawing","change":{"kind":"rename","expected_revision":1,"name":"100%_BLUEPRINT"}}),
    );
    f.docs.mutate(&token("alice"), &rename).await.unwrap();
    let mut input = query(None, 10);
    input["query"] = json!("100%_b");
    let page = browse(&f, "alice", input.clone()).await;
    assert_eq!(page["entries"].as_array().unwrap().len(), 1);
    assert_eq!(page["entries"][0]["document"]["revision"], 2);
    input["query"] = json!("%");
    assert_eq!(
        browse(&f, "alice", input.clone()).await["entries"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    input["query"] = json!("");
    input["app"] = json!("cad");
    assert_eq!(
        browse(&f, "alice", input).await["entries"]
            .as_array()
            .unwrap()
            .len(),
        1
    ); // navigation folders remain
    f.docs
        .configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    assert_eq!(
        browse(&f, "alice", query(None, 10)).await["entries"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    f.docs
        .configure_team(
            &token("admin"),
            "design",
            &["alice".into()],
            &["map".into()],
        )
        .await
        .unwrap();
    assert_eq!(
        browse(&f, "alice", query(None, 10)).await["entries"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    assert_eq!(
        browse(&f, "alice", query(None, 10)).await["entries"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        f.post("alice", "browse", query(Some("folder"), 10))
            .await
            .status(),
        404
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn browsing_revocation_rechecks_when_waiting_and_on_continuation() {
    let f = Fixture::new().await;
    folder(&f, "folder", "Shared", None).await;
    document(&f, "a", Some("folder")).await;
    document(&f, "b", Some("folder")).await;
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let page = browse(&f, "bob", query(Some("folder"), 1)).await;
    assert_eq!(page["next_after"], "a");
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let client = f.client.clone();
    let url = f.url.clone();
    let mut input = query(Some("folder"), 1);
    input["after"] = page["next_after"].clone();
    let pending = tokio::spawn(async move {
        client
            .post(format!("{url}/api/v1/documents/browse"))
            .header("origin", &url)
            .header("cookie", format!("{COOKIE}={}", token("bob")))
            .json(&input)
            .send()
            .await
            .unwrap()
    });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))")
        .await;
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='folder' AND user_id='bob'",&[]).await.unwrap();
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    assert_eq!(
        f.post("eve", "browse", query(Some("folder"), 10))
            .await
            .status(),
        404
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn browsing_input_limits_and_folder_creation_audit_are_atomic() {
    let f = Fixture::new().await;
    for name in [" ".to_owned(), "bad\nname".into(), "x".repeat(1025)] {
        assert_eq!(
            f.post(
                "alice",
                "folder",
                json!({"id":"folder","name":name,"location":place(None)})
            )
            .await
            .status(),
            400
        );
    }
    f.sql("CREATE FUNCTION reject_folder_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER reject_folder_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_folder_audit()").await;
    assert_eq!(
        f.post(
            "alice",
            "folder",
            json!({"id":"folder","name":"Nice","location":place(None)})
        )
        .await
        .status(),
        503
    );
    let n: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_access.resources WHERE id='folder'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(n, 0);
    f.sql("DROP TRIGGER reject_folder_audit ON aether_access.audit")
        .await;
    f.docs
        .create_folder(&token("alice"), "old-client", &place(None))
        .await
        .unwrap();
    assert_eq!(
        browse(&f, "alice", query(None, 10)).await["entries"][0]["folder"]["name"],
        "old-client"
    );
    for input in [
        json!({"organization":"default","limit":0}),
        json!({"organization":"default","limit":101}),
        json!({"organization":"default","limit":1,"after":"bad/id"}),
        json!({"organization":"default","limit":1,"actor":"admin"}),
        json!({"organization":"default","limit":1,"query":"\n"}),
    ] {
        assert_eq!(f.post("alice", "browse", input).await.status(), 400);
    }
    // Fixture rows are resource metadata only (folders have no content/revision store).
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,folder_name) SELECT 'company','hidden-'||lpad(n::text,5,'0'),'default','bob','folder','drive','Private' FROM generate_series(1,2048) n").await;
    let response = f.post("alice", "browse", query(None, 10)).await;
    assert_eq!(response.status(), 503);
    let body = response.text().await.unwrap();
    assert!(!body.contains("hidden-") && !body.contains("Private"));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn browsing_schema2_upgrade_preserves_locations_and_rolls_back_failure() {
    let f = Fixture::new().await;
    folder(&f, "old-folder", "Previously unnamed", None).await;
    document(&f, "drawing", Some("old-folder")).await;
    f.access_before_branch_metadata().await;
    f.sql("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; DROP TABLE aether_access.legacy_file_metadata; DROP TABLE aether_access.workspace_preference_events,aether_access.workspace_preference_receipts,aether_access.workspace_preferences; DROP TABLE aether_access.collaboration_events,aether_access.collaboration_receipts,aether_access.collaboration_items,aether_access.collaboration_heads; DROP TABLE aether_access.version_events,aether_access.version_receipts,aether_access.named_versions; DROP TABLE aether_access.legacy_history_annotations; DROP TABLE aether_access.library_recents; DROP TABLE aether_access.resource_events,aether_access.resource_receipts; DROP INDEX aether_access.recycle_roots; ALTER TABLE aether_access.resources DROP COLUMN structure_revision; DROP INDEX aether_access.browse_children; ALTER TABLE aether_access.resources DROP COLUMN folder_name").await;
    let mut hash = Sha256::new();
    hash.update(include_str!("../../src/documents/schema.sql"));
    hash.update(include_str!("../../src/documents/002-directory.sql"));
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_access.schema_state SET version=2,checksum=$1",
            &[&format!("{:x}", hash.finalize())],
        )
        .await
        .unwrap();
    assert!(matches!(
        f.docs.check_schema().await,
        Err(Error::Incompatible)
    ));
    f.sql("CREATE INDEX browse_children ON aether_access.resources(id)")
        .await;
    assert!(f.docs.migrate().await.is_err());
    assert_eq!(f.pool.get().await.unwrap().query_one("SELECT count(*) FROM information_schema.columns WHERE table_schema='aether_access' AND table_name='resources' AND column_name='folder_name'",&[]).await.unwrap().get::<_,i64>(0),0);
    f.sql("DROP INDEX aether_access.browse_children").await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    let result = browse(&f, "alice", query(Some("old-folder"), 10)).await;
    assert_eq!(result["path"][0]["name"], "old-folder");
    assert_eq!(result["entries"][0]["document"]["document_id"], "drawing");
    assert!(f.docs.read(&token("alice"), "drawing", None).await.is_ok());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn browsing_workspace_roots_and_tenants_do_not_expand_access() {
    let f = Fixture::new().await;
    // Members may open a separately shared folder without being able to browse
    // the otherwise private workspace's root or its neighboring documents.
    f.sql("INSERT INTO aether_access.workspaces(tenant,id,organization,name) VALUES('company','private-ws','default','Private'); INSERT INTO aether_access.workspace_members VALUES('company','private-ws','alice','editor')").await;
    let location = Location {
        organization: "default".into(),
        workspace: Some("private-ws".into()),
        parent: None,
    };
    f.docs
        .create_named_folder(&token("alice"), "shared-folder", &location, "Shared folder")
        .await
        .unwrap();
    f.docs
        .grant(&token("admin"), "shared-folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let mut input = query(None, 10);
    input["workspace"] = json!("private-ws");
    assert_eq!(f.post("bob", "browse", input.clone()).await.status(), 404);
    assert_eq!(
        browse(&f, "alice", input.clone()).await["entries"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    input["parent"] = json!("shared-folder");
    assert_eq!(
        browse(&f, "bob", input.clone()).await["path"][0]["name"],
        "Shared folder"
    );
    input["organization"] = json!("other");
    assert_eq!(f.post("bob", "browse", input).await.status(), 404);
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
        .configure_app(&token("alice"), "drive", true, false)
        .await
        .unwrap_err();
    other
        .configure_app(&token("admin"), "drive", true, false)
        .await
        .unwrap();
    let request = serde_json::from_value(query(None, 10)).unwrap();
    assert!(
        other
            .browse(&token("alice"), &request)
            .await
            .unwrap()
            .entries
            .is_empty()
    );
    let request = serde_json::from_value(query(Some("shared-folder"), 10)).unwrap();
    assert!(matches!(
        other.browse(&token("alice"), &request).await,
        Err(Error::Denied)
    ));
}
