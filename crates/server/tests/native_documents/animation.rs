use super::*;
use aether_server::native::animation::Animation;
use base64::{Engine, engine::general_purpose::STANDARD};
const RED_PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIUlEQVR4nGP8z0AaYCJRPcOoBmIAE1GqkMCoBmIAyaEEAEAuAR9UPEsJAAAAAElFTkSuQmCC";
const GREEN_PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIklEQVR4nGNk+M9AEmAiTTnDqAaiABNxyhBgVAMxgORQAgA/LwEfrFyWwgAAAABJRU5ErkJggg==";
async fn fixture() -> Fixture {
    let mut f = Fixture::new().await;
    f.docs
        .configure_app(&token("admin"), "animation", true, false)
        .await
        .unwrap();
    let runtime = Animation::load(std::path::Path::new(
        &std::env::var("AETHER_TEST_ANIMATION").expect("Animation worker configuration required"),
    ))
    .unwrap();
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let root = tempfile::tempdir().unwrap();
    for (user, data) in [("alice", RED_PNG), ("bob", GREEN_PNG)] {
        std::fs::create_dir(root.path().join(user)).unwrap();
        std::fs::write(
            root.path().join(user).join("image.png"),
            STANDARD.decode(data).unwrap(),
        )
        .unwrap();
    }
    std::fs::write(
        root.path().join("alice/large.png"),
        vec![0u8; 2 * 1024 * 1024 + 1],
    )
    .unwrap();
    let assets = aether_server::workspace_assets::WorkspaceAssets::load(root.path()).unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_workspace_assets(assets)
        .with_animation(runtime);
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    f
}

async fn canvas(f: &Fixture, user: &str, path: &str) -> Value {
    let result: Value = rpc(
        f,
        user,
        "canvas2d.new",
        json!({"canvas":{
            "width":16,"height":16,
            "sources":[{"id":"s","kind":"image","asset":path}],
            "surfaces":[{"id":"s","source":"s"}]
        }}),
    )
    .await
    .json()
    .await
    .unwrap();
    assert_eq!(result["ok"], true, "{result}");
    result["result"]["handle"].clone()
}

#[tokio::test]
#[ignore = "installed Animation media worker and disposable PostgreSQL"]
async fn raster_preview_reads_private_bytes_ignores_injection_and_preserves_canvas() {
    let f = fixture().await;
    for (user, expected) in [("alice", json!([255, 0, 0])), ("bob", json!([0, 255, 0]))] {
        let handle = canvas(&f, user, "image.png").await;
        let response: Value = rpc(
            &f,
            user,
            "canvas2d.matrix_preview",
            json!({
                "handle":handle,"target":{"width":1,"height":1},
                "studio_canvas": {"surfaces":[]},
                "studio_assets":{"image.png":GREEN_PNG}
            }),
        )
        .await
        .json()
        .await
        .unwrap();
        assert_eq!(response["ok"], true, "{response}");
        assert_eq!(response["result"]["rows"][0][0], expected);
        let rendered: Value = rpc(&f, user, "canvas2d.render_frame", json!({"handle":handle}))
            .await
            .json()
            .await
            .unwrap();
        assert_eq!(rendered["ok"], true, "{rendered}");
        assert!(
            STANDARD
                .decode(rendered["result"]["png_base64"].as_str().unwrap())
                .unwrap()
                .starts_with(b"\x89PNG\r\n\x1a\n")
        );
        let source: Value = rpc(&f, user, "canvas2d.get", json!({"handle":handle}))
            .await
            .json()
            .await
            .unwrap();
        assert_eq!(
            source["result"]["canvas"]["sources"][0]["asset"],
            "image.png"
        );
    }
    let handle = canvas(&f, "alice", "image.png").await;
    // App removal is rechecked before any media output and destroys its handles.
    f.docs
        .set_app_restricted(&token("admin"), "animation", true)
        .await
        .unwrap();
    assert_eq!(
        rpc(
            &f,
            "alice",
            "canvas2d.render_frame",
            json!({"handle":handle})
        )
        .await
        .status(),
        403
    );
}

