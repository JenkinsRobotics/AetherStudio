use super::*;
async fn call(f: &Fixture, user: &str, action: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/library/{action}", f.url))
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
        .create_folder(&token("alice"), "parent", &Location::default())
        .await
        .unwrap();
    f
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn library_home_folder_creation_keeps_app_and_retry_identity_without_drive_permission() {
    let f = seed().await;
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    let input = json!({"app":"map","operation_id":"folder","name":"Map folder","kind":"folder","scope":"personal"});
    let r = call(&f, "alice", "create", input.clone()).await;
    assert_eq!(r.status(), 200);
    let folder: Value = r.json().await.unwrap();
    assert_eq!(folder["app"], "map");
    assert_eq!(folder["kind"], "folder");
    assert_eq!(folder["revision"], 1);
    let r = call(&f, "alice", "create", input.clone()).await;
    assert_eq!(r.status(), 200);
    let replay: Value = r.json().await.unwrap();
    assert_eq!(replay["id"], folder["id"]);
    assert_eq!(replay["replayed"], true);
    let listed: Value = call(&f, "alice", "list", json!({"app":"map","view":"personal"}))
        .await
        .json()
        .await
        .unwrap();
    assert!(
        listed["files"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["id"] == folder["id"])
    );
    let file=call(&f,"alice","create",json!({"app":"map","operation_id":"child","name":"Show","parent":folder["id"],"data_base64":"e30="})).await;
    assert_eq!(file.status(), 200);
    let file: Value = file.json().await.unwrap();
    assert_eq!(file["parent"], folder["id"]);
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(call(&f, "alice", "create", input).await.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn library_home_folder_validation_locations_and_audit_failure_are_atomic() {
    let f = seed().await;
    let input = json!({"app":"map","operation_id":"folder","name":"Map folder","kind":"folder","parent":"parent"});
    assert_eq!(call(&f, "eve", "create", input.clone()).await.status(), 404);
    for (field, value) in [
        ("data_base64", json!("e30=")),
        ("name", json!("../name")),
        ("scope", json!("unknown")),
        ("organization", json!("different")),
    ] {
        let mut invalid = input.clone();
        invalid[field] = value;
        assert_eq!(call(&f, "alice", "create", invalid).await.status(), 400);
    }
    f.sql("CREATE FUNCTION reject_home_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER reject_home_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_home_audit()").await;
    assert!(
        !call(&f, "alice", "create", input.clone())
            .await
            .status()
            .is_success()
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resources", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resource_receipts", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    f.sql("DROP TRIGGER reject_home_audit ON aether_access.audit")
        .await;
    assert_eq!(call(&f, "alice", "create", input).await.status(), 200);
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.members WHERE user_id='eve'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn library_folder_adapter_preserves_existing_drive_create_receipt_fingerprint() {
    let f = seed().await;
    let input: aether_server::documents::drive_create::Request = serde_json::from_value(
        json!({"operation_id":"drive-folder","kind":"folder","name":"Drive folder"}),
    )
    .unwrap();
    let created = f.docs.drive_create(&token("alice"), &input).await.unwrap();
    let c = f.pool.get().await.unwrap();
    let stored: Value = c
        .query_one(
            "SELECT request FROM aether_access.resource_receipts WHERE operation_id='drive-folder'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    let hash = format!("{:x}", Sha256::digest(serde_json::to_vec(&input).unwrap()));
    assert_eq!(
        stored,
        json!({"action":"drive_create","format":1,"input_sha256":hash})
    );
    assert_eq!(
        f.docs.drive_create(&token("alice"), &input).await.unwrap()["id"],
        created["id"]
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn library_home_folder_rename_uses_canonical_guards_without_drive_access_or_content_history()
{
    let f = seed().await;
    let created: Value = call(
        &f,
        "alice",
        "create",
        json!({"app":"map","operation_id":"folder","name":"Map folder","kind":"folder"}),
    )
    .await
    .json()
    .await
    .unwrap();
    let id = created["id"].as_str().unwrap();
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    let input =
        json!({"app":"map","id":id,"operation_id":"rename","name":"Renamed","expected_revision":1});
    assert_eq!(call(&f, "bob", "rename", input.clone()).await.status(), 404);
    let r = call(&f, "alice", "rename", input.clone()).await;
    assert_eq!(r.status(), 200);
    let r: Value = r.json().await.unwrap();
    assert_eq!(r["revision"], 2);
    assert_eq!(r["name"], "Renamed");
    let later =
        json!({"app":"map","id":id,"operation_id":"later","name":"Later","expected_revision":2});
    assert_eq!(call(&f, "alice", "rename", later).await.status(), 200);
    let replay: Value = call(&f, "alice", "rename", input.clone())
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(replay["replayed"], true);
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT folder_name FROM aether_access.resources WHERE id=$1",
            &[&id]
        )
        .await
        .unwrap()
        .get::<_, String>(0),
        "Later"
    );
    let mut stale = input;
    stale["operation_id"] = json!("stale");
    assert_eq!(call(&f, "alice", "rename", stale).await.status(), 409);
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.resource_events WHERE resource=$1",
            &[&id]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
}
