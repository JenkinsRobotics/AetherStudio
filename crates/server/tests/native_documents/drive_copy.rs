use super::*;
async fn copy(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/copy", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
fn request(id: &str, op: &str) -> Value {
    json!({"id":id,"operation_id":op,"expected_revision":1,"expected_structure_revision":1,"destination":{"organization":"default"}})
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Folder")
        .await
        .unwrap();
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"new","document_id":"child","location":{"organization":"default","parent":"folder"},"change":{"kind":"create","app":"map","name":"Child","content_base64":"e30="}}))).await.unwrap();
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_copy_subtree_owns_new_files_with_current_bytes_and_no_copied_grants_or_history() {
    let f = seed().await;
    f.docs
        .mutate(&token("alice"), &save("child", "save-before-copy", 1))
        .await
        .unwrap();
    let input = request("folder", "copy-folder");
    let r = copy(&f, "bob", input.clone()).await;
    assert_eq!(r.status(), 200);
    let folder: Value = r.json().await.unwrap();
    assert_eq!(folder["name"], "Copy of Folder");
    assert_eq!(folder["owner_id"], "bob");
    let root = folder["id"].as_str().unwrap();
    let c = f.pool.get().await.unwrap();
    let child: String = c
        .query_one(
            "SELECT id FROM aether_access.resources WHERE parent=$1",
            &[&root],
        )
        .await
        .unwrap()
        .get(0);
    let saved = f.docs.read(&token("bob"), &child, None).await.unwrap();
    assert_eq!(saved.document.revision, 1);
    assert_eq!(saved.content_base64, "eyJhIjoyfQ==");
    assert!(f.docs.read(&token("alice"), &child, None).await.is_err());
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.grants", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    f.docs
        .mutate(&token("bob"), &save(&child, "edit-copy", 1))
        .await
        .unwrap();
    let replay: Value = copy(&f, "bob", input.clone()).await.json().await.unwrap();
    assert_eq!(replay["id"], folder["id"]);
    assert_eq!(replay["replayed"], true);
    assert_eq!(
        f.docs
            .read(&token("bob"), &child, None)
            .await
            .unwrap()
            .document
            .revision,
        2
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resources", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        4
    );
    f.docs
        .grant(&token("alice"), "folder", "bob", None)
        .await
        .unwrap();
    assert_eq!(copy(&f, "bob", input).await.status(), 404);
    assert!(f.docs.read(&token("bob"), &child, None).await.is_ok());
    assert_eq!(
        f.docs
            .read(&token("alice"), "child", None)
            .await
            .unwrap()
            .document
            .revision,
        2
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_copy_conflicts_permissions_and_audit_failure_leave_no_partial_subtree() {
    let f = seed().await;
    let mut input = request("folder", "copy");
    assert_eq!(copy(&f, "eve", input.clone()).await.status(), 404);
    input["expected_revision"] = json!(2);
    assert_eq!(copy(&f, "bob", input.clone()).await.status(), 409);
    input["expected_revision"] = json!(1);
    input["destination"]["parent"] = json!("folder");
    assert_eq!(copy(&f, "alice", input.clone()).await.status(), 400);
    input["destination"] = json!({"organization":"default"});
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(copy(&f, "bob", input.clone()).await.status(), 404);
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.sql("CREATE FUNCTION reject_copy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER reject_copy_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_copy_audit()").await;
    assert!(!copy(&f, "bob", input.clone()).await.status().is_success());
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resources", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
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
    f.sql("DROP TRIGGER reject_copy_audit ON aether_access.audit")
        .await;
    let (a, b) = tokio::join!(
        copy(&f, "bob", input.clone()),
        copy(&f, "bob", input.clone())
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_eq!(a["id"], b["id"]);
    assert_ne!(a["replayed"], b["replayed"]);
    input["operation_id"] = json!("another-copy");
    assert_eq!(copy(&f, "bob", input.clone()).await.status(), 409);
    input["operation_id"] = json!("copy");
    input["name"] = json!("Changed request");
    assert_eq!(copy(&f, "bob", input).await.status(), 409);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_copy_preserves_verified_attachment_bytes_but_refuses_missing_backing_files() {
    use aether_protocol_core::storage::{DocumentChange, DocumentMutation};
    use aether_server::attachments::Attachments;
    use aether_store::hosted::AuthorizedScope;
    use base64::{Engine, engine::general_purpose::STANDARD};
    let f = seed().await;
    let root = tempfile::tempdir().unwrap();
    let bytes = b"original attachment bytes";
    let digest = format!("{:x}", Sha256::digest(bytes));
    std::fs::write(root.path().join(&digest), bytes).unwrap();
    let attachments = Attachments::load(root.path()).unwrap();
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
                    name: "Image.png".into(),
                    content_base64: STANDARD.encode(
                        serde_json::to_vec(&json!({"aether_drive_blob":digest,"size":bytes.len()}))
                            .unwrap(),
                    ),
                },
            },
        )
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,parent) VALUES('company','image','default','alice','document','drive','folder')").await;
    let input = request("image", "image-copy");
    assert_eq!(copy(&f, "bob", input.clone()).await.status(), 503);
    let result = f
        .docs
        .drive_copy(
            &token("bob"),
            &serde_json::from_value(input).unwrap(),
            Some(&attachments),
        )
        .await
        .unwrap();
    let id = result["id"].as_str().unwrap();
    let copied = f
        .docs
        .download(&token("bob"), id, None, Some(&attachments))
        .await
        .unwrap();
    let length = copied.content.len();
    assert_eq!(
        &axum::body::to_bytes(copied.content.body(0, length), length)
            .await
            .unwrap()[..],
        bytes
    );
    assert!(
        f.docs
            .download(&token("eve"), id, None, Some(&attachments))
            .await
            .is_err()
    );
    assert_eq!(
        f.docs
            .read(&token("bob"), id, None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_copy_excludes_trash_and_refuses_oversized_trees_without_partial_success() {
    let f = seed().await;
    f.docs
        .create_named_folder(
            &token("alice"),
            "trash",
            &Location {
                organization: "default".into(),
                workspace: None,
                parent: Some("folder".into()),
            },
            "Trash",
        )
        .await
        .unwrap();
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE id='trash'")
        .await;
    let response = copy(&f, "alice", request("folder", "without-trash")).await;
    assert_eq!(response.status(), 200);
    let root = response.json::<Value>().await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.resources WHERE parent=$1",
            &[&root]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,parent,folder_name) SELECT 'company','many-'||i,'default','alice','folder','drive','folder','Folder '||i FROM generate_series(1,256) i").await;
    let before: i64 = c
        .query_one("SELECT count(*) FROM aether_access.resources", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(
        copy(&f, "alice", request("folder", "too-many"))
            .await
            .status(),
        501
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resources", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        before
    );
}
