use super::*;
impl Fixture {
    pub(super) async fn library(
        &self,
        user: &str,
        action: &str,
        value: Value,
    ) -> reqwest::Response {
        self.client
            .post(format!("{}/api/library/{action}", self.url))
            .header("origin", &self.url)
            .header("cookie", format!("{COOKIE}={}", token(user)))
            .json(&value)
            .send()
            .await
            .unwrap()
    }
}
fn new_file(op: &str) -> Value {
    json!({"app":"map","operation_id":op,"kind":"file","name":"Test.aethermap","scope":"personal","data_base64":"e30="})
}
async fn created(f: &Fixture, op: &str) -> Value {
    let response = f.library("alice", "create", new_file(op)).await;
    assert_eq!(response.status(), 200);
    response.json().await.unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn metadata_writable_tracks_current_role_without_cross_request_caching() {
    let f = Fixture::new().await;
    let file = created(&f, "metadata-role").await;
    let id = file["id"].as_str().unwrap();
    for (role, writable) in [
        (Role::Viewer, false),
        (Role::Editor, true),
        (Role::Viewer, false),
    ] {
        f.docs
            .grant(&token("alice"), id, "bob", Some(role))
            .await
            .unwrap();
        let response = f.library("bob", "read", json!({"app":"map","id":id})).await;
        assert_eq!(response.status(), 200);
        let read: Value = response.json().await.unwrap();
        assert_eq!(read["writable"], writable);
        assert_eq!(read["revision"], 1);
        assert_eq!(read["data_base64"], "e30=");
    }
    f.docs
        .grant(&token("alice"), id, "bob", None)
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "read", json!({"app":"map","id":id}))
            .await
            .status(),
        404
    );
    assert_eq!(
        f.library("admin", "read", json!({"app":"map","id":id}))
            .await
            .status(),
        404
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_editors_roundtrip_and_exact_replay_preserve_history() {
    let f = Fixture::new().await;
    let file = created(&f, "one").await;
    let id = file["id"].as_str().unwrap();
    assert_eq!(file["revision"], 1);
    assert_eq!(file["owner"], "alice");
    assert_eq!(file["writable"], true);
    assert_eq!(file["size"], 2);
    assert!(file["created"].as_f64().unwrap() > 0.0);
    assert_eq!(file["scope"], "personal");
    let saved: Value = f.library("alice", "save", json!({"app":"map","id":id,"operation_id":"save","expected_revision":1,"branch":"Main","data_base64":"eyJuIjoyfQ=="})).await.json().await.unwrap();
    assert_eq!(saved["revision"], 2);
    let renamed: Value = f.library("alice", "rename", json!({"app":"map","id":id,"operation_id":"rename","expected_revision":2,"name":"Renamed.aethermap"})).await.json().await.unwrap();
    assert_eq!(renamed["revision"], 3);
    let replay = created(&f, "one").await;
    assert_eq!(replay["id"], id);
    assert_eq!(replay["revision"], 1);
    assert_eq!(replay["replayed"], true);
    let read: Value = f
        .library("alice", "read", json!({"app":"map","id":id}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(read["name"], "Renamed.aethermap");
    assert_eq!(read["data_base64"], "eyJuIjoyfQ==");
    assert_eq!(read["created"], file["created"]);
    assert_eq!(
        f.docs
            .history(&token("alice"), id, 0, 10)
            .await
            .unwrap()
            .len(),
        3
    );
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_access.library_recents", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    let mut changed = new_file("one");
    changed["name"] = json!("Different");
    assert_eq!(f.library("alice", "create", changed).await.status(), 409);
    assert_eq!(f.library("alice", "save", json!({"app":"map","id":id,"operation_id":"stale","expected_revision":1,"data_base64":"e30="})).await.status(), 409);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_app_and_current_permissions_guard_replays_and_metadata() {
    let f = Fixture::new().await;
    let file = created(&f, "permission").await;
    let id = file["id"].as_str().unwrap();
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    assert_eq!(f.library("alice", "save", json!({"app":"cad","id":id,"operation_id":"wrong-app","expected_revision":1,"data_base64":"e30="})).await.status(), 404);
    assert_eq!(
        f.library("alice", "read", json!({"app":"cad","id":id}))
            .await
            .status(),
        404
    );
    assert_eq!(
        f.library("admin", "read", json!({"app":"map","id":id}))
            .await
            .status(),
        404
    );
    f.docs
        .grant(&token("alice"), id, "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let read: Value = f
        .library("bob", "read", json!({"app":"map","id":id}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(read["writable"], false);
    assert_eq!(f.library("bob", "save", json!({"app":"map","id":id,"operation_id":"bob-save","expected_revision":1,"data_base64":"e30="})).await.status(), 404);
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        f.library("alice", "create", new_file("permission"))
            .await
            .status(),
        404
    );
    assert_eq!(
        f.library("bob", "read", json!({"app":"map","id":id}))
            .await
            .status(),
        404
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_does_not_silently_apply_branches_or_unknown_fields_to_main() {
    let f = Fixture::new().await;
    let file = created(&f, "unsupported").await;
    let id = file["id"].as_str().unwrap();
    for action in ["project_create", "delete"] {
        let response = f
            .library("alice", action, json!({"app":"map","id":id}))
            .await;
        assert_eq!(response.status(), 501);
        let error: Value = response.json().await.unwrap();
        assert_eq!(error["code"], "unsupported_feature");
        assert_eq!(error["execution"], "rejected");
    }
    assert_eq!(f.library("alice", "save", json!({"app":"map","id":id,"operation_id":"branch","expected_revision":1,"branch":"Alternative","data_base64":"e30="})).await.status(), 501);
    for extra in [
        json!({"actor":"admin"}),
        json!({"revision":1}),
        json!({"action":"save"}),
    ] {
        let mut request = json!({"app":"map","id":id});
        request
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        assert_eq!(f.library("alice", "read", request).await.status(), 400);
    }
    let mut missing = new_file("missing");
    missing.as_object_mut().unwrap().remove("operation_id");
    assert_eq!(f.library("alice", "create", missing).await.status(), 400);
    assert_eq!(
        f.docs
            .read(&token("alice"), id, None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_recents_failure_rolls_back_content_receipts_and_enrollment() {
    let f = Fixture::new().await;
    f.sql("CREATE FUNCTION reject_recent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER reject_recent BEFORE INSERT OR UPDATE ON aether_access.library_recents FOR EACH ROW EXECUTE FUNCTION reject_recent()").await;
    assert_eq!(
        f.library("alice", "create", new_file("atomic"))
            .await
            .status(),
        503
    );
    for table in [
        "aether_access.resources",
        "aether_store.operations",
        "aether_store.revisions",
    ] {
        assert_eq!(
            f.pool
                .get()
                .await
                .unwrap()
                .query_one(&format!("SELECT count(*) FROM {table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
    f.sql("DROP TRIGGER reject_recent ON aether_access.library_recents")
        .await;
    let file = created(&f, "atomic").await;
    let id = file["id"].as_str().unwrap();
    f.sql("CREATE TRIGGER reject_recent BEFORE INSERT OR UPDATE ON aether_access.library_recents FOR EACH ROW EXECUTE FUNCTION reject_recent()").await;
    assert_eq!(f.library("alice", "save", json!({"app":"map","id":id,"operation_id":"atomic-save","expected_revision":1,"data_base64":"eA=="})).await.status(), 503);
    assert_eq!(
        f.docs
            .read(&token("alice"), id, None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_folder_projection_keeps_private_parent_hidden() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(&token("alice"), "private", &Location::default(), "Private")
        .await
        .unwrap();
    let mut request = new_file("nested");
    request["parent"] = json!("private");
    let file: Value = f
        .library("alice", "create", request)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(file["parent"], "private");
    let id = file["id"].as_str().unwrap();
    f.docs
        .grant(&token("alice"), id, "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let read: Value = f
        .library("bob", "read", json!({"app":"map","id":id}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(read["parent"], Value::Null);
    assert_eq!(read["parent_hidden"], true);
    let mut wrong = new_file("wrong-folder");
    wrong["parent"] = json!(id);
    assert_eq!(f.library("alice", "create", wrong).await.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_enforces_file_boundary_and_browser_authority() {
    let f = Fixture::new().await;
    for (field, value) in [
        ("name", json!("..")),
        ("name", json!("a/b")),
        ("name", json!("a".repeat(181))),
        ("data_base64", json!("%%%")),
        ("data_base64", json!("AAAA".repeat(2 * 1024 * 1024 + 1))),
    ] {
        let mut request = new_file("invalid");
        request[field] = value;
        assert_eq!(f.library("alice", "create", request).await.status(), 400);
    }
    let denied = f
        .client
        .post(format!("{}/api/library/create", f.url))
        .header("origin", "https://elsewhere.invalid")
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&new_file("cross-origin"))
        .send()
        .await
        .unwrap();
    assert_eq!(denied.status(), 403);
    let no_auth = f
        .client
        .post(format!("{}/api/library/project_create", f.url))
        .header("origin", &f.url)
        .json(&json!({}))
        .send()
        .await
        .unwrap();
    assert_eq!(no_auth.status(), 401);
    let mut drive = new_file("blob");
    drive["app"] = json!("drive");
    assert_eq!(f.library("alice", "create", drive).await.status(), 501);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_concurrent_browser_retransmission_creates_one_document() {
    let f = Fixture::new().await;
    let (one, two) = tokio::join!(
        f.library("alice", "create", new_file("browser-retransmission")),
        f.library("alice", "create", new_file("browser-retransmission")),
    );
    assert_eq!(one.status(), 200);
    assert_eq!(two.status(), 200);
    let one: Value = one.json().await.unwrap();
    let two: Value = two.json().await.unwrap();
    assert_eq!(one["id"], two["id"]);
    assert_ne!(one["replayed"], two["replayed"]);
    assert_eq!(one["revision"], 1);
    assert_eq!(two["revision"], 1);
    assert_eq!(
        f.docs
            .history(&token("alice"), one["id"].as_str().unwrap(), 0, 10)
            .await
            .unwrap()
            .len(),
        1
    );
}
