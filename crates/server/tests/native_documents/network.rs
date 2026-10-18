use super::*;
#[path = "../support/tls.rs"]
mod tls;
async fn managed() -> (
    Fixture,
    tempfile::TempDir,
    aether_server::native::network::Network,
) {
    let mut f = Fixture::new().await;
    let settings = aether_server::settings::Settings::new(f.pool.clone(), f.identity.clone());
    settings
        .migrate(&aether_server::native::presentation::Presentation::default())
        .await
        .unwrap();
    let root = tempfile::tempdir().unwrap();
    f.task.abort();
    let listener = aether_server::native::listener::Listener::bind(
        aether_server::native::listener::Configuration {
            address: "127.0.0.1:0".parse().unwrap(),
            public_origin: None,
            certificate: None,
            private_key: None,
        },
    )
    .await
    .unwrap();
    f.url = listener.origin().to_owned();
    let config = aether_server::native::network::Configuration {
        name: settings
            .snapshot()
            .await
            .unwrap()
            .presentation
            .name()
            .into(),
        bind_address: "127.0.0.1".into(),
        port: listener.address().unwrap().port(),
        public_url: f.url.clone(),
        tls_cert: String::new(),
        tls_key: String::new(),
    };
    let (network, requests) = aether_server::native::network::Network::new(
        settings.clone(),
        "fixture-host",
        Some(root.path().to_owned()),
        config,
        &listener,
    )
    .unwrap();
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let manifest = root.path().join("frontend.json");
    std::fs::write(&manifest,serde_json::to_vec(&json!({"schema":1,"studio":repo.join("studio/dist"),"session":repo.join("core/session"),"icons":repo.join("core/assets/icons"),"branding":repo.join("core/assets/branding/apps"),"apps":{}})).unwrap()).unwrap();
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_settings(settings)
        .with_documents(f.docs.clone())
        .with_network(network.clone())
        .with_listen_address(listener.address().unwrap())
        .with_frontends(aether_server::native::frontends::Frontends::load(&manifest).unwrap());
    let controller = network.clone();
    f.task = tokio::spawn(async move {
        controller
            .serve(listener, host, requests, std::future::pending())
            .await
            .unwrap();
    });
    (f, root, network)
}
async fn request(f: &Fixture, user: &str, path: &str, body: Option<Value>) -> reqwest::Response {
    let mut request = if let Some(body) = body {
        f.client
            .post(format!("{}{path}", f.url))
            .header("origin", &f.url)
            .json(&body)
    } else {
        f.client.get(format!("{}{path}", f.url))
    };
    if !user.is_empty() {
        request = request.header("cookie", format!("{COOKIE}={}", token(user)));
    }
    request.send().await.unwrap()
}
async fn state(f: &Fixture) -> Value {
    let response = request(f, "admin", "/api/admin/state", None).await;
    assert_eq!(response.status(), 200);
    response.json().await.unwrap()
}
fn free_address() -> SocketAddr {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap()
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and built Studio"]
async fn network_configuration_is_scoped_audited_and_keeps_running_listener_on_failure() {
    let (f, _root, _network) = managed().await;
    let before = state(&f).await;
    let mut value = before["settings"].clone();
    value["name"] = json!("Managed fixture");
    assert_eq!(
        request(&f, "", "/api/admin/settings", Some(value.clone()))
            .await
            .status(),
        401
    );
    assert_eq!(
        request(&f, "alice", "/api/admin/settings", Some(value.clone()))
            .await
            .status(),
        403
    );
    let mut invalid = value.clone();
    invalid["tls_cert"] = json!("/tmp/outside-certificate.pem");
    invalid["tls_key"] = json!("/tmp/outside-private.pem");
    assert_eq!(
        request(&f, "admin", "/api/admin/settings", Some(invalid))
            .await
            .status(),
        400
    );
    let occupied = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = occupied.local_addr().unwrap();
    let mut invalid = value.clone();
    invalid["port"] = json!(address.port());
    invalid["public_url"] = json!(format!("http://{address}"));
    assert_eq!(
        request(&f, "admin", "/api/admin/settings", Some(invalid))
            .await
            .status(),
        400
    );
    assert_eq!(state(&f).await["settings"], before["settings"]);
    f.sql("ALTER TABLE aether_identity.audit ADD CONSTRAINT network_failure CHECK(action<>'network_settings_saved') NOT VALID").await;
    assert_eq!(
        request(&f, "admin", "/api/admin/settings", Some(value.clone()))
            .await
            .status(),
        503
    );
    assert_eq!(state(&f).await["settings"], before["settings"]);
    f.sql("ALTER TABLE aether_identity.audit DROP CONSTRAINT network_failure")
        .await;
    assert_eq!(
        request(&f, "admin", "/api/admin/settings", Some(value.clone()))
            .await
            .status(),
        200
    );
    let settings = aether_server::settings::Settings::new(f.pool.clone(), f.identity.clone());
    assert!(
        settings
            .network_snapshot("other-host")
            .await
            .unwrap()
            .is_none()
    );
    assert_eq!(
        settings
            .network_snapshot("fixture-host")
            .await
            .unwrap()
            .unwrap()
            .name,
        "Managed fixture"
    );
    assert_eq!(state(&f).await["restart_required"], true);
    assert_eq!(
        request(&f, "alice", "/api/admin/restart", Some(json!({})))
            .await
            .status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET role='member' WHERE id='admin'")
        .await;
    assert_eq!(
        request(&f, "admin", "/api/admin/restart", Some(json!({})))
            .await
            .status(),
        403
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and built Studio"]
async fn controlled_restart_moves_to_reserved_port_and_survives_stale_or_invalid_requests() {
    let (mut f, _root, _network) = managed().await;
    let before = state(&f).await;
    let mut value = before["settings"].clone();
    let address = free_address();
    value["port"] = json!(address.port());
    value["public_url"] = json!(format!("http://{address}"));
    assert_eq!(
        request(&f, "admin", "/api/admin/settings", Some(value.clone()))
            .await
            .status(),
        200
    );
    // Port contention after save is detected again before accepting a restart.
    let occupied = std::net::TcpListener::bind(address).unwrap();
    assert_eq!(
        request(&f, "admin", "/api/admin/restart", Some(json!({})))
            .await
            .status(),
        400
    );
    assert_eq!(
        state(&f).await["running_settings"],
        before["running_settings"]
    );
    drop(occupied);
    let response = request(&f, "admin", "/api/admin/restart", Some(json!({}))).await;
    assert_eq!(response.status(), 200);
    let response: Value = response.json().await.unwrap();
    let old = f.url.clone();
    f.url = response["url"].as_str().unwrap().into();
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            if f.client
                .get(format!("{}/healthz", f.url))
                .send()
                .await
                .is_ok_and(|r| r.status().is_success())
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .unwrap();
    let after = state(&f).await;
    assert_eq!(after["settings"], value);
    assert_eq!(after["running_settings"], value);
    assert_eq!(after["restart_required"], false);
    assert!(f.client.get(format!("{old}/healthz")).send().await.is_err());
    // The same socket can restart again, without losing its lease or authority.
    let response = request(&f, "admin", "/api/admin/restart", Some(json!({}))).await;
    assert_eq!(response.status(), 200);
    let _: Value = response.json().await.unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(state(&f).await["restart_required"], false);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and built Studio"]
async fn controlled_restart_changes_http_to_verified_tls_on_same_socket() {
    let (mut f, root, _network) = managed().await;
    let (_cert_root, cert, key) = tls::certificate();
    let local_cert = root.path().join("certificate.pem");
    let local_key = root.path().join("private.pem");
    std::fs::copy(cert, &local_cert).unwrap();
    std::fs::copy(key, &local_key).unwrap();
    let mut value = state(&f).await["settings"].clone();
    value["public_url"] = json!(f.url.replacen("http:", "https:", 1));
    value["tls_cert"] = json!(local_cert);
    value["tls_key"] = json!(local_key);
    assert_eq!(
        request(&f, "admin", "/api/admin/settings", Some(value.clone()))
            .await
            .status(),
        200
    );
    // Revalidate TLS on restart: replacing the key after save must leave HTTP alive.
    let key_bytes = std::fs::read(&local_key).unwrap();
    std::fs::write(&local_key, b"invalid PEM").unwrap();
    assert_eq!(
        request(&f, "admin", "/api/admin/restart", Some(json!({})))
            .await
            .status(),
        400
    );
    assert_eq!(state(&f).await["running_settings"]["tls_key"], "");
    std::fs::write(&local_key, key_bytes).unwrap();
    let response = request(&f, "admin", "/api/admin/restart", Some(json!({}))).await;
    assert_eq!(response.status(), 200);
    let _: Value = response.json().await.unwrap();
    f.url = value["public_url"].as_str().unwrap().into();
    f.client = reqwest::Client::builder()
        .no_proxy()
        .add_root_certificate(
            reqwest::Certificate::from_pem(&std::fs::read(local_cert).unwrap()).unwrap(),
        )
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(state(&f).await["restart_required"], false);
    assert!(
        reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap()
            .get(format!("{}/healthz", f.url))
            .send()
            .await
            .is_err()
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and built native host"]
async fn actual_executable_loads_saved_instance_and_operator_recovery_preserves_it() {
    let (f, _root, _network) = managed().await;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(_root.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let address = free_address();
    let mut value = state(&f).await["settings"].clone();
    value["port"] = json!(address.port());
    value["public_url"] = json!(format!("http://{address}"));
    assert_eq!(
        request(&f, "admin", "/api/admin/settings", Some(value))
            .await
            .status(),
        200
    );
    let database: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get(0);
    let dsn = format!(
        "{} dbname={database}",
        std::env::var("AETHER_TEST_PG").unwrap()
    );
    for reset in [false, true] {
        let fallback = free_address();
        let expected = if reset { fallback } else { address };
        let config = _root.path().join("installation.json");
        std::fs::write(&config,serde_json::to_vec(&json!({"schema":1,"environment":{
            "AETHER_NATIVE_PG":dsn,"AETHER_NATIVE_TENANT":"company",
            "AETHER_NATIVE_OBJECTS":f._objects.path(),"AETHER_NATIVE_INSTANCE":"fixture-host",
            "AETHER_NATIVE_LISTEN":fallback.to_string(),"AETHER_NATIVE_NETWORK_RESET":if reset {"1"} else {"0"}
        }})).unwrap()).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&config, std::fs::Permissions::from_mode(0o600)).unwrap();
        }
        let mut child = tokio::process::Command::new(env!("CARGO_BIN_EXE_aether-native-host"))
            .arg("serve")
            .arg("--config")
            .arg(&config)
            .env_clear()
            // Configured service ignores a conflicting inherited authority.
            .env(
                "AETHER_NATIVE_PG",
                "host=/invalid-inherited-database user=invalid",
            )
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .unwrap();
        tokio::time::timeout(Duration::from_secs(15), async {
            loop {
                assert!(
                    child.try_wait().unwrap().is_none(),
                    "Native managed host stopped before readiness."
                );
                if f.client
                    .get(format!("http://{expected}/healthz"))
                    .send()
                    .await
                    .is_ok_and(|r| r.status().is_success())
                {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        })
        .await
        .unwrap();
        child.kill().await.unwrap();
        child.wait().await.unwrap();
        let settings = aether_server::settings::Settings::new(f.pool.clone(), f.identity.clone());
        assert_eq!(
            settings
                .network_snapshot("fixture-host")
                .await
                .unwrap()
                .unwrap()
                .port,
            address.port()
        );
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and built Studio"]
async fn network_schema3_upgrade_preserves_settings_and_browser_restart_reconnects() {
    let (f, _root, _network) = managed().await;
    let settings = aether_server::settings::Settings::new(f.pool.clone(), f.identity.clone());
    f.sql("DROP TABLE aether_settings.network").await;
    let mut hash = Sha256::new();
    for source in [
        include_str!("../../src/settings/schema.sql"),
        include_str!("../../src/settings/002-mail.sql"),
        include_str!("../../src/settings/003-backups.sql"),
    ] {
        hash.update(source);
    }
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_settings.schema_state SET version=3,checksum=$1",
            &[&format!("{:x}", hash.finalize())],
        )
        .await
        .unwrap();
    assert!(settings.check_schema().await.is_err());
    settings
        .migrate(&aether_server::native::presentation::Presentation::default())
        .await
        .unwrap();
    settings.check_schema().await.unwrap();
    let address = free_address();
    let output = tokio::process::Command::new("node")
        .arg(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../dev/rebuild/network_browser.mjs"),
        )
        .arg(&f.url)
        .arg(token("admin"))
        .arg(address.port().to_string())
        .output()
        .await
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{}", String::from_utf8_lossy(&output.stdout));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and built native host"]
async fn actual_native_executable_serves_verified_https_login_and_secure_session() {
    let f = Fixture::new().await;
    aether_server::settings::Settings::new(f.pool.clone(), f.identity.clone())
        .migrate(&aether_server::native::presentation::Presentation::default())
        .await
        .unwrap();
    f.identity
        .create_user(
            &token("admin"),
            &aether_identity::NewAccount {
                username: "https-fixture".into(),
                role: aether_identity::Role::Member,
                must_change: false,
                full_name: "HTTPS Fixture".into(),
                email: String::new(),
            },
            "fixture-TLS-password-2026",
        )
        .await
        .unwrap();
    let (_cert_root, cert, key) = tls::certificate();
    let reservation = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = reservation.local_addr().unwrap();
    drop(reservation);
    let origin = format!("https://{address}");
    let database: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get(0);
    let dsn = format!(
        "{} dbname={database}",
        std::env::var("AETHER_TEST_PG").unwrap()
    );
    let mut child = tokio::process::Command::new(env!("CARGO_BIN_EXE_aether-native-host"))
        .arg("serve")
        .env_clear()
        .env("AETHER_NATIVE_PG", dsn)
        .env("AETHER_NATIVE_TENANT", "company")
        .env("AETHER_NATIVE_OBJECTS", f._objects.path())
        .env("AETHER_NATIVE_LISTEN", address.to_string())
        .env("AETHER_NATIVE_PUBLIC_ORIGIN", &origin)
        .env("AETHER_NATIVE_TLS_CERT", &cert)
        .env("AETHER_NATIVE_TLS_KEY", key)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    let root = reqwest::Certificate::from_pem(&std::fs::read(cert).unwrap()).unwrap();
    let client = reqwest::Client::builder()
        .no_proxy()
        .add_root_certificate(root)
        // Debug scrypt uses the unchanged production cost. Let the native host's
        // 45-second admission deadline decide failures instead of a shorter client timer.
        .timeout(Duration::from_secs(50))
        .build()
        .unwrap();
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            assert!(
                child.try_wait().unwrap().is_none(),
                "Native TLS host stopped before readiness."
            );
            if client
                .get(format!("{origin}/healthz"))
                .send()
                .await
                .is_ok_and(|v| v.status().is_success())
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .unwrap();
    let response = client
        .post(format!("{origin}/api/login"))
        .header("origin", &origin)
        .json(&json!({"username":"https-fixture","password":"fixture-TLS-password-2026"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let cookie = response.headers()["set-cookie"].to_str().unwrap();
    assert!(
        cookie.contains("; Secure")
            && cookie.contains("HttpOnly")
            && cookie.contains("SameSite=Strict")
    );
    let cookie = cookie.split(';').next().unwrap().to_owned();
    let status: Value = client
        .get(format!("{origin}/api/status"))
        .header("cookie", &cookie)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(status["user"]["username"], "https-fixture");
    assert_eq!(
        client
            .get(format!("{origin}/api/admin/state"))
            .header("cookie", cookie)
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    #[cfg(unix)]
    {
        let result = tokio::process::Command::new("/bin/kill")
            .arg("-TERM")
            .arg(child.id().unwrap().to_string())
            .status()
            .await
            .unwrap();
        assert!(result.success());
        assert!(
            tokio::time::timeout(Duration::from_secs(10), child.wait())
                .await
                .unwrap()
                .unwrap()
                .success()
        );
    }
    #[cfg(not(unix))]
    child.kill().await.unwrap();
}
