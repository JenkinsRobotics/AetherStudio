use super::*;

async fn history(f: &Fixture, user: &str, id: &str) -> reqwest::Response {
    f.library(user, "history", json!({"app":"map","id":id}))
        .await
}
async fn seed(f: &Fixture) {
    f.docs
        .mutate(&token("alice"), &create("history-file"))
        .await
        .unwrap();
    f.docs
        .mutate(&token("alice"), &save("history-file", "second", 1))
        .await
        .unwrap();
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"rename","document_id":"history-file","change":{"kind":"rename","expected_revision":2,"name":"New name"}}))).await.unwrap();
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn history_lists_descending_and_opens_immutable_content_without_writes() {
    let f = Fixture::new().await;
    seed(&f).await;
    f.sql("UPDATE aether_identity.users SET full_name='Alice Example' WHERE id='alice'")
        .await;
    let response = history(&f, "alice", "history-file").await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let value: Value = response.json().await.unwrap();
    assert_eq!(value["writable"], true);
    assert_eq!(value["scope"], "personal");
    assert_eq!(value["versions"], json!([]));
    assert_eq!(
        value["branches"],
        json!([{"name":"Main","head_revision":3,"created_from":null,"created":null}])
    );
    let rows = value["revisions"].as_array().unwrap();
    assert_eq!(rows.len(), 3);
    for (index, r) in rows.iter().enumerate() {
        assert_eq!(r["revision"], 3 - index);
        assert_eq!(r["author"], "Alice Example");
        assert_eq!(r["branch"], "Main");
        assert_eq!(r["note"], "");
        assert_eq!(r["merge_parent_revision"], Value::Null);
        assert_eq!(r["blob_hash"].as_str().unwrap().len(), 64);
        assert_eq!(r.as_object().unwrap().len(), 10);
    }
    assert_eq!(rows[0]["parent_revision"], 2);
    assert_eq!(rows[2]["parent_revision"], Value::Null);
    assert_eq!(rows[0]["event"], "rename");
    let response = f
        .library(
            "alice",
            "read_revision",
            json!({"app":"map","id":"history-file","revision":1}),
        )
        .await;
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.json::<Value>().await.unwrap(),
        json!({"id":"history-file","name":"Show","revision":1,"data_base64":"e30=","writable":false})
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.library_recents", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    assert_eq!(
        f.docs
            .read(&token("alice"), "history-file", None)
            .await
            .unwrap()
            .document
            .revision,
        3
    );
    // Listing uses revision metadata only. Missing content breaks opening, not
    // the ability to inspect the retained history metadata for recovery.
    std::fs::remove_dir_all(f._objects.path().join("v1")).unwrap();
    assert_eq!(history(&f, "alice", "history-file").await.status(), 200);
    assert!(
        !f.library(
            "alice",
            "read_revision",
            json!({"app":"map","id":"history-file","revision":1})
        )
        .await
        .status()
        .is_success()
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn history_current_permissions_app_and_revocation_guard_every_read() {
    let f = Fixture::new().await;
    seed(&f).await;
    for who in ["bob", "admin"] {
        assert_eq!(history(&f, who, "history-file").await.status(), 404);
    }
    f.docs
        .grant(&token("alice"), "history-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        history(&f, "bob", "history-file")
            .await
            .json::<Value>()
            .await
            .unwrap()["writable"],
        false
    );
    assert_eq!(
        f.library(
            "bob",
            "read_revision",
            json!({"app":"map","id":"history-file","revision":1})
        )
        .await
        .status(),
        200
    );
    f.docs
        .grant(&token("alice"), "history-file", "bob", None)
        .await
        .unwrap();
    assert_eq!(history(&f, "bob", "history-file").await.status(), 404);
    assert_eq!(
        f.library("alice", "history", json!({"app":"cad","id":"history-file"}))
            .await
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(history(&f, "alice", "history-file").await.status(), 404);
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(history(&f, "alice", "history-file").await.status(), 403);
    f.sql("UPDATE aether_identity.users SET must_change=false WHERE id='alice'")
        .await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
        &[],
    )
    .await
    .unwrap();
    let docs = f.docs.clone();
    let pending = tokio::spawn(async move {
        docs.library(
            &token("alice"),
            &serde_json::from_value(json!({"action":"history","app":"map","id":"history-file"}))
                .unwrap(),
        )
        .await
    });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062603))")
        .await;
    tx.execute(
        "DELETE FROM aether_identity.sessions WHERE user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(
        pending.await.unwrap(),
        Err(Error::Identity(aether_identity::Error::Unauthorized))
    ));
    assert_eq!(history(&f, "alice", "history-file").await.status(), 401);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn history_import_notes_are_exact_and_missing_import_details_fail_closed() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("history-file"))
        .await
        .unwrap();
    let imported = format!(
        "legacy-{:x}",
        Sha256::digest(serde_json::to_vec(&("history-file", 1)).unwrap())
    );
    let c = f.pool.get().await.unwrap();
    c.execute("UPDATE aether_store.revisions SET metadata=jsonb_set(metadata,'{operation_id}',to_jsonb($1::text)) WHERE document_id='history-file'",&[&imported]).await.unwrap();
    assert_eq!(history(&f, "alice", "history-file").await.status(), 503);
    c.execute("INSERT INTO aether_access.legacy_history_annotations VALUES('company','history-file',1,$1,$2,NULL)",&[&"Original note — preserved",&1700000000.1234567_f64]).await.unwrap();
    let body: Value = history(&f, "alice", "history-file")
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(body["revisions"][0]["note"], "Original note — preserved");
    assert_eq!(
        body["revisions"][0]["saved"].as_f64().unwrap(),
        1700000000.1234567_f64
    );
    assert_eq!(body["revisions"][0]["parent_revision"], Value::Null);
    // Incomplete imported metadata is never silently replaced by an empty note.
    f.sql("DELETE FROM aether_access.legacy_history_annotations")
        .await;
    assert_eq!(history(&f, "alice", "history-file").await.status(), 503);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn history_refuses_unsupported_branches_invalid_inputs_and_partial_large_lists() {
    let f = Fixture::new().await;
    seed(&f).await;
    for action in ["history", "read_revision"] {
        let mut value = json!({"app":"map","id":"history-file","branch":"Other"});
        if action == "read_revision" {
            value["revision"] = json!(1);
        }
        assert_eq!(f.library("alice", action, value).await.status(), 501);
    }
    for revision in [json!(0), json!(-1), json!(1.5), json!("1"), Value::Null] {
        assert_eq!(
            f.library(
                "alice",
                "read_revision",
                json!({"app":"map","id":"history-file","revision":revision})
            )
            .await
            .status(),
            400
        );
    }
    assert_eq!(
        f.library(
            "alice",
            "read_revision",
            json!({"app":"map","id":"history-file","revision":999})
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        f.library(
            "alice",
            "history",
            json!({"app":"map","id":"history-file","actor":"admin"})
        )
        .await
        .status(),
        400
    );
    // Canonical native writes build a real bounded-history edge, preserving all
    // operations/events. The legacy API must refuse instead of dropping old rows.
    for revision in 4..=1001 {
        f.docs
            .mutate(
                &token("alice"),
                &save("history-file", &format!("save-{revision}"), revision - 1),
            )
            .await
            .unwrap();
        if revision == 1000 {
            let response = history(&f, "alice", "history-file").await;
            assert_eq!(response.status(), 200);
            assert_eq!(
                response.json::<Value>().await.unwrap()["revisions"]
                    .as_array()
                    .unwrap()
                    .len(),
                1000
            );
        }
    }
    let response = history(&f, "alice", "history-file").await;
    assert_eq!(response.status(), 501);
    let body: Value = response.json().await.unwrap();
    assert!(body.get("revisions").is_none());
    assert_eq!(
        f.docs
            .history(&token("alice"), "history-file", 1000, 1)
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        f.library(
            "alice",
            "read_revision",
            json!({"app":"map","id":"history-file","revision":1})
        )
        .await
        .status(),
        200
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn history_schema5_upgrade_and_failed_ddl_preserve_documents() {
    let f = Fixture::new().await;
    seed(&f).await;
    let mut hash = Sha256::new();
    for sql in [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
    ] {
        hash.update(sql);
    }
    let checksum = format!("{:x}", hash.finalize());
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; DROP TABLE aether_access.legacy_file_metadata; DROP TABLE aether_access.workspace_preference_events,aether_access.workspace_preference_receipts,aether_access.workspace_preferences; DROP TABLE aether_access.collaboration_events,aether_access.collaboration_receipts,aether_access.collaboration_items,aether_access.collaboration_heads; DROP TABLE aether_access.version_events,aether_access.version_receipts,aether_access.named_versions; DROP TABLE aether_access.legacy_history_annotations; UPDATE aether_access.schema_state SET version=5,checksum='{checksum}'; CREATE VIEW aether_access.legacy_history_annotations AS SELECT 1 AS conflict")).await;
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
        5
    );
    f.sql("DROP VIEW aether_access.legacy_history_annotations")
        .await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(
        history(&f, "alice", "history-file")
            .await
            .json::<Value>()
            .await
            .unwrap()["revisions"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    assert_eq!(
        f.docs
            .read(&token("alice"), "history-file", Some(1))
            .await
            .unwrap()
            .content_base64,
        "e30="
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn history_same_document_id_and_actor_are_isolated_between_tenants() {
    let f = Fixture::new().await;
    seed(&f).await;
    f.sql("INSERT INTO aether_identity.users SELECT 'other',id,username,password,role,active,must_change,full_name,email,email_verified FROM aether_identity.users; INSERT INTO aether_identity.sessions SELECT 'other',token_hash,user_id,created,expires FROM aether_identity.sessions").await;
    let identity = Identity::new(f.pool.clone(), "other", 2).unwrap();
    let docs = Documents::new(
        f.pool.clone(),
        identity,
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    docs.configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    docs.mutate(&token("alice"), &create("history-file"))
        .await
        .unwrap();
    let request =
        serde_json::from_value(json!({"action":"history","app":"map","id":"history-file"}))
            .unwrap();
    assert_eq!(
        docs.library(&token("alice"), &request).await.unwrap()["revisions"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        history(&f, "alice", "history-file")
            .await
            .json::<Value>()
            .await
            .unwrap()["revisions"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
}
