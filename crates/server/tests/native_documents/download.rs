use super::*;
use aether_protocol_core::storage::{DocumentChange, DocumentMutation};
use aether_server::attachments::Attachments;
use aether_store::hosted::AuthorizedScope;
use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::StatusCode;

async fn fixture() -> Fixture {
    let mut f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("seed"))
        .await
        .unwrap();
    let root = tempfile::tempdir().unwrap();
    for data in [b"old image".as_slice(), b"new image".as_slice()] {
        std::fs::write(
            root.path().join(format!("{:x}", Sha256::digest(data))),
            data,
        )
        .unwrap();
    }
    let attachments = Attachments::load(root.path()).unwrap();
    // Use the trusted store to model the verified legacy import. Public writes
    // are deliberately forbidden from introducing these references.
    let store = HostedStore::new(
        f.pool.clone(),
        ContentStore::local(f._objects.path()).unwrap(),
    );
    let scope = AuthorizedScope::new("company", "alice").unwrap();
    for (revision, data) in [(1, b"old image"), (2, b"new image")] {
        let descriptor = STANDARD.encode(serde_json::to_vec(&json!({"aether_drive_blob":format!("{:x}",Sha256::digest(data)),"size":data.len()})).unwrap());
        let change = if revision == 1 {
            DocumentChange::Create {
                app: "drive".into(),
                name: "π image.PNG".into(),
                content_base64: descriptor,
            }
        } else {
            DocumentChange::Save {
                expected_revision: 1,
                content_base64: descriptor,
            }
        };
        store
            .mutate(
                &scope,
                &DocumentMutation {
                    actor: "alice".into(),
                    document_id: "image".into(),
                    operation_id: format!("import-{revision}"),
                    change,
                },
            )
            .await
            .unwrap();
    }
    f.sql("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app) VALUES('company','image','default','alice','document','drive')").await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(f.identity.clone(), &url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_attachments(attachments);
    f.task.abort();
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    f.url = url;
    f
}
fn get(f: &Fixture, user: Option<&str>, query: &str) -> reqwest::RequestBuilder {
    let request = f
        .client
        .get(format!("{}/api/drive/download?{query}", f.url));
    if let Some(user) = user {
        request.header("cookie", format!("{COOKIE}={}", token(user)))
    } else {
        request
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn downloads_original_bytes_saved_revisions_ranges_and_head_without_descriptors() {
    let f = fixture().await;
    let r = get(&f, Some("alice"), "id=image&preview=1")
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), StatusCode::OK);
    assert_eq!(r.headers()["content-type"], "image/png");
    assert!(
        r.headers()["content-disposition"]
            .to_str()
            .unwrap()
            .starts_with("inline; filename*=UTF-8''%CF%80%20image.PNG")
    );
    assert_eq!(r.headers()["cache-control"], "no-store");
    assert_eq!(r.headers()["x-content-type-options"], "nosniff");
    assert_eq!(r.headers()["cross-origin-resource-policy"], "same-origin");
    assert_eq!(r.bytes().await.unwrap(), &b"new image"[..]);
    let r = get(&f, Some("alice"), "id=image&revision=1")
        .header("range", "bytes=1-3")
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(r.headers()["content-range"], "bytes 1-3/9");
    assert!(
        r.headers()["content-disposition"]
            .to_str()
            .unwrap()
            .starts_with("attachment;")
    );
    assert_eq!(r.bytes().await.unwrap(), &b"ld "[..]);
    let r = f
        .client
        .head(format!("{}/api/drive/download?id=image", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .send()
        .await
        .unwrap();
    assert_eq!(r.headers()["content-length"], "9");
    assert!(r.bytes().await.unwrap().is_empty());
    assert_eq!(
        get(&f, Some("alice"), "id=seed")
            .send()
            .await
            .unwrap()
            .bytes()
            .await
            .unwrap(),
        &b"{}"[..]
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn downloads_recheck_grants_apps_trash_and_sessions_for_each_range() {
    let f = fixture().await;
    assert_eq!(
        get(&f, None, "id=image").send().await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );
    for user in ["bob", "admin"] {
        assert_eq!(
            get(&f, Some(user), "id=image")
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::NOT_FOUND
        );
    }
    f.docs
        .grant(&token("alice"), "image", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        get(&f, Some("bob"), "id=image&revision=1")
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::OK
    );
    f.docs
        .grant(&token("alice"), "image", "bob", None)
        .await
        .unwrap();
    let hidden = get(&f, Some("bob"), "id=image")
        .header("range", "bytes=999-")
        .send()
        .await
        .unwrap();
    assert_eq!(hidden.status(), StatusCode::NOT_FOUND);
    assert!(!hidden.headers().contains_key("content-range"));
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    assert!(
        !get(&f, Some("alice"), "id=image")
            .send()
            .await
            .unwrap()
            .status()
            .is_success()
    );
    f.docs
        .configure_app(&token("admin"), "drive", true, false)
        .await
        .unwrap();
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE id='image'")
        .await;
    assert_eq!(
        get(&f, Some("alice"), "id=image")
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NOT_FOUND
    );
    f.sql("UPDATE aether_access.resources SET trashed=false WHERE id='image'; UPDATE aether_identity.users SET active=false WHERE id='alice'").await;
    assert_eq!(
        get(&f, Some("alice"), "id=image")
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::UNAUTHORIZED
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn download_refuses_bad_ranges_queries_missing_content_and_unsupported_folders() {
    let f = fixture().await;
    for query in [
        "id=image&revision=0",
        "id=image&revision=-1",
        "id=image&id=seed",
        "id=image&path=/tmp/secret",
        "id=image&revision=no",
    ] {
        assert_eq!(
            get(&f, Some("alice"), query).send().await.unwrap().status(),
            StatusCode::BAD_REQUEST
        );
    }
    assert_eq!(
        get(&f, Some("alice"), "id=image&revision=99")
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NOT_FOUND
    );
    for value in ["bytes=9-", "bytes=-2", "bytes=3-1", "bytes=0-2,4-6"] {
        let r = get(&f, Some("alice"), "id=image")
            .header("range", value)
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(r.headers()["content-range"], "bytes */9");
    }
    assert!(matches!(
        f.docs.download(&token("alice"), "image", None, None).await,
        Err(Error::Unavailable)
    ));
    f.sql("UPDATE aether_access.resources SET kind='folder',folder_name='Folder' WHERE id='image'")
        .await;
    assert_eq!(
        get(&f, Some("alice"), "id=image")
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NOT_IMPLEMENTED
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn ordinary_writes_cannot_claim_other_private_attachments_by_hash() {
    let f = fixture().await;
    let descriptor = STANDARD.encode(
        serde_json::to_vec(
            &json!({"size":9,"aether_drive_blob":format!("{:x}",Sha256::digest(b"new image"))}),
        )
        .unwrap(),
    );
    let input = mutation(
        json!({"operation_id":"forge","document_id":"forged","change":{"kind":"create","app":"drive","name":"forged.png","content_base64":descriptor}}),
    );
    assert!(matches!(
        f.docs.mutate(&token("bob"), &input).await,
        Err(Error::Unsupported)
    ));
    assert_eq!(
        get(&f, Some("bob"), "id=forged")
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NOT_FOUND
    );
    let plain = mutation(
        json!({"operation_id":"plain","document_id":"plain","change":{"kind":"create","app":"drive","name":"plain.txt","content_base64":"e30="}}),
    );
    f.docs.mutate(&token("bob"), &plain).await.unwrap();
    let forged = mutation(
        json!({"operation_id":"forge-save","document_id":"plain","change":{"kind":"save","expected_revision":1,"content_base64":descriptor}}),
    );
    assert!(matches!(
        f.docs.mutate(&token("bob"), &forged).await,
        Err(Error::Unsupported)
    ));
    assert_eq!(
        f.docs
            .read(&token("bob"), "plain", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    // Restoring an authorized document's already imported history remains legal.
    let restore = mutation(
        json!({"operation_id":"restore-image","document_id":"image","change":{"kind":"restore","expected_revision":2,"source_revision":1}}),
    );
    f.docs.mutate(&token("alice"), &restore).await.unwrap();
    assert_eq!(
        get(&f, Some("alice"), "id=image")
            .send()
            .await
            .unwrap()
            .bytes()
            .await
            .unwrap(),
        &b"old image"[..]
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn queued_download_observes_revocation_and_cross_site_requests_are_refused() {
    let f = fixture().await;
    f.docs
        .grant(&token("alice"), "image", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let mut blocker = f.pool.get().await.unwrap();
    let tx = blocker.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let request = get(&f, Some("bob"), "id=image&revision=1").header("range", "bytes=0-1");
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))")
        .await;
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='image' AND user_id='bob'", &[]).await.unwrap();
    tx.commit().await.unwrap();
    let denied = pending.await.unwrap();
    assert_eq!(denied.status(), StatusCode::NOT_FOUND);
    assert!(!denied.headers().contains_key("content-range"));
    assert_eq!(
        get(&f, Some("alice"), "id=image")
            .header("sec-fetch-site", "cross-site")
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );
}

async fn read_json(f: &Fixture, user: &str, id: &str) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/read", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&json!({"id":id}))
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_read_resolves_authorized_attachment_bytes_and_restored_revision() {
    let f = fixture().await;
    assert_eq!(read_json(&f, "bob", "image").await.status(), 404);
    f.docs
        .grant(&token("alice"), "image", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let reply = read_json(&f, "bob", "image").await;
    assert_eq!(reply.status(), 200);
    let value: Value = reply.json().await.unwrap();
    assert_eq!(
        STANDARD
            .decode(value["data_base64"].as_str().unwrap())
            .unwrap(),
        b"new image"
    );
    assert_eq!(
        value["sha256"],
        format!("{:x}", Sha256::digest(b"new image"))
    );
    assert_eq!(value["size"], 9);
    assert_eq!(value["revision"], 2);
    let restore = mutation(
        json!({"operation_id":"read-restore","document_id":"image","change":{"kind":"restore","expected_revision":2,"source_revision":1}}),
    );
    f.docs.mutate(&token("alice"), &restore).await.unwrap();
    let value: Value = read_json(&f, "bob", "image").await.json().await.unwrap();
    assert_eq!(value["revision"], 3);
    assert_eq!(
        value["sha256"],
        format!("{:x}", Sha256::digest(b"old image"))
    );
    assert_eq!(
        STANDARD
            .decode(value["data_base64"].as_str().unwrap())
            .unwrap(),
        b"old image"
    );
    f.docs
        .grant(&token("alice"), "image", "bob", None)
        .await
        .unwrap();
    assert_eq!(read_json(&f, "bob", "image").await.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_read_unavailable_or_oversized_attachment_never_records_success() {
    let f = fixture().await;
    let store = HostedStore::new(
        f.pool.clone(),
        ContentStore::local(f._objects.path()).unwrap(),
    );
    let scope = AuthorizedScope::new("company", "alice").unwrap();
    for (n, size, status) in [(1, 8, 503), (2, 16 * 1024 * 1024 + 1, 413)] {
        // Valid imported descriptor, but missing from the configured snapshot;
        // oversized reads are rejected before retrieving or base64-encoding it.
        let content_base64 = STANDARD.encode(
            serde_json::to_vec(&json!({"aether_drive_blob":"a".repeat(64),"size":size})).unwrap(),
        );
        let id = format!("missing-{n}");
        store
            .mutate(
                &scope,
                &DocumentMutation {
                    actor: "alice".into(),
                    operation_id: format!("import-missing-{n}"),
                    document_id: id.clone(),
                    change: DocumentChange::Create {
                        app: "drive".into(),
                        name: "Missing.pdf".into(),
                        content_base64,
                    },
                },
            )
            .await
            .unwrap();
        f.pool.get().await.unwrap().execute("INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app) VALUES('company',$1,'default','alice','document','drive')",&[&id]).await.unwrap();
        let response = read_json(&f, "alice", &id).await;
        assert_eq!(response.status(), status);
        let body: Value = response.json().await.unwrap();
        assert!(body.get("data_base64").is_none());
        if status == 413 {
            assert_eq!(body["code"], "too_large");
        }
    }
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_access.library_recents", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    // Existing download path still resolves the known attachment normally.
    assert_eq!(
        get(&f, Some("alice"), "id=image")
            .send()
            .await
            .unwrap()
            .bytes()
            .await
            .unwrap(),
        &b"new image"[..]
    );
}
