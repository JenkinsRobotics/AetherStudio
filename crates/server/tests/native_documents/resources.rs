use super::*;

fn place(parent: Option<&str>) -> Location {
    Location {
        parent: parent.map(str::to_owned),
        ..Location::default()
    }
}
async fn folder(f: &Fixture, id: &str, parent: Option<&str>) {
    f.docs
        .create_named_folder(&token("alice"), id, &place(parent), id)
        .await
        .unwrap();
}
async fn file(f: &Fixture, id: &str, parent: Option<&str>) {
    let mut input = create(id);
    input.location = Some(place(parent));
    f.docs.mutate(&token("alice"), &input).await.unwrap();
}
fn change(id: &str, revision: u32, op: &str, change: Value) -> Value {
    json!({"operation_id":op,"id":id,"expected_structure_revision":revision,"change":change})
}
async fn applied(f: &Fixture, user: &str, input: Value) -> Value {
    let response = f.post(user, "resource-change", input).await;
    let status = response.status();
    let body: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{body}");
    body
}
async fn state(f: &Fixture, user: &str, id: &str) -> Value {
    let response = f.post(user, "resource-state", json!({"id":id})).await;
    assert_eq!(response.status(), 200);
    response.json().await.unwrap()
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn folder_rename_guards_replay_and_content_revision_independence() {
    let f = Fixture::new().await;
    folder(&f, "folder", None).await;
    file(&f, "show", Some("folder")).await;
    let input = change(
        "folder",
        1,
        "rename-1",
        json!({"kind":"rename_folder","name":"  Design files  "}),
    );
    for user in ["admin", "bob"] {
        assert_eq!(
            f.post(user, "resource-change", input.clone())
                .await
                .status(),
            404
        );
    }
    let first = applied(&f, "alice", input.clone()).await;
    assert_eq!(first["resource"]["name"], "Design files");
    assert_eq!(first["resource"]["structure_revision"], 2);
    assert_eq!(first["replayed"], false);
    let repeated = applied(&f, "alice", input.clone()).await;
    assert_eq!(repeated["resource"], first["resource"]);
    assert_eq!(repeated["replayed"], true);
    assert_eq!(
        f.post(
            "alice",
            "resource-change",
            change(
                "folder",
                1,
                "stale",
                json!({"kind":"rename_folder","name":"Stale"})
            )
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        f.post(
            "alice",
            "resource-change",
            change("folder", 2, "rename-1", json!({"kind":"trash"}))
        )
        .await
        .status(),
        409
    );
    let child = state(&f, "alice", "show").await;
    assert_eq!(child["document_revision"], 1);
    assert_eq!(child["structure_revision"], 1);
    assert_eq!(
        f.docs
            .history(&token("alice"), "show", 0, 10)
            .await
            .unwrap()
            .len(),
        1
    );
    let c = f.pool.get().await.unwrap();
    let row=c.query_one("SELECT count(*),min(before_state->>'structure_revision'),min(after_state->>'structure_revision') FROM aether_access.resource_events",&[]).await.unwrap();
    assert_eq!(row.get::<_, i64>(0), 1);
    assert_eq!(row.get::<_, String>(1), "1");
    assert_eq!(row.get::<_, String>(2), "2");
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resource_receipts", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn subtree_move_preserves_content_and_revokes_cross_organization_shares() {
    let f = Fixture::new().await;
    folder(&f, "root", None).await;
    folder(&f, "inner", Some("root")).await;
    file(&f, "show", Some("inner")).await;
    f.docs
        .grant(&token("alice"), "root", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.links VALUES('company','link','show','viewer',clock_timestamp()+interval '1 hour',false); INSERT INTO aether_access.link_visits VALUES('company','link','bob')").await;
    let original = f.docs.read(&token("bob"), "show", None).await.unwrap();
    assert_eq!(f.post("admin","directory",json!({"action":"create_organization","id":"design","name":"Design","default_workspace_id":"design-ws"})).await.status(),200);
    for user in ["alice", "bob"] {
        f.docs
            .set_organization_member(&token("admin"), "design", user, Some("member"))
            .await
            .unwrap();
    }
    let destination = json!({"organization":"design","workspace":null,"parent":null});
    let result = applied(
        &f,
        "alice",
        change(
            "root",
            1,
            "move-org",
            json!({"kind":"move","destination":destination}),
        ),
    )
    .await;
    assert_eq!(result["resource"]["location"]["organization"], "design");
    for (id, parent) in [
        ("root", None),
        ("inner", Some("root")),
        ("show", Some("inner")),
    ] {
        let s = state(&f, "alice", id).await;
        assert_eq!(s["location"]["organization"], "design");
        assert_eq!(s["location"]["parent"], json!(parent));
        assert_eq!(s["structure_revision"], 2);
        assert_eq!(
            f.post("bob", "resource-state", json!({"id":id}))
                .await
                .status(),
            404
        );
    }
    let saved = f.docs.read(&token("alice"), "show", None).await.unwrap();
    assert_eq!(
        serde_json::to_value(saved).unwrap(),
        serde_json::to_value(original).unwrap()
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.grants", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    assert!(
        c.query_one(
            "SELECT revoked FROM aether_access.links WHERE id='link'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, bool>(0)
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resource_events", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        3
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn move_validates_entire_tree_and_destination_before_mutating() {
    let f = Fixture::new().await;
    folder(&f, "root", None).await;
    folder(&f, "inner", Some("root")).await;
    folder(&f, "destination", None).await;
    file(&f, "show", Some("inner")).await;
    let mv = |parent| {
        change(
            "root",
            1,
            "move",
            json!({"kind":"move","destination":place(parent)}),
        )
    };
    assert_eq!(
        f.post("alice", "resource-change", mv(Some("inner")))
            .await
            .status(),
        400
    );
    assert_eq!(
        f.post("alice", "resource-change", mv(Some("show")))
            .await
            .status(),
        404
    );
    // A workspace creator owns the root but not every child; a root move cannot
    // extract another owner's content without checking that descendant.
    f.sql("UPDATE aether_access.resources SET workspace='shared' WHERE id IN ('root','inner','show'); UPDATE aether_access.resources SET owner='bob' WHERE id='show'").await;
    assert_eq!(
        f.post("alice", "resource-change", mv(Some("destination")))
            .await
            .status(),
        404
    );
    assert_eq!(state(&f, "alice", "root").await["structure_revision"], 1);
    f.sql("UPDATE aether_access.resources SET owner='alice' WHERE id='show'")
        .await;
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        f.post("alice", "resource-change", mv(Some("destination")))
            .await
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    // A malformed cross-location descendant is not silently repaired by moving.
    f.sql("UPDATE aether_access.resources SET workspace=NULL WHERE id='show'")
        .await;
    assert_eq!(
        f.post("alice", "resource-change", mv(Some("destination")))
            .await
            .status(),
        404
    );
    f.sql("UPDATE aether_access.resources SET workspace='shared' WHERE id='show'")
        .await;
    applied(&f, "alice", mv(Some("destination"))).await;
    assert_eq!(
        state(&f, "alice", "show").await["location"]["workspace"],
        Value::Null
    );
    assert_eq!(
        state(&f, "alice", "root").await["location"]["parent"],
        "destination"
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn recycle_restore_preserves_independent_children_and_history() {
    let f = Fixture::new().await;
    folder(&f, "root", None).await;
    file(&f, "active", Some("root")).await;
    file(&f, "recycled", Some("root")).await;
    let trash = |id, op| change(id, 1, op, json!({"kind":"trash"}));
    applied(&f, "alice", trash("recycled", "child-trash")).await;
    applied(&f, "alice", trash("root", "root-trash")).await;
    for id in ["active", "recycled"] {
        assert!(matches!(
            f.docs.read(&token("alice"), id, None).await,
            Err(Error::Denied)
        ));
    }
    assert_eq!(state(&f, "alice", "active").await["trashed"], false);
    assert_eq!(state(&f, "alice", "recycled").await["trashed"], true);
    let restore_child = change("recycled", 2, "child-restore", json!({"kind":"restore"}));
    assert_eq!(
        f.post("alice", "resource-change", restore_child.clone())
            .await
            .status(),
        404
    );
    applied(
        &f,
        "alice",
        change("root", 2, "root-restore", json!({"kind":"restore"})),
    )
    .await;
    assert!(f.docs.read(&token("alice"), "active", None).await.is_ok());
    assert!(matches!(
        f.docs.read(&token("alice"), "recycled", None).await,
        Err(Error::Denied)
    ));
    applied(&f, "alice", restore_child).await;
    assert_eq!(
        f.docs
            .history(&token("alice"), "recycled", 0, 10)
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        state(&f, "alice", "recycled").await["structure_revision"],
        3
    );
    // A retry of the original trash is a receipt lookup, not another deletion.
    assert_eq!(
        applied(&f, "alice", trash("root", "root-trash")).await["replayed"],
        true
    );
    assert!(f.docs.read(&token("alice"), "active", None).await.is_ok());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn structural_events_receipts_and_subtree_changes_rollback_together() {
    let f = Fixture::new().await;
    folder(&f, "root", None).await;
    folder(&f, "destination", None).await;
    file(&f, "child", Some("root")).await;
    let input = change(
        "root",
        1,
        "atomic",
        json!({"kind":"move","destination":place(Some("destination"))}),
    );
    // Failure after root metadata/event update must roll back the entire subtree.
    f.sql("CREATE FUNCTION reject_child_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='child' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_child_event BEFORE INSERT ON aether_access.resource_events FOR EACH ROW EXECUTE FUNCTION reject_child_event()").await;
    assert_eq!(
        f.post("alice", "resource-change", input.clone())
            .await
            .status(),
        503
    );
    assert_eq!(
        state(&f, "alice", "root").await["location"]["parent"],
        Value::Null
    );
    for id in ["root", "child"] {
        assert_eq!(state(&f, "alice", id).await["structure_revision"], 1);
    }
    let c = f.pool.get().await.unwrap();
    for table in ["resource_events", "resource_receipts"] {
        assert_eq!(
            c.query_one(&format!("SELECT count(*) FROM aether_access.{table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
    f.sql("DROP TRIGGER reject_child_event ON aether_access.resource_events; CREATE FUNCTION reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt fixture'; END $$; CREATE TRIGGER reject_receipt BEFORE INSERT ON aether_access.resource_receipts FOR EACH ROW EXECUTE FUNCTION reject_receipt()").await;
    assert_eq!(
        f.post("alice", "resource-change", input.clone())
            .await
            .status(),
        503
    );
    assert_eq!(state(&f, "alice", "root").await["structure_revision"], 1);
    f.sql("DROP TRIGGER reject_receipt ON aether_access.resource_receipts")
        .await;
    applied(&f, "alice", input).await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn current_permissions_guard_state_replays_and_waiting_mutations() {
    let f = Fixture::new().await;
    folder(&f, "private-parent", None).await;
    folder(&f, "shared-child", Some("private-parent")).await;
    f.docs
        .grant(&token("alice"), "shared-child", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let visible = state(&f, "bob", "shared-child").await;
    assert_eq!(visible["location"]["parent"], Value::Null);
    assert_eq!(visible["parent_hidden"], true);
    let input = change(
        "shared-child",
        1,
        "bob-rename",
        json!({"kind":"rename_folder","name":"Shared"}),
    );
    assert_eq!(
        applied(&f, "bob", input.clone()).await["resource"]["parent_hidden"],
        true
    );
    assert_eq!(
        f.post(
            "bob",
            "resource-change",
            change("shared-child", 2, "not-owner", json!({"kind":"trash"}))
        )
        .await
        .status(),
        404
    );
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let docs = f.docs.clone();
    let pending_input: aether_protocol_core::resources::ResourceMutation =
        serde_json::from_value(input.clone()).unwrap();
    let pending =
        tokio::spawn(async move { docs.change_resource(&token("bob"), &pending_input).await });
    f.waiting("pg_advisory_xact_lock(hashtextextended($1,1095062604))")
        .await;
    tx.execute(
        "DELETE FROM aether_access.grants WHERE resource='shared-child' AND user_id='bob'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(pending.await.unwrap(), Err(Error::Denied)));
    assert_eq!(f.post("bob", "resource-change", input).await.status(), 404);
    assert_eq!(
        f.post("admin", "resource-state", json!({"id":"shared-child"}))
            .await
            .status(),
        404
    );
    // Competing edits on the same structural revision have exactly one winner.
    let one = change(
        "shared-child",
        2,
        "one",
        json!({"kind":"rename_folder","name":"One"}),
    );
    let two = change(
        "shared-child",
        2,
        "two",
        json!({"kind":"rename_folder","name":"Two"}),
    );
    let (one, two) = tokio::join!(
        f.post("alice", "resource-change", one),
        f.post("alice", "resource-change", two)
    );
    let mut status = [one.status().as_u16(), two.status().as_u16()];
    status.sort();
    assert_eq!(status, [200, 409]);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn resource_input_boundaries_and_tenant_isolation() {
    let f = Fixture::new().await;
    folder(&f, "folder", None).await;
    for input in [
        json!({"id":"folder","change":{"kind":"trash"}}),
        change("folder", 0, "zero", json!({"kind":"trash"})),
        change("folder", 1, "bad/id", json!({"kind":"trash"})),
        change(
            "folder",
            1,
            "bad-name",
            json!({"kind":"rename_folder","name":"\n"}),
        ),
        change(
            "folder",
            1,
            "unknown",
            json!({"kind":"trash","actor":"admin"}),
        ),
        change(
            "folder",
            1,
            "bad-dest",
            json!({"kind":"move","destination":{"organization":"bad/id"}}),
        ),
    ] {
        assert_eq!(
            f.post("alice", "resource-change", input).await.status(),
            400
        );
    }
    file(&f, "file", None).await;
    assert_eq!(
        f.post(
            "alice",
            "resource-change",
            change(
                "file",
                1,
                "file-rename",
                json!({"kind":"rename_folder","name":"No"})
            )
        )
        .await
        .status(),
        400
    );
    let other = Documents::new(
        f.pool.clone(),
        Identity::new(f.pool.clone(), "other", 1).unwrap(),
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    assert!(
        other
            .resource_state(&token("alice"), "folder")
            .await
            .is_err()
    );
    assert_eq!(state(&f, "alice", "folder").await["structure_revision"], 1);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn resource_schema3_migration_is_atomic_preserves_files_and_refuses_drift() {
    let f = Fixture::new().await;
    folder(&f, "folder", None).await;
    file(&f, "file", Some("folder")).await;
    f.access_before_branch_metadata().await;
    f.sql("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; DROP TABLE aether_access.legacy_file_metadata; DROP TABLE aether_access.workspace_preference_events,aether_access.workspace_preference_receipts,aether_access.workspace_preferences; DROP TABLE aether_access.collaboration_events,aether_access.collaboration_receipts,aether_access.collaboration_items,aether_access.collaboration_heads; DROP TABLE aether_access.version_events,aether_access.version_receipts,aether_access.named_versions; DROP TABLE aether_access.legacy_history_annotations; DROP TABLE aether_access.library_recents; DROP TABLE aether_access.resource_events,aether_access.resource_receipts; DROP INDEX aether_access.recycle_roots; ALTER TABLE aether_access.resources DROP COLUMN structure_revision").await;
    let mut hash = Sha256::new();
    for sql in [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
    ] {
        hash.update(sql);
    }
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_access.schema_state SET version=3,checksum=$1",
            &[&format!("{:x}", hash.finalize())],
        )
        .await
        .unwrap();
    assert!(f.docs.check_schema().await.is_err());
    f.sql("CREATE TABLE aether_access.resource_events(conflict boolean)")
        .await;
    assert!(f.docs.migrate().await.is_err());
    assert_eq!(f.pool.get().await.unwrap().query_one("SELECT count(*) FROM information_schema.columns WHERE table_schema='aether_access' AND table_name='resources' AND column_name='structure_revision'",&[]).await.unwrap().get::<_,i64>(0),0);
    f.sql("DROP TABLE aether_access.resource_events").await;
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(state(&f, "alice", "file").await["structure_revision"], 1);
    assert_eq!(
        state(&f, "alice", "file").await["location"]["parent"],
        "folder"
    );
    assert_eq!(
        f.docs
            .read(&token("alice"), "file", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    f.sql("UPDATE aether_access.schema_state SET checksum='wrong'")
        .await;
    assert!(matches!(f.docs.migrate().await, Err(Error::Incompatible)));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn recycle_listing_pages_authorized_roots_and_reveals_children_after_restore() {
    let f = Fixture::new().await;
    folder(&f, "a-folder", None).await;
    file(&f, "b-child", Some("a-folder")).await;
    file(&f, "z-file", None).await;
    for id in ["b-child", "a-folder", "z-file"] {
        applied(
            &f,
            "alice",
            change(id, 1, &format!("trash-{id}"), json!({"kind":"trash"})),
        )
        .await;
    }
    f.docs
        .create_folder(&token("bob"), "m-private", &place(None))
        .await
        .unwrap();
    applied(
        &f,
        "bob",
        change("m-private", 1, "private-trash", json!({"kind":"trash"})),
    )
    .await;
    let query = |after: Option<&str>| json!({"organization":"default","workspace":null,"limit":1,"after":after});
    let first = f.post("alice", "recycle", query(None)).await;
    assert_eq!(first.status(), 200);
    let first: Value = first.json().await.unwrap();
    assert_eq!(first["resources"][0]["id"], "a-folder");
    assert_eq!(first["next_after"], "a-folder");
    let second: Value = f
        .post("alice", "recycle", query(Some("a-folder")))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(second["resources"][0]["id"], "z-file");
    assert_eq!(second["next_after"], Value::Null);
    let admin: Value = f
        .post("admin", "recycle", query(None))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(admin["resources"], json!([]));
    applied(
        &f,
        "alice",
        change("a-folder", 2, "restore-root", json!({"kind":"restore"})),
    )
    .await;
    let next: Value = f
        .post("alice", "recycle", query(None))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(next["resources"][0]["id"], "b-child");
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    let disabled: Value = f
        .post("alice", "recycle", query(None))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(disabled["resources"], json!([]));
    assert_eq!(
        f.post(
            "alice",
            "recycle",
            json!({"organization":"private","limit":10})
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        f.post(
            "alice",
            "recycle",
            json!({"organization":"default","limit":101})
        )
        .await
        .status(),
        400
    );
    // Hidden entries cannot leak a cursor or a partial success when a scan caps.
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,folder_name,trashed) SELECT 'company','hidden-'||lpad(n::text,5,'0'),'default','bob','folder','drive','Secret',true FROM generate_series(1,2048) n").await;
    assert_eq!(f.post("alice", "recycle", query(None)).await.status(), 503);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn move_tree_budgets_and_recycled_descendants_remain_atomic() {
    let f = Fixture::new().await;
    folder(&f, "root", None).await;
    folder(&f, "destination", None).await;
    folder(&f, "recycled", Some("root")).await;
    applied(
        &f,
        "alice",
        change("recycled", 1, "recycle", json!({"kind":"trash"})),
    )
    .await;
    let mv = change(
        "root",
        1,
        "move",
        json!({"kind":"move","destination":place(Some("destination"))}),
    );
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,parent,owner,kind,app,folder_name) SELECT 'company','child-'||n::text,'default','root','alice','folder','drive','Child' FROM generate_series(1,1024) n").await;
    assert_eq!(
        f.post("alice", "resource-change", mv.clone())
            .await
            .status(),
        503
    );
    assert_eq!(state(&f, "alice", "root").await["structure_revision"], 1);
    f.sql("DELETE FROM aether_access.resources WHERE id LIKE 'child-%'")
        .await;
    applied(&f, "alice", mv).await;
    let child = state(&f, "alice", "recycled").await;
    assert_eq!(child["trashed"], true);
    assert_eq!(child["structure_revision"], 3);
    assert_eq!(child["location"]["parent"], "root");
}
