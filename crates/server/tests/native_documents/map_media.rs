use super::*;
use axum::body::Body;
use base64::{Engine, engine::general_purpose::STANDARD};
async fn put(f: &Fixture, user: &str, name: &str, bytes: Vec<u8>) -> reqwest::Response {
    f.client
        .put(format!("{}/api/map/media/{name}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .header("content-length", bytes.len())
        .body(bytes)
        .send()
        .await
        .unwrap()
}
async fn get(f: &Fixture, user: &str, name: &str) -> reqwest::Response {
    f.client
        .get(format!("{}/api/map/media/{name}", f.url))
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .send()
        .await
        .unwrap()
}
async fn delete(f: &Fixture, user: &str, name: &str) -> reqwest::Response {
    f.client
        .delete(format!("{}/api/map/media/{name}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .send()
        .await
        .unwrap()
}
fn with_media(id: &str, names: &[&str]) -> Mutation {
    mutation(
        json!({"operation_id":format!("create-{id}"),"document_id":id,"change":{"kind":"create","app":"map","name":"Show","content_base64":STANDARD.encode(serde_json::to_vec(&json!({"media":names.iter().map(|n| json!({"file":n})).collect::<Vec<_>>()})).unwrap())}}),
    )
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn private_immutable_upload_ranges_and_tombstone() {
    let f = Fixture::new().await;
    let data = vec![42; 1024 * 1024 + 31];
    assert_eq!(
        put(&f, "alice", "clip.mp4", data.clone()).await.status(),
        200
    );
    assert_eq!(
        put(&f, "alice", "clip.mp4", data.clone()).await.status(),
        200
    );
    assert_eq!(put(&f, "alice", "clip.mp4", vec![43]).await.status(), 409);
    assert_eq!(put(&f, "bob", "clip.mp4", data.clone()).await.status(), 404);
    assert_eq!(get(&f, "bob", "clip.mp4").await.status(), 404);
    assert_eq!(get(&f, "admin", "clip.mp4").await.status(), 404);
    let response = get(&f, "alice", "clip.mp4").await;
    assert_eq!(response.headers()["content-type"], "video/mp4");
    assert_eq!(response.bytes().await.unwrap().as_ref(), data);
    for (range, start, end) in [
        ("bytes=1048570-1048580", 1048570, 1048581),
        ("bytes=-10", data.len() - 10, data.len()),
        ("bytes=0-", 0, data.len()),
    ] {
        let r = f
            .client
            .get(format!("{}/api/map/media/clip.mp4", f.url))
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .header("range", range)
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 206);
        assert_eq!(r.bytes().await.unwrap().as_ref(), &data[start..end]);
    }
    for range in [
        "bytes=0-1,3-4",
        "bytes=-0",
        "bytes=999999999-",
        "bytes=+1-2",
    ] {
        let r = f
            .client
            .get(format!("{}/api/map/media/clip.mp4", f.url))
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .header("range", range)
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 416);
        assert_eq!(
            r.headers()["content-range"],
            format!("bytes */{}", data.len())
        );
    }
    assert_eq!(delete(&f, "bob", "clip.mp4").await.status(), 404);
    assert_eq!(delete(&f, "alice", "clip.mp4").await.status(), 200);
    assert_eq!(delete(&f, "alice", "clip.mp4").await.status(), 200);
    assert_eq!(get(&f, "alice", "clip.mp4").await.status(), 404);
    assert_eq!(put(&f, "alice", "clip.mp4", data).await.status(), 409);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn shared_authority_retains_history_and_cannot_launder_private_names() {
    let f = Fixture::new().await;
    assert_eq!(
        put(&f, "alice", "image.png", vec![1, 2, 3]).await.status(),
        200
    );
    assert!(matches!(
        f.docs
            .mutate(&token("bob"), &with_media("stolen", &["image.png"]))
            .await,
        Err(Error::Denied)
    ));
    assert!(f.docs.read(&token("bob"), "stolen", None).await.is_err());
    f.docs
        .mutate(&token("alice"), &with_media("show", &["image.png"]))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "show", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(get(&f, "bob", "image.png").await.status(), 200);
    // Referencing a shared asset in an independent copy is legitimate reuse.
    f.docs
        .mutate(&token("bob"), &with_media("copy", &["image.png"]))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "show", "bob", None)
        .await
        .unwrap();
    assert_eq!(get(&f, "bob", "image.png").await.status(), 200);
    f.docs
        .grant(&token("alice"), "show", "eve", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(get(&f, "eve", "image.png").await.status(), 200);
    f.docs
        .grant(&token("alice"), "show", "eve", None)
        .await
        .unwrap();
    assert_eq!(get(&f, "eve", "image.png").await.status(), 404);
    f.docs
        .mutate(&token("alice"), &save("show", "remove-media", 1))
        .await
        .unwrap();
    f.docs
        .mutate(&token("bob"), &save("copy", "remove-copy-media", 1))
        .await
        .unwrap();
    assert_eq!(delete(&f, "alice", "image.png").await.status(), 409);
    assert!(
        STANDARD
            .decode(
                f.docs
                    .read(&token("alice"), "show", Some(1))
                    .await
                    .unwrap()
                    .content_base64
            )
            .unwrap()
            .windows(9)
            .any(|w| w == b"image.png")
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_failure_and_revocation_do_not_publish_partial_assets() {
    let f = Fixture::new().await;
    assert!(
        f.docs
            .map_media_upload(&token("alice"), "short.png", 10, Body::from(vec![1, 2]))
            .await
            .is_err()
    );
    assert!(
        f.docs
            .map_media_upload(&token("alice"), "long.png", 1, Body::from(vec![1, 2]))
            .await
            .is_err()
    );
    let (sender, receiver) = tokio::sync::oneshot::channel::<Vec<u8>>();
    let body = Body::from_stream(futures_util::stream::once(async move {
        Ok::<_, std::io::Error>(receiver.await.unwrap())
    }));
    let docs = f.docs.clone();
    let task = tokio::spawn(async move {
        docs.map_media_upload(&token("alice"), "late.png", 2, body)
            .await
    });
    // The upload is waiting for its body; revoke without waiting for a held SQL lock.
    tokio::time::sleep(Duration::from_millis(150)).await;
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='alice'")
        .await;
    sender.send(vec![1, 2]).unwrap();
    assert!(task.await.unwrap().is_err());
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_access.map_media", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn boundary_rejects_cross_origin_devices_on_writes_and_invalid_media() {
    let f = Fixture::new().await;
    for (name, expected) in [
        ("page.html", 400),
        ("image.svg", 400),
        ("bad.name.png", 400),
        ("okay.PNG", 200),
    ] {
        assert_eq!(put(&f, "alice", name, vec![1]).await.status(), expected);
    }
    let r = f
        .client
        .put(format!("{}/api/map/media/no.png", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .body(vec![1])
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 403);
    let r = f
        .client
        .put(format!("{}/api/map/media/no.png", f.url))
        .header("origin", &f.url)
        .bearer_auth(format!("aether_dev_{}", "a".repeat(64)))
        .body(vec![1])
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 401);
    assert_eq!(put(&f, "alice", "zero.png", vec![]).await.status(), 413);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn concurrent_names_and_audit_failure_are_atomic() {
    let f = Fixture::new().await;
    let (a, b) = tokio::join!(
        put(&f, "alice", "same.png", vec![1; 32]),
        put(&f, "alice", "same.png", vec![2; 32])
    );
    let mut statuses = vec![a.status().as_u16(), b.status().as_u16()];
    statuses.sort();
    assert_eq!(statuses, vec![200, 409]);
    f.sql("CREATE FUNCTION reject_media_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER fail_media_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_media_audit()").await;
    assert_eq!(
        put(&f, "alice", "rollback.png", vec![1]).await.status(),
        503
    );
    assert_eq!(get(&f, "alice", "rollback.png").await.status(), 404);
    assert_eq!(delete(&f, "alice", "same.png").await.status(), 503);
    assert_eq!(get(&f, "alice", "same.png").await.status(), 200);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn player_reads_only_current_assigned_show_and_fresh_grants() {
    let f = Fixture::new().await;
    for name in ["show.png", "private.png"] {
        assert_eq!(put(&f, "bob", name, vec![1, 2]).await.status(), 200);
    }
    f.docs
        .mutate(&token("bob"), &with_media("show", &["show.png"]))
        .await
        .unwrap();
    f.docs
        .grant(&token("bob"), "show", "alice", Some(Role::Viewer))
        .await
        .unwrap();
    let announce: aether_server::documents::map_devices::Announcement=serde_json::from_value(json!({"device_id":"pi","pairing_secret":"private-possession-proof-01234567890123456789","name":"Pi"})).unwrap();
    let enrollment = f.docs.map_announce(&announce, None).await.unwrap();
    let claim =
        serde_json::from_value(json!({"action":"claim","code":enrollment["code"]})).unwrap();
    f.docs
        .map_device_action(&token("alice"), &claim)
        .await
        .unwrap();
    let paired = f.docs.map_announce(&announce, None).await.unwrap();
    let bearer = paired["token"].as_str().unwrap();
    let assignment =
        serde_json::from_value(json!({"action":"assign","device_id":"pi","document":"show"}))
            .unwrap();
    f.docs
        .map_device_action(&token("alice"), &assignment)
        .await
        .unwrap();
    for (name, status) in [("show.png", 200), ("private.png", 404)] {
        assert_eq!(
            f.client
                .get(format!("{}/api/map/media/{name}", f.url))
                .bearer_auth(bearer)
                .send()
                .await
                .unwrap()
                .status(),
            status
        );
    }
    f.docs
        .grant(&token("bob"), "show", "alice", None)
        .await
        .unwrap();
    assert_eq!(
        f.client
            .get(format!("{}/api/map/media/show.png", f.url))
            .bearer_auth(bearer)
            .send()
            .await
            .unwrap()
            .status(),
        404
    );
    f.docs
        .grant(&token("bob"), "show", "alice", Some(Role::Viewer))
        .await
        .unwrap();
    f.docs
        .mutate(&token("bob"), &save("show", "remove", 1))
        .await
        .unwrap();
    // A history reference retains bytes, but does not expand player authority.
    assert_eq!(get(&f, "alice", "show.png").await.status(), 200);
    assert_eq!(
        f.client
            .get(format!("{}/api/map/media/show.png", f.url))
            .bearer_auth(bearer)
            .send()
            .await
            .unwrap()
            .status(),
        404
    );
    assert_eq!(
        f.client
            .get(format!("{}/api/map/media/show.png", f.url))
            .bearer_auth(bearer)
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn branch_only_media_retains_bytes_and_invalid_binding_rolls_back_revision() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("show"))
        .await
        .unwrap();
    assert_eq!(put(&f, "alice", "branch.png", vec![9]).await.status(), 200);
    let response=f.library("alice","branch_create",json!({"app":"map","id":"show","operation_id":"fork","expected_revision":1,"from_revision":1,"name":"Branch"})).await;
    assert_eq!(response.status(), 200);
    let branch = response.json::<Value>().await.unwrap()["branch_id"].clone();
    let content = STANDARD.encode(br#"{"media":[{"file":"branch.png"}]}"#);
    let response=f.library("alice","save",json!({"app":"map","id":"show","branch":branch,"operation_id":"branch-save","expected_revision":1,"data_base64":content})).await;
    let status = response.status();
    let result = response.json::<Value>().await.unwrap();
    assert_eq!(status, 200, "{result}");
    assert_eq!(delete(&f, "alice", "branch.png").await.status(), 409);
    let bad = STANDARD.encode(br#"{"media":[{"file":"missing.png"}]}"#);
    let response=f.library("alice","save",json!({"app":"map","id":"show","branch":branch,"operation_id":"bad-save","expected_revision":2,"data_base64":bad})).await;
    assert_eq!(response.status(), 404);
    assert_eq!(
        f.docs
            .read(&token("alice"), "show", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    assert!(f.docs.read(&token("alice"), "show", Some(3)).await.is_err());
    assert!(f.docs.read(&token("alice"), "show", Some(2)).await.is_ok());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn additive_schema19_upgrade_keeps_existing_documents() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("retained"))
        .await
        .unwrap();
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/documents");
    let mut sources: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|p| p.unwrap().path())
        .filter(|p| {
            p.extension().is_some_and(|e| e == "sql")
                && p.file_name().unwrap() < std::ffi::OsStr::new("019")
                && p.file_name().unwrap() != "schema.sql"
        })
        .collect();
    sources.sort();
    sources.insert(0, dir.join("schema.sql"));
    let mut hash = Sha256::new();
    for path in sources {
        hash.update(std::fs::read(path).unwrap());
    }
    let checksum = format!("{:x}", hash.finalize());
    f.sql("DROP TABLE aether_access.live_editor_calls,aether_access.live_editors,aether_access.workspace_files, aether_access.team_labels, aether_access.map_media_refs,aether_access.map_media")
        .await;
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_access.schema_state SET version=18,checksum=$1",
            &[&checksum],
        )
        .await
        .unwrap();
    f.sql("ALTER TABLE aether_access.map_devices DROP COLUMN kind CASCADE")
        .await;
    assert!(f.docs.check_schema().await.is_err());
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(
        f.docs
            .read(&token("alice"), "retained", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    assert_eq!(put(&f, "alice", "new.png", vec![1]).await.status(), 200);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and Chromium"]
async fn actual_map_browser_uploads_decodes_ranges_and_deletes() {
    let f = Fixture::new().await;
    let output = tokio::process::Command::new(
        std::env::var("AETHER_TEST_NODE").unwrap_or_else(|_| "node".into()),
    )
    .arg(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../dev/rebuild/map_media_browser.mjs"),
    )
    .arg(&f.url)
    .arg(token("alice"))
    .output()
    .await
    .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{}", String::from_utf8_lossy(&output.stdout));
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner, optimized capacity check"]
async fn upload_512_mib_streams_over_http_and_roundtrips_hash() {
    let mut f = Fixture::new().await;
    f.client = reqwest::Client::builder()
        .no_proxy()
        .retry(reqwest::retry::never())
        .timeout(Duration::from_secs(180))
        .build()
        .unwrap();
    let bytes = 512 * 1024 * 1024usize;
    let stream = futures_util::stream::iter(
        (0..512).map(|index| Ok::<_, std::io::Error>(vec![(index % 251) as u8; 1024 * 1024])),
    );
    let response = f
        .client
        .put(format!("{}/api/map/media/large.mp4", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .header("content-length", bytes)
        .body(reqwest::Body::wrap_stream(stream))
        .send()
        .await
        .unwrap();
    let status = response.status();
    let result = response.json::<Value>().await.unwrap();
    assert_eq!(status, 200, "{result}");
    assert_eq!(result["bytes"], bytes);
    let mut expected = Sha256::new();
    for index in 0..512 {
        expected.update(vec![(index % 251) as u8; 1024 * 1024]);
    }
    let mut response = get(&f, "alice", "large.mp4").await;
    assert_eq!(response.status(), 200);
    let mut hash = Sha256::new();
    let mut count = 0;
    while let Some(part) = response.chunk().await.unwrap() {
        count += part.len();
        hash.update(part);
    }
    assert_eq!(count, bytes);
    assert_eq!(hash.finalize(), expected.finalize());
    let rejected = f
        .docs
        .map_media_upload(&token("alice"), "oversize.mp4", bytes + 1, Body::empty())
        .await;
    assert!(matches!(rejected, Err(Error::TooLarge)));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn recovery_audit_verifies_media_and_detects_manifest_corruption() {
    let f = Fixture::new().await;
    assert_eq!(
        put(&f, "alice", "audit.png", vec![7; 1024 * 1024 + 12])
            .await
            .status(),
        200
    );
    assert_eq!(f.docs.verify_uploads().await.unwrap(), 1);
    assert_eq!(delete(&f, "alice", "audit.png").await.status(), 200);
    // Tombstones retain bytes until a separately qualified garbage collector.
    assert_eq!(f.docs.verify_uploads().await.unwrap(), 1);
    f.sql("UPDATE aether_access.map_media SET digest=repeat('0',64)")
        .await;
    assert!(f.docs.verify_uploads().await.is_err());
}
