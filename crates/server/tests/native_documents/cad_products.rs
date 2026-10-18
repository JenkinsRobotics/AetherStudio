use super::*;
use aether_server::products::Products;
use base64::{Engine, engine::general_purpose::STANDARD};
use std::path::Path;

fn installed() -> Products {
    installed_script(None)
}
pub(super) fn installed_script(script: Option<&str>) -> Products {
    let directory = tempfile::tempdir().unwrap();
    let original = std::env::var("AETHER_TEST_CAD_WORKER").unwrap();
    let manifest = if let Some(script) = script {
        let mut value: Value = serde_json::from_slice(&std::fs::read(original).unwrap()).unwrap();
        value["sha256"] = json!(format!("{:x}", Sha256::digest(script.as_bytes())));
        let path = directory.path().join("native-worker.json");
        std::fs::write(&path, value.to_string()).unwrap();
        std::fs::write(directory.path().join("runner.pyz"), script).unwrap();
        path
    } else {
        Path::new(&original).to_owned()
    };
    let config = directory.path().join("products.json");
    std::fs::write(
        &config,
        serde_json::to_vec(&json!({
            "schema":1, "node":std::env::var("AETHER_TEST_NODE").unwrap(),
            "python":std::env::var("AETHER_TEST_CAD_PYTHON").unwrap(),
            "freecad":std::env::var("AETHER_TEST_CAD_FREECAD").unwrap(),
            "manifests":[manifest]
        }))
        .unwrap(),
    )
    .unwrap();
    Products::load(&config).unwrap()
}
pub(super) async fn ok(response: reqwest::Response) -> Value {
    let status = response.status();
    let value = response.json::<Value>().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
pub(super) async fn issue(f: &Fixture, write: bool, content: bool) -> String {
    ok(f.client
        .post(format!("{}/api/automation/connections/create", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({"label":"CAD","apps":["cad"],"can_write":write,"can_edit_content":content}))
        .send()
        .await
        .unwrap())
    .await["token"]
        .as_str()
        .unwrap()
        .into()
}
async fn fixture() -> (Fixture, Value, String) {
    fixture_with(installed()).await
}
async fn fixture_with(registry: Products) -> (Fixture, Value, String) {
    let f = Fixture::configured(512, Some(registry)).await;
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    let source = std::fs::read(std::env::var("AETHER_TEST_CAD_FIXTURE").unwrap()).unwrap();
    let file=ok(f.library("alice","create",json!({"app":"cad","operation_id":"cad-create","kind":"file","name":"Agent.acpart","scope":"personal","data_base64":STANDARD.encode(source)})).await).await;
    let key = issue(&f, true, true).await;
    (f, file, key)
}
pub(super) async fn call(
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
fn target(file: &Value) -> Value {
    json!({"app":"cad","id":file["id"]})
}
fn edit(file: &Value, revision: u32, depth: u32) -> Value {
    json!({"app":"cad","id":file["id"],"feature_id":"pad","depth_mm":depth,"expected_revision":revision})
}
async fn head(f: &Fixture, file: &Value) -> Value {
    ok(f.library("alice", "read", target(file)).await).await
}
fn volume(result: &Value) -> f64 {
    result["result"]["evaluated_bodies"][0]["volume_mm3"]
        .as_f64()
        .unwrap()
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + installed CAD bundle + FreeCAD"]
async fn cad_catalog_and_content_permissions_are_native() {
    let (f, file, full) = fixture().await;
    for (key, count) in [
        (issue(&f, false, false).await, 13),
        (issue(&f, true, false).await, 15),
        (full.clone(), 22),
    ] {
        let catalog = ok(f
            .client
            .post(format!("{}/api/automation/commands/list", f.url))
            .bearer_auth(&key)
            .json(&json!({}))
            .send()
            .await
            .unwrap())
        .await;
        assert_eq!(catalog["commands"].as_array().unwrap().len(), count);
        let result = call(&f, &key, "cad.extrude.setdepth", edit(&file, 1, 8), None).await;
        assert_eq!(result.status(), if count == 22 { 200 } else { 403 });
    }
    let inspected = ok(call(&f, &full, "cad.part.inspect", target(&file), None).await).await;
    assert_eq!(inspected["result"]["features"][1]["depth_mm"], 8);
    f.docs
        .configure_app(&token("admin"), "cad", false, false)
        .await
        .unwrap();
    assert_eq!(
        call(&f, &full, "cad.part.inspect", target(&file), None)
            .await
            .status(),
        403
    );
    // An agent key is still not a browser session.
    assert_eq!(
        f.client
            .post(format!("{}/api/library/read", f.url))
            .bearer_auth(full)
            .json(&target(&file))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + installed CAD bundle + FreeCAD"]
async fn cad_native_geometry_preview_edit_topology_and_recovery() {
    let (f, file, key) = fixture().await;
    let mut preview = edit(&file, 1, 8);
    preview.as_object_mut().unwrap().remove("expected_revision");
    let result = ok(call(&f, &key, "cad.extrude.preview", preview, None).await).await;
    assert!((volume(&result) - 1600.0).abs() < 0.001);
    assert_eq!(result["result"]["changed"], false);
    assert_eq!(head(&f, &file).await["revision"], 1);
    let result = ok(call(
        &f,
        &key,
        "cad.extrude.setdepth",
        edit(&file, 1, 8),
        Some("depth-once"),
    )
    .await)
    .await;
    assert!((volume(&result) - 1600.0).abs() < 0.001);
    assert_eq!(result["result"]["document"]["revision"], 2);
    let body = &result["result"]["evaluated_bodies"][0]["id"];
    let topology = ok(call(
        &f,
        &key,
        "cad.part.topology",
        json!({"app":"cad","id":file["id"],"body_id":body}),
        None,
    )
    .await)
    .await;
    assert_eq!(topology["result"]["coordinate_units"], "millimeter");
    assert_eq!(topology["result"]["faces"].as_array().unwrap().len(), 6);
    assert_eq!(call(&f,&key,"cad.feature.move",json!({"app":"cad","id":file["id"],"feature_id":"pad","direction":-1,"expected_revision":2}),None).await.status(),400);
    assert_eq!(head(&f, &file).await["revision"], 2);
    // Suppression is validated by the same native engine before commit.
    let suppressed=ok(call(&f,&key,"cad.feature.suppress",json!({"app":"cad","id":file["id"],"feature_id":"pad","action":"suppress","expected_revision":2}),Some("suppress")).await).await;
    assert_eq!(suppressed["result"]["document"]["revision"], 3);
    assert!(
        suppressed["result"]["evaluated_bodies"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    ok(f.library("alice","restore",json!({"app":"cad","id":file["id"],"revision":1,"expected_revision":3,"operation_id":"restore-original"})).await).await;
    let recovered = ok(call(&f, &key, "cad.part.evaluate", target(&file), None).await).await;
    assert!((volume(&recovered) - 1000.0).abs() < 0.001);
    assert_eq!(recovered["result"]["document"]["revision"], 4);
    assert_eq!(
        f.docs
            .history(&token("alice"), file["id"].as_str().unwrap(), 0, 100)
            .await
            .unwrap()
            .len(),
        4
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + installed CAD bundle + FreeCAD"]
async fn cad_noop_receipts_and_concurrent_edits_preserve_revisions() {
    let (f, file, key) = fixture().await;
    let noop = ok(call(
        &f,
        &key,
        "cad.extrude.setdepth",
        edit(&file, 1, 5),
        Some("no-change"),
    )
    .await)
    .await;
    assert_eq!(noop["result"]["changed"], false);
    assert_eq!(noop["result"]["document"]["revision"], 1);
    let (a, b) = tokio::join!(
        call(
            &f,
            &key,
            "cad.extrude.setdepth",
            edit(&file, 1, 8),
            Some("same-edit")
        ),
        call(
            &f,
            &key,
            "cad.extrude.setdepth",
            edit(&file, 1, 8),
            Some("same-edit")
        )
    );
    let a = ok(a).await;
    let b = ok(b).await;
    assert_eq!(a["result"]["document"]["revision"], 2);
    assert_eq!(b["result"]["document"]["revision"], 2);
    assert_ne!(a["result"]["replayed"], b["result"]["replayed"]);
    let replay = ok(call(
        &f,
        &key,
        "cad.extrude.setdepth",
        edit(&file, 1, 5),
        Some("no-change"),
    )
    .await)
    .await;
    assert_eq!(replay["result"]["replayed"], true);
    assert_eq!(replay["result"]["document"]["revision"], 1);
    assert_eq!(
        call(
            &f,
            &key,
            "cad.extrude.setdepth",
            edit(&file, 1, 9),
            Some("same-edit")
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        call(&f, &key, "cad.extrude.setdepth", edit(&file, 1, 9), None)
            .await
            .status(),
        409
    );
    assert_eq!(head(&f, &file).await["revision"], 2);
    f.sql("UPDATE aether_identity.agent_connections SET revoked=true")
        .await;
    assert_eq!(
        call(
            &f,
            &key,
            "cad.extrude.setdepth",
            edit(&file, 1, 5),
            Some("no-change")
        )
        .await
        .status(),
        401
    );
}

#[tokio::test]
#[ignore = "installed CAD bundle + FreeCAD"]
async fn cad_requires_explicit_runtimes_and_snapshots_installed_zip() {
    let directory = tempfile::tempdir().unwrap();
    let source = Path::new(&std::env::var("AETHER_TEST_CAD_WORKER").unwrap()).to_owned();
    let manifest = directory.path().join("native-worker.json");
    std::fs::copy(&source, &manifest).unwrap();
    std::fs::copy(
        source.parent().unwrap().join("runner.pyz"),
        directory.path().join("runner.pyz"),
    )
    .unwrap();
    let config = directory.path().join("products.json");
    let mut value = json!({"schema":1,"node":std::env::var("AETHER_TEST_NODE").unwrap(),"manifests":[manifest]});
    std::fs::write(&config, value.to_string()).unwrap();
    assert!(Products::load(&config).is_err());
    value["python"] = json!(std::env::var("AETHER_TEST_CAD_PYTHON").unwrap());
    value["freecad"] = json!("relative-freecad");
    std::fs::write(&config, value.to_string()).unwrap();
    assert!(Products::load(&config).is_err());
    value["freecad"] = json!(std::env::var("AETHER_TEST_CAD_FREECAD").unwrap());
    std::fs::write(&config, value.to_string()).unwrap();
    let original: Value = serde_json::from_slice(&std::fs::read(&manifest).unwrap()).unwrap();
    for paths in [
        json!(["/api/map/engine"]),
        json!(["/api/cad/../engine"]),
        json!(["/api/cad/engine", "/api/cad/engine"]),
        json!(["/api/cad/engine?key=secret"]),
    ] {
        let mut changed = original.clone();
        changed["services"] = paths;
        std::fs::write(&manifest, changed.to_string()).unwrap();
        assert!(Products::load(&config).is_err());
    }
    let mut command_only = original.clone();
    command_only.as_object_mut().unwrap().remove("services");
    std::fs::write(&manifest, command_only.to_string()).unwrap();
    let old = Products::load(&config).unwrap();
    assert!(old.service("/api/cad/engine", &json!({})).await.is_err());
    std::fs::write(&manifest, original.to_string()).unwrap();
    let registry = Products::load(&config).unwrap();
    std::fs::write(directory.path().join("runner.pyz"), b"changed").unwrap();
    assert!(Products::load(&config).is_err());
    drop(directory);
    assert_eq!(
        registry
            .service("/api/cad/mate-kinds", &json!({}))
            .await
            .unwrap()["ok"],
        true
    );
    let source =
        std::fs::read_to_string(std::env::var("AETHER_TEST_CAD_FIXTURE").unwrap()).unwrap();
    let result = registry
        .execute(
            &registry.get("cad.part.evaluate").unwrap(),
            &source,
            &json!({"app":"cad","id":"fixture"}),
        )
        .await
        .unwrap();
    assert!(
        (result["result"]["evaluated_bodies"][0]["volume_mm3"]
            .as_f64()
            .unwrap()
            - 1000.0)
            .abs()
            < 0.001
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + installed CAD worker + FreeCAD"]
async fn real_rust_mcp_and_cli_share_cad_receipts() {
    use tokio::io::AsyncWriteExt;
    let (f, file, key) = fixture().await;
    let program = json!({"version":1,"steps":[
        {"id":"first","tool":"aether_cad_extrude_depth","arguments":{"feature_id":"pad","depth_mm":7}},
        {"id":"second","tool":"aether_cad_extrude_depth","arguments":{"feature_id":{"$ref":"first.feature_id"},"depth_mm":8}}
    ]}).to_string();
    let arguments =
        json!({"app":"cad","id":file["id"],"expected_revision":1,"program_json":program});
    let frames = [
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}}),
        json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"cad_part_runprogram","_meta":{"aether/operationId":"cad-mcp"},"arguments":arguments}}),
        json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"cad_part_runprogram","_meta":{"aether/operationId":"cad-mcp"},"arguments":arguments}}),
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
    assert_eq!(replies.len(), 4);
    assert_eq!(replies[1]["result"]["tools"].as_array().unwrap().len(), 22);
    let first = &replies[2]["result"]["structuredContent"];
    let second = &replies[3]["result"]["structuredContent"];
    assert_eq!(first["result"]["document"]["revision"], 2);
    assert_eq!(first["result"]["steps_completed"], 2);
    assert!((volume(first) - 1600.0).abs() < 0.001);
    assert_eq!(second["result"]["replayed"], true);
    let mut cli = tokio::process::Command::new(std::env::var("AETHER_AUTOMATION_BIN").unwrap())
        .args(["run", "cad.part.runprogram", "--operation-id", "cad-mcp"])
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
        .write_all(arguments.to_string().as_bytes())
        .await
        .unwrap();
    let output = tokio::time::timeout(Duration::from_secs(15), cli.wait_with_output())
        .await
        .unwrap()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    assert_eq!(
        serde_json::from_slice::<Value>(&output.stdout).unwrap(),
        *second
    );
    assert_eq!(head(&f, &file).await["revision"], 2);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + installed CAD bundle"]
async fn noop_cannot_receipt_a_head_changed_during_validation() {
    let dir = tempfile::tempdir().unwrap();
    let started = dir.path().join("started");
    let release = dir.path().join("release");
    let script = format!(
        "import sys,json,time,pathlib\njson.load(sys.stdin)\npathlib.Path({}).write_text('started')\nwhile not pathlib.Path({}).exists(): time.sleep(0.01)\nprint(json.dumps({{'result':{{}},'unchanged':True}}))",
        json!(started),
        json!(release)
    );
    let (f, file, key) = fixture_with(installed_script(Some(&script))).await;
    let request = call(
        &f,
        &key,
        "cad.extrude.setdepth",
        edit(&file, 1, 5),
        Some("noop-race"),
    );
    let concurrent = async {
        tokio::time::timeout(Duration::from_secs(5), async {
            while !started.exists() {
                tokio::time::sleep(Duration::from_millis(10)).await
            }
        })
        .await
        .unwrap();
        let source = std::fs::read(std::env::var("AETHER_TEST_CAD_FIXTURE").unwrap()).unwrap();
        ok(f.library("alice","save",json!({"app":"cad","id":file["id"],"expected_revision":1,"operation_id":"wins","data_base64":STANDARD.encode(source)})).await).await;
        std::fs::write(release, "go").unwrap();
    };
    let (response, ()) = tokio::join!(request, concurrent);
    assert_eq!(response.status(), 409);
    assert_eq!(head(&f, &file).await["revision"], 2);
    let row = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_access.automation_receipts",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, i64>(0), 0);
}

#[tokio::test]
#[ignore = "installed CAD worker + Python; Unix process groups"]
async fn python_worker_cancellation_kills_descendants_and_removes_private_work() {
    let dir = tempfile::tempdir().unwrap();
    let marker = dir.path().join("started");
    let script = format!(
        "import sys,os,json,time,pathlib,subprocess\njson.load(sys.stdin)\nchild=subprocess.Popen(['/bin/sleep','30'])\nmarker=pathlib.Path({})\ntemporary=marker.with_suffix('.tmp')\ntemporary.write_text(json.dumps([os.getpid(),child.pid,os.getcwd()]))\ntemporary.replace(marker)\ntime.sleep(30)",
        json!(marker)
    );
    let registry = installed_script(Some(&script));
    let product = registry.get("cad.part.evaluate").unwrap();
    let job = tokio::spawn(async move {
        registry
            .execute(&product, "{{}}", &json!({"app":"cad","id":"fixture"}))
            .await
    });
    tokio::time::timeout(Duration::from_secs(5), async {
        while !marker.exists() {
            tokio::time::sleep(Duration::from_millis(10)).await
        }
    })
    .await
    .unwrap();
    let data: Value = serde_json::from_slice(&std::fs::read(marker).unwrap()).unwrap();
    job.abort();
    assert!(job.await.unwrap_err().is_cancelled());
    tokio::time::timeout(Duration::from_secs(5), async {
        for pid in [&data[0], &data[1]] {
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
    assert!(!Path::new(data[2].as_str().unwrap()).exists());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL + installed CAD bundle + FreeCAD"]
async fn cad_program_is_one_revision_with_proof_permissions_and_replay() {
    let (f, file, key) = fixture().await;
    let readonly = issue(&f, false, false).await;
    let docs = ok(call(&f, &readonly, "cad.part.docs", target(&file), None).await).await;
    assert_eq!(docs["result"]["total"], 8);
    let program = json!({"version":1,"steps":[
        {"id":"first","tool":"aether_cad_extrude_depth","arguments":{"feature_id":"pad","depth_mm":8}},
        {"id":"second","tool":"aether_cad_extrude_depth","arguments":{"feature_id":{"$ref":"first.feature_id"},"depth_mm":9}}
    ]}).to_string();
    let args = json!({"app":"cad","id":file["id"],"expected_revision":1,"program_json":program});
    assert_eq!(
        call(&f, &readonly, "cad.part.runprogram", args.clone(), None)
            .await
            .status(),
        403
    );
    assert_eq!(head(&f, &file).await["revision"], 1);
    let applied = ok(call(
        &f,
        &key,
        "cad.part.runprogram",
        args.clone(),
        Some("program-once"),
    )
    .await)
    .await;
    assert_eq!(applied["result"]["steps_completed"], 2);
    assert_eq!(applied["result"]["document"]["revision"], 2);
    assert!((volume(&applied) - 1800.0).abs() < 0.001);
    let replayed = ok(call(
        &f,
        &key,
        "cad.part.runprogram",
        args.clone(),
        Some("program-once"),
    )
    .await)
    .await;
    assert_eq!(replayed["result"]["replayed"], true);
    assert_eq!(replayed["result"]["document"]["revision"], 2);
    assert_eq!(
        call(&f, &key, "cad.part.runprogram", args, None)
            .await
            .status(),
        409
    );
    let proof = ok(call(
        &f,
        &readonly,
        "cad.part.verify",
        json!({"app":"cad","id":file["id"],"density_kg_m3":7800}),
        None,
    )
    .await)
    .await;
    assert_eq!(proof["result"]["changed"], false);
    assert!(
        (proof["result"]["measurements"][0]["volume_mm3"]
            .as_f64()
            .unwrap()
            - 1800.0)
            .abs()
            < 0.001
    );
    let bad = json!({"version":1,"steps":[
        {"id":"first","tool":"aether_cad_extrude_depth","arguments":{"feature_id":"pad","depth_mm":12}},
        {"id":"missing","tool":"aether_cad_extrude_depth","arguments":{"feature_id":"missing","depth_mm":9}}
    ]}).to_string();
    assert_eq!(
        call(
            &f,
            &key,
            "cad.part.runprogram",
            json!({"app":"cad","id":file["id"],"expected_revision":2,"program_json":bad}),
            None
        )
        .await
        .status(),
        400
    );
    assert_eq!(head(&f, &file).await["revision"], 2);
    assert_eq!(
        f.docs
            .history(&token("alice"), file["id"].as_str().unwrap(), 0, 100)
            .await
            .unwrap()
            .len(),
        2
    );
}
