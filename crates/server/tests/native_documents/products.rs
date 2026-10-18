use super::*;
use aether_server::products::Products;
use base64::{Engine, engine::general_purpose::STANDARD};
use std::path::Path;

fn installed(script: Option<&str>) -> Products {
    let directory = tempfile::tempdir().unwrap();
    let original = std::env::var("AETHER_TEST_MAP_WORKER").expect("Build Map worker first");
    let manifest = if let Some(script) = script {
        let mut value: Value = serde_json::from_slice(&std::fs::read(original).unwrap()).unwrap();
        value["sha256"] = json!(format!("{:x}", Sha256::digest(script.as_bytes())));
        let path = directory.path().join("native-worker.json");
        std::fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
        std::fs::write(directory.path().join("runner.mjs"), script).unwrap();
        path
    } else {
        Path::new(&original).to_owned()
    };
    let config = directory.path().join("products.json");
    std::fs::write(&config,serde_json::to_vec(&json!({"schema":1,"node":std::env::var("AETHER_TEST_NODE").unwrap(),"manifests":[manifest]})).unwrap()).unwrap();
    Products::load(&config).unwrap()
}
async fn fixture(script: Option<&str>) -> (Fixture, Value, String) {
    let f = Fixture::configured(512, Some(installed(script))).await;
    let source = std::fs::read(std::env::var("AETHER_TEST_MAP_FIXTURE").unwrap()).unwrap();
    let response=f.library("alice","create",json!({"app":"map","operation_id":"show-create","kind":"file","name":"Show.aethermap","scope":"personal","data_base64":STANDARD.encode(source)})).await;
    assert_eq!(response.status(), 200);
    let file = response.json().await.unwrap();
    let key = issue(&f, true, true).await;
    (f, file, key)
}
async fn issue(f: &Fixture, write: bool, content: bool) -> String {
    let r=f.client.post(format!("{}/api/automation/connections/create",f.url)).header("origin",&f.url).header("cookie",format!("{COOKIE}={}",token("alice"))).json(&json!({"label":"Products","apps":["map"],"can_write":write,"can_edit_content":content})).send().await.unwrap();
    assert_eq!(r.status(), 200);
    r.json::<Value>().await.unwrap()["token"]
        .as_str()
        .unwrap()
        .into()
}
async fn call(
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
fn edit(file: &Value, revision: u32) -> Value {
    json!({"app":"map","id":file["id"],"clip_id":"clip","action":"duplicate","expected_revision":revision})
}
async fn ok(r: reqwest::Response) -> Value {
    let status = r.status();
    let value = r.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
async fn head(f: &Fixture, file: &Value) -> Value {
    ok(
        f.library("alice", "read", json!({"app":"map","id":file["id"]}))
            .await,
    )
    .await
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn installed_map_catalog_respects_content_grants() {
    let (f, file, full) = fixture(None).await;
    let listing = f
        .client
        .post(format!("{}/api/automation/connections/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({}))
        .send()
        .await
        .unwrap();
    assert_eq!(ok(listing).await["saved_content_editing_available"], true);
    for (key, count) in [
        (issue(&f, false, false).await, 7),
        (issue(&f, true, false).await, 9),
        (full.clone(), 19),
    ] {
        let r = f
            .client
            .post(format!("{}/api/automation/commands/list", f.url))
            .bearer_auth(&key)
            .json(&json!({}))
            .send()
            .await
            .unwrap();
        let catalog = ok(r).await;
        assert_eq!(catalog["commands"].as_array().unwrap().len(), count);
        let r = call(&f, &key, "map.clip.edit", edit(&file, 1), None).await;
        assert_eq!(r.status(), if count == 19 { 200 } else { 403 });
    }
    let result = ok(call(
        &f,
        &full,
        "map.show.inspect",
        json!({"app":"map","id":file["id"]}),
        None,
    )
    .await)
    .await;
    assert_eq!(result["result"]["saved_state_only"], true);
    assert_eq!(result["result"]["changed"], false);
    assert_eq!(result["result"]["document"]["revision"], 2);
    assert_eq!(
        call(
            &f,
            &full,
            "map.show.inspect",
            json!({"app":"map","id":file["id"]}),
            Some("read-receipt")
        )
        .await
        .status(),
        400
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn map_worker_edits_evaluates_and_replays_original_random_ids() {
    let (f, file, key) = fixture(None).await;
    let first = ok(call(
        &f,
        &key,
        "map.clip.edit",
        edit(&file, 1),
        Some("duplicate-once"),
    )
    .await)
    .await;
    let original = head(&f, &file).await;
    assert_eq!(original["revision"], 2);
    let repeated = ok(call(
        &f,
        &key,
        "map.clip.edit",
        edit(&file, 1),
        Some("duplicate-once"),
    )
    .await)
    .await;
    let mut expected = first.clone();
    expected["result"]["replayed"] = json!(true);
    assert_eq!(repeated, expected);
    assert_eq!(
        head(&f, &file).await["data_base64"],
        original["data_base64"]
    );
    let moved=ok(call(&f,&key,"map.clip.move",json!({"app":"map","id":file["id"],"clip_id":"clip","track_id":"v1","start_s":8,"expected_revision":2}),Some("move-once")).await).await;
    assert_eq!(moved["result"]["document"]["revision"], 3);
    let inspected = ok(call(
        &f,
        &key,
        "map.show.inspect",
        json!({"app":"map","id":file["id"]}),
        None,
    )
    .await)
    .await;
    let clip = inspected["result"]["clips"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["id"] == "clip")
        .unwrap();
    assert_eq!(clip["start_s"], 8.0);

    assert_eq!(
        ok(call(
            &f,
            &key,
            "map.clip.edit",
            edit(&file, 1),
            Some("duplicate-once")
        )
        .await)
        .await,
        expected
    );
    assert_eq!(
        call(
            &f,
            &key,
            "map.clip.edit",
            edit(&file, 2),
            Some("duplicate-once")
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        call(&f, &key, "map.clip.edit", edit(&file, 1), Some("stale"))
            .await
            .status(),
        409
    );
    assert_eq!(call(&f,&key,"map.clip.move",json!({"app":"map","id":file["id"],"clip_id":"clip","track_id":"missing","start_s":1,"expected_revision":3}),None).await.status(),400);
    let evaluated = ok(call(
        &f,
        &key,
        "map.show.evaluate",
        json!({"app":"map","id":file["id"],"scene_id":"scene","time_s":9}),
        None,
    )
    .await)
    .await;
    assert_eq!(evaluated["result"]["changed"], false);
    assert_eq!(head(&f, &file).await["revision"], 3);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn concurrent_duplicate_requests_commit_once() {
    let (f, file, key) = fixture(None).await;
    let (a, b) = tokio::join!(
        call(&f, &key, "map.clip.edit", edit(&file, 1), Some("same")),
        call(&f, &key, "map.clip.edit", edit(&file, 1), Some("same"))
    );
    let mut a = ok(a).await;
    let mut b = ok(b).await;
    assert_ne!(a["result"]["replayed"], b["result"]["replayed"]);
    a["result"]["replayed"] = Value::Null;
    b["result"]["replayed"] = Value::Null;
    assert_eq!(a, b);
    assert_eq!(head(&f, &file).await["revision"], 2);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn failed_receipt_rolls_back_content_and_retry_remains_possible() {
    let (f, file, key) = fixture(None).await;
    f.sql("ALTER TABLE aether_access.automation_receipts ADD CONSTRAINT reject_fixture CHECK(false) NOT VALID").await;
    assert!(
        call(&f, &key, "map.clip.edit", edit(&file, 1), Some("atomic"))
            .await
            .status()
            .is_server_error()
    );
    assert_eq!(head(&f, &file).await["revision"], 1);
    f.sql("ALTER TABLE aether_access.automation_receipts DROP CONSTRAINT reject_fixture")
        .await;
    assert_eq!(
        ok(call(&f, &key, "map.clip.edit", edit(&file, 1), Some("atomic")).await).await["result"]["document"]
            ["revision"],
        2
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn worker_cannot_commit_after_grant_revoked() {
    let dir = tempfile::tempdir().unwrap();
    let started = dir.path().join("started");
    let release = dir.path().join("release");
    let script = format!(
        "import fs from 'node:fs';const r=JSON.parse(fs.readFileSync(0,'utf8'));fs.writeFileSync({},'yes');const timer=setInterval(()=>{{if(fs.existsSync({})){{clearInterval(timer);process.stdout.write(JSON.stringify({{result:{{}},content:r.content}}));}}}},10);",
        json!(started),
        json!(release)
    );
    let (f, file, key) = fixture(Some(&script)).await;
    let edit = call(&f, &key, "map.clip.edit", edit(&file, 1), Some("revoked"));
    let revoke = async {
        tokio::time::timeout(Duration::from_secs(5), async {
            while !started.exists() {
                tokio::time::sleep(Duration::from_millis(10)).await
            }
        })
        .await
        .unwrap();
        // Normal revocation obtains the same exclusive authority lock. It must
        // finish while the worker is still running, proving locks were released.
        let row = f
            .pool
            .get()
            .await
            .unwrap()
            .query_one(
                "SELECT id FROM aether_identity.agent_connections WHERE tenant='company'",
                &[],
            )
            .await
            .unwrap();
        let id: String = row.get(0);
        let r = f
            .client
            .post(format!("{}/api/automation/connections/revoke", f.url))
            .header("origin", &f.url)
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .json(&json!({"id":id}))
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 200);
        std::fs::write(&release, "go").unwrap();
    };
    let (r, ()) = tokio::join!(edit, revoke);
    assert!([401, 403].contains(&r.status().as_u16()));
    assert_eq!(head(&f, &file).await["revision"], 1);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn worker_protocol_is_bounded_and_readonly_cannot_save() {
    let args = json!({"app":"map","id":"show"});
    for script in [
        "process.stdout.write('{}')",
        "process.stdout.write(JSON.stringify({result:{},content:'{}'}))",
        "process.stdout.write(JSON.stringify({result:{},unchanged:true}))",
        "process.stdout.write('x'.repeat(8388609))",
        "process.stderr.write('x'.repeat(65537))",
    ] {
        let registry = installed(Some(script));
        assert!(
            registry
                .execute(&registry.get("map.show.inspect").unwrap(), "{}", &args)
                .await
                .is_err()
        );
    }
    for response in [
        json!({"result":{}}),
        json!({"result":{},"unchanged":false}),
        json!({"result":{},"content":"{}","unchanged":true}),
    ] {
        let registry = installed(Some(&format!(
            "process.stdout.write({})",
            json!(response.to_string())
        )));
        assert!(registry.execute(&registry.get("map.clip.edit").unwrap(), "{}",
            &json!({"app":"map","id":"show","clip_id":"clip","action":"duplicate","expected_revision":1})).await.is_err());
    }
    // Installed bytes survive removal of original package/config directories.
    let registry = installed(Some(
        "process.stdout.write(JSON.stringify({result:{snapshot:true}}))",
    ));
    assert_eq!(
        registry
            .execute(&registry.get("map.show.inspect").unwrap(), "{}", &args)
            .await
            .unwrap()["result"]["snapshot"],
        true
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn real_rust_mcp_and_cli_share_map_receipts() {
    use tokio::io::AsyncWriteExt;
    let (f, file, key) = fixture(None).await;
    let creation = json!({"app":"map","id":file["id"],"name":"Portrait","width_px":720,"height_px":1280,"expected_revision":2});
    let frames = [
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}}),
        json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"map_clip_edit","_meta":{"aether/operationId":"map-mcp"},"arguments":edit(&file,1)}}),
        json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"map_clip_edit","_meta":{"aether/operationId":"map-mcp"},"arguments":edit(&file,1)}}),
        json!({"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"map_scene_create","_meta":{"aether/operationId":"create-scene"},"arguments":creation}}),
    ];
    let mut child = tokio::process::Command::new(std::env::var("AETHER_AUTOMATION_BIN").unwrap())
        .arg("mcp")
        .env("AETHER_SERVER_URL", &f.url)
        .env("AETHER_AUTOMATION_TOKEN", &key)
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
    assert!(!text.contains(&key));
    let replies: Vec<Value> = text
        .lines()
        .map(|l| serde_json::from_str(l).unwrap())
        .collect();
    assert_eq!(replies.len(), 5);
    assert_eq!(replies[1]["result"]["tools"].as_array().unwrap().len(), 19);
    let first = &replies[2]["result"]["structuredContent"];
    let second = &replies[3]["result"]["structuredContent"];
    assert_eq!(first["result"]["document"]["revision"], 2);
    assert_eq!(second["result"]["replayed"], true);
    let created = &replies[4]["result"]["structuredContent"];
    assert_eq!(created["result"]["document"]["revision"], 3);
    let mut cli = tokio::process::Command::new(std::env::var("AETHER_AUTOMATION_BIN").unwrap())
        .args(["run", "map.scene.create", "--operation-id", "create-scene"])
        .env("AETHER_SERVER_URL", &f.url)
        .env("AETHER_AUTOMATION_TOKEN", &key)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    cli.stdin
        .take()
        .unwrap()
        .write_all(creation.to_string().as_bytes())
        .await
        .unwrap();
    let output = tokio::time::timeout(Duration::from_secs(15), cli.wait_with_output())
        .await
        .unwrap()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let replay: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(replay["result"]["replayed"], true);
    assert_eq!(replay["result"]["created"], created["result"]["created"]);
    assert_eq!(head(&f, &file).await["revision"], 3);
    let args = json!({"app":"map","id":file["id"],"scene_id":created["result"]["created"]["scene_id"],"name":"Wall","expected_revision":3});
    let surface = ok(call(
        &f,
        &key,
        "map.surface.create",
        args.clone(),
        Some("create-surface"),
    )
    .await)
    .await;
    let repeated = ok(call(
        &f,
        &key,
        "map.surface.create",
        args.clone(),
        Some("create-surface"),
    )
    .await)
    .await;
    assert_eq!(surface["result"]["created"], repeated["result"]["created"]);
    assert_eq!(repeated["result"]["replayed"], true);
    assert_eq!(
        call(&f, &key, "map.surface.create", args, Some("stale-surface"))
            .await
            .status(),
        409
    );
    assert_eq!(head(&f, &file).await["revision"], 4);
    let geometry = json!({"app":"map","id":file["id"],"scene_id":created["result"]["created"]["scene_id"],"surface_id":surface["result"]["created"]["surface_id"],"expected_revision":4,"x_px":10,"y_px":20,"width_px":200,"height_px":100});
    let bounded = ok(call(
        &f,
        &key,
        "map.surface.bounds",
        geometry.clone(),
        Some("bounds-once"),
    )
    .await)
    .await;
    let retry = ok(call(
        &f,
        &key,
        "map.surface.bounds",
        geometry.clone(),
        Some("bounds-once"),
    )
    .await)
    .await;
    assert_eq!(
        bounded["result"]["changed_surface_ids"],
        retry["result"]["changed_surface_ids"]
    );
    assert_eq!(retry["result"]["replayed"], true);
    assert_eq!(
        bounded["result"]["scenes"][1]["surfaces"][0]["corners"],
        json!([[10, 20], [210, 20], [210, 120], [10, 120]])
    );
    assert_eq!(
        call(
            &f,
            &key,
            "map.surface.bounds",
            geometry,
            Some("stale-bounds")
        )
        .await
        .status(),
        409
    );
    let rotation = json!({"app":"map","id":file["id"],"scene_id":created["result"]["created"]["scene_id"],"surface_id":surface["result"]["created"]["surface_id"],"expected_revision":5,"delta_degrees":90});
    let turned = ok(call(
        &f,
        &key,
        "map.surface.rotate",
        rotation.clone(),
        Some("rotate-once"),
    )
    .await)
    .await;
    let replayed = ok(call(
        &f,
        &key,
        "map.surface.rotate",
        rotation,
        Some("rotate-once"),
    )
    .await)
    .await;
    assert_eq!(turned["result"]["scenes"], replayed["result"]["scenes"]);
    assert_eq!(replayed["result"]["replayed"], true);
    assert_eq!(head(&f, &file).await["revision"], 6);
    let placement = json!({"app":"map","id":file["id"],"asset_id":"red","track_id":"v1","start_s":20,"expected_revision":6});
    let placed = ok(call(
        &f,
        &key,
        "map.asset.place",
        placement.clone(),
        Some("place-once"),
    )
    .await)
    .await;
    let replayed = ok(call(
        &f,
        &key,
        "map.asset.place",
        placement.clone(),
        Some("place-once"),
    )
    .await)
    .await;
    assert_eq!(placed["result"]["created"], replayed["result"]["created"]);
    assert!(placed["result"]["created"]["clip_id"].is_string());
    assert_eq!(replayed["result"]["replayed"], true);
    assert_eq!(
        call(&f, &key, "map.asset.place", placement, Some("stale-place"))
            .await
            .status(),
        409
    );
    assert_eq!(head(&f, &file).await["revision"], 7);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn worker_cannot_overwrite_a_save_that_wins_during_evaluation() {
    let dir = tempfile::tempdir().unwrap();
    let started = dir.path().join("started");
    let release = dir.path().join("release");
    let script = format!(
        "import fs from 'node:fs';const r=JSON.parse(fs.readFileSync(0,'utf8'));fs.writeFileSync({},'yes');const t=setInterval(()=>{{if(fs.existsSync({})){{clearInterval(t);process.stdout.write(JSON.stringify({{result:{{}},content:r.content}}));}}}},10);",
        json!(started),
        json!(release)
    );
    let (f, file, key) = fixture(Some(&script)).await;
    let request = call(
        &f,
        &key,
        "map.clip.edit",
        edit(&file, 1),
        Some("racing-save"),
    );
    let save = async {
        tokio::time::timeout(Duration::from_secs(5), async {
            while !started.exists() {
                tokio::time::sleep(Duration::from_millis(10)).await
            }
        })
        .await
        .unwrap();
        let r=f.library("alice","save",json!({"app":"map","id":file["id"],"operation_id":"user-save","expected_revision":1,"data_base64":STANDARD.encode("{\"user\":true}")})).await;
        assert_eq!(r.status(), 200);
        std::fs::write(&release, "go").unwrap();
    };
    let (r, ()) = tokio::join!(request, save);
    assert_eq!(r.status(), 409);
    let saved = head(&f, &file).await;
    assert_eq!(saved["revision"], 2);
    assert_eq!(saved["data_base64"], STANDARD.encode("{\"user\":true}"));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn additive_schema17_upgrade_preserves_existing_show_and_rejects_changed_checksum() {
    let (f, file, _) = fixture(None).await;
    let row = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT version FROM aether_access.schema_state", &[])
        .await
        .unwrap();
    assert_eq!(row.get::<_, i32>(0), 21);
    let sources = [
        "schema.sql",
        "002-directory.sql",
        "003-folders.sql",
        "004-resource-lifecycle.sql",
        "005-library-recents.sql",
        "006-legacy-history.sql",
        "007-named-versions.sql",
        "008-collaboration.sql",
        "009-workspace-preferences.sql",
        "010-legacy-file-metadata.sql",
        "011-file-favorites.sql",
        "012-sharing-provenance.sql",
        "013-legacy-drive-events.sql",
        "014-uploads.sql",
        "015-link-credentials.sql",
        "016-branch-metadata.sql",
    ];
    let mut hash = Sha256::new();
    for source in sources {
        hash.update(
            std::fs::read(
                Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("src/documents")
                    .join(source),
            )
            .unwrap(),
        );
    }
    let checksum = format!("{:x}", hash.finalize());
    f.sql("DROP TABLE aether_access.live_editor_calls,aether_access.live_editors,aether_access.workspace_files, aether_access.team_labels, aether_access.map_media_refs, aether_access.map_media, aether_access.map_cast, aether_access.map_devices, aether_access.map_device_limits, aether_access.automation_receipts").await;
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_access.schema_state SET version=16,checksum=$1",
            &[&checksum],
        )
        .await
        .unwrap();
    assert!(f.docs.check_schema().await.is_err());
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(head(&f, &file).await["revision"], 1);
    f.sql("UPDATE aether_access.schema_state SET checksum='changed'")
        .await;
    assert!(f.docs.migrate().await.is_err());
}

#[tokio::test]
#[ignore = "built Map worker + Node"]
async fn installed_bundle_rejects_hash_schema_and_request_paths() {
    let directory = tempfile::tempdir().unwrap();
    let config = directory.path().join("config.json");
    let path = directory.path().join("native-worker.json");
    let original = std::env::var("AETHER_TEST_MAP_WORKER").unwrap();
    let mut manifest: Value = serde_json::from_slice(&std::fs::read(&original).unwrap()).unwrap();
    std::fs::write(directory.path().join("runner.mjs"), "x").unwrap();
    let configuration =
        json!({"schema":1,"node":std::env::var("AETHER_TEST_NODE").unwrap(),"manifests":[path]});
    std::fs::write(&config, configuration.to_string()).unwrap();
    std::fs::write(&path, manifest.to_string()).unwrap();
    assert!(Products::load(&config).is_err());
    manifest["sha256"] = json!(format!("{:x}", Sha256::digest("x")));
    manifest["commands"][0]["inputSchema"]["properties"]["unknown"] = json!({"type":"object"});
    std::fs::write(&path, manifest.to_string()).unwrap();
    assert!(Products::load(&config).is_err());
    let registry = installed(Some("process.stdout.write(JSON.stringify({result:{}}))"));
    let product = registry.get("map.show.inspect").unwrap();
    assert!(
        registry
            .execute(
                &product,
                "{}",
                &json!({"app":"map","id":"file","executable":"/bin/sh"})
            )
            .await
            .is_err()
    );
}

#[cfg(unix)]
#[tokio::test]
#[ignore = "built Map worker + Node"]
async fn cancellation_kills_worker_and_descendants() {
    let directory = tempfile::tempdir().unwrap();
    let pidfile = directory.path().join("pids");
    let script = format!(
        "import fs from 'node:fs';import {{spawn}} from 'node:child_process';fs.readFileSync(0);const child=spawn(process.execPath,['-e','setInterval(()=>{{}},1000)'],{{stdio:'ignore'}});fs.writeFileSync({},JSON.stringify([process.pid,child.pid]));setInterval(()=>{{}},1000);",
        json!(pidfile)
    );
    let registry = installed(Some(&script));
    let product = registry.get("map.show.inspect").unwrap();
    let job = tokio::spawn(async move {
        registry
            .execute(&product, "{}", &json!({"app":"map","id":"x"}))
            .await
    });
    tokio::time::timeout(Duration::from_secs(5), async {
        while !pidfile.exists() {
            tokio::time::sleep(Duration::from_millis(10)).await
        }
    })
    .await
    .unwrap();
    let pids: Vec<u32> = serde_json::from_slice(&std::fs::read(&pidfile).unwrap()).unwrap();
    job.abort();
    assert!(job.await.unwrap_err().is_cancelled());
    tokio::time::timeout(Duration::from_secs(5), async {
        for pid in pids {
            while std::process::Command::new("/bin/kill")
                .args(["-0", &pid.to_string()])
                .stderr(std::process::Stdio::null())
                .status()
                .unwrap()
                .success()
            {
                tokio::time::sleep(Duration::from_millis(20)).await
            }
        }
    })
    .await
    .unwrap();
}

#[tokio::test]
#[ignore = "built Map worker + Node"]
async fn worker_capacity_refuses_overload_and_releases_cancelled_slots() {
    let directory = tempfile::tempdir().unwrap();
    let root = directory.path();
    let script = format!(
        "import fs from 'node:fs';const r=JSON.parse(fs.readFileSync(0,'utf8'));if(r.arguments.id==='quick'){{process.stdout.write(JSON.stringify({{result:{{ok:true}}}}));}}else{{fs.writeFileSync({}+'/'+r.arguments.id,'ready');setInterval(()=>{{}},1000);}}",
        json!(root)
    );
    let registry = installed(Some(&script));
    let product = registry.get("map.show.inspect").unwrap();
    let mut jobs = Vec::new();
    for id in ["first", "second"] {
        let registry = registry.clone();
        let product = product.clone();
        jobs.push(tokio::spawn(async move {
            registry
                .execute(&product, "{}", &json!({"app":"map","id":id}))
                .await
        }));
    }
    tokio::time::timeout(Duration::from_secs(5), async {
        while !root.join("first").exists() || !root.join("second").exists() {
            tokio::time::sleep(Duration::from_millis(10)).await
        }
    })
    .await
    .unwrap();
    let mut waiting = Vec::new();
    for _ in 0..6 {
        let registry = registry.clone();
        let product = product.clone();
        waiting.push(tokio::spawn(async move {
            registry
                .execute(&product, "{}", &json!({"app":"map","id":"quick"}))
                .await
        }));
    }
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(waiting.iter().all(|job| !job.is_finished()));
    assert!(
        tokio::time::timeout(
            Duration::from_secs(1),
            registry.execute(&product, "{}", &json!({"app":"map","id":"quick"}))
        )
        .await
        .unwrap()
        .is_err()
    );
    let cancelled = waiting.pop().unwrap();
    cancelled.abort();
    assert!(cancelled.await.unwrap_err().is_cancelled());
    for job in jobs {
        job.abort();
        assert!(job.await.unwrap_err().is_cancelled());
    }
    for job in waiting {
        assert_eq!(job.await.unwrap().unwrap()["result"]["ok"], true);
    }
    let args = json!({"app":"map","id":"quick"});
    let (a, b) = tokio::join!(
        registry.execute(&product, "{}", &args),
        registry.execute(&product, "{}", &args)
    );
    assert_eq!(a.unwrap()["result"]["ok"], true);
    assert_eq!(b.unwrap()["result"]["ok"], true);
}

#[tokio::test]
#[ignore = "built Map worker + Node"]
async fn worker_deadline_is_enforced() {
    let registry = installed(Some("setInterval(()=>{},1000)"));
    let product = registry.get("map.show.inspect").unwrap();
    let start = std::time::Instant::now();
    assert!(
        tokio::time::timeout(
            Duration::from_secs(12),
            registry.execute(&product, "{}", &json!({"app":"map","id":"timeout"}))
        )
        .await
        .unwrap()
        .is_err()
    );
    assert!(start.elapsed() >= Duration::from_secs(9));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + built Map worker"]
async fn map_agent_programs_create_verify_replay_and_refuse_partial_saves() {
    let (f, file, key) = fixture(None).await;
    let recipe = json!({"version":1,"steps":[
        {"id":"scene","command":"map.scene.create","arguments":{"name":"Agent scene","width_px":1280,"height_px":720}},
        {"id":"wall","command":"map.surface.create","arguments":{"scene_id":{"$ref":"scene.scene_id"},"name":"Wall"}},
        {"id":"visual","command":"map.visual.create","arguments":{"scene_id":{"$ref":"scene.scene_id"},"name":"Aurora","source_json":{"kind":"gallery","id":"aurora:0"}}}
    ],"assertions":[{"scene_id":{"$ref":"scene.scene_id"},"time_s":10,"layer_count":1}]});
    let args = json!({"app":"map","id":file["id"],"expected_revision":1,"program_json":recipe.to_string()});
    let readonly = issue(&f, false, false).await;
    assert_eq!(
        call(&f, &readonly, "map.show.runprogram", args.clone(), None)
            .await
            .status(),
        403
    );
    let first = ok(call(
        &f,
        &key,
        "map.show.runprogram",
        args.clone(),
        Some("build-once"),
    )
    .await)
    .await;
    assert_eq!(first["result"]["document"]["revision"], 2);
    assert_eq!(first["result"]["assertions"][0]["passed"], true);
    let replay = ok(call(
        &f,
        &key,
        "map.show.runprogram",
        args.clone(),
        Some("build-once"),
    )
    .await)
    .await;
    assert_eq!(replay["result"]["replayed"], true);
    assert_eq!(
        first["result"]["references"],
        replay["result"]["references"]
    );
    assert_eq!(
        call(&f, &key, "map.show.runprogram", args, None)
            .await
            .status(),
        409
    );
    let proof=ok(call(&f,&readonly,"map.show.verify",json!({"app":"map","id":file["id"],"scene_id":first["result"]["references"]["scene"]["scene_id"],"time_s":10}),None).await).await;
    assert_eq!(proof["result"]["valid"], true);
    assert_eq!(proof["result"]["layer_count"], 1);
    assert_eq!(proof["result"]["layers"][0]["shader"]["preset"], "aurora");
    let original = head(&f, &file).await;
    let mut bad = recipe.clone();
    bad["assertions"][0]["layer_count"] = json!(9);
    assert_eq!(call(&f,&key,"map.show.runprogram",json!({"app":"map","id":file["id"],"expected_revision":2,"program_json":bad.to_string()}),Some("failed-build")).await.status(),400);
    assert_eq!(
        head(&f, &file).await["data_base64"],
        original["data_base64"]
    );
    assert_eq!(head(&f, &file).await["revision"], 2);
    let docs = ok(call(
        &f,
        &readonly,
        "map.agent.docs",
        json!({"app":"map","id":file["id"],"topic":"gallery","query":"aurora"}),
        None,
    )
    .await)
    .await;
    assert!(docs["result"]["total"].as_u64().unwrap() > 0);
}
