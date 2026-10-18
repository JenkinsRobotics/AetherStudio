use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};

async fn seed(f: &Fixture) {
    f.docs
        .mutate(&token("alice"), &create("compare-file"))
        .await
        .unwrap();
    let change = mutation(
        json!({"operation_id":"compare-save","document_id":"compare-file","change":{"kind":"save","expected_revision":1,"content_base64":STANDARD.encode(b"{\"text\":\"updated\"}")}}),
    );
    f.docs.mutate(&token("alice"), &change).await.unwrap();
    f.docs.mutate(&token("alice"), &mutation(json!({"operation_id":"compare-rename","document_id":"compare-file","change":{"kind":"rename","expected_revision":2,"name":"Renamed"}}))).await.unwrap();
}
async fn compare(f: &Fixture, who: &str, from: u32, to: u32) -> reqwest::Response {
    f.library(
        who,
        "compare",
        json!({"app":"map","id":"compare-file","from":from,"to":to}),
    )
    .await
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn compare_reports_immutable_content_paths_and_has_no_writes() {
    let f = Fixture::new().await;
    seed(&f).await;
    let response = compare(&f, "alice", 1, 3).await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let value: Value = response.json().await.unwrap();
    assert_eq!(value["base"], 1);
    assert_eq!(value["same_content"], false);
    assert_eq!(value["from_only"], json!([]));
    assert_eq!(value["to_only"].as_array().unwrap().len(), 2);
    assert_eq!(value["to_only"][0]["revision"], 3);
    assert_eq!(value["to_only"][1]["event"], "save");
    assert_eq!(value["features"], Value::Null);
    assert!(
        value["content_diff"]["text"]
            .as_str()
            .unwrap()
            .contains("updated")
    );
    let same: Value = compare(&f, "alice", 2, 3).await.json().await.unwrap();
    assert_eq!(same["same_content"], true);
    assert_eq!(same["base"], 2);
    let reverse: Value = compare(&f, "alice", 3, 1).await.json().await.unwrap();
    assert_eq!(reverse["from_only"], value["to_only"]);
    assert_eq!(reverse["to_only"], json!([]));
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        3
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.library_recents", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resource_receipts", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    std::fs::remove_dir_all(f._objects.path().join("v1")).unwrap();
    assert!(!compare(&f, "alice", 1, 3).await.status().is_success());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn compare_rechecks_permissions_app_membership_and_strict_inputs() {
    let f = Fixture::new().await;
    seed(&f).await;
    assert_eq!(compare(&f, "bob", 1, 3).await.status(), 404);
    assert_eq!(compare(&f, "admin", 1, 3).await.status(), 404);
    f.docs
        .grant(&token("alice"), "compare-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(compare(&f, "bob", 1, 3).await.status(), 200);
    f.docs
        .grant(&token("alice"), "compare-file", "bob", None)
        .await
        .unwrap();
    assert_eq!(compare(&f, "bob", 1, 3).await.status(), 404);
    for value in [json!(0), json!(-1), json!(1.5), json!("1"), Value::Null] {
        assert_eq!(
            f.library(
                "alice",
                "compare",
                json!({"app":"map","id":"compare-file","from":value,"to":2})
            )
            .await
            .status(),
            400
        );
    }
    assert_eq!(compare(&f, "alice", 1, 4).await.status(), 404);
    assert_eq!(
        f.library(
            "alice",
            "compare",
            json!({"app":"cad","id":"compare-file","from":1,"to":2})
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        f.library(
            "alice",
            "compare",
            json!({"app":"map","id":"compare-file","from":1,"to":2,"branch":"Other"})
        )
        .await
        .status(),
        501
    );
    assert_eq!(
        f.library(
            "alice",
            "compare",
            json!({"app":"map","id":"compare-file","from":1,"to":2,"operation_id":"not-a-write"})
        )
        .await
        .status(),
        400
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(compare(&f, "alice", 1, 3).await.status(), 404);
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.sql("DELETE FROM aether_access.members WHERE user_id='alice'")
        .await;
    assert_eq!(compare(&f, "alice", 1, 3).await.status(), 404);
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one(
                "SELECT count(*) FROM aether_access.members WHERE user_id='alice'",
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
async fn compare_preserves_imported_annotations_and_refuses_broken_ancestry() {
    let f = Fixture::new().await;
    seed(&f).await;
    let imported = format!(
        "legacy-{:x}",
        Sha256::digest(serde_json::to_vec(&("compare-file", 2)).unwrap())
    );
    let c = f.pool.get().await.unwrap();
    c.execute("UPDATE aether_store.revisions SET metadata=jsonb_set(metadata,'{operation_id}',to_jsonb($1::text)) WHERE document_id='compare-file' AND revision=2",&[&imported]).await.unwrap();
    assert_eq!(compare(&f, "alice", 1, 3).await.status(), 503);
    c.execute("INSERT INTO aether_access.legacy_history_annotations VALUES('company','compare-file',2,'Original note',1700000000.5,1)",&[]).await.unwrap();
    let value: Value = compare(&f, "alice", 1, 3).await.json().await.unwrap();
    assert_eq!(value["to_only"][1]["note"], "Original note");
    assert_eq!(value["to_only"][1]["saved"], 1700000000.5);
    assert!(
        c.execute(
            "UPDATE aether_access.legacy_history_annotations SET parent_revision=2",
            &[]
        )
        .await
        .is_err()
    );
    c.execute("UPDATE aether_store.revisions SET metadata=jsonb_set(metadata,'{parent_revision}','3'::jsonb) WHERE document_id='compare-file' AND revision=3", &[]).await.unwrap();
    assert_eq!(compare(&f, "alice", 1, 3).await.status(), 503);
}
