use super::*;
async fn call(f: &Fixture, user: &str, action: &str, body: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&body)
        .send()
        .await
        .unwrap()
}
async fn ok(f: &Fixture, user: &str, action: &str, body: Value) -> Value {
    let r = call(f, user, action, body).await;
    let status = r.status();
    let v: Value = r.json().await.unwrap();
    assert_eq!(status, 200, "{v}");
    v
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.sql("INSERT INTO aether_access.organizations VALUES('company','design','Design'); INSERT INTO aether_access.members VALUES('company','design','alice','member'),('company','design','bob','member'); INSERT INTO aether_access.workspaces VALUES('company','design-default','design',true,'Everyone'),('company','private','design',false,'Private');").await;
    f
}
fn favorite(op: &str, state: bool) -> Value {
    json!({"workspace":"design-default","operation_id":op,"favorite":state})
}
fn row(value: &Value, id: &str) -> Value {
    value["workspaces"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == id)
        .unwrap()
        .clone()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_preferences_are_personal_and_retries_do_not_rewind_later_choices() {
    let f = seed().await;
    f.docs
        .mutate(&token("alice"), &create("unchanged-file"))
        .await
        .unwrap();
    let first = ok(&f, "alice", "workspace_favorite", favorite("fav", true)).await;
    assert_eq!(first["applied_revision"], 1);
    assert_eq!(first["replayed"], false);
    assert_eq!(row(&first, "design-default")["favorite"], true);
    assert!(row(&first, "design-default")["opened"].is_null());
    let bob = ok(&f, "bob", "context", json!({})).await;
    assert_eq!(row(&bob, "design-default")["favorite"], false);
    assert_eq!(row(&bob, "design-default")["preference_revision"], 0);
    let opened = ok(
        &f,
        "alice",
        "workspace_open",
        json!({"workspace":"design-default","operation_id":"open"}),
    )
    .await;
    let time = row(&opened, "design-default")["opened"].as_f64().unwrap();
    assert!(time > 0.0);
    let second = ok(&f, "alice", "workspace_favorite", favorite("unfav", false)).await;
    assert_eq!(second["applied_revision"], 3);
    let replay = ok(&f, "alice", "workspace_favorite", favorite("fav", true)).await;
    assert_eq!(replay["replayed"], true);
    assert_eq!(replay["applied_revision"], 1);
    assert_eq!(row(&replay, "design-default")["favorite"], false);
    assert_eq!(row(&replay, "design-default")["preference_revision"], 3);
    assert_eq!(row(&replay, "design-default")["opened"], time);
    let replay = ok(
        &f,
        "alice",
        "workspace_open",
        json!({"workspace":"design-default","operation_id":"open"}),
    )
    .await;
    assert_eq!(row(&replay, "design-default")["opened"], time);
    assert_eq!(replay["applied_revision"], 2);
    let next = ok(
        &f,
        "alice",
        "workspace_open",
        json!({"workspace":"design-default","operation_id":"open-again"}),
    )
    .await;
    assert!(row(&next, "design-default")["opened"].as_f64().unwrap() > time);
    assert_eq!(
        f.docs
            .read(&token("alice"), "unchanged-file", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.workspace_preference_events",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        4
    );
    assert_eq!(
        c.query_one(
            "SELECT before_state FROM aether_access.workspace_preference_events WHERE revision=1",
            &[]
        )
        .await
        .unwrap()
        .get::<_, Value>(0),
        Value::Null
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_preferences_concurrent_replay_and_failed_audit_are_atomic() {
    let f = seed().await;
    let input = favorite("parallel", true);
    let (a, b) = tokio::join!(
        call(&f, "alice", "workspace_favorite", input.clone()),
        call(&f, "alice", "workspace_favorite", input)
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_ne!(a["replayed"], b["replayed"]);
    assert_eq!(a["applied_revision"], 1);
    assert_eq!(b["applied_revision"], 1);
    assert_eq!(
        call(
            &f,
            "alice",
            "workspace_favorite",
            favorite("parallel", false)
        )
        .await
        .status(),
        409
    );
    f.sql("CREATE FUNCTION reject_preference_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$; CREATE TRIGGER reject_preference_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_preference_audit()").await;
    assert_eq!(
        call(
            &f,
            "alice",
            "workspace_favorite",
            favorite("rollback", false)
        )
        .await
        .status(),
        503
    );
    assert_eq!(
        row(
            &ok(&f, "alice", "context", json!({})).await,
            "design-default"
        )["preference_revision"],
        1
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.workspace_preference_receipts",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    f.sql("DROP TRIGGER reject_preference_audit ON aether_access.audit")
        .await;
    assert_eq!(
        ok(
            &f,
            "alice",
            "workspace_favorite",
            favorite("rollback", false)
        )
        .await["applied_revision"],
        2
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_preferences_replay_rechecks_current_roles_and_redacts_newly_hidden_workspaces() {
    let f = seed().await;
    f.sql(
        "INSERT INTO aether_access.workspace_members VALUES('company','private','alice','viewer')",
    )
    .await;
    let first = ok(&f, "alice", "workspace_favorite", favorite("replay", true)).await;
    assert!(
        first["workspaces"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["id"] == "private")
    );
    f.sql("DELETE FROM aether_access.workspace_members WHERE tenant='company' AND workspace='private'").await;
    let replay = ok(&f, "alice", "workspace_favorite", favorite("replay", true)).await;
    assert!(
        !replay["workspaces"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["id"] == "private")
    );
    assert_eq!(
        call(
            &f,
            "alice",
            "workspace_open",
            json!({"workspace":"private","operation_id":"hidden"})
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        call(
            &f,
            "admin",
            "workspace_open",
            json!({"workspace":"private","operation_id":"admin-hidden"})
        )
        .await
        .status(),
        404
    );
    f.sql("DELETE FROM aether_access.members WHERE tenant='company' AND organization='design' AND user_id='alice'").await;
    assert_eq!(
        call(&f, "alice", "workspace_favorite", favorite("replay", true))
            .await
            .status(),
        404
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.workspace_preferences",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_preferences_strict_requests_and_limits_do_not_leave_partial_changes() {
    let f = seed().await;
    for value in [
        json!({"workspace":"design-default","favorite":true}),
        json!({"workspace":"design-default","operation_id":"bad"}),
        json!({"workspace":"design-default","operation_id":"bad","favorite":"yes"}),
        json!({"workspace":"design-default","operation_id":"bad","favorite":true,"user":"bob"}),
        json!({"workspace":"design-default","operation_id":"bad","favorite":true,"action":"workspace_open"}),
    ] {
        assert_eq!(
            call(&f, "alice", "workspace_favorite", value)
                .await
                .status(),
            400
        );
    }
    assert_eq!(
        call(&f, "alice", "workspace_open", favorite("bad-open", false))
            .await
            .status(),
        400
    );
    f.sql("INSERT INTO aether_access.workspace_preferences VALUES('company','alice','design-default',true,100,4294967295)").await;
    assert_eq!(
        call(
            &f,
            "alice",
            "workspace_favorite",
            favorite("overflow", false)
        )
        .await
        .status(),
        501
    );
    f.sql("UPDATE aether_access.workspace_preferences SET revision=0 WHERE tenant='company'; INSERT INTO aether_access.workspaces(tenant,id,organization,name) SELECT 'company','visible-'||n,'design','Workspace '||n FROM generate_series(1,1000)n; UPDATE aether_access.members SET role='owner' WHERE user_id='alice';").await;
    assert_eq!(
        call(
            &f,
            "alice",
            "workspace_favorite",
            favorite("too-many", false)
        )
        .await
        .status(),
        501
    );
    let c = f.pool.get().await.unwrap();
    let row = c
        .query_one(
            "SELECT favorite,revision FROM aether_access.workspace_preferences",
            &[],
        )
        .await
        .unwrap();
    assert!(row.get::<_, bool>(0));
    assert_eq!(row.get::<_, i64>(1), 0);
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.workspace_preference_receipts",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_preferences_schema8_upgrade_is_atomic_and_preserves_documents() {
    let f = seed().await;
    f.docs
        .mutate(&token("alice"), &create("kept"))
        .await
        .unwrap();
    let mut hash = Sha256::new();
    for sql in [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
        include_str!("../../src/documents/006-legacy-history.sql"),
        include_str!("../../src/documents/007-named-versions.sql"),
        include_str!("../../src/documents/008-collaboration.sql"),
    ] {
        hash.update(sql);
    }
    let checksum = format!("{:x}", hash.finalize());
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; DROP TABLE aether_access.legacy_file_metadata; DROP TABLE aether_access.workspace_preference_events,aether_access.workspace_preference_receipts,aether_access.workspace_preferences; UPDATE aether_access.schema_state SET version=8,checksum='{checksum}'; CREATE VIEW aether_access.workspace_preference_receipts AS SELECT 1 AS conflict")).await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        8
    );
    assert!(
        c.query_one(
            "SELECT to_regclass('aether_access.workspace_preferences')::text",
            &[]
        )
        .await
        .unwrap()
        .get::<_, Option<String>>(0)
        .is_none()
    );
    f.sql("DROP VIEW aether_access.workspace_preference_receipts")
        .await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(
        f.docs
            .read(&token("alice"), "kept", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    assert_eq!(
        ok(
            &f,
            "alice",
            "workspace_favorite",
            favorite("upgraded", true)
        )
        .await["applied_revision"],
        1
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_preferences_waiting_write_observes_revocation_without_receipt() {
    let f = seed().await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute("DELETE FROM aether_access.members WHERE tenant='company' AND organization='design' AND user_id='alice'", &[]).await.unwrap();
    let req = f
        .client
        .post(format!("{}/api/drive/workspace_favorite", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&favorite("queued", true));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    for table in [
        "workspace_preferences",
        "workspace_preference_receipts",
        "workspace_preference_events",
    ] {
        assert_eq!(
            c.query_one(&format!("SELECT count(*) FROM aether_access.{table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_preferences_matching_tenant_ids_cannot_read_or_rewrite_other_preferences() {
    let f = seed().await;
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('other','alice','Other Alice','unused','member',false); INSERT INTO aether_access.organizations VALUES('other','design','Other secret'); INSERT INTO aether_access.members VALUES('other','design','alice','owner'); INSERT INTO aether_access.workspaces VALUES('other','design-default','design',true,'Other workspace'); INSERT INTO aether_access.workspace_preferences VALUES('other','alice','design-default',true,123,0);").await;
    let before = ok(&f, "alice", "context", json!({})).await;
    assert_eq!(row(&before, "design-default")["favorite"], false);
    assert!(row(&before, "design-default")["opened"].is_null());
    let changed = ok(
        &f,
        "alice",
        "workspace_favorite",
        favorite("same-id", false),
    )
    .await;
    assert_eq!(changed["applied_revision"], 1);
    assert_eq!(row(&changed, "design-default")["favorite"], false);
    let c = f.pool.get().await.unwrap();
    let other=c.query_one("SELECT favorite,opened,revision FROM aether_access.workspace_preferences WHERE tenant='other'",&[]).await.unwrap();
    assert!(other.get::<_, bool>(0));
    assert_eq!(other.get::<_, f64>(1), 123.0);
    assert_eq!(other.get::<_, i64>(2), 0);
}
