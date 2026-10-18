#![cfg(unix)]
use super::*;
use aether_server::agents::{Agents, Configuration};
struct AgentFixture {
    f: Fixture,
    agents: Agents,
    config: Configuration,
    root: tempfile::TempDir,
    url: String,
    task: tokio::task::JoinHandle<()>,
}
impl AgentFixture {
    async fn new() -> Self {
        Self::configured(false).await
    }
    async fn configured(all_providers: bool) -> Self {
        let f = Fixture::new().await;
        let root = tempfile::tempdir().unwrap();
        let executable = std::process::Command::new("node")
            .args(["-p", "process.execPath"])
            .output()
            .unwrap();
        assert!(executable.status.success());
        let script = root.path().join("fixture.mjs");
        std::fs::write(&script, include_str!("agent_fixture.mjs")).unwrap();
        let product = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let provider = |id: &str| {
            all_providers.then(|| aether_server::agents::CliProvider {
                adapter: product.join(format!("providers/{id}.mjs")),
                cli: product.join("tests/native_documents/official_cli_fixture.mjs"),
            })
        };
        let config = Configuration {
            root: root.path().join("agents"),
            node: String::from_utf8(executable.stdout).unwrap().trim().into(),
            chatgpt_adapter: script,
            claude: provider("claude"),
            gemini: provider("gemini"),
        };
        let agents = Agents::open(config.clone(), "company").unwrap();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let host = NativeHost::new(f.identity.clone(), &url, 64, Duration::from_secs(30))
            .unwrap()
            .with_documents(f.docs.clone())
            .with_agents(agents.clone());
        let task = tokio::spawn(async move {
            axum::serve(
                listener,
                router(host).into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await
            .unwrap();
        });
        Self {
            f,
            agents,
            config,
            root,
            url,
            task,
        }
    }
    async fn post(&self, user: &str, action: &str, data: Value) -> reqwest::Response {
        self.f
            .client
            .post(format!("{}/api/agent/{action}", self.url))
            .header("origin", &self.url)
            .header("cookie", format!("{COOKIE}={}", token(user)))
            .json(&data)
            .send()
            .await
            .unwrap()
    }
    async fn call(&self, user: &str, action: &str, data: Value) -> Value {
        let response = self.post(user, action, data).await;
        let status = response.status();
        let value: Value = response.json().await.unwrap();
        assert_eq!(status, 200, "{action}: {value}");
        value
    }
    async fn wait(&self, user: &str, id: &str) -> Value {
        tokio::time::timeout(Duration::from_secs(8), async {
            loop {
                let value = self.call(user, "job", json!({"id":id})).await;
                if value["state"] != "running" {
                    return value;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .unwrap()
    }
    async fn connect(&self, user: &str) {
        self.call("admin", "install", json!({"provider":"chatgpt"}))
            .await;
        let job = self
            .call(user, "login", json!({"provider":"chatgpt"}))
            .await;
        let id = job["id"].as_str().unwrap();
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if !self.call(user, "job", json!({"id":id})).await["login"].is_null() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        self.call(user, "code", json!({"id":id,"code":user})).await;
        assert_eq!(self.wait(user, id).await["state"], "completed");
    }
    fn dir(&self, user: &str) -> std::path::PathBuf {
        self.config
            .root
            .join(format!("{:x}", Sha256::digest("company")))
            .join("accounts")
            .join(format!("{:x}", Sha256::digest(user)))
    }
    async fn finish(self) {
        self.agents.shutdown().await;
        self.task.abort();
        let _ = self.task.await;
    }
}
fn chat(mode: &str) -> Value {
    json!({"provider":"chatgpt","app":"map","messages":[{"role":"user","content":mode}],"context":"fixture","model":"fixture-model"})
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_image_budget_and_receipt_retry() {
    let a = AgentFixture::new().await;
    a.connect("alice").await;
    let mut payload = chat("image-budget");
    payload["tools"] = json!([{"name":"aether_sketch_preview","description":"Preview","inputSchema":{"type":"object","properties":{}}}]);
    let job = a.call("alice", "chat", payload).await;
    assert_eq!(job["tool_result_format"], "images-v1");
    let id = job["id"].as_str().unwrap();
    let image = json!({"mimeType":"image/png","width":1,"height":1,"data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUioAAAAASUVORK5CYII="});
    for index in 0..9 {
        let call_id = format!("image{index}");
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                let job = a.call("alice", "job", json!({"id":id})).await;
                if job["tool_call"]["id"] == call_id {
                    break;
                }
                assert_eq!(job["state"], "running");
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        let receipt = json!({"id":id,"call_id":call_id,"result":{"ok":true,"value":{"kind":"drawing"},"images":[image.clone()]}});
        if index < 8 {
            let mut invalid = receipt.clone();
            invalid["result"]["images"][0]["width"] = json!(2);
            assert_eq!(a.post("alice", "tool_result", invalid).await.status(), 400);
            assert_eq!(
                a.post("bob", "tool_result", receipt.clone()).await.status(),
                404
            );
            a.call("alice", "tool_result", receipt.clone()).await;
            a.call("alice", "tool_result", receipt.clone()).await;
            let mut conflict = receipt;
            conflict["result"]["value"]["kind"] = json!("other");
            assert_eq!(a.post("alice", "tool_result", conflict).await.status(), 409);
        } else {
            assert_eq!(a.post("alice", "tool_result", receipt).await.status(), 400);
            a.call("alice","tool_result",json!({"id":id,"call_id":call_id,"result":{"ok":false,"error":"Preview limit reached"}})).await;
        }
    }
    assert_eq!(a.wait("alice", id).await["state"], "completed");
    a.finish().await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_editor_tools_are_scoped_and_receipts_are_idempotent() {
    let a = AgentFixture::new().await;
    a.connect("alice").await;
    let mut payload = chat("tools");
    payload["tools"] = json!([{"name":"aether_sketch_draw","description":"Draw rectangle","inputSchema":{"type":"object","properties":{"width":{"type":"number"}}}}]);
    let job = a.call("alice", "chat", payload.clone()).await;
    let id = job["id"].as_str().unwrap();
    let pending = tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let value = a.call("alice", "job", json!({"id":id})).await;
            if !value["tool_call"].is_null() {
                break value;
            }
            assert_eq!(value["state"], "running", "{value}");
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(pending["tool_call"]["name"], "aether_sketch_draw");
    let receipt = json!({"id":id,"call_id":"edit1","result":{"ok":true,"value":{"shape_id":"r1"}}});
    assert_eq!(
        a.post("bob", "tool_result", receipt.clone()).await.status(),
        404
    );
    let mut wrong = receipt.clone();
    wrong["call_id"] = json!("wrong");
    assert_eq!(a.post("alice", "tool_result", wrong).await.status(), 409);
    a.call("alice", "tool_result", receipt.clone()).await;
    a.call("alice", "tool_result", receipt.clone()).await;
    let mut conflict = receipt;
    conflict["result"]["value"]["shape_id"] = json!("other");
    assert_eq!(a.post("alice", "tool_result", conflict).await.status(), 409);
    let done = a.wait("alice", id).await;
    assert_eq!(done["state"], "completed");
    assert!(done["text"].as_str().unwrap().contains("r1"));
    payload["messages"][0]["content"] = json!("unknown-tool");
    let invalid = a.call("alice", "chat", payload.clone()).await;
    assert_eq!(
        a.wait("alice", invalid["id"].as_str().unwrap()).await["state"],
        "failed"
    );
    payload["messages"][0]["content"] = json!("tools");
    let cancelled = a.call("alice", "chat", payload).await;
    let id = cancelled["id"].as_str().unwrap();
    a.call("alice", "cancel", json!({"id":id})).await;
    assert_eq!(
        a.post(
            "alice",
            "tool_result",
            json!({"id":id,"call_id":"edit1","result":{"ok":true,"value":null}})
        )
        .await
        .status(),
        409
    );
    a.finish().await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_catalog_authority_and_boundary() {
    let a = AgentFixture::new().await;
    let catalog = a.call("alice", "catalog", json!({})).await;
    assert_eq!(catalog["plugins"].as_array().unwrap().len(), 3);
    assert_eq!(catalog["plugins"][0]["installed"], false);
    assert_eq!(catalog["plugins"][1]["capabilities"]["chat"], false);
    assert_eq!(
        a.post("alice", "install", json!({"provider":"chatgpt"}))
            .await
            .status(),
        403
    );
    assert_eq!(
        a.post("admin", "install", json!({"provider":"claude"}))
            .await
            .status(),
        501
    );
    assert_eq!(a.post("alice", "chat", chat("hello")).await.status(), 409);
    assert_eq!(
        a.post("alice", "catalog", json!({"user":"admin"}))
            .await
            .status(),
        400
    );
    assert_eq!(a.post("nobody", "catalog", json!({})).await.status(), 401);
    let foreign =
        a.f.client
            .post(format!("{}/api/agent/catalog", a.url))
            .header("origin", "https://foreign.invalid")
            .header("cookie", format!("{COOKIE}={}", token("admin")))
            .json(&json!({}))
            .send()
            .await
            .unwrap();
    assert_eq!(foreign.status(), 403);
    let response = a.post("alice", "catalog", json!({})).await;
    assert_eq!(response.headers()["cache-control"], "no-store");
    a.f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(a.post("alice", "catalog", json!({})).await.status(), 403);
    a.finish().await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_isolate_connections_jobs_and_environment() {
    let a = AgentFixture::new().await;
    a.connect("alice").await;
    a.connect("bob").await;
    let job = a.call("alice", "chat", chat("hello")).await;
    let id = job["id"].as_str().unwrap();
    assert_eq!(a.post("bob", "job", json!({"id":id})).await.status(), 404);
    assert_eq!(
        a.post("bob", "cancel", json!({"id":id})).await.status(),
        404
    );
    let done = a.wait("alice", id).await;
    assert_eq!(done["state"], "completed");
    assert_eq!(done["text"], "Hello alice");
    let bob = a.call("bob", "catalog", json!({})).await;
    assert_eq!(bob["plugins"][0]["account"]["label"], "bob");
    assert!(!bob.to_string().contains("DO-NOT-EXPOSE"));
    let process: Value = serde_json::from_slice(
        &std::fs::read(a.dir("alice").join("chatgpt/process.json")).unwrap(),
    )
    .unwrap();
    let env = process["env"].as_array().unwrap();
    assert!(
        env.iter()
            .all(|k| ["HOME", "TMPDIR", "LANG", "__CF_USER_TEXT_ENCODING"]
                .contains(&k.as_str().unwrap())),
        "{env:?}"
    );
    let models = a
        .call("alice", "models", json!({"provider":"chatgpt"}))
        .await;
    let done = a.wait("alice", models["id"].as_str().unwrap()).await;
    assert_eq!(done["models"][0]["id"], "fixture-model");
    a.call("alice", "disconnect", json!({"provider":"chatgpt"}))
        .await;
    assert!(!a.dir("alice").exists());
    assert!(a.dir("bob").exists());
    assert_eq!(
        a.call("bob", "catalog", json!({})).await["plugins"][0]["account"]["connected"],
        true
    );
    a.finish().await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_cancel_disable_and_revoke() {
    let a = AgentFixture::new().await;
    a.connect("alice").await;
    let job = a.call("alice", "chat", chat("hang")).await;
    let id = job["id"].as_str().unwrap();
    assert_eq!(a.post("alice", "chat", chat("hello")).await.status(), 409);
    a.call("admin", "disable", json!({"provider":"chatgpt"}))
        .await;
    assert_eq!(a.wait("alice", id).await["state"], "cancelled");
    // Wait for process cleanup, not just the public cancellation flag.
    tokio::time::sleep(Duration::from_millis(200)).await;
    a.call("admin", "enable", json!({"provider":"chatgpt"}))
        .await;
    let job = a.call("alice", "chat", chat("hang")).await;
    let id = job["id"].as_str().unwrap();
    a.f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(a.post("alice", "job", json!({"id":id})).await.status(), 403);
    tokio::time::sleep(Duration::from_millis(200)).await;
    a.f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    assert_eq!(a.wait("alice", id).await["state"], "cancelled");
    a.finish().await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_background_revocation_kills_without_polling() {
    let a = AgentFixture::new().await;
    a.connect("alice").await;
    let job = a.call("alice", "chat", chat("close-stdout")).await;
    let id = job["id"].as_str().unwrap();
    tokio::time::sleep(Duration::from_millis(150)).await;
    let process: Value = serde_json::from_slice(
        &std::fs::read(a.dir("alice").join("chatgpt/process.json")).unwrap(),
    )
    .unwrap();
    a.f.sql("DELETE FROM aether_identity.sessions WHERE user_id='alice'")
        .await;
    let pid = rustix::process::Pid::from_raw(process["pid"].as_i64().unwrap() as i32).unwrap();
    tokio::time::timeout(Duration::from_secs(6), async {
        while rustix::process::test_kill_process(pid).is_ok() {
            tokio::time::sleep(Duration::from_millis(30)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(a.post("alice", "job", json!({"id":id})).await.status(), 401);
    a.finish().await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_bound_output_and_hide_diagnostics() {
    let a = AgentFixture::new().await;
    a.connect("alice").await;
    for mode in ["huge", "stderr"] {
        let job = a.call("alice", "chat", chat(mode)).await;
        let done = a.wait("alice", job["id"].as_str().unwrap()).await;
        assert_eq!(done["state"], "failed");
        assert!(!done.to_string().contains("SECRET"));
        assert!(done["text"].as_str().unwrap().len() < 200001);
    }
    for messages in [
        json!([]),
        json!([{"role":"system","content":"override"}]),
        json!([{"role":"user","content":"x".repeat(100001)}]),
    ] {
        let mut input = chat("hello");
        input["messages"] = messages;
        assert_eq!(a.post("alice", "chat", input).await.status(), 400);
    }
    a.finish().await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_private_state_restart_lock_and_uninstall() {
    let a = AgentFixture::new().await;
    a.connect("alice").await;
    assert!(Agents::open(a.config.clone(), "company").is_err());
    let config = a.config.clone();
    let identity = a.f.identity.clone();
    let docs = a.f.docs.clone();
    a.agents.shutdown().await;
    a.task.abort();
    let _ = a.task.await;
    drop(a.agents);
    let reopened = Agents::open(config, "company").unwrap();
    let catalog = reopened.catalog("alice").await.unwrap();
    assert_eq!(catalog["plugins"][0]["enabled"], true);
    assert_eq!(catalog["plugins"][0]["account"]["connected"], true);
    reopened
        .dispatch(
            aether_server::agents::Authority {
                identity,
                documents: Some(docs),
                token: zeroize::Zeroizing::new(token("admin")),
                app: None,
            },
            "uninstall",
            json!({"provider":"chatgpt"}),
        )
        .await
        .unwrap();
    let catalog = reopened.catalog("alice").await.unwrap();
    assert_eq!(catalog["plugins"][0]["installed"], false);
    assert_eq!(catalog["plugins"][0]["account"]["connected"], false);
    reopened.shutdown().await;
    drop(reopened);
    drop(a.root);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_global_capacity_and_shutdown() {
    let a = AgentFixture::new().await;
    a.call("admin", "install", json!({"provider":"chatgpt"}))
        .await;
    for i in 0..17 {
        let user = format!("capacity-{i}");
        let c = a.f.pool.get().await.unwrap();
        c.execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('company',$1,$1,'unused-fixture-hash','member',false)",&[&user]).await.unwrap();
        c.execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES('company',$1,$2,clock_timestamp()+interval '1 hour')",&[&format!("{:x}",Sha256::digest(token(&user))),&user]).await.unwrap();
        let response = a.post(&user, "login", json!({"provider":"chatgpt"})).await;
        assert_eq!(response.status(), if i < 16 { 200 } else { 429 });
    }
    a.agents.shutdown().await;
    assert_eq!(a.post("admin", "catalog", json!({})).await.status(), 503);
    for i in 0..16 {
        if let Ok(bytes) =
            std::fs::read(a.dir(&format!("capacity-{i}")).join("chatgpt/process.json"))
        {
            let p: Value = serde_json::from_slice(&bytes).unwrap();
            let pid = rustix::process::Pid::from_raw(p["pid"].as_i64().unwrap() as i32).unwrap();
            assert!(rustix::process::test_kill_process(pid).is_err());
        }
    }
    a.finish().await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_reject_foreign_login_url_and_cancelled_connection() {
    let a = AgentFixture::new().await;
    a.call("admin", "install", json!({"provider":"chatgpt"}))
        .await;
    for code in ["bad-url", "hang"] {
        let job = a
            .call("alice", "login", json!({"provider":"chatgpt"}))
            .await;
        let id = job["id"].as_str().unwrap();
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if !a.call("alice", "job", json!({"id":id})).await["login"].is_null() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        a.call("alice", "code", json!({"id":id,"code":code})).await;
        if code == "hang" {
            a.call("alice", "cancel", json!({"id":id})).await;
        }
        let done = a.wait("alice", id).await;
        assert_eq!(
            done["state"],
            if code == "hang" {
                "cancelled"
            } else {
                "failed"
            }
        );
        assert!(!done.to_string().contains("attacker.invalid"));
        assert_eq!(
            a.call("alice", "catalog", json!({})).await["plugins"][0]["account"]["connected"],
            false
        );
    }
    a.finish().await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_official_cli_adapters_isolate_providers_and_preserve_chatgpt() {
    let a = AgentFixture::configured(true).await;
    a.connect("alice").await;
    for (index, provider) in [(1, "claude"), (2, "gemini")] {
        let catalog = a
            .call("admin", "install", json!({"provider":provider}))
            .await;
        assert_eq!(catalog["plugins"][index]["runtimeReady"], true);
        assert_eq!(catalog["plugins"][index]["installed"], true);
        let login = a.call("alice", "login", json!({"provider":provider})).await;
        let done = a.wait("alice", login["id"].as_str().unwrap()).await;
        assert_eq!(done["provider"], provider);
        assert_eq!(done["state"], "completed", "{done}");
        let models = a
            .call("alice", "models", json!({"provider":provider}))
            .await;
        let done = a.wait("alice", models["id"].as_str().unwrap()).await;
        assert_eq!(done["state"], "completed", "{done}");
        assert!(
            done["models"]
                .as_array()
                .unwrap()
                .iter()
                .any(|m| m["id"] == "")
        );
        let mut request = chat("hello");
        request["provider"] = json!(provider);
        let job = a.call("alice", "chat", request).await;
        let done = a.wait("alice", job["id"].as_str().unwrap()).await;
        assert_eq!(done["state"], "completed", "{done}");
        assert!(done["text"].as_str().unwrap().contains("fixture response"));
        let other = a.call("bob", "catalog", json!({})).await;
        assert_eq!(other["plugins"][index]["account"]["connected"], false);
    }
    // Per-provider changes must not remove another connection or stop its job.
    let mut request = chat("hang");
    request["provider"] = json!("gemini");
    let running = a.call("alice", "chat", request).await;
    a.call("admin", "disable", json!({"provider":"claude"}))
        .await;
    let job = a.call("alice", "job", json!({"id":running["id"]})).await;
    assert_eq!(job["state"], "running");
    let catalog = a
        .call("admin", "uninstall", json!({"provider":"claude"}))
        .await;
    assert_eq!(catalog["plugins"][1]["installed"], false);
    assert_eq!(catalog["plugins"][2]["enabled"], true);
    a.call("alice", "cancel", json!({"id":running["id"]})).await;
    // Polling reports cancellation immediately; disconnect retries until reaped.
    for _ in 0..100 {
        if a.post("alice", "disconnect", json!({"provider":"gemini"}))
            .await
            .status()
            == 200
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let catalog = a.call("alice", "catalog", json!({})).await;
    assert_eq!(catalog["plugins"][0]["account"]["connected"], true);
    assert_eq!(catalog["plugins"][1]["account"]["connected"], false);
    assert_eq!(catalog["plugins"][2]["account"]["connected"], false);
    let job = a.call("alice", "chat", chat("hello")).await;
    assert_eq!(
        a.wait("alice", job["id"].as_str().unwrap()).await["text"],
        "Hello alice"
    );
    a.finish().await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_agents_cli_state_survives_restart_and_can_disconnect_without_runtime() {
    let a = AgentFixture::configured(true).await;
    a.connect("alice").await;
    a.call("admin", "install", json!({"provider":"claude"}))
        .await;
    let login = a.call("alice", "login", json!({"provider":"claude"})).await;
    assert_eq!(
        a.wait("alice", login["id"].as_str().unwrap()).await["state"],
        "completed"
    );
    let mut config = a.config.clone();
    a.agents.shutdown().await;
    a.task.abort();
    let _ = a.task.await;
    drop(a.agents);
    // Removal of an optional adapter must not discard state or prevent cleanup.
    config.claude = None;
    let reopened = Agents::open(config, "company").unwrap();
    let catalog = reopened.catalog("alice").await.unwrap();
    assert_eq!(catalog["plugins"][1]["runtimeReady"], false);
    assert_eq!(catalog["plugins"][1]["account"]["connected"], true);
    let authority = aether_server::agents::Authority {
        identity: a.f.identity.clone(),
        documents: Some(a.f.docs.clone()),
        token: zeroize::Zeroizing::new(token("alice")),
        app: None,
    };
    assert!(matches!(
        reopened
            .dispatch(authority.clone(), "login", json!({"provider":"claude"}))
            .await,
        Err(aether_server::agents::Error::Unsupported)
    ));
    reopened
        .dispatch(authority, "disconnect", json!({"provider":"claude"}))
        .await
        .unwrap();
    let catalog = reopened.catalog("alice").await.unwrap();
    assert_eq!(catalog["plugins"][1]["account"]["connected"], false);
    assert_eq!(catalog["plugins"][0]["account"]["connected"], true);
    reopened.shutdown().await;
    drop(reopened);
    drop(a.root);
}
