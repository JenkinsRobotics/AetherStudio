use super::*;
async fn activity(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/activity", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"create-visible","document_id":"visible","change":{"kind":"create","app":"map","name":"Visible","content_base64":"e30="}}))).await.unwrap();
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"create-private","document_id":"private","change":{"kind":"create","app":"map","name":"Private","content_base64":"e30="}}))).await.unwrap();
    f.docs
        .grant(&token("alice"), "visible", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.legacy_drive_events VALUES('company',1,'default','visible','alice','trash',1234.125,'Exact original name'),('company',2,'default','private','alice','trash',1235.5,'Private original name'),('company',3,'default',NULL,'alice','delete_forever',1236.0,'Purged original name')").await;
    f
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn activity_preserves_original_facts_and_projects_native_without_private_history() {
    let f = seed().await;
    let response = activity(&f, "bob", json!({})).await;
    assert_eq!(response.status(), 200);
    let page: Value = response.json().await.unwrap();
    let events = page["events"].as_array().unwrap();
    let legacy = events.iter().find(|e| e["id"] == "legacy:1").unwrap();
    assert_eq!(legacy["created"], 1234.125);
    assert_eq!(legacy["detail"], "Exact original name");
    assert_eq!(legacy["author"], "alice");
    assert!(events.iter().any(|e| e["id"] == "document:create-visible"));
    assert!(!page.to_string().contains("Private original"));
    assert!(!page.to_string().contains("Purged original"));
    let file = activity(&f, "bob", json!({"organization":"all","file":"visible"})).await;
    assert_eq!(file.status(), 200);
    assert!(
        file.json::<Value>().await.unwrap()["events"]
            .as_array()
            .unwrap()
            .iter()
            .all(|e| e["file_id"] == "visible")
    );
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
    // Purged-file details are restricted to an explicit organization owner.
    f.docs
        .set_organization_member(&token("admin"), "default", "alice", Some("owner"))
        .await
        .unwrap();
    let owner = activity(&f, "alice", json!({}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert!(
        owner["events"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["id"] == "legacy:3")
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn activity_current_app_access_and_membership_control_legacy_and_native_events() {
    let f = seed().await;
    assert_eq!(
        activity(&f, "bob", json!({"file":"private"}))
            .await
            .status(),
        404
    );
    assert_eq!(activity(&f, "eve", json!({})).await.status(), 404);
    assert_eq!(
        activity(&f, "alice", json!({"actor":"bob"})).await.status(),
        400
    );
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'",
    )
    .await;
    let page = activity(&f, "bob", json!({}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert!(page["events"].as_array().unwrap().is_empty());
    assert_eq!(
        activity(&f, "bob", json!({"file":"visible"}))
            .await
            .status(),
        404
    );
    f.sql("UPDATE aether_access.applications SET enabled=true WHERE tenant='company' AND id='map'")
        .await;
    f.docs
        .grant(&token("alice"), "visible", "bob", None)
        .await
        .unwrap();
    let page = activity(&f, "bob", json!({}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert!(page["events"].as_array().unwrap().is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn activity_legacy_recycle_facts_remain_exact_and_native_deletions_supersede_them() {
    let f = seed().await;
    f.sql(
        "UPDATE aether_access.resources SET trashed=true WHERE tenant='company' AND id='visible'",
    )
    .await;
    let page = f
        .client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({"view":"trash"}))
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(page["files"][0]["deleted_at"], 1234.125);
    assert_eq!(page["files"][0]["deleted_by"], "alice");
    for (revision, kind) in [(1, "restore"), (2, "trash")] {
        let response=f.post("alice","resource-change",json!({"id":"visible","operation_id":kind,"expected_structure_revision":revision,"change":{"kind":kind}})).await;
        assert_eq!(response.status(), 200);
    }
    let page = activity(&f, "bob", json!({"file":"visible"}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert!(
        page["events"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["action"] == "restore")
    );
    assert_eq!(
        page["events"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["id"] == "legacy:1")
            .count(),
        1
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn activity_bounds_are_explicit_and_schema13_upgrade_rolls_back_then_preserves_grants() {
    use sha2::{Digest, Sha256};
    let f = seed().await;
    let prior = [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
        include_str!("../../src/documents/006-legacy-history.sql"),
        include_str!("../../src/documents/007-named-versions.sql"),
        include_str!("../../src/documents/008-collaboration.sql"),
        include_str!("../../src/documents/009-workspace-preferences.sql"),
        include_str!("../../src/documents/010-legacy-file-metadata.sql"),
        include_str!("../../src/documents/011-file-favorites.sql"),
        include_str!("../../src/documents/012-sharing-provenance.sql"),
    ]
    .concat();
    let hash = format!("{:x}", Sha256::digest(prior.as_bytes()));
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; UPDATE aether_access.schema_state SET version=12,checksum='{hash}'; CREATE VIEW aether_access.legacy_drive_events AS SELECT 1 AS conflict")).await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        12
    );
    f.sql("DROP VIEW aether_access.legacy_drive_events").await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_access.grants", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    f.sql("INSERT INTO aether_access.legacy_drive_events SELECT 'company',n,'default','visible','alice','renamed',1234.0,'Exact' FROM generate_series(1,4097) n").await;
    let reply = activity(&f, "bob", json!({})).await;
    assert_eq!(reply.status(), 501);
    assert!(reply.json::<Value>().await.unwrap().get("events").is_none());
}