#[tokio::test]
#[ignore = "installed Animation media worker and disposable PostgreSQL"]
async fn raster_preview_rejects_paths_budgets_and_bad_media_without_losing_session() {
    let f = fixture().await;
    for path in [
        "/etc/passwd",
        "../bob/image.png",
        "https://localhost/secret",
        "x/%2e%2e/secret",
    ] {
        let handle = canvas(&f, "alice", path).await;
        assert_eq!(
            rpc(
                &f,
                "alice",
                "canvas2d.render_frame",
                json!({"handle":handle})
            )
            .await
            .status(),
            400
        );
    }
    let handle = canvas(&f, "alice", "large.png").await;
    assert_eq!(
        rpc(
            &f,
            "alice",
            "canvas2d.render_frame",
            json!({"handle":handle})
        )
        .await
        .status(),
        413
    );
    let handle = canvas(&f, "bob", "large.png").await;
    assert_eq!(
        rpc(&f, "bob", "canvas2d.render_frame", json!({"handle":handle}))
            .await
            .status(),
        404
    );
    f.docs
        .workspace_save(
            &token("alice"),
            "animation",
            &aether_server::documents::workspace_files::Save {
                path: "corrupt.png".into(),
                text: "not image data".into(),
                expected_revision: None,
            },
            None,
        )
        .await
        .unwrap();
    let bad = canvas(&f, "alice", "corrupt.png").await;
    let result: Value = rpc(&f, "alice", "canvas2d.render_frame", json!({"handle":bad}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(result["error"]["code"], "invalid_media", "{result}");
    let good = canvas(&f, "alice", "image.png").await;
    let result: Value = rpc(
        &f,
        "alice",
        "canvas2d.matrix_preview",
        json!({"handle":good,"target":{"width":999999}}),
    )
    .await
    .json()
    .await
    .unwrap();
    assert_eq!(result["ok"], false);
    let result: Value = rpc(&f, "alice", "canvas2d.render_frame", json!({"handle":good}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(result["ok"], true, "{result}");
}
async fn rpc(f: &Fixture, user: &str, method: &str, params: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/animation/rpc", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&json!({"id":42,"method":method,"params":params}))
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "installed Animation worker and disposable PostgreSQL runner"]
async fn installed_engine_keeps_session_handles_and_roundtrips_workspace_bytes() {
    let f = fixture().await;
    // Independent startup hooks from one browser session may overlap. They
    // serialize behind that session's worker rather than spuriously failing.
    let (one, two) = tokio::join!(
        rpc(&f, "alice", "hello", json!({"protocol_version":1})),
        rpc(&f, "alice", "mate_types", json!({}))
    );
    assert_eq!(one.status(), 200);
    assert_eq!(two.status(), 200);
    let hello = rpc(&f, "alice", "hello", json!({"protocol_version":1}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(hello["ok"], true, "{hello}");
    assert_eq!(hello["result"]["engine"], "aether_animation");
    assert!(
        !hello["result"]["capabilities"]
            .as_array()
            .unwrap()
            .contains(&json!("shutdown"))
    );
    let created = rpc(
        &f,
        "alice",
        "new_workspace",
        json!({"name":"Native session"}),
    )
    .await
    .json::<Value>()
    .await
    .unwrap();
    assert_eq!(created["ok"], true, "{created}");
    let handle = created["result"]["handle"].as_str().unwrap();
    let own = rpc(&f, "alice", "describe_workspace", json!({"handle":handle}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(own["ok"], true);
    let other = rpc(&f, "bob", "describe_workspace", json!({"handle":handle}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(other["ok"], false);
    let saved = rpc(
        &f,
        "alice",
        "save_workspace",
        json!({"handle":handle,"return_data":true}),
    )
    .await
    .json::<Value>()
    .await
    .unwrap();
    assert_eq!(saved["ok"], true, "{saved}");
    let reopened = rpc(
        &f,
        "bob",
        "load_workspace",
        json!({"data_base64":saved["result"]["data_base64"]}),
    )
    .await
    .json::<Value>()
    .await
    .unwrap();
    assert_eq!(reopened["ok"], true, "{reopened}");
    f.docs
        .set_app_restricted(&token("admin"), "animation", true)
        .await
        .unwrap();
    assert_eq!(
        rpc(&f, "alice", "describe_workspace", json!({"handle":handle}))
            .await
            .status(),
        403
    );
    f.docs
        .set_app_restricted(&token("admin"), "animation", false)
        .await
        .unwrap();
    assert_eq!(
        rpc(&f, "alice", "describe_workspace", json!({"handle":handle}))
            .await
            .json::<Value>()
            .await
            .unwrap()["ok"],
        false
    );
}
#[tokio::test]
#[ignore = "installed Animation worker and disposable PostgreSQL runner"]
async fn forbidden_paths_shutdown_invalid_session_and_revocation_are_refused() {
    let f = fixture().await;
    assert_eq!(
        rpc(&f, "missing", "hello", json!({"protocol_version":1}))
            .await
            .status(),
        401
    );
    assert_eq!(rpc(&f, "alice", "shutdown", json!({})).await.status(), 400);
    for path in ["/etc/passwd", "../bob/show.aether", "x/../../secret"] {
        assert_eq!(
            rpc(&f, "alice", "load_workspace", json!({"path":path}))
                .await
                .status(),
            400
        );
    }
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='alice'")
        .await;
    assert_eq!(
        rpc(&f, "alice", "hello", json!({"protocol_version":1}))
            .await
            .status(),
        401
    );
}

#[tokio::test]
#[ignore = "installed Animation worker, Chromium and disposable PostgreSQL"]
async fn workspace_file_rpc_retains_binary_versions_guards_conflicts_and_owner_scope() {
    let f = fixture().await;
    let created: Value = rpc(
        &f,
        "alice",
        "new_workspace",
        json!({"name":"Stored archive"}),
    )
    .await
    .json()
    .await
    .unwrap();
    let handle = &created["result"]["handle"];
    let saved = rpc(
        &f,
        "alice",
        "save_workspace",
        json!({"handle":handle,"path":"shows/first.aether"}),
    )
    .await;
    assert_eq!(saved.status(), 200);
    let saved: Value = saved.json().await.unwrap();
    assert_eq!(saved["ok"], true, "{saved}");
    assert!(saved["result"]["data_base64"].is_null());
    let revision = &saved["result"]["file_revision"];
    assert_eq!(revision.as_str().unwrap().len(), 64);
    let loaded: Value = rpc(
        &f,
        "alice",
        "load_workspace",
        json!({"path":"shows/first.aether"}),
    )
    .await
    .json()
    .await
    .unwrap();
    assert_eq!(loaded["ok"], true, "{loaded}");
    assert_eq!(&loaded["result"]["file_revision"], revision);
    let other = rpc(
        &f,
        "bob",
        "load_workspace",
        json!({"path":"shows/first.aether"}),
    )
    .await;
    assert!(!other.status().is_success());
    // Missing or stale file guards cannot replace an existing archive.
    for guard in [Value::Null, json!("0".repeat(64))] {
        assert_eq!(
            rpc(
                &f,
                "alice",
                "save_workspace",
                json!({"handle":handle,"path":"shows/first.aether","expected_file_revision":guard})
            )
            .await
            .status(),
            409
        );
    }
    // A new workspace produces a distinct archive; failed audit must leave the old head.
    let created: Value = rpc(&f, "alice", "new_workspace", json!({"name":"Next version"}))
        .await
        .json()
        .await
        .unwrap();
    let params = json!({"handle":created["result"]["handle"],"path":"shows/first.aether","expected_file_revision":revision});
    f.sql("ALTER TABLE aether_access.audit ADD CONSTRAINT workspace_rpc_failure CHECK(action<>'workspace_file_saved') NOT VALID").await;
    assert_eq!(
        rpc(&f, "alice", "save_workspace", params.clone())
            .await
            .status(),
        503
    );
    f.sql("ALTER TABLE aether_access.audit DROP CONSTRAINT workspace_rpc_failure")
        .await;
    let current: Value = rpc(
        &f,
        "alice",
        "load_workspace",
        json!({"path":"shows/first.aether"}),
    )
    .await
    .json()
    .await
    .unwrap();
    assert_eq!(&current["result"]["file_revision"], revision);
    let updated: Value = rpc(&f, "alice", "save_workspace", params)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(updated["ok"], true, "{updated}");
    assert_ne!(&updated["result"]["file_revision"], revision);
    let rows=f.pool.get().await.unwrap().query_one("SELECT count(*) FROM aether_access.workspace_files WHERE tenant='company' AND owner='alice' AND path='shows/first.aether'",&[]).await.unwrap();
    assert_eq!(rows.get::<_, i64>(0), 2);
    f.docs
        .set_app_restricted(&token("admin"), "animation", true)
        .await
        .unwrap();
    assert_eq!(
        rpc(
            &f,
            "alice",
            "load_workspace",
            json!({"path":"shows/first.aether"})
        )
        .await
        .status(),
        403
    );
}

#[tokio::test]
#[ignore = "installed Animation worker, Chromium and disposable PostgreSQL"]
async fn actual_animation_browser_load_pose_serialize_save_and_reopen() {
    let f = fixture().await;
    let result = tokio::process::Command::new(
        std::env::var("AETHER_TEST_NODE").unwrap_or_else(|_| "node".into()),
    )
    .arg(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../dev/rebuild/animation_browser.mjs"),
    )
    .arg(&f.url)
    .arg(token("alice"))
    .arg(std::env::var("AETHER_TEST_ANIMATION_ROOT").unwrap())
    .output()
    .await
    .unwrap();
    assert!(
        result.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
    println!("{}", String::from_utf8_lossy(&result.stdout));
}

async fn cad_rpc(f: &Fixture, user: &str, method: &str, params: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/cad/rpc", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&json!({"id":42,"method":method,"params":params}))
        .send()
        .await
        .unwrap()
}

#[tokio::test]
#[ignore = "installed document codec worker and disposable PostgreSQL"]
async fn cad_route_uses_cad_entitlement_and_isolates_handles_and_files() {
    let f = fixture().await;
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    f.docs
        .configure_app(&token("admin"), "animation", false, false)
        .await
        .unwrap();
    let response = cad_rpc(&f, "alice", "new_workspace", json!({"name":"CAD assembly"})).await;
    assert_eq!(response.status(), 200);
    let created: Value = response.json().await.unwrap();
    assert_eq!(created["ok"], true, "{created}");
    let handle = created["result"]["handle"].clone();
    let assembly = created["result"]["root_assembly_id"].clone();
    let params = json!({"handle":handle,"assembly_id":assembly});
    assert_eq!(
        cad_rpc(&f, "alice", "describe_assembly", params.clone())
            .await
            .json::<Value>()
            .await
            .unwrap()["ok"],
        true
    );
    assert_eq!(
        cad_rpc(&f, "bob", "describe_assembly", params.clone())
            .await
            .json::<Value>()
            .await
            .unwrap()["ok"],
        false
    );
    for (method, args) in [
        ("load_workspace", json!({"path":"private.aether"})),
        (
            "save_workspace",
            json!({"handle":handle,"path":"private.aether"}),
        ),
        ("shutdown", json!({})),
        ("canvas2d.new", json!({})),
    ] {
        assert_eq!(cad_rpc(&f, "alice", method, args).await.status(), 400);
    }
    assert_eq!(
        cad_rpc(&f, "missing", "new_workspace", json!({"name":"No session"}))
            .await
            .status(),
        401
    );
    let archive:Value=cad_rpc(&f,"alice","save_workspace",json!({"handle":handle,"expected_revision":created["result"]["revision"],"return_data":true})).await.json().await.unwrap();
    assert_eq!(archive["ok"], true, "{archive}");
    assert_eq!(
        cad_rpc(
            &f,
            "alice",
            "load_workspace",
            json!({"data_base64":archive["result"]["data_base64"]})
        )
        .await
        .json::<Value>()
        .await
        .unwrap()["ok"],
        true
    );
    f.docs
        .configure_app(&token("admin"), "animation", true, false)
        .await
        .unwrap();
    assert_eq!(
        rpc(&f, "alice", "describe_assembly", params.clone())
            .await
            .json::<Value>()
            .await
            .unwrap()["ok"],
        false
    );
    f.docs
        .set_app_restricted(&token("admin"), "cad", true)
        .await
        .unwrap();
    assert_eq!(
        cad_rpc(&f, "alice", "describe_assembly", params.clone())
            .await
            .status(),
        403
    );
    f.docs
        .set_app_restricted(&token("admin"), "cad", false)
        .await
        .unwrap();
    assert_eq!(
        cad_rpc(&f, "alice", "describe_assembly", params)
            .await
            .json::<Value>()
            .await
            .unwrap()["ok"],
        false
    );
}
