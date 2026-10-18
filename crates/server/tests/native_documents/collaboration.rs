use super::*;
async fn fixture() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("discussion"))
        .await
        .unwrap();
    f
}
fn input(op: &str, revision: u32, collection: &str, value: Value) -> Value {
    json!({"app":"map","id":"discussion","operation_id":op,"expected_revision":revision,"collection":collection,"operation":"add","value":value})
}
async fn read(f: &Fixture, user: &str) -> Value {
    let r = f
        .library(
            user,
            "collaboration",
            json!({"app":"map","id":"discussion","operation_id":"read-compat"}),
        )
        .await;
    assert_eq!(r.status(), 200);
    r.json().await.unwrap()
}
async fn change(f: &Fixture, user: &str, value: Value) -> Value {
    let r = f.library(user, "collaboration_mutate", value).await;
    let status = r.status();
    let data: Value = r.json().await.unwrap();
    assert_eq!(status, 200, "{data}");
    data
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_threads_tasks_notes_author_permissions_and_content_independence() {
    let f = fixture().await;
    let initial = read(&f, "alice").await;
    assert_eq!(initial["revision"], 0);
    assert_eq!(initial["comments"], json!([]));
    assert_eq!(initial["notes"], json!({"text":""}));
    assert_eq!(initial["members"].as_array().unwrap().len(), 1);
    f.docs
        .grant(&token("alice"), "discussion", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let added = change(
        &f,
        "bob",
        input(
            "question",
            0,
            "comments",
            json!({"text":"Review dimensions","revision":1}),
        ),
    )
    .await;
    let root = added["comments"][0]["id"].clone();
    assert_eq!(added["comments"][0]["reference_name"], "Saved state");
    assert_eq!(added["members"].as_array().unwrap().len(), 2);
    let replied = change(
        &f,
        "alice",
        input(
            "reply",
            1,
            "comments",
            json!({"text":"Owner answer","parent":root}),
        ),
    )
    .await;
    let reply = replied["comments"][1]["id"].clone();
    let mut edit = input("edit-answer", 2, "comments", json!({"text":"Not mine"}));
    edit["operation"] = json!("update");
    edit["item"] = reply;
    assert_eq!(
        f.library("bob", "collaboration_mutate", edit)
            .await
            .status(),
        403
    );
    let mut resolved = input("resolve", 2, "comments", json!({"resolved":true}));
    resolved["operation"] = json!("update");
    resolved["item"] = root.clone();
    assert_eq!(
        change(&f, "bob", resolved).await["comments"][0]["resolved"],
        true
    );
    let mut removed = input("remove", 3, "comments", json!({}));
    removed["operation"] = json!("delete");
    removed["item"] = root.clone();
    let deleted = change(&f, "alice", removed).await;
    assert_eq!(deleted["comments"][0]["deleted"], true);
    assert_eq!(deleted["comments"][0]["text"], "");
    assert_eq!(deleted["comments"][1]["text"], "Owner answer");
    let tasks = change(
        &f,
        "alice",
        input(
            "task",
            4,
            "tasks",
            json!({"text":"Check harness","assignee":"bob","due":"2026-10-20"}),
        ),
    )
    .await;
    let task = tasks["tasks"][0]["id"].clone();
    let mut complete = input("complete", 5, "tasks", json!({"status":"done"}));
    complete["operation"] = json!("update");
    complete["item"] = task.clone();
    assert_eq!(
        change(&f, "bob", complete).await["tasks"][0]["status"],
        "done"
    );
    let mut takeover = input("takeover", 6, "tasks", json!({"text":"Replace task"}));
    takeover["operation"] = json!("update");
    takeover["item"] = task;
    assert_eq!(
        f.library("bob", "collaboration_mutate", takeover)
            .await
            .status(),
        403
    );
    let mut notes = input("notes", 6, "notes", json!({"text":"Build specification"}));
    notes["operation"] = json!("update");
    assert_eq!(
        f.library("bob", "collaboration_mutate", notes.clone())
            .await
            .status(),
        403
    );
    change(&f, "alice", notes).await;
    change(
        &f,
        "alice",
        input(
            "reminder",
            7,
            "reminders",
            json!({"text":"Review before release"}),
        ),
    )
    .await;
    let state = read(&f, "alice").await;
    assert_eq!(state["revision"], 8);
    assert_eq!(state["activity"].as_array().unwrap().len(), 8);
    assert_eq!(state["notes"]["text"], "Build specification");
    assert_eq!(state["tasks"][0]["status"], "done");
    assert_eq!(
        f.docs
            .read(&token("alice"), "discussion", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    let c = f.pool.get().await.unwrap();
    let previous: Value = c
        .query_one(
            "SELECT before_state FROM aether_access.collaboration_events WHERE revision=4",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(previous["text"], "Review dimensions");
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
async fn collaboration_concurrent_retry_and_content_saves_have_independent_guards() {
    let f = fixture().await;
    let body = input("same", 0, "comments", json!({"text":"Once"}));
    let (a, b) = tokio::join!(
        f.library("alice", "collaboration_mutate", body.clone()),
        f.library("alice", "collaboration_mutate", body.clone())
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_ne!(a["replayed"], b["replayed"]);
    assert_eq!(a["comments"], b["comments"]);
    let mut conflict = body.clone();
    conflict["value"]["text"] = json!("Different");
    assert_eq!(
        f.library("alice", "collaboration_mutate", conflict)
            .await
            .status(),
        409
    );
    let author = token("alice");
    let content_save = save("discussion", "content-save", 1);
    let (discussion, doc) = tokio::join!(
        change(
            &f,
            "alice",
            input("second", 1, "comments", json!({"text":"Second"}))
        ),
        f.docs.mutate(&author, &content_save)
    );
    assert_eq!(discussion["revision"], 2);
    assert_eq!(doc.unwrap().document.revision, 2);
    let replay = change(&f, "alice", body).await;
    assert_eq!(replay["applied_revision"], 1);
    assert_eq!(replay["revision"], 2);
    assert_eq!(replay["comments"].as_array().unwrap().len(), 2);
    assert_eq!(replay["replayed"], true);
    assert_eq!(
        f.library(
            "alice",
            "collaboration_mutate",
            input("stale", 0, "comments", json!({"text":"Lost"}))
        )
        .await
        .status(),
        409
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_audit_failure_rolls_back_items_history_heads_and_receipts() {
    let f = fixture().await;
    f.sql("CREATE FUNCTION aether_access.fail_discussion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='collaboration_mutated' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_discussion BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION aether_access.fail_discussion()").await;
    let body = input("rollback", 0, "comments", json!({"text":"Retained draft"}));
    assert_eq!(
        f.library("alice", "collaboration_mutate", body.clone())
            .await
            .status(),
        503
    );
    for table in [
        "collaboration_heads",
        "collaboration_items",
        "collaboration_events",
        "collaboration_receipts",
    ] {
        assert_eq!(
            f.pool
                .get()
                .await
                .unwrap()
                .query_one(&format!("SELECT count(*) FROM aether_access.{table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
    assert_eq!(read(&f, "alice").await["revision"], 0);
    f.sql("DROP TRIGGER fail_discussion ON aether_access.audit")
        .await;
    assert_eq!(change(&f, "alice", body).await["revision"], 1);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_validates_comments_images_dates_and_does_not_mutate_on_refusal() {
    let f = fixture().await;
    for (collection, value, status) in [
        ("comments", json!({"text":""}), 400),
        ("comments", json!({"text":"bad","revision":true}), 400),
        ("comments", json!({"text":"bad","revision":999}), 400),
        ("comments", json!({"text":"bad","branch":"Other"}), 501),
        ("comments", json!({"text":"bad","parent":"missing"}), 400),
        ("comments", json!({"text":"bad","attachments":[{}]}), 400),
        (
            "comments",
            json!({"text":"bad","attachments":[{"name":"script.svg","data_url":"data:image/svg+xml;base64,PHN2Zy8+"}]}),
            400,
        ),
        (
            "comments",
            json!({"text":"bad","attachments":[{"name":"image.png","data_url":"data:image/png;base64,SGVsbG8="}]}),
            400,
        ),
        ("comments", json!({"text":"bad","author":"bob"}), 400),
        ("tasks", json!({"text":"bad","due":"2026-02-30"}), 400),
        ("tasks", json!({"text":"bad","assignee":"missing"}), 400),
        ("reminders", json!({"text":"bad","status":"other"}), 400),
    ] {
        assert_eq!(
            f.library(
                "alice",
                "collaboration_mutate",
                input("invalid", 0, collection, value)
            )
            .await
            .status(),
            status
        );
    }
    assert_eq!(read(&f, "alice").await["revision"], 0);
    let image =
        json!({"name":"Review.png","data_url":"data:image/png;base64,iVBORw0KGgppbWFnZQ=="});
    let s = change(
        &f,
        "alice",
        input(
            "image",
            0,
            "comments",
            json!({"text":"Check this","attachments":[image.clone()],"revision":1}),
        ),
    )
    .await;
    assert_eq!(s["comments"][0]["attachments"], json!([image]));
    let root = s["comments"][0]["id"].clone();
    let s = change(
        &f,
        "alice",
        input(
            "reply",
            1,
            "comments",
            json!({"text":"Reply","parent":root}),
        ),
    )
    .await;
    let reply = s["comments"][1]["id"].clone();
    assert_eq!(
        f.library(
            "alice",
            "collaboration_mutate",
            input(
                "nested",
                2,
                "comments",
                json!({"text":"Nested","parent":reply})
            )
        )
        .await
        .status(),
        400
    );
    let mut clear = input(
        "clear",
        2,
        "comments",
        json!({"text":"Edited","revision":null,"attachments":[]}),
    );
    clear["operation"] = json!("update");
    clear["item"] = root;
    let s = change(&f, "alice", clear).await;
    assert!(s["comments"][0]["revision"].is_null());
    assert_eq!(s["comments"][0]["attachments"], json!([]));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_rechecks_current_access_app_and_editor_receipts() {
    let f = fixture().await;
    for user in ["bob", "admin"] {
        assert_eq!(
            f.library(
                user,
                "collaboration",
                json!({"app":"map","id":"discussion"})
            )
            .await
            .status(),
            404
        );
        assert_eq!(
            f.library(
                user,
                "collaboration_mutate",
                input("private", 0, "comments", json!({"text":"Hidden"}))
            )
            .await
            .status(),
            404
        );
    }
    f.docs
        .grant(&token("alice"), "discussion", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let mut note = input("editor-note", 0, "notes", json!({"text":"Editor note"}));
    note["operation"] = json!("update");
    change(&f, "bob", note.clone()).await;
    f.docs
        .grant(&token("alice"), "discussion", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "collaboration_mutate", note)
            .await
            .status(),
        403
    );
    let own = input("own", 1, "comments", json!({"text":"Viewer comment"}));
    change(&f, "bob", own.clone()).await;
    f.docs
        .grant(&token("alice"), "discussion", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "collaboration_mutate", own).await.status(),
        404
    );
    assert_eq!(
        read(&f, "alice").await["members"].as_array().unwrap().len(),
        1
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        f.library(
            "alice",
            "collaboration",
            json!({"app":"map","id":"discussion"})
        )
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
        f.library(
            "alice",
            "collaboration_mutate",
            input("password", 2, "comments", json!({"text":"No"}))
        )
        .await
        .status(),
        403
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_queued_write_observes_committed_revocation() {
    let f = fixture().await;
    f.docs
        .grant(&token("alice"), "discussion", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.query_one(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='discussion' AND user_id='bob'",&[]).await.unwrap();
    let request = f.library(
        "bob",
        "collaboration_mutate",
        input("queued", 0, "comments", json!({"text":"Revoked"})),
    );
    let barrier = async {
        f.waiting("pg_advisory_xact_lock").await;
        tx.commit().await.unwrap();
    };
    let (response, ()) = tokio::join!(request, barrier);
    assert_eq!(response.status(), 404);
    assert_eq!(read(&f, "alice").await["revision"], 0);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_schema7_upgrade_is_atomic_and_keeps_named_versions() {
    let f = fixture().await;
    let named = json!({"app":"map","id":"discussion","operation_id":"version","expected_revision":1,"name":"V1"});
    assert_eq!(f.library("alice", "version", named).await.status(), 200);
    let mut hash = Sha256::new();
    for sql in [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
        include_str!("../../src/documents/006-legacy-history.sql"),
        include_str!("../../src/documents/007-named-versions.sql"),
    ] {
        hash.update(sql);
    }
    let checksum = format!("{:x}", hash.finalize());
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; DROP TABLE aether_access.legacy_file_metadata; DROP TABLE aether_access.workspace_preference_events,aether_access.workspace_preference_receipts,aether_access.workspace_preferences; DROP TABLE aether_access.collaboration_events,aether_access.collaboration_receipts,aether_access.collaboration_items,aether_access.collaboration_heads; UPDATE aether_access.schema_state SET version=7,checksum='{checksum}'; CREATE VIEW aether_access.collaboration_items AS SELECT 1 AS conflict")).await;
    assert!(f.docs.migrate().await.is_err());
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        7
    );
    assert!(
        c.query_one(
            "SELECT to_regclass('aether_access.collaboration_heads')::text",
            &[]
        )
        .await
        .unwrap()
        .get::<_, Option<String>>(0)
        .is_none()
    );
    f.sql("DROP VIEW aether_access.collaboration_items").await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(read(&f, "alice").await["revision"], 0);
    let result = change(
        &f,
        "alice",
        input(
            "reference",
            0,
            "comments",
            json!({"text":"Reference","revision":1}),
        ),
    )
    .await;
    assert_eq!(result["comments"][0]["reference_name"], "V1");
    assert_eq!(
        f.docs
            .read(&token("alice"), "discussion", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    f.sql("UPDATE aether_access.schema_state SET checksum='incorrect'")
        .await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_tenants_and_activity_windows_are_isolated() {
    let f = fixture().await;
    change(
        &f,
        "alice",
        input("same", 0, "comments", json!({"text":"Company"})),
    )
    .await;
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
    let mut body = input("same", 0, "comments", json!({"text":"Other company"}));
    body["action"] = json!("collaboration_mutate");
    let request = serde_json::from_value(body).unwrap();
    assert!(matches!(
        other.collaboration(&token("alice"), &request).await,
        Err(Error::Denied)
    ));
    other
        .mutate(&token("alice"), &create("discussion"))
        .await
        .unwrap();
    let other_state = other
        .collaboration(&token("alice"), &request)
        .await
        .unwrap();
    assert_eq!(other_state["replayed"], false);
    assert_eq!(other_state["comments"][0]["text"], "Other company");
    for i in 1..102 {
        let mut body = input(
            &format!("note-{i}"),
            i,
            "notes",
            json!({"text":format!("Note {i}")}),
        );
        body["operation"] = json!("update");
        change(&f, "alice", body).await;
    }
    let state = read(&f, "alice").await;
    assert_eq!(state["revision"], 102);
    assert_eq!(state["comments"][0]["text"], "Company");
    assert_eq!(state["activity"].as_array().unwrap().len(), 100);
    assert_eq!(state["activity"][0]["revision"], 102);
    assert_eq!(state["activity"][99]["revision"], 3);
    assert_eq!(
        other
            .collaboration(&token("alice"), &request)
            .await
            .unwrap()["revision"],
        1
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn collaboration_limits_refuse_overflow_without_hiding_existing_items() {
    let f = fixture().await;
    let state = change(
        &f,
        "alice",
        input("first", 0, "comments", json!({"text":"Keep"})),
    )
    .await;
    // Simulate an imported full collection while retaining its valid head and event.
    f.sql("INSERT INTO aether_access.collaboration_items SELECT 'company','discussion','comments','fixture-'||i,i,jsonb_build_object('id','fixture-'||i,'author','alice','text','Kept','created',0,'updated',0,'parent',null,'revision',null,'branch','Main','resolved',false) FROM generate_series(1,4999) i").await;
    assert_eq!(
        read(&f, "alice").await["comments"]
            .as_array()
            .unwrap()
            .len(),
        5000
    );
    assert_eq!(
        f.library(
            "alice",
            "collaboration_mutate",
            input("overflow", 1, "comments", json!({"text":"No room"}))
        )
        .await
        .status(),
        501
    );
    let mut edit = input(
        "still-editable",
        1,
        "comments",
        json!({"text":"Still editable"}),
    );
    edit["operation"] = json!("update");
    edit["item"] = state["comments"][0]["id"].clone();
    assert_eq!(change(&f, "alice", edit).await["revision"], 2);
    // Out-of-band oversized data must not produce a partial success response.
    f.sql("UPDATE aether_access.collaboration_items SET value=jsonb_set(value,'{text}',to_jsonb(repeat('x',4000))) WHERE position>0").await;
    assert_eq!(
        f.library(
            "alice",
            "collaboration",
            json!({"app":"map","id":"discussion"})
        )
        .await
        .status(),
        501
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.collaboration_receipts",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
    assert_eq!(
        c.query_one(
            "SELECT revision FROM aether_access.collaboration_heads",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
}
