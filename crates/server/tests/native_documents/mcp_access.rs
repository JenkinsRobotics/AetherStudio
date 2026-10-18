use super::*;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
const CALLBACK: &str = "http://127.0.0.1:54321/callback";
const VERIFIER: &str = "aether-fixture-verifier-012345678901234567890123456789";

async fn response_json(response: reqwest::Response, expected: u16) -> Value {
    let status = response.status();
    let value: Value = response.json().await.unwrap();
    assert_eq!(status, expected, "{value}");
    value
}
async fn register(f: &Fixture) -> String {
    response_json(f.client.post(format!("{}/oauth/register",f.url)).json(&json!({"client_name":"Fixture assistant","redirect_uris":[CALLBACK],"token_endpoint_auth_method":"none","grant_types":["authorization_code"]})).send().await.unwrap(),201).await["client_id"].as_str().unwrap().into()
}
fn authorization(f: &Fixture, client: &str) -> Vec<(String, String)> {
    [
        ("client_id", client.to_string()),
        ("redirect_uri", CALLBACK.into()),
        ("response_type", "code".into()),
        ("resource", format!("{}/mcp", f.url)),
        ("state", "caller-state&exact".into()),
        ("code_challenge_method", "S256".into()),
        (
            "code_challenge",
            URL_SAFE_NO_PAD.encode(Sha256::digest(VERIFIER)),
        ),
    ]
    .into_iter()
    .map(|(k, v)| (k.into(), v))
    .collect()
}
async fn begin(f: &Fixture, client: &str) -> String {
    let http = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    let response = http
        .get(format!("{}/oauth/authorize", f.url))
        .header("sec-fetch-site", "cross-site")
        .query(&authorization(f, client))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 303);
    let url = reqwest::Url::parse(response.headers()["location"].to_str().unwrap()).unwrap();
    url.query_pairs()
        .find(|(k, _)| k == "agent-connect")
        .unwrap()
        .1
        .into()
}
async fn consent(
    f: &Fixture,
    user: &str,
    action: &str,
    request: &str,
    access: Option<Value>,
) -> reqwest::Response {
    f.client
        .post(format!("{}/api/automation/authorization/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&json!({"request":request,"access":access}))
        .send()
        .await
        .unwrap()
}
async fn approve(f: &Fixture, request: &str, write: bool) -> String {
    let value=response_json(consent(f,"alice","approve",request,Some(json!({"label":"ignored","apps":["map"],"can_write":write,"can_edit_content":write,"lifetime_hours":1}))).await,200).await;
    let url = reqwest::Url::parse(value["redirect"].as_str().unwrap()).unwrap();
    assert_eq!(
        url.query_pairs().find(|(k, _)| k == "state").unwrap().1,
        "caller-state&exact"
    );
    url.query_pairs()
        .find(|(k, _)| k == "code")
        .unwrap()
        .1
        .into()
}
fn exchange_body(f: &Fixture, client: &str, code: &str) -> Value {
    json!({"grant_type":"authorization_code","client_id":client,"redirect_uri":CALLBACK,"resource":format!("{}/mcp",f.url),"code":code,"code_verifier":VERIFIER})
}
async fn exchange(f: &Fixture, body: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/oauth/token", f.url))
        .form(&body)
        .send()
        .await
        .unwrap()
}
async fn connect(f: &Fixture, write: bool) -> String {
    let client = register(f).await;
    let request = begin(f, &client).await;
    let code = approve(f, &request, write).await;
    response_json(exchange(f, exchange_body(f, &client, &code)).await, 200).await["access_token"]
        .as_str()
        .unwrap()
        .into()
}
async fn mcp(f: &Fixture, key: &str, method: &str, params: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/mcp", f.url))
        .bearer_auth(key)
        .header("mcp-protocol-version", "2025-11-25")
        .header("accept", "application/json, text/event-stream")
        .json(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}))
        .send()
        .await
        .unwrap()
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn oauth_pkce_exact_redirect_audience_one_use_and_user_bound_consent() {
    let f = Fixture::new().await;
    let client = register(&f).await;
    let request = begin(&f, &client).await;
    let details = response_json(consent(&f, "alice", "read", &request, None).await, 200).await;
    assert_eq!(details["request"]["client_name"], "Fixture assistant");
    assert_eq!(
        consent(&f, "bob", "read", &request, None).await.status(),
        403
    );
    let code = approve(&f, &request, true).await;
    assert_eq!(
        consent(&f, "alice", "deny", &request, None).await.status(),
        403
    );
    for (field, value) in [
        (
            "code_verifier",
            "incorrect-verifier-012345678901234567890123456789",
        ),
        ("client_id", &"c".repeat(64)),
        ("redirect_uri", "http://127.0.0.1:54322/callback"),
        ("resource", "https://other.test/mcp"),
    ] {
        let mut body = exchange_body(&f, &client, &code);
        body[field] = json!(value);
        assert_eq!(exchange(&f, body).await.status(), 400, "{field}");
    }
    let value = response_json(exchange(&f, exchange_body(&f, &client, &code)).await, 200).await;
    let key = value["access_token"].as_str().unwrap();
    assert!(key.starts_with("aether_mcp_"));
    assert!(value["expires_in"].as_i64().unwrap() <= 3600);
    assert!(value.get("refresh_token").is_none());
    assert_eq!(
        exchange(&f, exchange_body(&f, &client, &code))
            .await
            .status(),
        400
    );
    let row = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT token_hash FROM aether_identity.agent_connections WHERE tenant='company'",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(
        row.get::<_, String>(0),
        format!("{:x}", Sha256::digest(key))
    );
    assert_eq!(
        f.client
            .post(format!("{}/api/automation/commands/list", f.url))
            .bearer_auth(key)
            .json(&json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert!(
        f.identity
            .authorize_mcp(key, "https://wrong.test/mcp")
            .await
            .is_err()
    );
    assert_eq!(response_json(mcp(&f,key,"initialize",json!({"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}})).await,200).await["result"]["protocolVersion"],"2025-11-25");
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn mcp_edits_use_user_permissions_history_replay_and_revocation() {
    let f = Fixture::new().await;
    let file=response_json(f.library("alice","create",json!({"app":"map","operation_id":"mcp-fixture","kind":"file","name":"Before.aethermap","scope":"personal","data_base64":"e30="})).await,200).await;
    let key = connect(&f, true).await;
    let list = response_json(mcp(&f, &key, "tools/list", json!({})).await, 200).await;
    assert!(
        list["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["name"] == "document_rename")
    );
    let args = json!({"name":"document_rename","arguments":{"app":"map","id":file["id"],"name":"After.aethermap","expected_revision":1},"_meta":{"aether/operationId":"mcp-rename-1"}});
    let first = response_json(mcp(&f, &key, "tools/call", args.clone()).await, 200).await;
    assert_eq!(first["result"]["isError"], false, "{first}");
    let replay = response_json(mcp(&f, &key, "tools/call", args.clone()).await, 200).await;
    assert_eq!(replay["result"]["isError"], false, "{replay}");
    let mut stale = args.clone();
    stale["_meta"]["aether/operationId"] = json!("mcp-rename-2");
    assert_eq!(
        response_json(mcp(&f, &key, "tools/call", stale).await, 200).await["result"]["isError"],
        true
    );
    let reader = connect(&f, false).await;
    let read_tools = response_json(mcp(&f, &reader, "tools/list", json!({})).await, 200).await;
    assert!(
        read_tools["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .all(|t| t["annotations"]["readOnlyHint"] == true)
    );
    assert_eq!(
        response_json(mcp(&f, &reader, "tools/call", args).await, 200).await["error"]["code"],
        -32602
    );
    assert_eq!(
        response_json(
            mcp(
                &f,
                &key,
                "tools/call",
                json!({"name":"document_list","arguments":{"app":"cad"}})
            )
            .await,
            200
        )
        .await["result"]["isError"],
        true
    );
    let grant: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT id FROM aether_identity.agent_connections WHERE token_hash=$1",
            &[&format!("{:x}", Sha256::digest(&key))],
        )
        .await
        .unwrap()
        .get(0);
    assert!(
        f.identity
            .revoke_agent_connection(&token("bob"), &grant)
            .await
            .is_err()
    );
    f.identity
        .revoke_agent_connection(&token("alice"), &grant)
        .await
        .unwrap();
    assert_eq!(mcp(&f, &key, "tools/list", json!({})).await.status(), 401);
    assert_eq!(
        first["result"]["structuredContent"]["result"]["revision"],
        2
    );
    assert_eq!(
        replay["result"]["structuredContent"]["result"]["replayed"],
        true
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn mcp_metadata_boundaries_cancellation_expiry_and_stdio_catalog_match() {
    let f = Fixture::new().await;
    let response = f
        .client
        .post(format!("{}/mcp", f.url))
        .json(&json!({}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 401);
    assert!(
        response.headers()["www-authenticate"]
            .to_str()
            .unwrap()
            .contains("oauth-protected-resource/mcp")
    );
    let meta = response_json(
        f.client
            .get(format!(
                "{}/.well-known/oauth-protected-resource/mcp",
                f.url
            ))
            .send()
            .await
            .unwrap(),
        200,
    )
    .await;
    assert_eq!(meta["resource"], format!("{}/mcp", f.url));
    assert_eq!(
        f.client
            .get(format!("{}/mcp", f.url))
            .send()
            .await
            .unwrap()
            .status(),
        405
    );
    let client = register(&f).await;
    let request = begin(&f, &client).await;
    let denied = response_json(consent(&f, "alice", "deny", &request, None).await, 200).await;
    assert!(
        denied["redirect"]
            .as_str()
            .unwrap()
            .contains("error=access_denied")
    );
    assert_eq!(
        consent(&f, "alice", "approve", &request, None)
            .await
            .status(),
        403
    );
    let request = begin(&f, &client).await;
    let code = approve(&f, &request, false).await;
    f.sql("UPDATE aether_identity.oauth_requests SET code_expires=clock_timestamp()-interval '1 second'").await;
    assert_eq!(
        exchange(&f, exchange_body(&f, &client, &code))
            .await
            .status(),
        400
    );
    let key = connect(&f, false).await;
    for (name, value) in [
        ("origin", "https://wrong.test"),
        ("cookie", "aether_native_session=wrong"),
        ("host", "wrong.test"),
        ("mcp-protocol-version", "1900-01-01"),
    ] {
        assert!(
            f.client
                .post(format!("{}/mcp", f.url))
                .bearer_auth(&key)
                .header(name, value)
                .json(&json!({"jsonrpc":"2.0","id":1,"method":"ping"}))
                .send()
                .await
                .unwrap()
                .status()
                .is_client_error(),
            "{name}"
        );
    }
    assert_eq!(
        f.client
            .post(format!("{}/mcp", f.url))
            .bearer_auth(&key)
            .json(&json!({"jsonrpc":"2.0","method":"notifications/initialized"}))
            .send()
            .await
            .unwrap()
            .status(),
        202
    );
    let direct: aether_protocol_core::mcp::Catalog =
        serde_json::from_value(f.docs.automation_catalog(&key).await.unwrap()).unwrap();
    assert_eq!(
        response_json(mcp(&f, &key, "tools/list", json!({})).await, 200).await["result"],
        direct.tools()
    );
    f.sql("UPDATE aether_identity.agent_connections SET expires=clock_timestamp()-interval '1 second'").await;
    assert_eq!(mcp(&f, &key, "ping", json!({})).await.status(), 401);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn identity_upgrade_preserves_existing_users_sessions_and_agent_grants() {
    let f = Fixture::new().await;
    let issued = f
        .docs
        .automation_connections(
            &token("alice"),
            Some(&aether_identity::automation::AgentConnectionInput {
                label: "Existing local assistant".into(),
                apps: vec!["map".into()],
                can_write: false,
                can_edit_content: false,
                lifetime_hours: 24,
            }),
        )
        .await
        .unwrap();
    f.sql("DROP TABLE aether_identity.oauth_grants, aether_identity.oauth_requests, aether_identity.oauth_clients").await;
    let previous = format!(
        "{}{}{}{}",
        include_str!("../../../identity/src/schema.sql"),
        include_str!("../../../identity/src/schema2.sql"),
        include_str!("../../../identity/src/schema3.sql"),
        include_str!("../../../identity/src/schema4.sql")
    );
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_identity.schema_state SET version=4,checksum=$1",
            &[&format!("{:x}", Sha256::digest(previous))],
        )
        .await
        .unwrap();
    assert!(f.identity.check_schema().await.is_err());
    f.identity.migrate().await.unwrap();
    f.identity.migrate().await.unwrap();
    f.identity.check_schema().await.unwrap();
    f.identity.authenticate(&token("alice")).await.unwrap();
    let key = issued["token"].as_str().unwrap();
    f.docs.automation_catalog(key).await.unwrap();
    let http = response_json(mcp(&f, key, "tools/list", json!({})).await, 200).await;
    let catalog: aether_protocol_core::mcp::Catalog =
        serde_json::from_value(f.docs.automation_catalog(key).await.unwrap()).unwrap();
    assert_eq!(http["result"], catalog.tools());
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_identity.users", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        4
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_identity.agent_connections",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
}
