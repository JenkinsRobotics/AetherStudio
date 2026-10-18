use super::*;

async fn fixture() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("release-file"))
        .await
        .unwrap();
    assert_eq!(f.library("alice","version",json!({"app":"map","id":"release-file","operation_id":"initial-label","expected_revision":1,"name":"V1","message":"Original"})).await.status(),200);
    f
}
async fn version(f: &Fixture) -> Value {
    let response = f
        .library("alice", "history", json!({"app":"map","id":"release-file"}))
        .await;
    assert_eq!(response.status(), 200);
    response.json::<Value>().await.unwrap()["versions"][0].clone()
}
fn transition(op: &str, previous: &Value, status: &str) -> Value {
    json!({"app":"map","id":"release-file","operation_id":op,"name":"V1","expected_revision":1,"expected_status":previous["status"],"expected_status_updated":previous["status_updated"],"status":status})
}
async fn apply(f: &Fixture, body: Value) -> Value {
    let response = f.library("alice", "version_status", body).await;
    let status = response.status();
    let value: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn release_lifecycle_transitions_and_replays_preserve_file_history() {
    let f = fixture().await;
    let initial = version(&f).await;
    let candidate = transition("candidate", &initial, "candidate");
    assert_eq!(
        apply(&f, candidate.clone()).await,
        json!({"ok":true,"status":"candidate","replayed":false})
    );
    let current = version(&f).await;
    assert_eq!(current["status"], "candidate");
    assert!(current["status_updated"].as_f64().unwrap() > 0.0);
    let withdrawn = transition("withdraw", &current, "version");
    apply(&f, withdrawn).await;
    let restored = version(&f).await;
    assert_eq!(restored["status"], "version");
    assert!(
        restored["status_updated"].as_f64().unwrap() > current["status_updated"].as_f64().unwrap()
    );
    // Reusing old status with a stale timestamp cannot overwrite a later return to version.
    let stale = transition("stale-cycle", &initial, "candidate");
    assert_eq!(
        f.library("alice", "version_status", stale).await.status(),
        409
    );
    apply(&f, transition("candidate-again", &restored, "candidate")).await;
    let current = version(&f).await;
    apply(&f, transition("release", &current, "released")).await;
    let released = version(&f).await;
    let mut obsolete = transition("obsolete", &released, "obsolete");
    obsolete["note"] = json!("  Superseded by a reviewed design  ");
    apply(&f, obsolete.clone()).await;
    let final_state = version(&f).await;
    assert_eq!(final_state["status"], "obsolete");
    assert_eq!(
        final_state["status_note"],
        "Superseded by a reviewed design"
    );
    for key in ["name", "revision", "created", "message", "origin", "branch"] {
        assert_eq!(final_state[key], initial[key]);
    }
    for body in [candidate, obsolete] {
        assert_eq!(apply(&f, body).await["replayed"], true);
    }
    assert_eq!(version(&f).await, final_state);
    assert_eq!(
        f.docs
            .read(&token("alice"), "release-file", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.version_events", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        6
    );
    let changed: Value = c
        .query_one(
            "SELECT before_state FROM aether_access.version_events WHERE operation_id='obsolete'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(changed["status"], "released");
    assert_eq!(changed["author"], "alice");
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
async fn release_lifecycle_validates_transitions_fields_and_expected_state() {
    let f = fixture().await;
    let initial = version(&f).await;
    for (key, value, status) in [
        ("status", json!("released"), 400),
        ("status", json!("obsolete"), 400),
        ("status", json!("version"), 400),
        ("status", json!("unknown"), 400),
        ("expected_status", json!("candidate"), 409),
        ("expected_status_updated", json!(1), 409),
        ("expected_status_updated", json!(-1), 400),
        ("expected_status_updated", json!(true), 400),
        ("expected_revision", json!(2), 409),
        ("name", json!("missing"), 404),
        ("branch", json!("Other"), 501),
        ("note", json!("x".repeat(501)), 400),
        ("note", json!("bad\0text"), 400),
        ("message", json!("not a label edit"), 400),
        ("new_name", json!("not a rename"), 400),
        ("author", json!("admin"), 400),
    ] {
        let mut body = transition("bad", &initial, "candidate");
        body[key] = value;
        assert_eq!(
            f.library("alice", "version_status", body).await.status(),
            status,
            "{key}"
        );
    }
    for key in [
        "status",
        "expected_status",
        "expected_status_updated",
        "operation_id",
    ] {
        let mut body = transition("missing", &initial, "candidate");
        body.as_object_mut().unwrap().remove(key);
        assert_eq!(
            f.library("alice", "version_status", body).await.status(),
            400,
            "{key}"
        );
    }
    assert_eq!(version(&f).await, initial);
    apply(&f, transition("candidate", &initial, "candidate")).await;
    apply(&f, transition("released", &version(&f).await, "released")).await;
    let released = version(&f).await;
    for note in [None, Some(json!(" \n ")), Some(json!(null))] {
        let mut body = transition("blank-obsolete", &released, "obsolete");
        if let Some(note) = note {
            body["note"] = note;
        }
        assert_eq!(
            f.library("alice", "version_status", body).await.status(),
            400
        );
    }
    for action in ["version_update", "version_delete"] {
        assert_eq!(f.library("alice",action,json!({"app":"map","id":"release-file","operation_id":action,"expected_revision":1,"name":"V1"})).await.status(),409);
    }
    let mut body = transition("obsolete", &released, "obsolete");
    body["note"] = json!("Retired");
    apply(&f, body).await;
    let obsolete = version(&f).await;
    for next in ["version", "candidate", "released", "obsolete"] {
        assert_eq!(
            f.library(
                "alice",
                "version_status",
                transition("terminal", &obsolete, next)
            )
            .await
            .status(),
            400
        );
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn release_lifecycle_concurrent_replay_revocation_and_failed_audit_are_atomic() {
    let f = fixture().await;
    let initial = version(&f).await;
    let body = transition("same", &initial, "candidate");
    let (a, b) = tokio::join!(
        f.library("alice", "version_status", body.clone()),
        f.library("alice", "version_status", body.clone())
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    assert_ne!(
        a.json::<Value>().await.unwrap()["replayed"],
        b.json::<Value>().await.unwrap()["replayed"]
    );
    let mut reused = body.clone();
    reused["note"] = json!("Different request");
    assert_eq!(
        f.library("alice", "version_status", reused).await.status(),
        409
    );
    f.docs
        .grant(&token("alice"), "release-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let next = transition("release", &version(&f).await, "released");
    for user in ["bob", "admin"] {
        assert_eq!(
            f.library(user, "version_status", next.clone())
                .await
                .status(),
            404
        );
    }
    f.docs
        .grant(&token("alice"), "release-file", "bob", Some(Role::Editor))
        .await
        .unwrap();
    f.sql("CREATE FUNCTION aether_access.fail_release() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER fail_release BEFORE INSERT ON aether_access.version_events FOR EACH ROW EXECUTE FUNCTION aether_access.fail_release()").await;
    assert_eq!(
        f.library("bob", "version_status", next.clone())
            .await
            .status(),
        503
    );
    assert_eq!(version(&f).await["status"], "candidate");
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.version_receipts WHERE operation_id='release'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.sql("DROP TRIGGER fail_release ON aether_access.version_events")
        .await;
    assert_eq!(
        f.library("bob", "version_status", next.clone())
            .await
            .status(),
        200
    );
    f.docs
        .grant(&token("alice"), "release-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(f.library("bob", "version_status", next).await.status(), 404);
    assert_eq!(version(&f).await["status"], "released");
}
