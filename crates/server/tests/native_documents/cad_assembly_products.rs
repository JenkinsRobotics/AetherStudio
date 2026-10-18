use super::cad_products::{call, installed_script, issue, ok};
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use tokio::io::AsyncWriteExt;

async fn fixture(script: Option<&str>) -> (Fixture, Value, String) {
    let f = Fixture::configured(512, Some(installed_script(script))).await;
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    let file = ok(f.library("alice", "project_create", json!({"app":"cad","name":"Assembly agent","operation_id":"create","packaging":"assembly"})).await).await;
    let key = issue(&f, true, true).await;
    (f, file, key)
}
fn target(file: &Value) -> Value {
    json!({"app":"cad","id":file["id"]})
}
async fn head(f: &Fixture, file: &Value) -> Value {
    ok(f.library("alice", "read", target(file)).await).await
}
async fn agent(f: &Fixture, key: &str, args: &[&str], input: &str) -> String {
    let mut child = tokio::process::Command::new(std::env::var("AETHER_AUTOMATION_BIN").unwrap())
        .args(args)
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
        .write_all(input.as_bytes())
        .await
        .unwrap();
    let output = tokio::time::timeout(Duration::from_secs(40), child.wait_with_output())
        .await
        .unwrap()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let text = String::from_utf8(output.stdout).unwrap();
    assert!(!text.contains(key));
    text
}

#[tokio::test]
#[ignore = "disposable PostgreSQL, native CAD archive worker and FreeCAD"]
async fn saved_assembly_mcp_preview_apply_and_cli_retry_preserve_one_archive_revision() {
    let (f, file, key) = fixture(None).await;
    let readonly = issue(&f, false, false).await;
    let before = head(&f, &file).await;
    let inspected =
        ok(call(&f, &readonly, "cad.assembly.inspect", target(&file), None).await).await;
    assert_eq!(inspected["result"]["counts"]["instances"], 0);
    let recipe = inspected["result"]["example"].to_string();
    let preview_args = json!({"app":"cad","id":file["id"],"recipe_json":recipe});
    let preview = ok(call(
        &f,
        &readonly,
        "cad.assembly.preview",
        preview_args.clone(),
        None,
    )
    .await)
    .await;
    assert_eq!(preview["result"]["instance_count"], 4);
    assert_eq!(preview["result"]["changed"], false);
    assert_eq!(head(&f, &file).await["data_base64"], before["data_base64"]);
    let mut args = preview_args;
    args["expected_revision"] = json!(1);
    assert_eq!(
        call(&f, &readonly, "cad.assembly.compose", args.clone(), None)
            .await
            .status(),
        403
    );
    // An agent cannot select content encoding: only the installed manifest can.
    let mut forged = args.clone();
    forged["content_encoding"] = json!("utf8");
    assert_eq!(
        call(&f, &key, "cad.assembly.compose", forged, None)
            .await
            .status(),
        400
    );
    let frames = [
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}}),
        json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"cad_assembly_compose","_meta":{"aether/operationId":"assembly-once"},"arguments":args}})
    ].iter().map(|v| format!("{v}\n")).collect::<String>();
    let output = agent(&f, &key, &["mcp"], &frames).await;
    let replies: Vec<Value> = output
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    let applied = &replies[1]["result"]["structuredContent"];
    assert_eq!(applied["result"]["instance_count"], 4, "{applied}");
    assert_eq!(applied["result"]["document"]["revision"], 2);
    let saved = head(&f, &file).await;
    assert!(
        STANDARD
            .decode(saved["data_base64"].as_str().unwrap())
            .unwrap()
            .starts_with(b"PK")
    );
    let replay: Value = serde_json::from_str(
        &agent(
            &f,
            &key,
            &[
                "run",
                "cad.assembly.compose",
                "--operation-id",
                "assembly-once",
            ],
            &args.to_string(),
        )
        .await,
    )
    .unwrap();
    assert_eq!(replay["result"]["replayed"], true);
    assert_eq!(replay["result"]["ids"], applied["result"]["ids"]);
    assert_eq!(head(&f, &file).await["data_base64"], saved["data_base64"]);
    assert_eq!(
        call(&f, &key, "cad.assembly.compose", args, None)
            .await
            .status(),
        409
    );
    let reopened = ok(call(&f, &readonly, "cad.assembly.inspect", target(&file), None).await).await;
    assert_eq!(reopened["result"]["counts"]["instances"], 4);
    assert_eq!(reopened["result"]["counts"]["parts"], 1);
    // Existing project/browser codec can still open the agent's saved archive.
    let project = ok(f.library("alice", "project_read", target(&file)).await).await;
    assert_eq!(
        project["project"]["assemblies"].as_array().unwrap().len(),
        1
    );
    let bad = json!({"version":1,"parts":[],"instances":[]});
    assert_eq!(call(&f, &key, "cad.assembly.compose", json!({"app":"cad","id":file["id"],"expected_revision":2,"recipe_json":bad.to_string()}), None).await.status(), 400);
    assert_eq!(head(&f, &file).await["data_base64"], saved["data_base64"]);
    assert_eq!(
        f.docs
            .history(&token("alice"), file["id"].as_str().unwrap(), 0, 100)
            .await
            .unwrap()
            .len(),
        2
    );
    let old = ok(f
        .library(
            "alice",
            "project_read",
            json!({"app":"cad","id":file["id"],"revision":1}),
        )
        .await)
    .await;
    assert_eq!(old["project"], file["project"]);
}

