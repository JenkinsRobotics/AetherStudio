use super::*;

async fn seed(f: &Fixture) {
    f.docs
        .mutate(&token("alice"), &create("restore-file"))
        .await
        .unwrap();
    f.docs
        .mutate(&token("alice"), &save("restore-file", "second", 1))
        .await
        .unwrap();
    f.docs.mutate(&token("alice"), &mutation(json!({"operation_id":"rename","document_id":"restore-file","change":{"kind":"rename","expected_revision":2,"name":"Current name"}}))).await.unwrap();
}
fn input(operation: &str) -> Value {
    json!({"app":"map","id":"restore-file","operation_id":operation,"expected_revision":3,"revision":1,"branch":"Main"})
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn legacy_restore_keeps_current_name_appends_history_and_replays_exactly() {
    let f = Fixture::new().await;
    seed(&f).await;
    let original = f
        .docs
        .read(&token("alice"), "restore-file", Some(1))
        .await
        .unwrap();
    let before = f
        .docs
        .read(&token("alice"), "restore-file", Some(3))
        .await
        .unwrap();
    let response = f.library("alice", "restore", input("restore")).await;
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.json::<Value>().await.unwrap(),
        json!({"ok":true,"revision":4,"branch":"Main","replayed":false})
    );
    let current = f
        .docs
        .read(&token("alice"), "restore-file", None)
        .await
        .unwrap();
    assert_eq!(current.content_base64, original.content_base64);
    assert_eq!(current.document.name, "Current name");
    assert_eq!(current.document.parent_revision, Some(3));
    assert_eq!(current.document.restored_from_revision, Some(1));
    assert_eq!(
        f.docs
            .read(&token("alice"), "restore-file", Some(3))
            .await
            .unwrap()
            .document,
        before.document
    );
    let history: Value = f
        .library("alice", "history", json!({"app":"map","id":"restore-file"}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(history["revisions"].as_array().unwrap().len(), 4);
    assert_eq!(history["revisions"][0]["note"], "Restored revision 1");
    assert_eq!(history["revisions"][0]["event"], "restore");
    f.docs
        .mutate(&token("alice"), &save("restore-file", "later", 4))
        .await
        .unwrap();
    let replay: Value = f
        .library("alice", "restore", input("restore"))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(
        replay,
        json!({"ok":true,"revision":4,"branch":"Main","replayed":true})
    );
    assert_eq!(
        f.docs
            .read(&token("alice"), "restore-file", None)
            .await
            .unwrap()
            .document
            .revision,
        5
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.library_recents", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn restore_guard_concurrency_and_reused_operation_cannot_overwrite_later_work() {
    let f = Fixture::new().await;
    seed(&f).await;
    let (a, b) = tokio::join!(
        f.library("alice", "restore", input("same")),
        f.library("alice", "restore", input("same"))
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let mut flags = vec![
        a.json::<Value>().await.unwrap()["replayed"]
            .as_bool()
            .unwrap(),
        b.json::<Value>().await.unwrap()["replayed"]
            .as_bool()
            .unwrap(),
    ];
    flags.sort();
    assert_eq!(flags, vec![false, true]);
    assert_eq!(
        f.library("alice", "restore", input("stale")).await.status(),
        409
    );
    let mut altered = input("same");
    altered["revision"] = json!(2);
    assert_eq!(f.library("alice", "restore", altered).await.status(), 409);
    for (key, value, status) in [
        ("branch", json!("Other"), 501),
        ("revision", json!(0), 400),
        ("revision", json!("1"), 400),
        ("preserve_name", json!(false), 400),
    ] {
        let mut bad = input("bad");
        bad[key] = value;
        assert_eq!(f.library("alice", "restore", bad).await.status(), status);
    }
    let mut missing = input("missing");
    missing["revision"] = json!(999);
    missing["expected_revision"] = json!(4);
    assert_eq!(f.library("alice", "restore", missing).await.status(), 404);
    assert_eq!(
        f.docs
            .read(&token("alice"), "restore-file", None)
            .await
            .unwrap()
            .document
            .revision,
        4
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn restore_rechecks_edit_permission_and_failed_audit_rolls_back() {
    let f = Fixture::new().await;
    seed(&f).await;
    for user in ["bob", "admin"] {
        assert_eq!(
            f.library(user, "restore", input("denied")).await.status(),
            404
        );
    }
    f.docs
        .grant(&token("alice"), "restore-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "restore", input("denied")).await.status(),
        404
    );
    f.docs
        .grant(&token("alice"), "restore-file", "bob", Some(Role::Editor))
        .await
        .unwrap();
    f.sql("CREATE FUNCTION aether_store.fail_restore_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER fail_restore BEFORE INSERT ON aether_store.audit FOR EACH ROW EXECUTE FUNCTION aether_store.fail_restore_audit()").await;
    assert_eq!(
        f.library("bob", "restore", input("rollback"))
            .await
            .status(),
        503
    );
    assert_eq!(
        f.docs
            .read(&token("alice"), "restore-file", None)
            .await
            .unwrap()
            .document
            .revision,
        3
    );
    f.sql("DROP TRIGGER fail_restore ON aether_store.audit")
        .await;
    assert_eq!(
        f.library("bob", "restore", input("rollback"))
            .await
            .status(),
        200
    );
    f.docs
        .grant(&token("alice"), "restore-file", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "restore", input("rollback"))
            .await
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        f.library("alice", "restore", input("later")).await.status(),
        404
    );
}
