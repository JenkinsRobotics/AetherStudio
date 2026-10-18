use super::*;
async fn edit(f: &Fixture, user: &str, action: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    for (id, name) in [("folder", "Folder"), ("destination", "Destination")] {
        f.docs
            .create_named_folder(&token("alice"), id, &Location::default(), name)
            .await
            .unwrap();
    }
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"create","document_id":"file","change":{"kind":"create","app":"map","name":"Original","content_base64":"e30="},"location":{"organization":"default","workspace":null,"parent":"folder"}}))).await.unwrap();
    f
}
fn rename(
    id: &str,
    kind: &str,
    name: &str,
    revision: u32,
    structure: u32,
    operation: &str,
) -> Value {
    json!({"id":id,"kind":kind,"name":name,"expected_revision":if kind == "folder" {structure} else {revision},"operation_id":operation})
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_edits_file_rename_preserves_bytes_and_replays_without_rewinding_later_names() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "file", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let first = rename("file", "file", "Changed", 1, 1, "rename");
    let response = edit(&f, "bob", "rename", first.clone()).await;
    assert_eq!(response.status(), 200);
    let receipt: Value = response.json().await.unwrap();
    assert_eq!(receipt["revision"], 2);
    assert_eq!(receipt["structure_revision"], 1);
    assert_eq!(receipt["name"], "Changed");
    assert_eq!(
        edit(
            &f,
            "bob",
            "rename",
            rename("file", "file", "Later", 2, 1, "later")
        )
        .await
        .status(),
        200
    );
    let replay = edit(&f, "bob", "rename", first).await;
    assert_eq!(replay.status(), 200);
    let replay: Value = replay.json().await.unwrap();
    assert_eq!(replay["replayed"], true);
    assert_eq!(replay["name"], "Later");
    assert_eq!(replay["revision"], 3);
    assert_eq!(
        edit(
            &f,
            "bob",
            "rename",
            rename("file", "file", "Stale", 1, 1, "stale")
        )
        .await
        .status(),
        409
    );
    for revision in 1..=3 {
        assert_eq!(
            f.docs
                .read(&token("alice"), "file", Some(revision))
                .await
                .unwrap()
                .content_base64,
            "e30="
        );
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_edits_folder_rename_and_move_guard_names_locations_and_content_independently() {
    let f = seed().await;
    assert_eq!(
        edit(
            &f,
            "alice",
            "rename",
            rename("folder", "folder", "destination", 1, 1, "collision")
        )
        .await
        .status(),
        409
    );
    let name = rename("folder", "folder", "Renamed", 1, 1, "rename-folder");
    let response = edit(&f, "alice", "rename", name.clone()).await;
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.json::<Value>().await.unwrap()["resource"]["structure_revision"],
        2
    );
    assert_eq!(
        edit(&f, "alice", "rename", name)
            .await
            .json::<Value>()
            .await
            .unwrap()["replayed"],
        true
    );
    let moved = json!({"id":"folder","operation_id":"move","expected_structure_revision":2,"destination":{"organization":"default","parent":"destination"}});
    let response = edit(&f, "alice", "move", moved.clone()).await;
    assert_eq!(response.status(), 200);
    assert_eq!(
        response.json::<Value>().await.unwrap()["resource"]["location"]["parent"],
        "destination"
    );
    assert_eq!(
        edit(&f, "alice", "move", moved)
            .await
            .json::<Value>()
            .await
            .unwrap()["replayed"],
        true
    );
    assert_eq!(edit(&f,"alice","move",json!({"id":"destination","operation_id":"cycle","expected_structure_revision":1,"destination":{"organization":"default","parent":"folder"}})).await.status(),400);
    let saved = f.docs.read(&token("alice"), "file", None).await.unwrap();
    assert_eq!(saved.document.revision, 1);
    assert_eq!(saved.content_base64, "e30=");
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_edits_move_restore_and_rename_collisions_never_overwrite_an_existing_item() {
    let f = seed().await;
    f.docs
        .create_named_folder(
            &token("alice"),
            "other-folder",
            &Location {
                organization: "default".into(),
                workspace: None,
                parent: Some("folder".into()),
            },
            "Different",
        )
        .await
        .unwrap();
    assert_eq!(
        edit(
            &f,
            "alice",
            "rename",
            rename(
                "other-folder",
                "folder",
                "original",
                1,
                1,
                "file-name-collision"
            )
        )
        .await
        .status(),
        409
    );
    f.docs
        .create_named_folder(
            &token("alice"),
            "duplicate",
            &Location {
                organization: "default".into(),
                workspace: None,
                parent: Some("destination".into()),
            },
            "original",
        )
        .await
        .unwrap();
    assert_eq!(edit(&f,"alice","move",json!({"id":"file","operation_id":"move","expected_structure_revision":1,"destination":{"organization":"default","parent":"destination"}})).await.status(),409);
    assert_eq!(
        edit(
            &f,
            "alice",
            "trash",
            json!({"id":"file","operation_id":"trash","expected_structure_revision":1})
        )
        .await
        .status(),
        200
    );
    f.docs
        .create_named_folder(
            &token("alice"),
            "replacement",
            &Location {
                organization: "default".into(),
                workspace: None,
                parent: Some("folder".into()),
            },
            "ORIGINAL",
        )
        .await
        .unwrap();
    assert_eq!(
        edit(
            &f,
            "alice",
            "restore",
            json!({"id":"file","operation_id":"restore","expected_structure_revision":2})
        )
        .await
        .status(),
        409
    );
    let state = f
        .docs
        .resource_state(&token("alice"), "file")
        .await
        .unwrap();
    assert!(state.trashed);
    assert_eq!(state.structure_revision, 2);
    assert_eq!(
        edit(
            &f,
            "alice",
            "rename",
            rename("destination", "folder", "folder", 1, 1, "conflict")
        )
        .await
        .status(),
        409
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_edits_current_permission_kind_and_audit_failure_cannot_leave_partial_rename() {
    let f = seed().await;
    let input = rename("file", "file", "Changed", 1, 1, "rename");
    assert_eq!(edit(&f, "bob", "rename", input.clone()).await.status(), 404);
    assert_eq!(edit(&f, "eve", "rename", input.clone()).await.status(), 404);
    assert_eq!(
        edit(
            &f,
            "alice",
            "rename",
            rename("file", "folder", "Wrong kind", 1, 1, "kind")
        )
        .await
        .status(),
        400
    );
    f.sql("CREATE FUNCTION reject_rename_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit failed'; END $$; CREATE TRIGGER reject_rename_audit BEFORE INSERT ON aether_store.audit FOR EACH ROW EXECUTE FUNCTION reject_rename_audit()").await;
    assert!(
        !edit(&f, "alice", "rename", input.clone())
            .await
            .status()
            .is_success()
    );
    assert_eq!(
        f.docs
            .read(&token("alice"), "file", None)
            .await
            .unwrap()
            .document
            .name,
        "Original"
    );
    f.sql("DROP TRIGGER reject_rename_audit ON aether_store.audit")
        .await;
    assert_eq!(edit(&f, "alice", "rename", input).await.status(), 200);
}