#[tokio::test]
#[ignore = "installed native CAD bundle and explicit runtimes"]
async fn binary_worker_transport_validates_encoding_and_decoded_bounds() {
    for (payload, read_only, too_large) in [
        ("'not base64!'", false, false),
        (
            "base64.b64encode(bytes(4*1024*1024+1)).decode()",
            false,
            true,
        ),
        ("'YWJj'", true, false),
    ] {
        let script = format!(
            "import base64,json,sys\njson.load(sys.stdin)\nprint(json.dumps({{'result':{{}},'content':{payload}}}))"
        );
        let registry = installed_script(Some(&script));
        let command = if read_only {
            "cad.assembly.inspect"
        } else {
            "cad.assembly.compose"
        };
        let product = registry.get(command).unwrap();
        let args = if read_only {
            json!({"app":"cad","id":"fixture"})
        } else {
            json!({"app":"cad","id":"fixture","expected_revision":1,"recipe_json":"{}"})
        };
        let result = registry.execute_bytes(&product, &[0, 255, 1], &args).await;
        assert!(if too_large {
            matches!(result, Err(Error::TooLarge))
        } else {
            matches!(result, Err(Error::Invalid))
        });
    }
    let script = "import json,sys\nr=json.load(sys.stdin)\nassert r['content_encoding']=='base64'\nprint(json.dumps({'result':{},'content':r['content']}))";
    let registry = installed_script(Some(script));
    let product = registry.get("cad.assembly.compose").unwrap();
    let args = json!({"app":"cad","id":"fixture","expected_revision":1,"recipe_json":"{}"});
    let result = registry
        .execute_bytes(&product, &[0, 255, 1], &args)
        .await
        .unwrap();
    assert_eq!(
        STANDARD
            .decode(result["content"].as_str().unwrap())
            .unwrap(),
        vec![0, 255, 1]
    );
    assert!(matches!(
        registry
            .execute_bytes(&product, &vec![0; 4 * 1024 * 1024 + 1], &args)
            .await,
        Err(Error::TooLarge)
    ));
    let text = registry.get("cad.part.inspect").unwrap();
    assert!(matches!(
        registry
            .execute_bytes(&text, &[255], &json!({"app":"cad","id":"fixture"}))
            .await,
        Err(Error::Invalid)
    ));
}

#[tokio::test]
#[ignore = "operator Node runtime and installed command schemas"]
async fn node_text_compatibility_and_binary_manifest_validation() {
    use aether_server::products::Products;
    let dir = tempfile::tempdir().unwrap();
    let source = "import fs from 'node:fs';const r=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(r.command==='cad.assembly.compose'?{result:{},content:r.content}:{result:{source:r.content,encoding:r.content_encoding??'utf8'}}));";
    let mut manifest: Value = serde_json::from_slice(
        &std::fs::read(std::env::var("AETHER_TEST_CAD_WORKER").unwrap()).unwrap(),
    )
    .unwrap();
    manifest["runtime"] = json!("node");
    manifest["entry"] = json!("runner.mjs");
    manifest["sha256"] = json!(format!("{:x}", Sha256::digest(source)));
    manifest["services"] = json!([]);
    manifest["binary_commands"] = json!(["cad.assembly.compose"]);
    let path = dir.path().join("native-worker.json");
    let config = dir.path().join("products.json");
    std::fs::write(dir.path().join("runner.mjs"), source).unwrap();
    std::fs::write(&path, manifest.to_string()).unwrap();
    std::fs::write(
        &config,
        json!({"schema":1,"node":std::env::var("AETHER_TEST_NODE").unwrap(),"manifests":[path]})
            .to_string(),
    )
    .unwrap();
    let registry = Products::load(&config).unwrap();
    let binary = registry.get("cad.assembly.compose").unwrap();
    let result = registry
        .execute_bytes(
            &binary,
            &[0, 255, 2],
            &json!({"app":"cad","id":"fixture","expected_revision":1,"recipe_json":"{}"}),
        )
        .await
        .unwrap();
    assert_eq!(
        STANDARD
            .decode(result["content"].as_str().unwrap())
            .unwrap(),
        vec![0, 255, 2]
    );
    // Old Node bundles have no encoding declaration and retain UTF-8 semantics.
    manifest.as_object_mut().unwrap().remove("binary_commands");
    std::fs::write(&path, manifest.to_string()).unwrap();
    let legacy = Products::load(&config).unwrap();
    let text = legacy.get("cad.part.inspect").unwrap();
    let result = legacy
        .execute(&text, "βeta", &json!({"app":"cad","id":"fixture"}))
        .await
        .unwrap();
    assert_eq!(result["result"], json!({"source":"βeta","encoding":"utf8"}));
    for invalid in [
        json!(["cad.missing"]),
        json!(["cad.part.inspect", "cad.part.inspect"]),
    ] {
        manifest["binary_commands"] = invalid;
        std::fs::write(&path, manifest.to_string()).unwrap();
        assert!(matches!(Products::load(&config), Err(Error::Invalid)));
    }
}
