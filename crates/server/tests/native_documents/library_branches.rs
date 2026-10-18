use super::*;

async fn seed(f: &Fixture) {
    f.docs
        .mutate(&token("alice"), &create("branch-file"))
        .await
        .unwrap();
}
fn fork(op: &str, name: &str, head: u32) -> Value {
    json!({"app":"map","id":"branch-file","operation_id":op,"expected_revision":head,"from_revision":head,"name":name})
}
async fn accepted(f: &Fixture, action: &str, request: Value) -> Value {
    let response = f.library("alice", action, request).await;
    let status = response.status();
    let result: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{action}: {result}");
    result
}
async fn history(f: &Fixture) -> Value {
    accepted(f, "history", json!({"app":"map","id":"branch-file"})).await
}
fn save_request(branch: &str, op: &str, expected: u32, data: &str) -> Value {
    json!({"app":"map","id":"branch-file","operation_id":op,"branch":branch,"expected_revision":expected,"data_base64":data})
}
fn merge_request(source: &str, target: &str, op: &str, from: u32, to: u32) -> Value {
    json!({"app":"map","id":"branch-file","operation_id":op,"source":source,"target":target,"expected_source_revision":from,"expected_revision":to})
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branches_read_save_restore_history_and_compare_keep_main_independent() {
    let f = Fixture::new().await;
    seed(&f).await;
    let created = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = created["branch_id"].as_str().unwrap();
    let noop = accepted(&f, "merge", merge_request("Main", id, "initial-noop", 1, 1)).await;
    assert_eq!(noop["merged"], false);
    assert_eq!(noop["branch_id"], id);
    let saved = accepted(
        &f,
        "save",
        save_request(id, "save-branch", 1, "eyJhIjoxfQ=="),
    )
    .await;
    assert_eq!(saved["revision"], 2);
    assert_eq!(saved["branch_id"], id);
    assert_eq!(saved["branch_label"], "Experiment");
    let main = accepted(&f, "read", json!({"app":"map","id":"branch-file"})).await;
    assert_eq!(main["revision"], 1);
    assert_eq!(main["data_base64"], "e30=");
    let selected = accepted(
        &f,
        "read",
        json!({"app":"map","id":"branch-file","branch":id}),
    )
    .await;
    assert_eq!(selected["revision"], 2);
    assert_eq!(selected["branch_label"], "Experiment");
    assert_eq!(selected["data_base64"], "eyJhIjoxfQ==");
    accepted(
        &f,
        "save",
        save_request("Main", "save-main", 1, "eyJiIjoyfQ=="),
    )
    .await;
    let h = history(&f).await;
    assert_eq!(h["revisions"].as_array().unwrap().len(), 3);
    assert_eq!(h["branches"][0]["head_revision"], 3);
    assert_eq!(h["branches"][1]["head_revision"], 2);
    assert_eq!(h["branches"][1]["id"], id);
    assert_eq!(h["revisions"][1]["branch"], "Experiment");
    assert_eq!(h["revisions"][1]["branch_id"], id);
    let diff = accepted(
        &f,
        "compare",
        json!({"app":"map","id":"branch-file","branch":id,"from":2,"to":3}),
    )
    .await;
    assert_eq!(diff["base"], 1);
    assert_eq!(diff["same_content"], false);
    assert_eq!(diff["from_only"][0]["revision"], 2);
    let restored = accepted(&f,"restore",json!({"app":"map","id":"branch-file","operation_id":"restore-branch","branch":id,"expected_revision":2,"revision":1})).await;
    assert_eq!(restored["revision"], 4);
    assert_eq!(restored["branch_id"], id);
    assert_eq!(history(&f).await["branches"][0]["head_revision"], 3);
    assert_eq!(
        f.docs
            .read(&token("alice"), "branch-file", Some(2))
            .await
            .unwrap()
            .content_base64,
        "eyJhIjoxfQ=="
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn merges_are_guarded_explicit_and_compare_follows_both_parents() {
    let f = Fixture::new().await;
    seed(&f).await;
    let created = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = created["branch_id"].as_str().unwrap();
    accepted(&f, "save", save_request(id, "branch2", 1, "eyJhIjoxfQ==")).await;
    let fast = accepted(&f, "merge", merge_request(id, "Main", "fast", 2, 1)).await;
    assert_eq!(fast["revision"], 3);
    assert_eq!(fast["fast_forward"], true);
    let compare = accepted(
        &f,
        "compare",
        json!({"app":"map","id":"branch-file","from":2,"to":3}),
    )
    .await;
    assert_eq!(compare["base"], 2);
    assert_eq!(compare["from_only"], json!([]));
    assert_eq!(compare["same_content"], true);
    let rows = history(&f).await;
    assert_eq!(rows["revisions"][0]["parent_revision"], 1);
    assert_eq!(rows["revisions"][0]["merge_parent_revision"], 2);
    accepted(&f, "save", save_request(id, "branch4", 2, "eyJhIjo0fQ==")).await;
    accepted(&f, "save", save_request("Main", "main5", 3, "eyJhIjo1fQ==")).await;
    let mut diverged = merge_request(id, "Main", "diverged", 4, 5);
    let rejected: Value = f
        .library("alice", "merge", diverged.clone())
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(
        rejected["detail"],
        json!({"conflict":true,"source_head":4,"target_head":5})
    );
    let mut stale = diverged.clone();
    stale["expected_revision"] = json!(3);
    let rejected: Value = f
        .library("alice", "merge", stale)
        .await
        .json()
        .await
        .unwrap();
    assert!(rejected.get("detail").is_none());
    assert_eq!(history(&f).await["branch_identity"], "stable");

    assert_eq!(
        f.library("alice", "merge", diverged.clone()).await.status(),
        409
    );
    diverged["resolution"] = json!("source");
    let result = accepted(&f, "merge", diverged.clone()).await;
    assert_eq!(result["revision"], 6);
    assert_eq!(result["fast_forward"], false);
    assert_eq!(result["merge_base_revision"], 2);
    assert_eq!(accepted(&f, "merge", diverged).await["replayed"], true);
    assert_eq!(
        f.docs
            .read(&token("alice"), "branch-file", None)
            .await
            .unwrap()
            .content_base64,
        "eyJhIjo0fQ=="
    );
    let noop = accepted(&f, "merge", merge_request(id, "Main", "noop", 4, 6)).await;
    assert_eq!(noop["merged"], false);
    assert_eq!(history(&f).await["revisions"].as_array().unwrap().len(), 6);
    let stale = merge_request(id, "Main", "stale", 2, 6);
    assert_eq!(f.library("alice", "merge", stale).await.status(), 409);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_name_reuse_does_not_redirect_old_tabs_or_replays() {
    let f = Fixture::new().await;
    seed(&f).await;
    let created = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = created["branch_id"].as_str().unwrap();
    let save = save_request(id, "branch2", 1, "eyJhIjoxfQ==");
    accepted(&f, "save", save.clone()).await;
    accepted(&f,"branch_rename",json!({"app":"map","id":"branch-file","operation_id":"rename","branch":id,"expected_revision":2,"new_name":"Renamed"})).await;
    assert_eq!(history(&f).await["revisions"][0]["branch"], "Renamed");
    let mut delete = json!({"app":"map","id":"branch-file","operation_id":"delete","branch":id,"expected_revision":2,"expected_main_revision":1});
    assert_eq!(
        f.library("alice", "branch_delete", delete.clone())
            .await
            .status(),
        409
    );
    delete["force"] = json!(true);
    accepted(&f, "branch_delete", delete).await;
    let recreated = accepted(&f, "branch_create", fork("fork-again", "Renamed", 1)).await;
    assert_ne!(recreated["branch_id"], id);
    let replay = accepted(&f, "save", save).await;
    assert_eq!(replay["replayed"], true);
    assert_eq!(replay["branch_label"], "Renamed");
    assert_eq!(replay["branch_id"], id);
    assert_eq!(
        accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await["replayed"],
        true
    );
    assert_eq!(
        f.library("alice", "save", save_request(id, "stale-tab", 2, "e30="))
            .await
            .status(),
        404
    );
    assert_eq!(
        f.library(
            "alice",
            "save",
            save_request("Renamed", "name-only", 1, "e30=")
        )
        .await
        .status(),
        501
    );
    assert_eq!(
        f.library(
            "alice",
            "read",
            json!({"app":"map","id":"branch-file","branch":id})
        )
        .await
        .status(),
        404
    );
    let h = history(&f).await;
    assert_eq!(h["branches"].as_array().unwrap().len(), 2);
    assert_eq!(h["revisions"].as_array().unwrap().len(), 2);
    assert_eq!(h["revisions"][0]["branch_id"], id);
    assert_eq!(h["revisions"][0]["branch"], "Renamed");
    assert_eq!(h["branches"][1]["head_revision"], 1);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn every_branch_command_and_replay_rechecks_current_permissions() {
    let f = Fixture::new().await;
    seed(&f).await;
    let request = fork("fork", "Experiment", 1);
    let created = accepted(&f, "branch_create", request.clone()).await;
    let id = created["branch_id"].as_str().unwrap();
    for who in ["bob", "admin"] {
        assert_eq!(
            f.library(who, "branch_create", request.clone())
                .await
                .status(),
            404
        );
    }
    f.docs
        .grant(&token("alice"), "branch-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        f.library(
            "bob",
            "read",
            json!({"app":"map","id":"branch-file","branch":id})
        )
        .await
        .status(),
        200
    );
    for (action, request) in [
        ("branch_create", fork("fork-bob", "Bob", 1)),
        (
            "branch_rename",
            json!({"app":"map","id":"branch-file","operation_id":"rename","branch":id,"expected_revision":1,"new_name":"Other"}),
        ),
        (
            "branch_delete",
            json!({"app":"map","id":"branch-file","operation_id":"delete","branch":id,"expected_revision":1,"expected_main_revision":1}),
        ),
        ("merge", merge_request(id, "Main", "merge", 1, 1)),
        ("save", save_request(id, "save", 1, "e30=")),
    ] {
        assert_eq!(
            f.library("bob", action, request).await.status(),
            404,
            "{action}"
        );
    }
    f.docs
        .grant(&token("alice"), "branch-file", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let bob_fork = fork("bob-fork", "Bob", 1);
    assert_eq!(
        f.library("bob", "branch_create", bob_fork.clone())
            .await
            .status(),
        200
    );
    f.docs
        .grant(&token("alice"), "branch-file", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "branch_create", bob_fork).await.status(),
        404
    );
    let mut wrong_app = request.clone();
    wrong_app["app"] = json!("cad");
    assert_eq!(
        f.library("alice", "branch_create", wrong_app)
            .await
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        f.library("alice", "branch_create", request.clone())
            .await
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(
        f.library("alice", "branch_create", request).await.status(),
        403
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_request_shape_and_operation_collisions_never_write_main() {
    let f = Fixture::new().await;
    seed(&f).await;
    let request = fork("fork", "Experiment", 1);
    for extra in [
        json!({"actor":"admin"}),
        json!({"action":"branch_delete"}),
        json!({"unknown":1}),
    ] {
        let mut invalid = request.clone();
        invalid
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        assert_eq!(
            f.library("alice", "branch_create", invalid).await.status(),
            400
        );
    }
    for field in ["operation_id", "expected_revision", "from_revision"] {
        let mut invalid = request.clone();
        invalid.as_object_mut().unwrap().remove(field);
        assert_eq!(
            f.library("alice", "branch_create", invalid).await.status(),
            400
        );
    }
    assert_eq!(
        f.library("alice", "branch_create", fork("reserved", "Main", 1))
            .await
            .status(),
        400
    );
    accepted(&f, "branch_create", request).await;
    assert_eq!(
        f.library("alice", "branch_create", fork("fork", "Different", 1))
            .await
            .status(),
        409
    );
    assert_eq!(
        f.library("alice", "save", save_request("Main", "fork", 1, "e30="))
            .await
            .status(),
        409
    );
    assert_eq!(
        f.docs
            .read(&token("alice"), "branch-file", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_save_failure_rolls_back_history_head_and_retry_receipt() {
    let f = Fixture::new().await;
    seed(&f).await;
    let created = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = created["branch_id"].as_str().unwrap();
    // Recents is in the same transaction, even for branch saves.
    f.sql("ALTER TABLE aether_access.library_recents ADD CONSTRAINT reject_recent CHECK (resource != 'branch-file')").await;
    let save = save_request(id, "branch-save", 1, "eyJhIjoxfQ==");
    assert_eq!(f.library("alice", "save", save.clone()).await.status(), 503);
    assert_eq!(history(&f).await["revisions"].as_array().unwrap().len(), 1);
    f.sql("ALTER TABLE aether_access.library_recents DROP CONSTRAINT reject_recent")
        .await;
    let saved = accepted(&f, "save", save).await;
    assert_eq!(saved["revision"], 2);
    assert_eq!(saved["replayed"], false);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_guard_waits_for_inflight_edit_and_concurrent_writers_conflict() {
    let f = Fixture::new().await;
    seed(&f).await;
    let branch = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = branch["branch_id"].as_str().unwrap();
    let a = save_request(id, "writer-a", 1, "eyJhIjoxfQ==");
    let b = save_request(id, "writer-b", 1, "eyJiIjoyfQ==");
    let (a, b) = tokio::join!(f.library("alice", "save", a), f.library("alice", "save", b));
    let mut codes = vec![a.status().as_u16(), b.status().as_u16()];
    codes.sort();
    assert_eq!(codes, vec![200, 409]);
    // Hold the document lock with an uncommitted source edit. The merge must
    // validate its source guard after waiting, not use the old pre-wait head.
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    let store = HostedStore::new(
        f.pool.clone(),
        ContentStore::local(f._objects.path()).unwrap(),
    );
    let scope = aether_store::hosted::AuthorizedScope::new("company", "alice").unwrap();
    let edit=serde_json::from_value(json!({"branch":id,"mutation":{"operation_id":"pending-edit","document_id":"branch-file","actor":"alice","change":{"kind":"save","expected_revision":2,"content_base64":"e30="}}})).unwrap();
    store.mutate_branch_in(&tx, &scope, &edit).await.unwrap();
    let docs = f.docs.clone();
    let mut request = merge_request(id, "Main", "waiting-merge", 2, 1);
    request["action"] = json!("merge");
    let request = serde_json::from_value(request).unwrap();
    let pending = tokio::spawn(async move { docs.library_branch(&token("alice"), &request).await });
    f.waiting("SELECT pg_advisory_xact_lock($1)").await;
    tx.commit().await.unwrap();
    assert!(
        matches!(pending.await.unwrap(),Err(Error::Storage(e)) if e.code==aether_protocol_core::storage::StoreErrorCode::RevisionConflict)
    );
    assert_eq!(history(&f).await["branches"][0]["head_revision"], 1);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_history_waits_for_coherent_heads_and_session_revocation_wins() {
    let f = Fixture::new().await;
    seed(&f).await;
    let branch = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = branch["branch_id"].as_str().unwrap();
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    let store = HostedStore::new(
        f.pool.clone(),
        ContentStore::local(f._objects.path()).unwrap(),
    );
    let scope = aether_store::hosted::AuthorizedScope::new("company", "alice").unwrap();
    let edit=serde_json::from_value(json!({"branch":id,"mutation":{"operation_id":"pending-edit","document_id":"branch-file","actor":"alice","change":{"kind":"save","expected_revision":1,"content_base64":"e30="}}})).unwrap();
    store.mutate_branch_in(&tx, &scope, &edit).await.unwrap();
    let docs = f.docs.clone();
    let pending = tokio::spawn(async move {
        docs.library(
            &token("alice"),
            &serde_json::from_value(json!({"action":"history","app":"map","id":"branch-file"}))
                .unwrap(),
        )
        .await
    });
    f.waiting("SELECT pg_advisory_xact_lock_shared($1)").await;
    tx.commit().await.unwrap();
    let h = pending.await.unwrap().unwrap();
    assert_eq!(h["branches"][0]["head_revision"], 1);
    assert_eq!(h["branches"][1]["head_revision"], 2);
    assert_eq!(h["revisions"].as_array().unwrap().len(), 2);
    // A logged-out session cannot replay even an earlier successful fork.
    let tx = client.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
        &[],
    )
    .await
    .unwrap();
    let mut request = fork("fork", "Experiment", 1);
    request["action"] = json!("branch_create");
    let request = serde_json::from_value(request).unwrap();
    let docs = f.docs.clone();
    let pending = tokio::spawn(async move { docs.library_branch(&token("alice"), &request).await });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062603))")
        .await;
    tx.execute(
        "DELETE FROM aether_identity.sessions WHERE tenant='company' AND user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(
        pending.await.unwrap(),
        Err(Error::Identity(aether_identity::Error::Unauthorized))
    ));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_metadata_commands_refuse_inconsistent_canonical_app_even_on_replay() {
    let f = Fixture::new().await;
    seed(&f).await;
    let request = fork("fork", "Experiment", 1);
    accepted(&f, "branch_create", request.clone()).await;
    // A damaged resource index cannot authorize branch commands against another
    // app's canonical document, even if the requesting user can use both apps.
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    f.sql("UPDATE aether_access.resources SET app='cad' WHERE id='branch-file'")
        .await;
    let mut replay = request;
    replay["app"] = json!("cad");
    assert_eq!(
        f.library("alice", "branch_create", replay.clone())
            .await
            .status(),
        503
    );
    replay["operation_id"] = json!("new-fork");
    replay["name"] = json!("Other");
    assert_eq!(
        f.library("alice", "branch_create", replay).await.status(),
        503
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_store.branches WHERE document_id='branch-file'",
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
async fn branch_checkpoints_follow_identity_through_rename_delete_and_name_reuse() {
    let f = Fixture::new().await;
    seed(&f).await;
    let branch = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = branch["branch_id"].as_str().unwrap();
    accepted(
        &f,
        "save",
        save_request(id, "branch-save", 1, "eyJhIjoxfQ=="),
    )
    .await;
    let checkpoint = json!({"app":"map","id":"branch-file","operation_id":"checkpoint","expected_revision":2,"branch":id,"name":"Review"});
    assert_eq!(
        accepted(&f, "version", checkpoint.clone()).await["revision"],
        2
    );
    let mut stale = checkpoint.clone();
    stale["operation_id"] = json!("stale");
    stale["expected_revision"] = json!(1);
    assert_eq!(f.library("alice", "version", stale).await.status(), 409);
    accepted(&f,"branch_rename",json!({"app":"map","id":"branch-file","operation_id":"rename","branch":id,"expected_revision":2,"new_name":"Renamed"})).await;
    let row = history(&f).await["versions"][0].clone();
    assert_eq!(row["branch"], "Renamed");
    assert_eq!(row["branch_id"], id);
    assert_eq!(row["revision"], 2);
    accepted(&f,"branch_delete",json!({"app":"map","id":"branch-file","operation_id":"delete","branch":id,"expected_revision":2,"expected_main_revision":1,"force":true})).await;
    let new = accepted(&f, "branch_create", fork("replacement", "Renamed", 1)).await;
    assert_ne!(new["branch_id"], id);
    assert_eq!(
        accepted(&f, "version", checkpoint.clone()).await["replayed"],
        true
    );
    let mut deleted = checkpoint;
    deleted["operation_id"] = json!("new-after-delete");
    assert_ne!(f.library("alice", "version", deleted).await.status(), 200);
    let status = json!({"app":"map","id":"branch-file","operation_id":"candidate","expected_revision":1,"name":"Review","status":"candidate","expected_status":"version","expected_status_updated":0});
    accepted(&f, "version_status", status.clone()).await;
    let mut release = status;
    release["operation_id"] = json!("release");
    release["status"] = json!("released");
    release["expected_status"] = json!("candidate");
    release["expected_status_updated"] = history(&f).await["versions"][0]["status_updated"].clone();
    accepted(&f, "version_status", release.clone()).await;
    assert_eq!(
        accepted(&f, "version_status", release.clone()).await["replayed"],
        true
    );
    f.docs
        .grant(&token("alice"), "branch-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_ne!(
        f.library("bob", "version_status", release).await.status(),
        200
    );
    let row = history(&f).await["versions"][0].clone();
    assert_eq!(row["status"], "released");
    assert_eq!(row["branch_id"], id);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_comments_inherit_stable_identity_even_after_deletion() {
    let f = Fixture::new().await;
    seed(&f).await;
    let branch = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = branch["branch_id"].as_str().unwrap();
    let comment = json!({"app":"map","id":"branch-file","branch":id,"operation_id":"comment","expected_revision":0,"collection":"comments","operation":"add","value":{"text":"Review this branch","revision":1}});
    let added = accepted(&f, "collaboration_mutate", comment.clone()).await;
    let root = added["comments"][0]["id"].clone();
    assert_eq!(added["comments"][0]["branch_id"], id);
    accepted(&f,"branch_rename",json!({"app":"map","id":"branch-file","operation_id":"rename","branch":id,"expected_revision":1,"new_name":"Renamed"})).await;
    let read = accepted(&f, "collaboration", json!({"app":"map","id":"branch-file"})).await;
    assert_eq!(read["comments"][0]["branch"], "Renamed");
    accepted(&f,"branch_delete",json!({"app":"map","id":"branch-file","operation_id":"delete","branch":id,"expected_revision":1,"expected_main_revision":1})).await;
    accepted(&f, "branch_create", fork("replacement", "Renamed", 1)).await;
    assert_eq!(
        accepted(&f, "collaboration_mutate", comment.clone()).await["replayed"],
        true
    );
    let reply = json!({"app":"map","id":"branch-file","operation_id":"reply","expected_revision":1,"collection":"comments","operation":"add","value":{"text":"Retained thread","parent":root}});
    let replied = accepted(&f, "collaboration_mutate", reply.clone()).await;
    assert_eq!(replied["comments"][1]["branch_id"], id);
    assert_eq!(replied["comments"][1]["branch"], "Renamed");
    let mut forged = reply;
    forged["operation_id"] = json!("forged");
    forged["expected_revision"] = json!(2);
    forged["value"]["branch"] = json!("Main");
    assert_eq!(
        f.library("alice", "collaboration_mutate", forged)
            .await
            .status(),
        400
    );
    let mut new = comment;
    new["operation_id"] = json!("deleted-root");
    new["expected_revision"] = json!(2);
    assert_ne!(
        f.library("alice", "collaboration_mutate", new)
            .await
            .status(),
        200
    );
    assert_eq!(history(&f).await["branches"][0]["head_revision"], 1);
    let c = f.pool.get().await.unwrap();
    let stored: Value = c
        .query_one(
            "SELECT value FROM aether_access.collaboration_items WHERE item_id=$1",
            &[&root.as_str().unwrap()],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(stored["branch"], "Experiment"); // Display resolution never rewrites the audit truth.
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn merge_checkpoint_failure_rolls_back_content_receipt_and_retries_once() {
    let f = Fixture::new().await;
    seed(&f).await;
    let branch = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = branch["branch_id"].as_str().unwrap();
    accepted(&f, "save", save_request(id, "save", 1, "eyJhIjoxfQ==")).await;
    f.sql("ALTER TABLE aether_access.named_versions ADD CONSTRAINT reject_auto CHECK(origin <> 'automatic')").await;
    let merge = merge_request(id, "Main", "merge", 2, 1);
    assert_ne!(
        f.library("alice", "merge", merge.clone()).await.status(),
        200
    );
    let h = history(&f).await;
    assert_eq!(h["revisions"].as_array().unwrap().len(), 2);
    assert_eq!(h["branches"][0]["head_revision"], 1);
    assert_eq!(h["versions"], json!([]));
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_store.branch_operations WHERE operation_id='merge'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.sql("ALTER TABLE aether_access.named_versions DROP CONSTRAINT reject_auto")
        .await;
    accepted(&f, "merge", merge.clone()).await;
    assert_eq!(accepted(&f, "merge", merge).await["replayed"], true);
    let h = history(&f).await;
    assert_eq!(h["versions"].as_array().unwrap().len(), 1);
    assert_eq!(h["versions"][0]["origin"], "automatic");
    assert_eq!(h["versions"][0]["revision"], 3);
    assert_eq!(h["versions"][0]["branch"], "Main");
    assert!(h["versions"][0].get("branch_id").is_none());
    accepted(&f, "merge", merge_request(id, "Main", "noop", 2, 3)).await;
    assert_eq!(history(&f).await["versions"].as_array().unwrap().len(), 1);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_metadata_schema_upgrade_is_atomic_and_preserves_main_receipts() {
    let f = Fixture::new().await;
    seed(&f).await;
    let request = json!({"app":"map","id":"branch-file","operation_id":"old-version","expected_revision":1,"name":"Original"});
    accepted(&f, "version", request.clone()).await;
    let old = history(&f).await["versions"].clone();
    f.access_before_branch_metadata().await;
    let mut sha = Sha256::new();
    for path in [
        "schema.sql",
        "002-directory.sql",
        "003-folders.sql",
        "004-resource-lifecycle.sql",
        "005-library-recents.sql",
        "006-legacy-history.sql",
        "007-named-versions.sql",
        "008-collaboration.sql",
        "009-workspace-preferences.sql",
        "010-legacy-file-metadata.sql",
        "011-file-favorites.sql",
        "012-sharing-provenance.sql",
        "013-legacy-drive-events.sql",
        "014-uploads.sql",
        "015-link-credentials.sql",
    ] {
        sha.update(
            std::fs::read(format!(
                "{}/src/documents/{path}",
                env!("CARGO_MANIFEST_DIR")
            ))
            .unwrap(),
        );
    }
    let checksum = format!("{:x}", sha.finalize());
    let c = f.pool.get().await.unwrap();
    c.execute(
        "UPDATE aether_access.schema_state SET version=15,checksum=$1",
        &[&checksum],
    )
    .await
    .unwrap();
    f.sql("ALTER TABLE aether_access.named_versions ADD COLUMN branch_id text")
        .await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
    assert_eq!(
        c.query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        15
    );
    f.sql("ALTER TABLE aether_access.named_versions DROP COLUMN branch_id")
        .await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(history(&f).await["versions"], old);
    assert_eq!(accepted(&f, "version", request).await["replayed"], true);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn named_merge_targets_checkpoint_collision_limits_and_current_permissions() {
    let f = Fixture::new().await;
    seed(&f).await;
    let branch = accepted(&f, "branch_create", fork("fork", "Experiment", 1)).await;
    let id = branch["branch_id"].as_str().unwrap();
    accepted(
        &f,
        "save",
        save_request("Main", "main-save", 1, "eyJhIjoxfQ=="),
    )
    .await;
    // A conflicting receipt aborts the whole merge, including its revision.
    let checkpoint = json!({"app":"map","id":"branch-file","operation_id":"collision","expected_revision":2,"name":"Merge r3: Main into Experiment"});
    accepted(&f, "version", checkpoint).await;
    let collision = merge_request("Main", id, "collision", 2, 1);
    assert_eq!(f.library("alice", "merge", collision).await.status(), 409);
    assert_eq!(history(&f).await["revisions"].as_array().unwrap().len(), 2);
    f.sql("INSERT INTO aether_access.named_versions SELECT 'company','branch-file','limit-'||i,1,'alice',i,'','version','user',0,'','Main',NULL FROM generate_series(1,999) i").await;
    let merge = merge_request("Main", id, "named-merge", 2, 1);
    assert_eq!(
        f.library("alice", "merge", merge.clone()).await.status(),
        501
    );
    assert_eq!(history(&f).await["revisions"].as_array().unwrap().len(), 2);
    f.sql("DELETE FROM aether_access.named_versions WHERE name LIKE 'limit-%'")
        .await;
    accepted(&f, "merge", merge.clone()).await;
    let h = history(&f).await;
    let automatic = h["versions"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["origin"] == "automatic")
        .unwrap();
    assert_eq!(automatic["branch_id"], id);
    assert_eq!(automatic["revision"], 3);
    assert_eq!(automatic["name"], "Merge r3: Main into Experiment (1)");
    assert_eq!(h["branches"][0]["head_revision"], 2);
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_ne!(
        f.library("alice", "merge", merge.clone()).await.status(),
        200
    );
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    assert_eq!(accepted(&f, "merge", merge).await["replayed"], true);
    assert_eq!(history(&f).await["versions"].as_array().unwrap().len(), 2);
}
