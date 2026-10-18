use super::*;
async fn body(r: reqwest::Response, status: u16) -> Value {
    let actual = r.status();
    let v: Value = r.json().await.unwrap();
    assert_eq!(actual, status, "{v}");
    v
}
async fn browser(f: &Fixture, user: &str, action: &str, v: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/automation/editor/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&v)
        .send()
        .await
        .unwrap()
}
async fn grant(f: &Fixture, user: &str, edit: bool) -> Value {
    body(f.client.post(format!("{}/api/automation/connections/create",f.url)).header("origin",&f.url).header("cookie",format!("{COOKIE}={}",token(user))).json(&json!({"label":"Live fixture","apps":["map"],"can_write":edit,"can_edit_content":edit})).send().await.unwrap(),200).await
}
async fn run(
    f: &Fixture,
    key: &str,
    id: &str,
    args: Value,
    operation: Option<&str>,
) -> reqwest::Response {
    f.client
        .post(format!("{}/api/automation/commands/run", f.url))
        .bearer_auth(key)
        .json(&json!({"id":id,"arguments":args,"operation_id":operation}))
        .send()
        .await
        .unwrap()
}
async fn register(f: &Fixture) -> Value {
    f.docs
        .mutate(&token("alice"), &create("live-doc"))
        .await
        .unwrap();
    body(browser(f,"alice","register",json!({"app":"map","document":"live-doc","context":"scene:1","tools":[{"name":"aether_map_inspect","description":"Inspect","inputSchema":{"type":"object","properties":{}}}]})).await,200).await
}
async fn invoke(f: &Fixture, key: &str, e: &Value, op: &str) -> Value {
    body(
        run(
            f,
            key,
            "editor.invoke",
            json!({"editor":e["editor"],"name":"aether_map_inspect","arguments":{},"operation":op}),
            None,
        )
        .await,
        200,
    )
    .await
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn mailbox_delivers_once_replays_receipt_and_rejects_changed_arguments() {
    let f = Fixture::new().await;
    let e = register(&f).await;
    let g = grant(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap();
    let list = body(run(&f, key, "editor.list", json!({}), None).await, 200).await;
    assert_eq!(list["editors"][0]["editor"], e["editor"]);
    let info = body(
        run(
            &f,
            key,
            "editor.inspect",
            json!({"editor":e["editor"]}),
            None,
        )
        .await,
        200,
    )
    .await;
    assert_eq!(info["editor"]["tools"].as_array().unwrap().len(), 1);
    assert!(!info.to_string().contains(e["secret"].as_str().unwrap()));
    invoke(&f, key, &e, "op1").await;
    assert_eq!(
        body(browser(&f, "alice", "poll", e.clone()).await, 200).await["call"]["id"],
        "op1"
    );
    assert!(body(browser(&f, "alice", "poll", e.clone()).await, 200).await["call"].is_null());
    invoke(&f, key, &e, "op1").await;
    let result = json!({"ok":true,"value":{"surfaces":2}});
    let mut reply = e.clone();
    reply["operation"] = json!("op1");
    reply["result"] = result.clone();
    body(browser(&f, "alice", "reply", reply.clone()).await, 200).await;
    body(browser(&f, "alice", "reply", reply.clone()).await, 200).await;
    reply["result"]["value"] = json!({"surfaces":3});
    body(browser(&f, "alice", "reply", reply).await, 409).await;
    let result = body(
        run(
            &f,
            key,
            "editor.result",
            json!({"editor":e["editor"],"operation":"op1"}),
            None,
        )
        .await,
        200,
    )
    .await;
    assert_eq!(result["live_editor"]["state"], "completed");
    assert_eq!(result["live_editor"]["reply"]["value"]["surfaces"], 2);
    body(
        run(
            &f,
            key,
            "editor.invoke",
            json!({"editor":e["editor"],"name":"aether_map_inspect","arguments":{"changed":true},"operation":"op1"}),
            Some("op1"),
        )
        .await,
        409,
    )
    .await;
    body(
        run(
            &f,
            key,
            "editor.invoke",
            json!({"editor":e["editor"],"name":"aether_map_inspect","arguments":{}}),
            None,
        )
        .await,
        400,
    )
    .await;
    body(browser(&f, "alice", "close", e.clone()).await, 200).await;
    assert_eq!(
        body(
            run(
                &f,
                key,
                "editor.result",
                json!({"editor":e["editor"],"operation":"op1"}),
                None
            )
            .await,
            200
        )
        .await["live_editor"]["state"],
        "completed"
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn editor_is_owner_session_secret_document_and_grant_scoped() {
    let f = Fixture::new().await;
    let e = register(&f).await;
    let ro = grant(&f, "alice", false).await;
    let bob = grant(&f, "bob", true).await;
    body(
        run(
            &f,
            ro["token"].as_str().unwrap(),
            "editor.list",
            json!({}),
            None,
        )
        .await,
        403,
    )
    .await;
    body(
        run(
            &f,
            bob["token"].as_str().unwrap(),
            "editor.inspect",
            json!({"editor":e["editor"]}),
            None,
        )
        .await,
        404,
    )
    .await;
    body(browser(&f, "bob", "poll", e.clone()).await, 404).await;
    let mut wrong = e.clone();
    wrong["secret"] = json!("wrong");
    body(browser(&f, "alice", "poll", wrong).await, 404).await;
    let no_origin = f
        .client
        .post(format!("{}/api/automation/editor/poll", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&e)
        .send()
        .await
        .unwrap();
    assert_eq!(no_origin.status(), 403);
    let g = grant(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap();
    invoke(&f, key, &e, "cancel-before").await;
    f.identity
        .revoke_agent_connection(&token("alice"), g["connection"]["id"].as_str().unwrap())
        .await
        .unwrap();
    assert!(body(browser(&f, "alice", "poll", e.clone()).await, 200).await["call"].is_null());
    let row = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT state FROM aether_access.live_editor_calls WHERE operation='cancel-before'",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, String>(0), "cancelled");
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn lost_dispatch_is_unknown_and_revocation_aborts_running_authority() {
    let f = Fixture::new().await;
    let e = register(&f).await;
    let g = grant(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap();
    invoke(&f, key, &e, "lost").await;
    body(browser(&f, "alice", "poll", e.clone()).await, 200).await;
    body(browser(&f, "alice", "close", e.clone()).await, 200).await;
    let r = body(
        run(
            &f,
            key,
            "editor.result",
            json!({"editor":e["editor"],"operation":"lost"}),
            None,
        )
        .await,
        200,
    )
    .await;
    assert_eq!(r["live_editor"]["state"], "outcome_unknown");
    let c = f.pool.get().await.unwrap();
    c.execute("UPDATE aether_access.live_editors SET closed=false,expires=clock_timestamp()+interval '15 seconds'",&[]).await.unwrap();
    let mut poll = e.clone();
    poll["running"] = json!("lost");
    body(browser(&f, "alice", "poll", poll.clone()).await, 200).await;
    f.identity
        .revoke_agent_connection(&token("alice"), g["connection"]["id"].as_str().unwrap())
        .await
        .unwrap();
    body(browser(&f, "alice", "poll", poll).await, 401).await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn unknown_tools_and_cross_product_catalogs_are_refused() {
    let f = Fixture::new().await;
    let e = register(&f).await;
    let g = grant(&f, "alice", true).await;
    let key = g["token"].as_str().unwrap();
    body(
        run(
            &f,
            key,
            "editor.invoke",
            json!({"editor":e["editor"],"name":"shell","arguments":{},"operation":"shell"}),
            Some("shell"),
        )
        .await,
        400,
    )
    .await;
    body(browser(&f,"alice","register",json!({"app":"map","document":"live-doc","context":"scene:1","tools":[{"name":"aether_cad_inspect","description":"Inspect","inputSchema":{"type":"object","properties":{}}}]})).await,400).await;
    let running = invoke(&f, key, &e, "pending").await;
    assert_eq!(running["accepted"], true);
    body(
        run(
            &f,
            key,
            "editor.invoke",
            json!({"editor":e["editor"],"name":"aether_map_inspect","arguments":{},"operation":"second"}),
            Some("second"),
        )
        .await,
        409,
    )
    .await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL"]
async fn schema21_upgrade_preserves_documents_and_is_repeatable() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("upgrade-doc"))
        .await
        .unwrap();
    let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/documents");
    let mut files: Vec<_> = std::fs::read_dir(&source)
        .unwrap()
        .map(|v| v.unwrap().path())
        .filter(|p| {
            p.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .get(..3)
                .and_then(|v| v.parse::<u32>().ok())
                .is_some_and(|v| v <= 21)
                && p.extension().is_some_and(|v| v == "sql")
        })
        .collect();
    files.sort();
    files.insert(0, source.join("schema.sql"));
    let mut hash = Sha256::new();
    for file in files {
        hash.update(std::fs::read(file).unwrap());
    }
    let checksum = format!("{:x}", hash.finalize());
    f.sql(&format!("DROP TABLE aether_access.live_editor_calls,aether_access.live_editors; UPDATE aether_access.schema_state SET version=21,checksum='{checksum}'")).await;
    f.sql("ALTER TABLE aether_access.map_devices DROP COLUMN kind CASCADE")
        .await;
    assert!(f.docs.check_schema().await.is_err());
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert!(
        f.docs
            .read(&token("alice"), "upgrade-doc", None)
            .await
            .is_ok()
    );
}
