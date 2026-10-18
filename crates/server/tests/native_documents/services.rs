use super::*;
use tokio::io::AsyncWriteExt;

#[tokio::test]
#[ignore = "disposable PostgreSQL and built CLI/MCP"]
async fn service_cli_and_mcp_keep_file_revisions_and_secret_redaction() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("admin"), &create("service-file"))
        .await
        .unwrap();
    let grant: Value = issue(
        &f,
        "admin",
        json!({"name":"MCP service","apps":["map"],"days":1,"can_write":true}),
    )
    .await
    .json()
    .await
    .unwrap();
    let key = grant["token"].as_str().unwrap();
    let binary = std::env::var("AETHER_AUTOMATION_BIN").unwrap();
    let output = tokio::process::Command::new(&binary)
        .arg("list")
        .env("AETHER_SERVER_URL", &f.url)
        .env("AETHER_AUTOMATION_TOKEN", key)
        .kill_on_drop(true)
        .output()
        .await
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!String::from_utf8_lossy(&output.stdout).contains(key));
    let frames = [
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}}),
        json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"document_rename","_meta":{"aether/operationId":"service-rename"},"arguments":{"app":"map","id":"service-file","expected_revision":1,"name":"Service rename"}}}),
    ];
    let mut child = tokio::process::Command::new(&binary)
        .arg("mcp")
        .env("AETHER_SERVER_URL", &f.url)
        .env("AETHER_AUTOMATION_TOKEN", key)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(
            frames
                .iter()
                .map(|v| format!("{v}\n"))
                .collect::<String>()
                .as_bytes(),
        )
        .await
        .unwrap();
    let output = tokio::time::timeout(Duration::from_secs(15), child.wait_with_output())
        .await
        .unwrap()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let text = String::from_utf8(output.stdout).unwrap();
    assert!(!text.contains(key));
    let replies: Vec<Value> = text
        .lines()
        .map(|l| serde_json::from_str(l).unwrap())
        .collect();
    assert_eq!(
        replies[1]["result"]["structuredContent"]["result"]["revision"], 2,
        "{text}"
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn service_schema3_upgrade_retains_existing_agent_authority() {
    let f = Fixture::new().await;
    let before = f
        .docs
        .automation_connections(
            &token("alice"),
            Some(&aether_identity::automation::AgentConnectionInput {
                label: "Existing".into(),
                apps: vec!["map".into()],
                can_write: false,
                can_edit_content: false,
                lifetime_hours: 24,
            }),
        )
        .await
        .unwrap();
    f.sql("DROP TABLE aether_identity.oauth_grants, aether_identity.oauth_requests, aether_identity.oauth_clients; ALTER TABLE aether_identity.agent_connections DROP COLUMN kind CASCADE")
        .await;
    let checksum = format!(
        "{:x}",
        Sha256::digest(
            format!(
                "{}{}{}",
                include_str!("../../../identity/src/schema.sql"),
                include_str!("../../../identity/src/schema2.sql"),
                include_str!("../../../identity/src/schema3.sql")
            )
            .as_bytes()
        )
    );
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_identity.schema_state SET version=3,checksum=$1",
            &[&checksum],
        )
        .await
        .unwrap();
    assert!(f.identity.check_schema().await.is_err());
    f.identity.migrate().await.unwrap();
    f.identity.migrate().await.unwrap();
    f.identity.check_schema().await.unwrap();
    assert_eq!(
        catalog(&f, before["token"].as_str().unwrap())
            .await
            .status(),
        200
    );
    assert_eq!(
        f.docs.services(&token("admin"), None).await.unwrap(),
        json!([])
    );
}
async fn issue(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/admin/service", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn catalog(f: &Fixture, key: &str) -> reqwest::Response {
    f.client
        .post(format!("{}/api/automation/commands/list", f.url))
        .bearer_auth(key)
        .json(&json!({}))
        .send()
        .await
        .unwrap()
}
fn input(name: &str) -> Value {
    json!({"name":name,"apps":["map"],"days":365})
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn service_keys_use_real_commands_and_current_authority_without_browser_access() {
    let f = Fixture::new().await;
    assert_eq!(issue(&f, "alice", input("denied")).await.status(), 403);
    let issued = issue(&f, "admin", input("reporting")).await;
    assert_eq!(issued.status(), 200);
    let issued: Value = issued.json().await.unwrap();
    let key = issued["token"].as_str().unwrap();
    assert!(key.starts_with("aether_sa_"));
    let report: Value = catalog(&f, key).await.json().await.unwrap();
    assert_eq!(report["apps"], json!(["map"]));
    assert!(
        report["commands"]
            .as_array()
            .unwrap()
            .iter()
            .all(|c| c["writes"] == false)
    );
    let connection = f.docs.services(&token("admin"), None).await.unwrap();
    assert_eq!(connection[0]["name"], "reporting");
    assert!(!connection.to_string().contains(key));
    assert_eq!(
        f.docs
            .automation_connections(&token("admin"), None)
            .await
            .unwrap()["connections"],
        json!([])
    );
    let stored: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT token_hash FROM aether_identity.agent_connections WHERE kind='service'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(stored, format!("{:x}", Sha256::digest(key.as_bytes())));
    assert_eq!(issue(&f, "admin", input("reporting")).await.status(), 409);
    for path in ["/api/admin/state", "/api/admin/maintenance"] {
        assert_eq!(
            f.client
                .get(format!("{}{path}", f.url))
                .bearer_auth(key)
                .send()
                .await
                .unwrap()
                .status(),
            401
        );
        assert_eq!(
            f.client
                .get(format!("{}{path}", f.url))
                .header("cookie", format!("{COOKIE}={key}"))
                .send()
                .await
                .unwrap()
                .status(),
            401
        );
    }
    assert_eq!(
        f.client
            .post(format!("{}/api/automation/commands/list", f.url))
            .bearer_auth(key)
            .header("cookie", format!("{COOKIE}={}", token("admin")))
            .json(&json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        catalog(&f, key).await.json::<Value>().await.unwrap()["apps"],
        json!([])
    );
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='admin'")
        .await;
    assert_eq!(catalog(&f, key).await.status(), 401);
    f.sql("UPDATE aether_identity.users SET active=true WHERE id='admin'")
        .await;
    assert_eq!(
        issue(&f, "admin", json!({"id":issued["id"],"action":"revoke"}))
            .await
            .status(),
        200
    );
    assert_eq!(catalog(&f, key).await.status(), 401);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn service_creation_validates_scopes_rolls_back_audit_and_serializes_names() {
    let f = Fixture::new().await;
    for invalid in [
        json!({"name":"bad","apps":["ui"],"days":1}),
        json!({"name":"bad","apps":["map"],"days":366}),
        json!({"name":"bad","apps":["map"],"days":1,"can_edit_content":true}),
    ] {
        assert_eq!(issue(&f, "admin", invalid).await.status(), 400);
    }
    f.sql("CREATE FUNCTION fail_service_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='service_created' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_service_audit BEFORE INSERT ON aether_identity.audit FOR EACH ROW EXECUTE FUNCTION fail_service_audit()").await;
    assert_eq!(issue(&f, "admin", input("rollback")).await.status(), 503);
    assert_eq!(
        f.docs.services(&token("admin"), None).await.unwrap(),
        json!([])
    );
    f.sql("DROP TRIGGER fail_service_audit ON aether_identity.audit")
        .await;
    let (one, two) = tokio::join!(
        issue(&f, "admin", input("concurrent")),
        issue(&f, "admin", input("concurrent"))
    );
    let mut statuses = vec![one.status().as_u16(), two.status().as_u16()];
    statuses.sort();
    assert_eq!(statuses, vec![200, 409]);
}
#[tokio::test]
#[ignore = "installed Animation worker and disposable PostgreSQL"]
async fn service_animation_runtime_is_scoped_isolated_and_revocable() {
    let mut f = Fixture::new().await;
    f.docs
        .configure_app(&token("admin"), "animation", true, false)
        .await
        .unwrap();
    let runtime = aether_server::native::animation::Animation::load(std::path::Path::new(
        &std::env::var("AETHER_TEST_ANIMATION").unwrap(),
    ))
    .unwrap();
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_animation(runtime);
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    let issued: Value = issue(
        &f,
        "admin",
        json!({"name":"Animation job","apps":["animation"],"days":1,"can_write":true}),
    )
    .await
    .json()
    .await
    .unwrap();
    let key = issued["token"].as_str().unwrap();
    let hello = json!({"method":"hello","params":{"protocol_version":1}});
    let response = f
        .client
        .post(format!("{}/animation/rpc", f.url))
        .bearer_auth(key)
        .json(&hello)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.json::<Value>().await.unwrap()["ok"], true);
    assert_eq!(
        f.client
            .post(format!("{}/animation/rpc", f.url))
            .header("origin", &f.url)
            .header("cookie", format!("{COOKIE}={key}"))
            .json(&hello)
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    f.sql("UPDATE aether_identity.agent_connections SET expires=clock_timestamp()-interval '1 second' WHERE kind='service'").await;
    assert_eq!(
        f.client
            .post(format!("{}/animation/rpc", f.url))
            .bearer_auth(key)
            .json(&hello)
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
}
