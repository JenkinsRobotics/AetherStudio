use super::*;
use aether_protocol_core::storage::{DocumentListPage, DocumentListRequest};

fn request(after: Option<&str>, limit: u32) -> DocumentListRequest {
    DocumentListRequest {
        app: None,
        query: String::new(),
        after: after.map(str::to_owned),
        limit,
    }
}
fn ids(page: &DocumentListPage) -> Vec<&str> {
    page.documents
        .iter()
        .map(|d| d.document_id.as_str())
        .collect()
}
async fn page(f: &Fixture, user: &str, input: DocumentListRequest) -> DocumentListPage {
    let response = f
        .post(user, "list", serde_json::to_value(input).unwrap())
        .await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    response.json().await.unwrap()
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_paginates_visible_results_without_private_ids_or_counts() {
    let f = Fixture::new().await;
    // More than a scan batch of private files precedes the authorized results.
    for i in 0..70 {
        f.docs
            .mutate(&token("alice"), &create(&format!("a-private-{i:03}")))
            .await
            .unwrap();
    }
    for id in ["visible-1", "visible-2", "visible-3"] {
        f.docs.mutate(&token("alice"), &create(id)).await.unwrap();
        f.docs
            .grant(&token("alice"), id, "bob", Some(Role::Viewer))
            .await
            .unwrap();
    }
    f.docs
        .mutate(&token("alice"), &create("zzz-secret"))
        .await
        .unwrap();
    let first = page(&f, "bob", request(None, 2)).await;
    assert_eq!(ids(&first), ["visible-1", "visible-2"]);
    assert_eq!(first.next_after.as_deref(), Some("visible-2"));
    let last = page(&f, "bob", request(first.next_after.as_deref(), 2)).await;
    assert_eq!(ids(&last), ["visible-3"]);
    assert!(last.next_after.is_none()); // a later private file is not lookahead
    for user in ["admin", "eve"] {
        let empty = page(&f, user, request(None, 2)).await;
        assert!(empty.documents.is_empty());
        assert!(empty.next_after.is_none());
    }
    let value = serde_json::to_value(&first).unwrap();
    assert_eq!(value.as_object().unwrap().len(), 2);
    let summary = value["documents"][0].as_object().unwrap();
    assert_eq!(summary.len(), 6);
    for field in [
        "actor",
        "content_base64",
        "content_sha256",
        "operation_id",
        "total",
    ] {
        assert!(!summary.contains_key(field));
    }
    // A client-controlled seek boundary neither proves existence nor grants access.
    let guessed = page(&f, "eve", request(Some("visible-1"), 100)).await;
    assert!(guessed.documents.is_empty());
    assert!(guessed.next_after.is_none());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_searches_current_names_literally_without_fetching_content() {
    let f = Fixture::new().await;
    for (id, name, app) in [
        ("a", "Alpha SHOW 100%_final", "map"),
        ("b", "Other", "drive"),
    ] {
        let mut m = create(id);
        m.change = aether_protocol_core::storage::DocumentChange::Create {
            app: app.into(),
            name: name.into(),
            content_base64: "e30=".into(),
        };
        f.docs.mutate(&token("alice"), &m).await.unwrap();
    }
    let mut query = request(None, 100);
    query.query = "show 100%_".into();
    assert_eq!(ids(&page(&f, "alice", query.clone()).await), ["a"]);
    query.query = "%".into();
    assert_eq!(ids(&page(&f, "alice", query.clone()).await), ["a"]);
    query.query = "' OR true --".into();
    assert!(page(&f, "alice", query.clone()).await.documents.is_empty());
    query.query.clear();
    query.app = Some("drive".into());
    assert_eq!(ids(&page(&f, "alice", query.clone()).await), ["b"]);
    f.docs
        .mutate(
            &token("alice"),
            &mutation(json!({
                "operation_id":"rename-a", "document_id":"a",
                "change":{"kind":"rename","expected_revision":1,"name":"New name"}
            })),
        )
        .await
        .unwrap();
    // Discovery uses metadata only, even if the separate object backend is down.
    std::fs::remove_dir_all(f._objects.path()).unwrap();
    query.app = Some("map".into());
    query.query = "new NAME".into();
    let found = page(&f, "alice", query.clone()).await;
    assert_eq!(ids(&found), ["a"]);
    assert_eq!(found.documents[0].revision, 2);
    assert_eq!(found.documents[0].size_bytes, 2);
    query.query = "alpha".into();
    assert!(page(&f, "alice", query).await.documents.is_empty());
    assert!(f.docs.read(&token("alice"), "a", None).await.is_err());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_rechecks_ancestor_app_and_membership_permissions() {
    let f = Fixture::new().await;
    let d = &f.docs;
    d.create_folder(&token("alice"), "folder", &Location::default())
        .await
        .unwrap();
    let mut m = create("nested");
    m.location = Some(Location {
        parent: Some("folder".into()),
        ..Location::default()
    });
    d.mutate(&token("alice"), &m).await.unwrap();
    d.grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(ids(&page(&f, "bob", request(None, 10)).await), ["nested"]);
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE id='folder'")
        .await;
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    f.sql("UPDATE aether_access.resources SET trashed=false,parent='folder' WHERE id='folder'")
        .await;
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    f.sql("UPDATE aether_access.resources SET parent=NULL WHERE id='folder'")
        .await;
    d.configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    d.configure_team(&token("admin"), "design", &["bob".into()], &["map".into()])
        .await
        .unwrap();
    assert_eq!(ids(&page(&f, "bob", request(None, 10)).await), ["nested"]);
    d.configure_app(&token("admin"), "map", false, true)
        .await
        .unwrap();
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    d.configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    d.set_organization_member(&token("admin"), "default", "bob", None)
        .await
        .unwrap();
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    assert!(matches!(
        d.read(&token("bob"), "nested", None).await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_http_validation_session_and_revoked_continuations() {
    let f = Fixture::new().await;
    for id in ["a", "b", "c"] {
        f.docs.mutate(&token("alice"), &create(id)).await.unwrap();
        f.docs
            .grant(&token("alice"), id, "bob", Some(Role::Viewer))
            .await
            .unwrap();
    }
    let first = page(&f, "bob", request(None, 1)).await;
    assert_eq!(first.next_after.as_deref(), Some("a"));
    for id in ["b", "c"] {
        f.docs
            .grant(&token("alice"), id, "bob", None)
            .await
            .unwrap();
    }
    let next = page(&f, "bob", request(first.next_after.as_deref(), 1)).await;
    assert!(next.documents.is_empty());
    assert!(next.next_after.is_none());
    for invalid in [
        json!({"limit":0}),
        json!({"limit":101}),
        json!({"limit":1,"actor":"alice"}),
        json!({"limit":1,"tenant":"company"}),
        json!({"limit":1,"after":"../private"}),
        json!({"limit":1,"app":""}),
        json!({"limit":1,"query":"\u{0}"}),
        json!({"limit":1,"query":"x".repeat(1025)}),
    ] {
        assert_eq!(f.post("bob", "list", invalid).await.status(), 400);
    }
    let unauthenticated = f
        .client
        .post(format!("{}/api/v1/documents/list", f.url))
        .header("origin", &f.url)
        .json(&json!({"limit":10}))
        .send()
        .await
        .unwrap();
    assert_eq!(unauthenticated.status(), 401);
    let cross_origin = f
        .client
        .post(format!("{}/api/v1/documents/list", f.url))
        .header("origin", "https://wrong.invalid")
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({"limit":10}))
        .send()
        .await
        .unwrap();
    assert_eq!(cross_origin.status(), 403);
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='bob'")
        .await;
    assert_eq!(
        f.post("bob", "list", json!({"limit":10})).await.status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET must_change=false WHERE id='bob'")
        .await;
    f.identity.sign_out(&token("bob")).await.unwrap();
    assert_eq!(
        f.post("bob", "list", json!({"limit":10})).await.status(),
        401
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_waiting_for_permission_change_reads_the_committed_revocation() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("file"))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(ids(&page(&f, "bob", request(None, 10)).await), ["file"]);
    let mut connection = f.pool.get().await.unwrap();
    let tx = connection.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let docs = f.docs.clone();
    let waiting = tokio::spawn(async move { docs.list(&token("bob"), &request(None, 10)).await });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))")
        .await;
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='file' AND user_id='bob'", &[]).await.unwrap();
    tx.commit().await.unwrap();
    let result = waiting.await.unwrap().unwrap();
    assert!(result.documents.is_empty());
    assert!(result.next_after.is_none());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_isolates_tenants_and_rejects_inconsistent_metadata() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("same-id"))
        .await
        .unwrap();
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
    assert!(
        other
            .list(&token("alice"), &request(None, 10))
            .await
            .unwrap()
            .documents
            .is_empty()
    );
    other
        .mutate(&token("alice"), &create("same-id"))
        .await
        .unwrap();
    other
        .mutate(&token("alice"), &save("same-id", "save-other", 1))
        .await
        .unwrap();
    assert_eq!(
        other
            .list(&token("alice"), &request(None, 10))
            .await
            .unwrap()
            .documents[0]
            .revision,
        2
    );
    assert_eq!(
        page(&f, "alice", request(None, 10)).await.documents[0].revision,
        1
    );
    f.sql("UPDATE aether_access.resources SET app='drive' WHERE tenant='company' AND id='same-id'")
        .await;
    assert_eq!(
        f.post("alice", "list", json!({"limit":10})).await.status(),
        503
    );
    f.sql("UPDATE aether_access.resources SET app='map' WHERE tenant='company' AND id='same-id'; UPDATE aether_store.revisions SET metadata=jsonb_set(metadata,'{document_id}','\"spoofed\"') WHERE tenant='company'").await;
    let response = f.post("alice", "list", json!({"limit":10})).await;
    assert_eq!(response.status(), 503);
    assert!(!response.text().await.unwrap().contains("spoofed"));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_filters_workspace_and_expired_or_revoked_links() {
    let f = Fixture::new().await;
    // Enroll before seeding valid managed-workspace membership.
    page(&f, "alice", request(None, 10)).await;
    page(&f, "bob", request(None, 10)).await;
    f.sql("INSERT INTO aether_access.workspaces VALUES('company','engineering','default',false); INSERT INTO aether_access.workspace_members VALUES('company','engineering','alice','editor')").await;
    let mut m = create("managed");
    m.location = Some(Location {
        workspace: Some("engineering".into()),
        ..Location::default()
    });
    f.docs.mutate(&token("alice"), &m).await.unwrap();
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    f.sql("INSERT INTO aether_access.workspace_members VALUES('company','engineering','bob','viewer')").await;
    assert_eq!(ids(&page(&f, "bob", request(None, 10)).await), ["managed"]);
    f.sql("DELETE FROM aether_access.workspace_members WHERE user_id='bob' AND workspace='engineering'").await;
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    f.docs
        .mutate(&token("alice"), &create("linked"))
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.links VALUES('company','link','linked','viewer',clock_timestamp()+interval '1 hour',false); INSERT INTO aether_access.link_visits VALUES('company','link','bob')").await;
    assert_eq!(ids(&page(&f, "bob", request(None, 10)).await), ["linked"]);
    assert!(
        page(&f, "eve", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    f.sql("UPDATE aether_access.links SET expires=clock_timestamp()-interval '1 second'")
        .await;
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
    f.sql(
        "UPDATE aether_access.links SET expires=clock_timestamp()+interval '1 hour',revoked=true",
    )
    .await;
    assert!(
        page(&f, "bob", request(None, 10))
            .await
            .documents
            .is_empty()
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn discovery_scan_budget_never_returns_partial_success() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("000-visible"))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "000-visible", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    // Use the real create authority: every fixture has ACLs, durable content,
    // a revision, receipt, audit entry and committed change event.
    for i in 0..2050 {
        let mut m = create(&format!("hidden-{i:04}"));
        if let aether_protocol_core::storage::DocumentChange::Create { app, .. } = &mut m.change {
            *app = "drive".into();
        }
        f.docs.mutate(&token("alice"), &m).await.unwrap();
    }
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    let response = f.post("bob", "list", json!({"limit":1})).await;
    assert_eq!(response.status(), 503);
    let body: Value = response.json().await.unwrap();
    assert!(body.get("documents").is_none());
    assert!(body.get("next_after").is_none());
    // A narrower request remains useful and can prove a complete result.
    let mut query = request(None, 1);
    query.app = Some("map".into());
    let narrow = page(&f, "bob", query).await;
    assert_eq!(ids(&narrow), ["000-visible"]);
    assert!(narrow.next_after.is_none());
}
