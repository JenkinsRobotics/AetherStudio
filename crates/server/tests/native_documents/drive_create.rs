use super::*;
async fn create(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/create", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn applied(f: &Fixture, input: Value) -> Value {
    let r = create(f, "alice", input).await;
    assert_eq!(r.status(), 200);
    r.json().await.unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_create_retries_keep_one_document_and_acknowledge_later_names_and_location() {
    let f = Fixture::new().await;
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"enroll","document_id":"existing","change":{"kind":"create","app":"map","name":"Existing","content_base64":"e30="}}))).await.unwrap();
    let input = json!({"operation_id":"text-create","kind":"file","app":"drive","name":"Text.txt","data_base64":"SGVsbG8="});
    let a = applied(&f, input.clone()).await;
    assert_eq!(a["revision"], 1);
    assert_eq!(a["size"], 5);
    assert_eq!(a["replayed"], false);
    let b = applied(&f, input.clone()).await;
    assert_eq!(a["id"], b["id"]);
    assert_eq!(b["replayed"], true);
    assert_eq!(create(&f,"alice",json!({"operation_id":"text-create","kind":"file","app":"drive","name":"Other.txt","data_base64":"SGVsbG8="})).await.status(),409);
    let id = a["id"].as_str().unwrap();
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"rename-text","document_id":id,"change":{"kind":"rename","name":"Later.txt","expected_revision":1}}))).await.unwrap();
    f.docs
        .create_named_folder(
            &token("alice"),
            "destination",
            &Location::default(),
            "Folder",
        )
        .await
        .unwrap();
    assert_eq!(f.post("alice","resource-change",json!({"operation_id":"move-text","id":id,"expected_structure_revision":1,"change":{"kind":"move","destination":{"organization":"default","parent":"destination"}}})).await.status(),200);
    let replay = applied(&f, input).await;
    assert_eq!(replay["name"], "Later.txt");
    assert_eq!(replay["parent"], "destination");
    assert_eq!(replay["revision"], 2);
    assert_eq!(
        f.docs
            .read(&token("alice"), id, None)
            .await
            .unwrap()
            .content_base64,
        "SGVsbG8="
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        3
    );
    let bytes:i32=c.query_one("SELECT octet_length(request::text) FROM aether_access.resource_receipts WHERE operation_id='text-create'",&[]).await.unwrap().get(0);
    assert!(bytes < 256);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_create_folder_concurrency_and_audit_failure_never_create_duplicate_or_partial_items()
{
    let f = Fixture::new().await;
    f.docs
        .create_folder(&token("alice"), "existing", &Location::default())
        .await
        .unwrap();
    let input = json!({"operation_id":"folder-create","kind":"folder","name":"New folder"});
    let (a, b) = tokio::join!(
        create(&f, "alice", input.clone()),
        create(&f, "alice", input.clone())
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_eq!(a["id"], b["id"]);
    assert_ne!(a["replayed"], b["replayed"]);
    assert_eq!(a["kind"], "folder");
    f.sql("CREATE FUNCTION reject_create_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER reject_create_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_create_audit()").await;
    let next = json!({"operation_id":"audit-fail","kind":"folder","name":"Should roll back"});
    assert!(
        !create(&f, "alice", next.clone())
            .await
            .status()
            .is_success()
    );
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_access.resources", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
    f.sql("DROP TRIGGER reject_create_audit ON aether_access.audit")
        .await;
    assert_eq!(applied(&f, next).await["replayed"], false);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_create_enforces_destination_current_permissions_names_and_private_attachment_boundary()
 {
    let f = Fixture::new().await;
    f.docs
        .create_folder(&token("alice"), "parent", &Location::default())
        .await
        .unwrap();
    let input = json!({"operation_id":"child","kind":"folder","name":"Child","parent":"parent"});
    assert_eq!(create(&f, "eve", input.clone()).await.status(), 404);
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "parent", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(create(&f, "bob", input.clone()).await.status(), 404);
    let child = applied(&f, input.clone()).await;
    assert_eq!(child["parent"], "parent");
    assert_eq!(
        create(
            &f,
            "alice",
            json!({"operation_id":"collision","kind":"file","name":"child","parent":"parent"})
        )
        .await
        .status(),
        409
    );
    for bad in [
        json!({"operation_id":"folder-content","kind":"folder","name":"No loss","data_base64":"SGVsbG8="}),
        json!({"operation_id":"invalid-base64","name":"Bad","data_base64":"%%%"}),
        json!({"operation_id":"spoof","name":"No","actor":"bob"}),
    ] {
        assert_eq!(create(&f, "alice", bad).await.status(), 400);
    }
    use base64::Engine;
    let descriptor =
        base64::engine::general_purpose::STANDARD.encode(b"{\"aether_drive_blob\":\"forged\"}");
    assert_eq!(
        create(
            &f,
            "alice",
            json!({"operation_id":"descriptor","name":"Forged","data_base64":descriptor})
        )
        .await
        .status(),
        501
    );
    f.docs
        .set_organization_member(&token("admin"), "default", "alice", None)
        .await
        .unwrap();
    assert_eq!(create(&f, "alice", input).await.status(), 404);
}
