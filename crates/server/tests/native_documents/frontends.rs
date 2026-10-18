use super::*;
use aether_server::native::frontends::Frontends;
async fn frontend_fixture() -> Fixture {
    let mut f = Fixture::new().await;
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    for dir in [
        "studio",
        "studio/assets",
        "session",
        "icons",
        "branding",
        "map",
        "map/assets",
        "cad",
        "cad/assets",
    ] {
        std::fs::create_dir_all(root.join(dir)).unwrap();
    }
    for app in ["studio", "map", "cad"] {
        std::fs::write(
            root.join(app).join("index.html"),
            format!("<html><head></head><body>{app}</body></html>"),
        )
        .unwrap();
        std::fs::write(
            root.join(app).join("assets/main.js"),
            format!("export const app='{app}';"),
        )
        .unwrap();
    }
    std::fs::write(root.join("map/assets/core.wasm"), b"\0asm\x01\0\0\0").unwrap();
    std::fs::write(root.join("session/account.js"), "export {};").unwrap();
    std::fs::write(root.join("session/account.css"), "body{}").unwrap();
    std::fs::write(root.join("icons/select.svg"), "<svg/>").unwrap();
    let config = root.join("frontends.json");
    std::fs::write(&config,serde_json::to_vec(&json!({"schema":1,"studio":"studio","session":"session","icons":"icons","branding":"branding","apps":{"map":"map","cad":"cad"}})).unwrap()).unwrap();
    let web = Frontends::load(&config).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(f.identity.clone(), &url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_frontends(web);
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
    f.client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap();
    f
}
fn request(f: &Fixture, path: &str, user: Option<&str>) -> reqwest::RequestBuilder {
    let request = f.client.get(format!("{}{path}", f.url));
    if let Some(user) = user {
        request.header("cookie", format!("{COOKIE}={}", token(user)))
    } else {
        request
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn frontend_studio_library_editor_assets_and_queries_preserve_routes() {
    let f = frontend_fixture().await;
    let public = request(&f, "/?next=%2Fmap%2F", None).send().await.unwrap();
    assert_eq!(public.status(), 200);
    assert!(public.text().await.unwrap().contains("studio"));
    for (path, body) in [
        ("/map/", "studio"),
        ("/map/index.html?document=fixture&branch=Main", "map"),
        ("/map/assets/main.js?v=123", "export const app='map';"),
        ("/suite/icons/select.svg", "<svg/>"),
    ] {
        let r = request(&f, path, Some("alice")).send().await.unwrap();
        assert_eq!(r.status(), 200, "{path}");
        assert_eq!(r.headers()["cache-control"], "no-store");
        assert!(r.text().await.unwrap().contains(body));
    }
    let r = request(&f, "/map?document=fixture", Some("alice"))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 302);
    assert_eq!(r.headers()["location"], "/map/?document=fixture");
    let r = request(&f, "/map/assets/core.wasm", Some("alice"))
        .send()
        .await
        .unwrap();
    assert_eq!(r.headers()["content-type"], "application/wasm");
    let length = r.bytes().await.unwrap().len();
    let r = f
        .client
        .head(format!("{}/map/assets/core.wasm", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 200);
    assert_eq!(r.headers()["content-length"], length.to_string());
    assert!(r.bytes().await.unwrap().is_empty());
    let value = request(&f, "/api/status", Some("alice"))
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(value["capabilities"]["frontend_hosting"], true);
    assert_eq!(value["applications_ready"], false);
    let map = value["apps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|app| app["id"] == "map")
        .unwrap();
    assert_eq!(map["installed"], true);
    assert_eq!(map["coming_soon"], false);
    assert_eq!(map["runtime_ready"], false);
    assert_eq!(
        map["runtime_missing"],
        json!(["media_storage", "player_distribution"])
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn frontend_permissions_apply_to_every_asset_and_session_change() {
    let f = frontend_fixture().await;
    let r = request(&f, "/map/index.html?document=one", None)
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 302);
    assert_eq!(
        r.headers()["location"],
        "/?next=%2Fmap%2Findex.html%3Fdocument%3Done"
    );
    assert_eq!(
        request(&f, "/map/assets/main.js", None)
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(
        request(&f, "/cad/index.html", Some("admin"))
            .send()
            .await
            .unwrap()
            .status(),
        404
    ); // unconfigured, even for admin
    f.docs
        .configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    for path in ["/map/", "/map/index.html", "/map/assets/core.wasm"] {
        assert_eq!(
            request(&f, path, Some("alice"))
                .send()
                .await
                .unwrap()
                .status(),
            404
        );
    }
    f.docs
        .configure_team(&token("admin"), "team", &["alice".into()], &["map".into()])
        .await
        .unwrap();
    assert_eq!(
        request(&f, "/map/assets/main.js", Some("alice"))
            .send()
            .await
            .unwrap()
            .status(),
        200
    );
    f.identity.sign_out(&token("alice")).await.unwrap();
    assert_eq!(
        request(&f, "/map/assets/main.js", Some("alice"))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='admin'")
        .await;
    assert_eq!(
        request(&f, "/map/index.html", Some("admin"))
            .send()
            .await
            .unwrap()
            .status(),
        302
    );
    assert_eq!(
        request(&f, "/map/assets/main.js", Some("admin"))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn frontend_missing_api_paths_methods_and_authority_fail_without_html_fallback() {
    let f = frontend_fixture().await;
    for path in [
        "/api/unknown",
        "/map/unknown",
        "/map/assets/missing.js",
        "/map/%252e%252e/secret",
        "/api%2funknown",
    ] {
        let r = request(&f, path, Some("alice")).send().await.unwrap();
        assert_eq!(r.status(), 404, "{path}");
        assert!(
            r.headers()["content-type"]
                .to_str()
                .unwrap()
                .contains("application/json")
        );
    }
    assert_eq!(
        request(&f, "/map/workspace/private", Some("alice"))
            .send()
            .await
            .unwrap()
            .status(),
        503
    );
    assert_eq!(
        request(&f, "/api/status?tenant=other", Some("alice"))
            .send()
            .await
            .unwrap()
            .status(),
        400
    );
    let r = f
        .client
        .post(format!("{}/map/index.html", f.url))
        .header("origin", &f.url)
        .json(&json!({}))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 405);
    f.sql("ALTER TABLE aether_identity.users RENAME TO unavailable_users")
        .await;
    let r = request(&f, "/map/index.html", Some("alice"))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 503);
    assert!(r.json::<Value>().await.unwrap().get("error").is_some());
}
