use super::*;
use base64::Engine;
use tokio::io::AsyncWriteExt;
async fn created(f: &Fixture, op: &str) -> Value {
    let response=f.library("alice","create",json!({"app":"map","operation_id":op,"kind":"file","name":"Fixture.aethermap","scope":"personal","data_base64":"e30="})).await;
    let status = response.status();
    let value: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}

async fn manage(f: &Fixture, user: &str, action: &str, data: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/automation/connections/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&data)
        .send()
        .await
        .unwrap()
}
async fn issue(f: &Fixture, user: &str, write: bool) -> Value {
    let response = manage(
        f,
        user,
        "create",
        json!({"label":"Fixture","apps":["map"],"can_write":write}),
    )
    .await;
    let status = response.status();
    let value: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
async fn command(f: &Fixture, key: &str, id: &str, arguments: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/automation/commands/run", f.url))
        .bearer_auth(key)
        .json(&json!({"id":id,"arguments":arguments}))
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
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_grants_are_hashed_private_and_scoped() {
    let f = Fixture::new().await;
    let issued = issue(&f, "alice", false).await;
    let key = issued["token"].as_str().unwrap();
    let row=f.pool.get().await.unwrap().query_one("SELECT token_hash,can_write,can_edit_content FROM aether_identity.agent_connections WHERE tenant='company'",&[]).await.unwrap();
    assert_eq!(
        row.get::<_, String>(0),
        format!("{:x}", Sha256::digest(key.as_bytes()))
    );
    assert!(!row.get::<_, bool>(1));
    assert!(!row.get::<_, bool>(2));
    let listing: Value = manage(&f, "alice", "list", json!({}))
        .await
        .json()
        .await
        .unwrap();
    assert!(!listing.to_string().contains(key));
    assert!(listing["connections"][0].get("token_hash").is_none());
    let other: Value = manage(&f, "bob", "list", json!({}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(other["connections"], json!([]));
    assert_eq!(
        manage(
            &f,
            "bob",
            "revoke",
            json!({"id":issued["connection"]["id"]})
        )
        .await
        .status(),
        403
    );
    let tools: Value = catalog(&f, key).await.json().await.unwrap();
    assert_eq!(tools["commands"].as_array().unwrap().len(), 3);
    assert_eq!(tools["apps"], json!(["map"]));
    assert_eq!(
        command(&f, key, "document.list", json!({"app":"cad"}))
            .await
            .status(),
        403
    );
    let file = created(&f, "agent-private").await;
    assert_eq!(
        command(
            &f,
            key,
            "document.rename",
            json!({"app":"map","id":file["id"],"name":"Denied","expected_revision":1})
        )
        .await
        .status(),
        403
    );
    for value in [
        json!({"label":"x","apps":["ui"]}),
        json!({"label":"x","apps":["map"],"can_edit_content":true}),
        json!({"label":"x","apps":["map"],"lifetime_hours":169}),
        json!({"label":"x","apps":["map","map"]}),
    ] {
        assert!(
            manage(&f, "alice", "create", value)
                .await
                .status()
                .is_client_error()
        );
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_keeps_revision_guards_history_and_receipts() {
    let f = Fixture::new().await;
    let file = created(&f, "agent-edit").await;
    let id = file["id"].as_str().unwrap();
    let grant = issue(&f, "alice", true).await;
    let key = grant["token"].as_str().unwrap();
    let body = json!({"id":"document.rename","operation_id":"agent-rename-one","arguments":{"app":"map","id":id,"name":"Changed","expected_revision":1}});
    for replay in [false, true] {
        let res = f
            .client
            .post(format!("{}/api/automation/commands/run", f.url))
            .bearer_auth(key)
            .json(&body)
            .send()
            .await
            .unwrap();
        let status = res.status();
        let out: Value = res.json().await.unwrap();
        assert_eq!(status, 200, "{out}");
        assert_eq!(out["result"]["revision"], 2);
        assert_eq!(out["result"]["replayed"], replay);
    }
    assert_eq!(
        command(
            &f,
            key,
            "document.rename",
            json!({"app":"map","id":id,"name":"Stale","expected_revision":1})
        )
        .await
        .status(),
        409
    );
    let read: Value = command(&f, key, "document.inspect", json!({"app":"map","id":id}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(read["result"]["text"], "{}");
    assert!(read["result"].get("data_base64").is_none());
    assert_eq!(read["result"]["revision"], 2);
    let version = command(
        &f,
        key,
        "document.version.create",
        json!({"app":"map","id":id,"name":"Check","expected_revision":2}),
    )
    .await;
    assert_eq!(version.status(), 200, "{}", version.text().await.unwrap());
    let history: Value = command(&f, key, "document.history", json!({"app":"map","id":id}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(history["result"]["revisions"].as_array().unwrap().len(), 2);
    assert_eq!(history["result"]["versions"].as_array().unwrap().len(), 1);
    let audit=f.pool.get().await.unwrap().query_one("SELECT count(*) FROM aether_identity.audit WHERE tenant='company' AND action='agent_command'",&[]).await.unwrap().get::<_,i64>(0);
    assert!(audit >= 5);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_boundary_never_accepts_keys_as_browser_sessions() {
    let f = Fixture::new().await;
    let issued = issue(&f, "alice", false).await;
    let key = issued["token"].as_str().unwrap();
    for path in [
        "/api/automation/connections/list",
        "/api/library/list",
        "/api/agent/catalog",
        "/api/admin/users",
    ] {
        let r = f
            .client
            .post(format!("{}{path}", f.url))
            .bearer_auth(key)
            .header("origin", &f.url)
            .json(&json!({}))
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 401, "{path}");
    }
    let url = format!("{}/api/automation/commands/list", f.url);
    for mode in [
        "foreign-origin",
        "foreign-site",
        "mixed",
        "duplicate",
        "query",
        "session",
    ] {
        let mut request = f
            .client
            .post(if mode == "query" {
                format!("{url}?x=1")
            } else {
                url.clone()
            })
            .json(&json!({}));
        request = request.bearer_auth(if mode == "session" {
            token("alice")
        } else {
            key.into()
        });
        request = match mode {
            "foreign-origin" => request.header("origin", "https://foreign.test"),
            "foreign-site" => request.header("sec-fetch-site", "cross-site"),
            "mixed" => request.header("cookie", format!("{COOKIE}={}", token("alice"))),
            "duplicate" => request.header("authorization", format!("Bearer {key}")),
            _ => request,
        };
        assert!(
            request.send().await.unwrap().status().is_client_error(),
            "{mode}"
        );
    }
    assert_eq!(
        f.client
            .post(&url)
            .header("origin", &f.url)
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .json(&json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_current_file_and_app_authority() {
    let f = Fixture::new().await;
    let file = created(&f, "agent-scope").await;
    let id = file["id"].as_str().unwrap();
    let granted = issue(&f, "bob", true).await;
    let key = granted["token"].as_str().unwrap();
    assert_eq!(
        command(&f, key, "document.inspect", json!({"app":"map","id":id}))
            .await
            .status(),
        404
    );
    f.docs
        .grant(&token("alice"), id, "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(
        command(&f, key, "document.inspect", json!({"app":"map","id":id}))
            .await
            .status(),
        200
    );
    assert_eq!(
        command(
            &f,
            key,
            "document.rename",
            json!({"app":"map","id":id,"name":"No","expected_revision":1})
        )
        .await
        .status(),
        404
    );
    f.docs
        .grant(&token("alice"), id, "bob", None)
        .await
        .unwrap();
    assert_eq!(
        command(&f, key, "document.inspect", json!({"app":"map","id":id}))
            .await
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        command(&f, key, "document.list", json!({"app":"map"}))
            .await
            .status(),
        403
    );
    let c: Value = catalog(&f, key).await.json().await.unwrap();
    assert_eq!(c["commands"], json!([]));
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_revocation_expiry_and_password_reset() {
    let f = Fixture::new().await;
    for mode in [
        "revoke",
        "expire",
        "sessions",
        "password",
        "inactive",
        "must-change",
    ] {
        let g = issue(&f, "alice", false).await;
        let key = g["token"].as_str().unwrap();
        assert_eq!(catalog(&f, key).await.status(), 200);
        match mode {
            "revoke"=>{assert_eq!(manage(&f,"alice","revoke",json!({"id":g["connection"]["id"]})).await.status(),200);},
            "expire"=>f.sql("UPDATE aether_identity.agent_connections SET expires=clock_timestamp()-interval '1 second'").await,
            "sessions"=>f.identity.revoke_sessions(&token("admin"),"alice").await.unwrap(),
            "password"=>f.identity.reset_password(&token("admin"),"alice","test-reset-password-long").await.unwrap(),
            "inactive"=>f.sql("UPDATE aether_identity.users SET active=false WHERE id='alice'").await,
            _=>f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'").await,
        }
        assert_eq!(catalog(&f, key).await.status(), 401, "{mode}");
        f.sql("UPDATE aether_identity.users SET active=true,must_change=false WHERE id='alice'")
            .await;
        f.pool.get().await.unwrap().execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES('company',$1,'alice',clock_timestamp()+interval '1 hour') ON CONFLICT DO NOTHING",&[&format!("{:x}",Sha256::digest(token("alice")))]).await.unwrap();
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_schema2_upgrade_preserves_documents_and_accounts() {
    let f = Fixture::new().await;
    let file = created(&f, "agent-upgrade").await;
    f.sql("DROP TABLE aether_access.live_editor_calls; DROP TABLE aether_identity.oauth_grants, aether_identity.oauth_requests, aether_identity.oauth_clients, aether_identity.agent_connections").await;
    let checksum = format!(
        "{:x}",
        Sha256::digest(
            format!(
                "{}{}",
                include_str!("../../../identity/src/schema.sql"),
                include_str!("../../../identity/src/schema2.sql")
            )
            .as_bytes()
        )
    );
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_identity.schema_state SET version=2,checksum=$1",
            &[&checksum],
        )
        .await
        .unwrap();
    assert!(f.identity.check_schema().await.is_err());
    f.identity.migrate().await.unwrap();
    f.identity.migrate().await.unwrap();
    f.identity.check_schema().await.unwrap();
    assert_eq!(
        f.library("alice", "read", json!({"app":"map","id":file["id"]}))
            .await
            .status(),
        200
    );
    issue(&f, "alice", false).await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_folder_binary_and_payload_limits() {
    let f = Fixture::new().await;
    let g = issue(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap();
    let folder: Value = f
        .library(
            "alice",
            "create",
            json!({"app":"map","operation_id":"agent-folder","name":"Folder","kind":"folder"}),
        )
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(
        command(
            &f,
            key,
            "document.rename",
            json!({"app":"map","id":folder["id"],"name":"No","expected_revision":1})
        )
        .await
        .status(),
        400
    );
    for (name, data, kind) in [
        ("binary", vec![0, 255, 23], "binary"),
        ("text", "é".repeat(40000).into_bytes(), "text"),
    ] {
        let content = base64::engine::general_purpose::STANDARD.encode(data);
        let file:Value=f.library("alice","create",json!({"app":"map","operation_id":format!("agent-{name}"),"name":name,"data_base64":content})).await.json().await.unwrap();
        let read: Value = command(
            &f,
            key,
            "document.inspect",
            json!({"app":"map","id":file["id"]}),
        )
        .await
        .json()
        .await
        .unwrap();
        assert_eq!(read["result"]["content_kind"], kind);
        if kind == "text" {
            assert_eq!(read["result"]["text"].as_str().unwrap().len(), 65536);
            assert_eq!(read["result"]["truncated"], true);
        }
    }
    assert_eq!(
        command(
            &f,
            key,
            "document.rename",
            json!({"app":"map","id":"x","expected_revision":true,"name":"x"})
        )
        .await
        .status(),
        400
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_real_rust_mcp_edits() {
    let f = Fixture::new().await;
    let file = created(&f, "native-mcp").await;
    let g = issue(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap();
    let frames = [
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}}),
        json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"document_rename","_meta":{"aether/operationId":"native-mcp-rename"},"arguments":{"app":"map","id":file["id"],"expected_revision":1,"name":"Rust MCP"}}}),
        json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"document_inspect","arguments":{"app":"map","id":file["id"]}}}),
        json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"document_rename","_meta":{"aether/operationId":"native-mcp-rename"},"arguments":{"app":"map","id":file["id"],"expected_revision":1,"name":"Rust MCP"}}}),
        json!({"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"document_rename","_meta":{"aether/operationId":"native-mcp-rename"},"arguments":{"app":"map","id":file["id"],"expected_revision":1,"name":"Changed request"}}}),
    ];
    let mut child = tokio::process::Command::new(
        std::env::var("AETHER_AUTOMATION_BIN").expect("Runner builds Rust bridge"),
    )
    .arg("mcp")
    .env("AETHER_SERVER_URL", &f.url)
    .env("AETHER_AUTOMATION_TOKEN", key)
    .stdin(std::process::Stdio::piped())
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped())
    .kill_on_drop(true)
    .spawn()
    .unwrap();
    let text = frames.iter().map(|v| format!("{v}\n")).collect::<String>();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(text.as_bytes())
        .await
        .unwrap();
    let output = tokio::time::timeout(Duration::from_secs(15), child.wait_with_output())
        .await
        .unwrap()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(!stdout.contains(key));
    let replies: Vec<Value> = stdout
        .lines()
        .map(|l| serde_json::from_str(l).unwrap())
        .collect();
    assert_eq!(replies.len(), 6);
    assert_eq!(
        replies[4]["result"]["structuredContent"]["result"]["replayed"],
        true
    );
    assert_eq!(replies[5]["result"]["isError"], true);
    assert_eq!(replies[1]["result"]["tools"].as_array().unwrap().len(), 5);
    assert_eq!(
        replies[2]["result"]["structuredContent"]["result"]["revision"],
        2
    );
    assert_eq!(
        replies[3]["result"]["structuredContent"]["result"]["name"],
        "Rust MCP"
    );
    let mut cli = tokio::process::Command::new(std::env::var("AETHER_AUTOMATION_BIN").unwrap())
        .args([
            "run",
            "document.rename",
            "--operation-id",
            "native-mcp-rename",
        ])
        .env("AETHER_SERVER_URL", &f.url)
        .env("AETHER_AUTOMATION_TOKEN", key)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    cli.stdin
        .take()
        .unwrap()
        .write_all(
            json!({"app":"map","id":file["id"],"expected_revision":1,"name":"Rust MCP"})
                .to_string()
                .as_bytes(),
        )
        .await
        .unwrap();
    let out = tokio::time::timeout(Duration::from_secs(15), cli.wait_with_output())
        .await
        .unwrap()
        .unwrap();
    assert!(out.status.success());
    let value: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(value["result"]["replayed"], true);
    assert_eq!(value["result"]["revision"], 2);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_rechecks_after_identity_lock_wait() {
    let f = Fixture::new().await;
    let file = created(&f, "agent-lock").await;
    let g = issue(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap().to_string();
    let mut c = f.pool.get().await.unwrap();
    let tx = c
        .build_transaction()
        .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
        .start()
        .await
        .unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
        &[],
    )
    .await
    .unwrap();
    let docs = f.docs.clone();
    let id = file["id"].clone();
    let pending = tokio::spawn(async move {
        docs.automation_run(zeroize::Zeroizing::new(key),serde_json::from_value(json!({"id":"document.rename","arguments":{"app":"map","id":id,"name":"Denied","expected_revision":1}})).unwrap()).await
    });
    f.waiting("%1095062603%").await;
    tx.execute(
        "UPDATE aether_identity.agent_connections SET revoked=true WHERE tenant='company'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(
        pending.await.unwrap(),
        Err(Error::Identity(aether_identity::Error::Unauthorized))
    ));
    let value: Value = f
        .library("alice", "read", json!({"app":"map","id":file["id"]}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(value["revision"], 1);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_grants_survive_restart_without_session_authority() {
    let f = Fixture::new().await;
    let g = issue(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap();
    let identity = Identity::new(f.pool.clone(), "company", 2).unwrap();
    identity.check_schema().await.unwrap();
    assert!(identity.authenticate(key).await.is_err());
    let mut client = f.pool.get().await.unwrap();
    let tx = client
        .build_transaction()
        .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
        .start()
        .await
        .unwrap();
    let (user, grant) = identity
        .authorize_agent_transaction(
            &tx,
            key,
            Some("map"),
            aether_identity::automation::AgentAccess::Write,
        )
        .await
        .unwrap();
    assert_eq!(user.id, "alice");
    assert_eq!(grant.id, g["connection"]["id"]);
    tx.commit().await.unwrap();
    identity
        .revoke_agent_connection(&token("alice"), grant.id.as_str())
        .await
        .unwrap();
    assert_eq!(catalog(&f, key).await.status(), 401);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn native_automation_issuance_limits_are_atomic_and_audit_failure_rolls_back() {
    let f = Fixture::new().await;
    // Two concurrent creates racing for the final hourly slot must not both succeed.
    f.pool.get().await.unwrap().batch_execute("INSERT INTO aether_identity.agent_connections(tenant,id,user_id,token_hash,label,apps,expires) SELECT 'company','seed-'||n,'alice',lpad(n::text,64,'0'),'Seed',ARRAY['map'],clock_timestamp()+interval '1 day' FROM generate_series(1,19) n").await.unwrap();
    let input = json!({"label":"Last slot","apps":["map"]});
    let (a, b) = tokio::join!(
        manage(&f, "alice", "create", input.clone()),
        manage(&f, "alice", "create", input)
    );
    let mut statuses = vec![a.status().as_u16(), b.status().as_u16()];
    statuses.sort();
    assert_eq!(statuses, vec![200, 429]);
    // Revoking credentials does not bypass the issuance throttle.
    f.pool
        .get()
        .await
        .unwrap()
        .batch_execute("UPDATE aether_identity.agent_connections SET revoked=true")
        .await
        .unwrap();
    assert_eq!(
        manage(
            &f,
            "alice",
            "create",
            json!({"label":"No bypass","apps":["map"]})
        )
        .await
        .status(),
        429
    );
    f.pool.get().await.unwrap().batch_execute("DELETE FROM aether_identity.agent_connections; INSERT INTO aether_identity.agent_connections(tenant,id,user_id,token_hash,label,apps,created,expires) SELECT 'company','seed-'||n,'alice',lpad(n::text,64,'0'),'Seed',ARRAY['map'],clock_timestamp()-interval '2 hours',clock_timestamp()+interval '1 day' FROM generate_series(1,64) n").await.unwrap();
    assert_eq!(
        manage(
            &f,
            "alice",
            "create",
            json!({"label":"Active limit","apps":["map"]})
        )
        .await
        .status(),
        429
    );
    f.pool.get().await.unwrap().batch_execute("DELETE FROM aether_identity.agent_connections; CREATE FUNCTION fail_agent_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER fail_agent_audit BEFORE INSERT ON aether_identity.audit FOR EACH ROW EXECUTE FUNCTION fail_agent_audit()").await.unwrap();
    assert_eq!(
        manage(
            &f,
            "alice",
            "create",
            json!({"label":"Audit failed","apps":["map"]})
        )
        .await
        .status(),
        503
    );
    let count: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_identity.agent_connections",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 0);
}
