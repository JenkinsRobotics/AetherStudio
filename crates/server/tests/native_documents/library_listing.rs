use super::*;

async fn list(f: &Fixture, user: &str, view: &str, parent: Option<&str>, query: &str) -> Value {
    let response = f
        .library(
            user,
            "list",
            json!({"app":"map","view":view,"parent":parent,"query":query}),
        )
        .await;
    let status = response.status();
    let value: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
fn ids(value: &Value) -> Vec<&str> {
    value["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["id"].as_str().unwrap())
        .collect()
}
async fn file(f: &Fixture, id: &str, location: Location) {
    let mut input = create(id);
    input.location = Some(location);
    f.docs.mutate(&token("alice"), &input).await.unwrap();
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_listing_preserves_personal_workspace_search_and_folder_semantics() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Models")
        .await
        .unwrap();
    file(&f, "first", Location::default()).await;
    file(&f, "second", Location::default()).await;
    file(
        &f,
        "nested",
        Location {
            parent: Some("folder".into()),
            ..Location::default()
        },
    )
    .await;
    file(
        &f,
        "workspace",
        Location {
            workspace: Some("shared".into()),
            ..Location::default()
        },
    )
    .await;
    let root = list(&f, "alice", "personal", None, "").await;
    assert_eq!(ids(&root), ["folder", "second", "first"]);
    assert_eq!(root["files"][0]["revision"], 1);
    assert!(root["files"][0]["created"].as_f64().unwrap() > 0.0);
    assert_eq!(root["files"][1]["size"], 2);
    assert_eq!(root["capabilities"]["named_versions"], true);
    assert_eq!(root["capabilities"]["version_lifecycle"], true);
    assert_eq!(root["capabilities"]["branches"], false);
    assert_eq!(root["files"][1]["versions"], 0);
    assert!(root["files"][1]["latest_version"].is_null());
    assert_eq!(
        ids(&list(&f, "alice", "personal", Some("folder"), "").await),
        ["nested"]
    );
    assert_eq!(
        ids(&list(&f, "alice", "personal", None, "  SHOW  ").await),
        ["nested", "second", "first"]
    );
    assert_eq!(
        ids(&list(&f, "bob", "workspace", None, "").await),
        ["workspace"]
    );
    assert!(ids(&list(&f, "bob", "personal", None, "").await).is_empty());
    assert!(ids(&list(&f, "admin", "personal", None, "").await).is_empty());
    // Plain lists are metadata-only, even when the content store is unavailable.
    std::fs::remove_dir_all(f._objects.path()).unwrap();
    assert_eq!(
        ids(&list(&f, "alice", "personal", None, "").await),
        ids(&root)
    );
    assert!(!root.to_string().contains("data_base64"));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_recents_recheck_access_and_do_not_change_order_on_listing_or_rename() {
    let f = Fixture::new().await;
    file(&f, "one", Location::default()).await;
    file(&f, "two", Location::default()).await;
    assert!(ids(&list(&f, "alice", "recent", None, "").await).is_empty());
    for id in ["two", "one"] {
        assert_eq!(
            f.library("alice", "read", json!({"app":"map","id":id}))
                .await
                .status(),
            200
        );
    }
    let recent = list(&f, "alice", "recent", None, "").await;
    assert_eq!(ids(&recent), ["one", "two"]);
    assert_eq!(f.library("alice","rename",json!({"app":"map","id":"two","operation_id":"rename","expected_revision":1,"name":"100%_Show"})).await.status(),200);
    assert_eq!(
        ids(&list(&f, "alice", "recent", None, "").await),
        ["one", "two"]
    );
    assert_eq!(ids(&list(&f, "alice", "recent", None, "%_").await), ["two"]);
    f.docs
        .grant(&token("alice"), "one", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "read", json!({"app":"map","id":"one"}))
            .await
            .status(),
        200
    );
    let bob = list(&f, "bob", "recent", None, "").await;
    assert_eq!(ids(&bob), ["one"]);
    assert_eq!(bob["files"][0]["writable"], false);
    f.docs
        .grant(&token("alice"), "one", "bob", None)
        .await
        .unwrap();
    assert!(ids(&list(&f, "bob", "recent", None, "").await).is_empty());
    assert_eq!(
        ids(&list(&f, "alice", "recent", None, "").await),
        ["one", "two"]
    );
    f.identity.sign_out(&token("alice")).await.unwrap();
    assert_eq!(
        f.library("alice", "list", json!({"app":"map"}))
            .await
            .status(),
        401
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_lists_hide_private_parents_and_trashed_ancestors() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(&token("alice"), "secret", &Location::default(), "Private")
        .await
        .unwrap();
    file(
        &f,
        "child",
        Location {
            parent: Some("secret".into()),
            ..Location::default()
        },
    )
    .await;
    f.docs
        .grant(&token("alice"), "child", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "read", json!({"app":"map","id":"child"}))
            .await
            .status(),
        200
    );
    let recent = list(&f, "bob", "recent", None, "").await;
    assert_eq!(ids(&recent), ["child"]);
    assert_eq!(recent["files"][0]["parent_hidden"], true);
    assert!(!recent.to_string().contains("secret"));
    assert_eq!(
        f.library("bob", "list", json!({"app":"map","parent":"secret"}))
            .await
            .status(),
        404
    );
    assert_eq!(
        f.library("alice", "list", json!({"app":"map","parent":"child"}))
            .await
            .status(),
        400
    );
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE id='secret'")
        .await;
    assert!(ids(&list(&f, "bob", "recent", None, "").await).is_empty());
    assert!(ids(&list(&f, "alice", "personal", None, "Show").await).is_empty());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_lists_enforce_app_rules_and_strict_requests() {
    let f = Fixture::new().await;
    file(&f, "file", Location::default()).await;
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Folder")
        .await
        .unwrap();
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    let cad = f
        .library("alice", "list", json!({"app":"cad"}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(ids(&cad), ["folder"]);
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    assert_eq!(
        ids(&list(&f, "alice", "personal", None, "").await),
        ["file"]
    );
    assert_eq!(
        f.library("alice", "list", json!({"app":"map","parent":"folder"}))
            .await
            .status(),
        404
    );
    for extra in [
        json!({"view":"trash"}),
        json!({"view":"shared"}),
        json!({"actor":"admin"}),
        json!({"organization":"other"}),
        json!({"query":"a\n"}),
        json!({"query":"x".repeat(1025)}),
        json!({"parent":"../private"}),
    ] {
        let mut request = json!({"app":"map"});
        request
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        assert_eq!(f.library("alice", "list", request).await.status(), 400);
    }
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        f.library("alice", "list", json!({"app":"map"}))
            .await
            .status(),
        404
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_listing_bound_fails_without_partial_results_or_private_data() {
    let f = Fixture::new().await;
    // Fixture folders need no content: the guard must reject before projecting.
    f.docs
        .create_folder(&token("alice"), "seed", &Location::default())
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,folder_name) SELECT 'company','many-'||n,'default','alice','folder','drive','Item' FROM generate_series(1,2048) n").await;
    let response = f.library("alice", "list", json!({"app":"map"})).await;
    assert_eq!(response.status(), 503);
    let value = response.json::<Value>().await.unwrap();
    assert!(value.get("files").is_none());
    assert!(!value.to_string().contains("many-"));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_recents_waiting_on_access_change_observe_committed_revocation() {
    let f = Fixture::new().await;
    file(&f, "shared", Location::default()).await;
    f.docs
        .grant(&token("alice"), "shared", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "read", json!({"app":"map","id":"shared"}))
            .await
            .status(),
        200
    );
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let client = f.client.clone();
    let url = f.url.clone();
    let pending = tokio::spawn(async move {
        client
            .post(format!("{url}/api/library/list"))
            .header("origin", &url)
            .header("cookie", format!("{COOKIE}={}", token("bob")))
            .json(&json!({"app":"map","view":"recent"}))
            .send()
            .await
            .unwrap()
    });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))")
        .await;
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='shared' AND user_id='bob'", &[]).await.unwrap();
    tx.commit().await.unwrap();
    let response = pending.await.unwrap();
    assert_eq!(response.status(), 200);
    assert!(ids(&response.json::<Value>().await.unwrap()).is_empty());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_folder_metadata_tracks_canonical_structure_events() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Before")
        .await
        .unwrap();
    let before = list(&f, "alice", "personal", None, "").await;
    let result = f.post("alice","resource-change",json!({"operation_id":"rename-folder","id":"folder","expected_structure_revision":1,"change":{"kind":"rename_folder","name":"After"}})).await;
    assert_eq!(result.status(), 200);
    let after = list(&f, "alice", "personal", None, "").await;
    let a = &after["files"][0];
    let b = &before["files"][0];
    assert_eq!(a["name"], "After");
    assert_eq!(a["revision"], 2);
    assert_eq!(a["created"], b["created"]);
    assert!(a["modified"].as_f64().unwrap() > b["modified"].as_f64().unwrap());
    // Missing canonical timestamps are corruption, never invented as "now".
    f.sql("DELETE FROM aether_access.audit WHERE action='create_folder'")
        .await;
    assert_eq!(
        f.library("alice", "list", json!({"app":"map"}))
            .await
            .status(),
        503
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn library_list_and_recents_are_tenant_scoped_even_for_identical_ids() {
    let f = Fixture::new().await;
    file(&f, "same", Location::default()).await;
    assert_eq!(
        f.library("alice", "read", json!({"app":"map","id":"same"}))
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
    let request = |view: &str| {
        serde_json::from_value::<aether_server::documents::library::Request>(
            json!({"action":"list","app":"map","view":view}),
        )
        .unwrap()
    };
    assert!(
        ids(&other
            .library(&token("alice"), &request("recent"))
            .await
            .unwrap())
        .is_empty()
    );
    other
        .mutate(&token("alice"), &create("same"))
        .await
        .unwrap();
    other
        .mutate(&token("alice"), &save("same", "save-other", 1))
        .await
        .unwrap();
    let page = other
        .library(&token("alice"), &request("personal"))
        .await
        .unwrap();
    assert_eq!(page["files"][0]["revision"], 2);
    assert!(
        ids(&other
            .library(&token("alice"), &request("recent"))
            .await
            .unwrap())
        .is_empty()
    );
    assert_eq!(
        list(&f, "alice", "personal", None, "").await["files"][0]["revision"],
        1
    );
    assert_eq!(ids(&list(&f, "alice", "recent", None, "").await), ["same"]);
}
