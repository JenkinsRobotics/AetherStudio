use super::*;

async fn fixture() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("version-file"))
        .await
        .unwrap();
    f
}
fn request(op: &str, name: &str) -> Value {
    json!({"app":"map","id":"version-file","operation_id":op,"expected_revision":1,"name":name,"branch":"Main"})
}
async fn versions(f: &Fixture) -> Value {
    let r = f
        .library("alice", "history", json!({"app":"map","id":"version-file"}))
        .await;
    assert_eq!(r.status(), 200);
    r.json::<Value>().await.unwrap()["versions"].clone()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn named_versions_create_rename_remove_preserve_content_and_record_counts() {
    let f = fixture().await;
    let mut input = request("v1", "  V1  ");
    input["message"] = json!(" First checkpoint \n");
    let r = f.library("alice", "version", input.clone()).await;
    assert_eq!(r.status(), 200);
    assert_eq!(
        r.json::<Value>().await.unwrap(),
        json!({"ok":true,"revision":1,"replayed":false})
    );
    let history = versions(&f).await;
    let row = &history[0];
    assert_eq!(row["name"], "V1");
    assert_eq!(row["message"], "First checkpoint");
    assert_eq!(row["revision"], 1);
    assert_eq!(row["status"], "version");
    assert_eq!(row["origin"], "user");
    assert_eq!(row["branch"], "Main");
    assert_eq!(row["status_updated"], 0.0);
    assert_eq!(row["status_note"], "");
    assert!(row["created"].as_f64().unwrap() > 0.0);
    assert_eq!(row.as_object().unwrap().len(), 9);
    let listing: Value = f
        .library("alice", "list", json!({"app":"map"}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(listing["files"][0]["versions"], 1);
    assert_eq!(listing["files"][0]["latest_version"], "V1");
    assert_eq!(listing["capabilities"]["named_versions"], true);
    let mut rename = request("rename-version", "V1");
    rename["new_name"] = json!("Release draft");
    assert_eq!(
        f.library("alice", "version_update", rename.clone())
            .await
            .status(),
        200
    );
    let renamed = versions(&f).await;
    assert_eq!(renamed[0]["name"], "Release draft");
    assert_eq!(renamed[0]["message"], row["message"]);
    assert_eq!(renamed[0]["created"], row["created"]);
    let delete = request("delete-version", "Release draft");
    assert_eq!(
        f.library("alice", "version_delete", delete.clone())
            .await
            .status(),
        200
    );
    assert_eq!(versions(&f).await, json!([]));
    for (action, body) in [
        ("version", input),
        ("version_update", rename),
        ("version_delete", delete),
    ] {
        let r = f.library("alice", action, body).await;
        assert_eq!(r.status(), 200);
        assert_eq!(r.json::<Value>().await.unwrap()["replayed"], true);
    }
    assert_eq!(versions(&f).await, json!([]));
    let current = f
        .docs
        .read(&token("alice"), "version-file", None)
        .await
        .unwrap();
    assert_eq!(current.document.revision, 1);
    assert_eq!(current.content_base64, "e30=");
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.version_events", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        3
    );
    let removed: Value = c.query_one("SELECT before_state FROM aether_access.version_events WHERE operation_id='delete-version'", &[]).await.unwrap().get(0);
    assert_eq!(removed["author"], "alice");
    assert_eq!(removed["name"], "Release draft");
    assert_eq!(removed["revision"], 1);
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
async fn named_version_concurrency_guards_replay_and_failed_audit_are_atomic() {
    let f = fixture().await;
    let (a, b) = tokio::join!(
        f.library("alice", "version", request("same", "V1")),
        f.library("alice", "version", request("same", "V1"))
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let mut replay = vec![
        a.json::<Value>().await.unwrap()["replayed"]
            .as_bool()
            .unwrap(),
        b.json::<Value>().await.unwrap()["replayed"]
            .as_bool()
            .unwrap(),
    ];
    replay.sort();
    assert_eq!(replay, vec![false, true]);
    assert_eq!(
        f.library("alice", "version", request("same", "V2"))
            .await
            .status(),
        409
    );
    assert_eq!(
        f.library("alice", "version", request("different", "V1"))
            .await
            .status(),
        409
    );
    f.docs
        .mutate(&token("alice"), &save("version-file", "saved", 1))
        .await
        .unwrap();
    assert_eq!(
        f.library("alice", "version", request("stale", "V2"))
            .await
            .status(),
        409
    );
    assert_eq!(
        f.library("alice", "version", request("same", "V1"))
            .await
            .status(),
        200
    );
    f.sql("CREATE FUNCTION aether_access.fail_version_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER fail_version BEFORE INSERT ON aether_access.version_events FOR EACH ROW EXECUTE FUNCTION aether_access.fail_version_audit()").await;
    let mut next = request("rollback", "V2");
    next["expected_revision"] = json!(2);
    assert_eq!(
        f.library("alice", "version", next.clone()).await.status(),
        503
    );
    assert_eq!(versions(&f).await.as_array().unwrap().len(), 1);
    f.sql("DROP TRIGGER fail_version ON aether_access.version_events")
        .await;
    assert_eq!(f.library("alice", "version", next).await.status(), 200);
    assert_eq!(versions(&f).await.as_array().unwrap().len(), 2);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn named_version_permissions_release_records_and_invalid_inputs_are_guarded() {
    let f = fixture().await;
    for user in ["bob", "admin"] {
        assert_eq!(
            f.library(user, "version", request("denied", "V1"))
                .await
                .status(),
            404
        );
    }
    f.docs
        .grant(&token("alice"), "version-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "version", request("denied", "V1"))
            .await
            .status(),
        404
    );
    f.docs
        .grant(&token("alice"), "version-file", "bob", Some(Role::Editor))
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "version", request("owned-op", "V1"))
            .await
            .status(),
        200
    );
    f.docs
        .grant(&token("alice"), "version-file", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "version", request("owned-op", "V1"))
            .await
            .status(),
        404
    );
    for (key, value, status) in [
        ("name", json!(" "), 400),
        ("name", json!("x".repeat(81)), 400),
        ("message", json!("x".repeat(501)), 400),
        ("branch", json!("Other"), 501),
        ("new_name", json!("ignored"), 400),
        ("actor", json!("admin"), 400),
    ] {
        let mut bad = request("bad", "V2");
        bad[key] = value;
        assert_eq!(f.library("alice", "version", bad).await.status(), status);
    }
    f.sql("UPDATE aether_access.named_versions SET status='released' WHERE name='V1'")
        .await;
    assert_eq!(
        f.library("alice", "version_delete", request("delete", "V1"))
            .await
            .status(),
        409
    );
    assert_eq!(
        f.library("alice", "version_update", request("rename", "V1"))
            .await
            .status(),
        409
    );
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(
        f.library("alice", "version", request("forced", "V2"))
            .await
            .status(),
        403
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn named_version_schema6_upgrade_rolls_back_failed_ddl_and_preserves_history() {
    let f = fixture().await;
    let mut hash = Sha256::new();
    for sql in [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
        include_str!("../../src/documents/006-legacy-history.sql"),
    ] {
        hash.update(sql);
    }
    let checksum = format!("{:x}", hash.finalize());
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; DROP TABLE aether_access.legacy_file_metadata; DROP TABLE aether_access.workspace_preference_events,aether_access.workspace_preference_receipts,aether_access.workspace_preferences; DROP TABLE aether_access.collaboration_events,aether_access.collaboration_receipts,aether_access.collaboration_items,aether_access.collaboration_heads; DROP TABLE aether_access.version_events,aether_access.version_receipts,aether_access.named_versions; UPDATE aether_access.schema_state SET version=6,checksum='{checksum}'; CREATE VIEW aether_access.named_versions AS SELECT 1 AS conflict")).await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        6
    );
    f.sql("DROP VIEW aether_access.named_versions").await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    assert_eq!(versions(&f).await, json!([]));
    assert_eq!(
        f.docs
            .read(&token("alice"), "version-file", Some(1))
            .await
            .unwrap()
            .content_base64,
        "e30="
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn named_versions_are_tenant_isolated_and_large_lists_fail_explicitly() {
    let f = fixture().await;
    assert_eq!(
        f.library("alice", "version", request("same", "Company checkpoint"))
            .await
            .status(),
        200
    );
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
    let mut body = request("same", "Other checkpoint");
    body["action"] = json!("version");
    let input = serde_json::from_value(body).unwrap();
    assert!(matches!(
        other.change_named_version(&token("alice"), &input).await,
        Err(Error::Denied)
    ));
    other
        .mutate(&token("alice"), &create("version-file"))
        .await
        .unwrap();
    assert_eq!(
        other
            .change_named_version(&token("alice"), &input)
            .await
            .unwrap()["replayed"],
        false
    );
    assert_eq!(versions(&f).await[0]["name"], "Company checkpoint");
    // Populate labels on a real immutable revision; no content or history is fabricated.
    f.sql("INSERT INTO aether_access.named_versions SELECT 'company','version-file','checkpoint-'||i,1,'alice',i,'','version','user',0,'','Main',NULL FROM generate_series(1,999) i").await;
    assert_eq!(versions(&f).await.as_array().unwrap().len(), 1000);
    assert_eq!(
        f.library("alice", "version", request("over-limit", "overflow"))
            .await
            .status(),
        501
    );
    f.sql("INSERT INTO aether_access.named_versions VALUES('company','version-file','outside-qualified-limit',1,'alice',0,'','version','user',0,'','Main',NULL)").await;
    assert_eq!(
        f.library("alice", "history", json!({"app":"map","id":"version-file"}))
            .await
            .status(),
        501
    );
    let listing: Value = f
        .library("alice", "list", json!({"app":"map"}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(listing["files"][0]["versions"], 1001);
    assert_eq!(listing["files"][0]["latest_version"], "Company checkpoint");
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn named_versions_queued_before_revocation_do_not_use_stale_permission() {
    let f = fixture().await;
    f.docs
        .grant(&token("alice"), "version-file", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='version-file' AND user_id='bob'",&[]).await.unwrap();
    let client = f.client.clone();
    let url = f.url.clone();
    let pending = tokio::spawn(async move {
        client
            .post(format!("{url}/api/library/version"))
            .header("origin", &url)
            .header("cookie", format!("{COOKIE}={}", token("bob")))
            .json(&request("queued", "Never created"))
            .send()
            .await
            .unwrap()
    });
    f.waiting("pg_advisory_xact_lock").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    assert_eq!(versions(&f).await, json!([]));
}
