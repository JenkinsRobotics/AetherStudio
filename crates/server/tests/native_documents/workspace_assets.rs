use super::*;
use aether_server::workspace_assets::WorkspaceAssets;

async fn fixture(marker: &str) -> Fixture {
    let mut f = Fixture::new().await;
    let root = tempfile::tempdir().unwrap();
    for user in ["alice", "bob"] {
        std::fs::create_dir_all(root.path().join(user).join("models")).unwrap();
        std::fs::write(
            root.path().join(user).join("models/π mesh.stl"),
            format!("{marker}-{user}"),
        )
        .unwrap();
    }
    let assets = WorkspaceAssets::load(root.path()).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(f.identity.clone(), &url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_workspace_assets(assets);
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
fn get(f: &Fixture, user: Option<&str>, path: &str) -> reqwest::RequestBuilder {
    let r = f.client.get(format!("{}{path}", f.url));
    if let Some(user) = user {
        r.header("cookie", format!("{COOKIE}={}", token(user)))
    } else {
        r
    }
}
const PATH: &str = "/map/workspace/models/%CF%80%20mesh.stl";

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn private_workspace_bytes_hash_head_query_and_isolation_match_legacy_contract() {
    let f = fixture("first").await;
    let other = fixture("second").await;
    for (host, marker) in [(&f, "first"), (&other, "second")] {
        for user in ["alice", "bob"] {
            let response = get(host, Some(user), &format!("{PATH}?v=cache-buster"))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), 200);
            let expected = format!("{marker}-{user}");
            assert_eq!(
                response.headers()["x-aether-revision"],
                format!("{:x}", Sha256::digest(&expected))
            );
            assert_eq!(
                response.headers()["content-type"],
                "application/octet-stream"
            );
            assert_eq!(response.headers()["content-disposition"], "attachment");
            assert_eq!(response.headers()["cache-control"], "no-store");
            assert_eq!(
                response.headers()["cross-origin-resource-policy"],
                "same-origin"
            );
            assert!(
                response.headers()["content-security-policy"]
                    .to_str()
                    .unwrap()
                    .contains("sandbox")
            );
            assert_eq!(response.text().await.unwrap(), expected);
        }
    }
    let response = f
        .client
        .head(format!("{}{PATH}", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["content-length"], "11");
    assert_eq!(response.bytes().await.unwrap().len(), 0);
    // Existing workspace downloads return complete objects, even with Range.
    let response = get(&f, Some("alice"), PATH)
        .header("range", "bytes=0-2")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.text().await.unwrap(), "first-alice");
    assert_eq!(
        get(&f, Some("admin"), PATH).send().await.unwrap().status(),
        404
    );
    assert_eq!(
        get(&f, Some("eve"), PATH).send().await.unwrap().status(),
        404
    );
    let c = f.pool.get().await.unwrap();
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
async fn workspace_access_rechecks_app_account_and_queued_revocation() {
    let f = fixture("fixture").await;
    assert_eq!(get(&f, None, PATH).send().await.unwrap().status(), 401);
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        get(&f, Some("alice"), PATH).send().await.unwrap().status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    assert_eq!(
        get(&f, Some("alice"), PATH).send().await.unwrap().status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(
        get(&f, Some("alice"), PATH).send().await.unwrap().status(),
        403
    );
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
    let request = get(&f, Some("alice"), PATH);
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062603))")
        .await;
    tx.execute(
        "DELETE FROM aether_identity.sessions WHERE user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 401);
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='bob'")
        .await;
    assert_eq!(
        get(&f, Some("bob"), PATH).send().await.unwrap().status(),
        401
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_routes_do_not_fall_back_or_expose_files_for_invalid_requests() {
    let f = fixture("fixture").await;
    for path in [
        "/unknown/workspace/models/file",
        "/map/workspace/models/missing",
        "/map/workspace/%252e%252e/bob/models/file",
        "/map/workspace/%00",
        "/map/workspace/%5cfile",
        "/map/workspace/%ff",
        "/map/workspace/bob/models/file",
    ] {
        let response = get(&f, Some("alice"), path).send().await.unwrap();
        assert_eq!(response.status(), 404, "{path}");
        assert!(
            response
                .json::<Value>()
                .await
                .unwrap()
                .get("error")
                .is_some()
        );
    }
    assert_eq!(
        get(&f, Some("alice"), PATH)
            .header("origin", "https://other.invalid")
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    let response = f
        .client
        .post(format!("{}{PATH}", f.url))
        .json(&json!({}))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 405);
    let missing = Fixture::new().await;
    assert_eq!(
        get(&missing, Some("alice"), PATH)
            .send()
            .await
            .unwrap()
            .status(),
        503
    );
    assert_eq!(
        get(&missing, None, PATH).send().await.unwrap().status(),
        401
    );
}

fn save(f: &Fixture, user: &str, data: Value) -> reqwest::RequestBuilder {
    f.client
        .post(format!("{}/map/files/save", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&data)
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn workspace_save_keeps_imported_base_guards_concurrent_edits_and_retains_all_versions() {
    let f = fixture("original").await;
    let path = "models/π mesh.stl";
    let initial = format!("{:x}", Sha256::digest(b"original-alice"));
    assert_eq!(
        save(&f, "alice", json!({"path":path,"text":"oops"}))
            .send()
            .await
            .unwrap()
            .status(),
        409
    );
    let first = save(
        &f,
        "alice",
        json!({"path":path,"text":"first","expected_revision":initial}),
    )
    .send()
    .await
    .unwrap();
    assert_eq!(first.status(), 200);
    let revision = first.json::<Value>().await.unwrap()["revision"].clone();
    let a = save(
        &f,
        "alice",
        json!({"path":path,"text":"second A","expected_revision":revision}),
    );
    let b = save(
        &f,
        "alice",
        json!({"path":path,"text":"second B","expected_revision":revision}),
    );
    let (a, b) = tokio::join!(a.send(), b.send());
    let mut statuses = [a.unwrap().status().as_u16(), b.unwrap().status().as_u16()];
    statuses.sort();
    assert_eq!(statuses, [200, 409]);
    let result = get(&f, Some("alice"), PATH).send().await.unwrap();
    let current = result.headers()["x-aether-revision"]
        .to_str()
        .unwrap()
        .to_string();
    let text = result.text().await.unwrap();
    assert!(matches!(text.as_str(), "second A" | "second B"));
    assert_eq!(current, format!("{:x}", Sha256::digest(text.as_bytes())));
    assert_eq!(
        get(&f, Some("bob"), PATH)
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap(),
        "original-bob"
    );
    assert_eq!(
        save(
            &f,
            "alice",
            json!({"path":path,"text":text,"expected_revision":current})
        )
        .send()
        .await
        .unwrap()
        .status(),
        200
    );
    let c = f.pool.get().await.unwrap();
    let rows = c.query("SELECT sequence,digest FROM aether_access.workspace_files WHERE owner='alice' ORDER BY sequence",&[]).await.unwrap();
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0].get::<_, String>(1), initial);
    assert_eq!(rows[1].get::<_, String>(1), revision.as_str().unwrap());
    assert_eq!(rows[2].get::<_, String>(1), current);
    f.docs.verify_uploads().await.unwrap();
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn new_workspace_file_survives_host_restart_empty_files_work_and_audit_failure_rolls_back() {
    let mut f = fixture("fixture").await;
    for path in ["../secret", "/etc/passwd", "a/%2e%2e/b", "a//b", "a/\\b"] {
        assert_eq!(
            save(&f, "alice", json!({"path":path,"text":"x"}))
                .send()
                .await
                .unwrap()
                .status(),
            400
        );
    }
    let empty = save(&f, "alice", json!({"path":"empty.txt","text":""}))
        .send()
        .await
        .unwrap();
    assert_eq!(empty.status(), 200);
    let empty_hash = empty.json::<Value>().await.unwrap()["revision"].clone();
    f.sql("CREATE FUNCTION fail_workspace_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='workspace_file_saved' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_workspace BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION fail_workspace_audit()").await;
    assert_eq!(
        save(
            &f,
            "alice",
            json!({"path":"empty.txt","text":"changed","expected_revision":empty_hash})
        )
        .send()
        .await
        .unwrap()
        .status(),
        503
    );
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    // No imported snapshot: the new native file is durable independently.
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone());
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    let result = get(&f, Some("alice"), "/map/workspace/empty.txt")
        .send()
        .await
        .unwrap();
    assert_eq!(result.status(), 200);
    assert_eq!(
        result.headers()["x-aether-revision"],
        empty_hash.as_str().unwrap()
    );
    assert!(result.bytes().await.unwrap().is_empty());
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        save(
            &f,
            "alice",
            json!({"path":"empty.txt","text":"x","expected_revision":empty_hash})
        )
        .send()
        .await
        .unwrap()
        .status(),
        404
    );
    assert_eq!(
        get(&f, Some("alice"), "/map/workspace/empty.txt")
            .send()
            .await
            .unwrap()
            .status(),
        404
    );
}
