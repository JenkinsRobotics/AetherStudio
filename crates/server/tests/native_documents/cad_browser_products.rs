use super::cad_products::installed_script;
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use std::path::Path;

fn requests() -> Value {
    let fixture = std::env::var("AETHER_TEST_CAD_FIXTURE").unwrap();
    serde_json::from_slice(
        &std::fs::read(Path::new(&fixture).with_file_name("browser-requests.json")).unwrap(),
    )
    .unwrap()
}
async fn fixture(script: Option<&str>) -> Fixture {
    let f = Fixture::configured(512, Some(installed_script(script))).await;
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    f
}
async fn post(f: &Fixture, user: &str, action: &str, value: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/cad/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&value)
        .send()
        .await
        .unwrap()
}
async fn ok(response: reqwest::Response) -> Value {
    let status = response.status();
    let data = response.json::<Value>().await.unwrap();
    assert_eq!(status, 200, "{data}");
    data
}
#[tokio::test]
#[ignore = "requires disposable PostgreSQL and installed FreeCAD"]
async fn real_browser_cad_build_analysis_export_and_assembly() {
    let f = fixture(None).await;
    let request = requests();
    let engine = ok(post(&f, "alice", "engine", json!({})).await).await;
    assert_eq!(engine["ok"], true);
    assert!(engine["engine"].as_str().unwrap().contains("FreeCAD"));
    assert!(engine.get("command").is_none());
    let kinds = ok(post(&f, "alice", "mate-kinds", json!({})).await).await;
    assert!(
        kinds["kinds"]
            .as_array()
            .unwrap()
            .contains(&json!("fastened"))
    );
    let part = ok(post(&f, "alice", "geometry", request["geometry"].clone()).await).await;
    assert_eq!(part["status"], "ok");
    assert!((part["bodies"][0]["volume_mm3"].as_f64().unwrap() - 1000.0).abs() < 1e-6);
    assert!(
        !part["bodies"][0]["triangles"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let section = ok(post(&f, "alice", "analysis", request["analysis"].clone()).await).await;
    assert_eq!(section["status"], "ok");
    assert!((section["bodies"][0]["volume_mm3"].as_f64().unwrap() - 400.0).abs() < 1e-6);
    for format in ["step", "stl"] {
        let mut export = request["export"].clone();
        export["format"] = json!(format);
        let exported = ok(post(&f, "alice", "export", export).await).await;
        assert_eq!(exported["status"], "ok");
        assert_eq!(exported["body_count"], 1);
        let bytes = STANDARD
            .decode(exported["data_base64"].as_str().unwrap())
            .unwrap();
        assert!(bytes.len() > 80);
        if format == "step" {
            assert!(bytes.starts_with(b"ISO-10303-21;"));
        }
    }
    let assembly = ok(post(&f, "alice", "assembly", request["assembly"].clone()).await).await;
    assert_eq!(assembly["status"], "ok");
    for v in assembly["instances"][1]["placement_mm"].as_array().unwrap() {
        assert!(v.as_f64().unwrap().abs() < 1e-6);
    }
    let c = f.pool.get().await.unwrap();
    let n: i64 = c
        .query_one("SELECT count(*) FROM aether_access.resources", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(n, 0, "Stateless CAD evaluation must not save a file");
}
#[tokio::test]
#[ignore = "requires disposable PostgreSQL and installed FreeCAD"]
async fn browser_cad_validation_and_http_boundary() {
    let f = fixture(None).await;
    for (action, input, status) in [
        ("geometry", json!({}), 400),
        ("geometry", json!({"features":vec![json!({});513]}), 413),
        ("geometry", json!({"features":[null]}), 400),
        ("analysis", json!({"features":[],"analysis":null}), 400),
        ("export", json!({"features":[],"format":"bad"}), 400),
        ("assembly", json!({"instances":[{}]}), 400),
        ("geometry", json!([]), 400),
        ("unknown", json!({}), 404),
    ] {
        assert_eq!(
            post(&f, "alice", action, input).await.status(),
            status,
            "{action}"
        );
    }
    let large = json!({"features":[],"padding":"x".repeat(4*1024*1024)});
    assert_eq!(post(&f, "alice", "geometry", large).await.status(), 413);
    assert_eq!(post(&f, "invalid", "engine", json!({})).await.status(), 401);
    let url = format!("{}/api/cad/engine", f.url);
    assert_eq!(
        f.client
            .post(&url)
            .header("origin", "http://evil.invalid")
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .json(&json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    assert_eq!(
        f.client
            .post(&url)
            .bearer_auth("agent-token")
            .json(&json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(f.client.get(&url).send().await.unwrap().status(), 405);
}
#[tokio::test]
#[ignore = "requires disposable PostgreSQL and installed product bundle"]
async fn browser_cad_requires_current_app_and_account_authority() {
    let f = fixture(Some(
        "import sys,json\njson.load(sys.stdin)\nprint('{\"result\":{\"ok\":true}}')\n",
    ))
    .await;
    assert_eq!(post(&f, "alice", "engine", json!({})).await.status(), 200);
    f.docs
        .configure_app(&token("admin"), "cad", true, true)
        .await
        .unwrap();
    assert_eq!(post(&f, "alice", "engine", json!({})).await.status(), 403);
    assert_eq!(post(&f, "admin", "engine", json!({})).await.status(), 200);
    f.docs
        .configure_app(&token("admin"), "cad", false, false)
        .await
        .unwrap();
    assert_eq!(post(&f, "admin", "engine", json!({})).await.status(), 403);
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(post(&f, "alice", "engine", json!({})).await.status(), 403);
    f.sql("DELETE FROM aether_identity.sessions WHERE user_id='bob'")
        .await;
    assert_eq!(post(&f, "bob", "engine", json!({})).await.status(), 401);
    let missing = Fixture::new().await;
    missing
        .docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    assert_eq!(
        post(&missing, "alice", "engine", json!({})).await.status(),
        503
    );
}
#[tokio::test]
#[ignore = "requires disposable PostgreSQL and installed product bundle"]
async fn browser_cad_revocation_during_work_suppresses_result() {
    for revoke_session in [false, true] {
        let dir = tempfile::tempdir().unwrap();
        let marker = dir.path().join("started");
        let release = dir.path().join("release");
        let script = format!(
            "import sys,json,time,pathlib\njson.load(sys.stdin)\npathlib.Path({}).touch()\nwhile not pathlib.Path({}).exists(): time.sleep(0.01)\nprint('{{\"result\":{{\"private\":\"geometry\"}}}}')\n",
            serde_json::to_string(marker.to_str().unwrap()).unwrap(),
            serde_json::to_string(release.to_str().unwrap()).unwrap()
        );
        let f = fixture(Some(&script)).await;
        let client = f.client.clone();
        let url = f.url.clone();
        let task = tokio::spawn(async move {
            client
                .post(format!("{url}/api/cad/geometry"))
                .header("origin", &url)
                .header("cookie", format!("{COOKIE}={}", token("alice")))
                .json(&json!({"features":[]}))
                .send()
                .await
                .unwrap()
        });
        tokio::time::timeout(Duration::from_secs(5), async {
            while !marker.exists() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        if revoke_session {
            f.sql("DELETE FROM aether_identity.sessions WHERE user_id='alice'")
                .await;
        } else {
            f.docs
                .configure_app(&token("admin"), "cad", false, false)
                .await
                .unwrap();
        }
        std::fs::write(release, b"done").unwrap();
        let result = task.await.unwrap();
        assert_eq!(result.status(), if revoke_session { 401 } else { 403 });
        assert!(!result.text().await.unwrap().contains("geometry"));
    }
}
#[tokio::test]
#[ignore = "requires disposable PostgreSQL and installed product bundle"]
async fn browser_service_cannot_return_content_or_noop_and_errors_are_redacted() {
    for response in [
        json!({"result":{},"content":"replacement"}),
        json!({"result":{},"unchanged":true}),
        json!({"result":{},"extra":"secret"}),
        json!({"error":{"kind":"invalid","message":"/private/operator/password"}}),
    ] {
        let script = format!(
            "print({})",
            serde_json::to_string(&response.to_string()).unwrap()
        );
        let f = fixture(Some(&script)).await;
        let result = post(&f, "alice", "geometry", json!({})).await;
        assert_eq!(result.status(), 400);
        assert!(!result.text().await.unwrap().contains("private"));
    }
}

#[tokio::test]
#[ignore = "requires disposable PostgreSQL, FreeCAD and Chromium"]
async fn actual_cad_browser_adapters_use_native_service() {
    let f = fixture(None).await;
    let result = tokio::process::Command::new(std::env::var("AETHER_TEST_NODE").unwrap())
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../dev/rebuild/cad_browser.mjs"))
        .arg(&f.url)
        .arg(token("alice"))
        .arg(std::env::var("AETHER_TEST_CAD_FIXTURE").unwrap())
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
