use super::cad_products::installed_script;
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};

async fn fixture(script: Option<&str>) -> Fixture {
    let f = Fixture::configured(512, Some(installed_script(script))).await;
    f.docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    f
}
async fn ok(r: reqwest::Response) -> Value {
    let status = r.status();
    let v = r.json::<Value>().await.unwrap();
    assert_eq!(status, 200, "{v}");
    v
}
async fn create_project(f: &Fixture) -> Value {
    ok(f.library(
        "alice",
        "project_create",
        json!({"app":"cad","name":"Wheel","operation_id":"new-project"}),
    )
    .await)
    .await
}
fn read(id: &Value) -> Value {
    json!({"app":"cad","id":id})
}
fn edit(id: &Value, op: &str, revision: u32, operation: &str) -> Value {
    json!({"app":"cad","id":id,"operation_id":op,"expected_revision":revision,"operation":operation,"name":"Bracket"})
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn create_open_edit_retry_and_historical_project() {
    let f = fixture(None).await;
    let p = create_project(&f).await;
    assert_eq!(p["name"], "Wheel.acad");
    assert_eq!(p["project"]["parts"].as_array().unwrap().len(), 1);
    let replay = create_project(&f).await;
    assert_eq!(replay["id"], p["id"]);
    assert_eq!(replay["replayed"], true);
    // Native operation IDs are globally unique within the tenant. Another
    // actor cannot reinterpret an existing receipt as their own create.
    assert_eq!(
        f.library(
            "bob",
            "project_create",
            json!({"app":"cad","name":"Wheel","operation_id":"new-project"})
        )
        .await
        .status(),
        409
    );
    let bob = ok(f
        .library(
            "bob",
            "project_create",
            json!({"app":"cad","name":"Wheel","operation_id":"bob-new-project"}),
        )
        .await)
    .await;
    assert_ne!(bob["project"]["id"], p["project"]["id"]);

    let request = edit(&p["id"], "add-part", 1, "add_part");
    let changed = ok(f.library("alice", "project_edit", request.clone()).await).await;
    assert_eq!(changed["revision"], 2);
    assert_eq!(changed["project"]["parts"].as_array().unwrap().len(), 2);
    let again = ok(f.library("alice", "project_edit", request).await).await;
    assert_eq!(again["replayed"], true);
    assert_eq!(again["project"], changed["project"]);
    assert_eq!(
        f.library(
            "alice",
            "project_edit",
            edit(&p["id"], "stale", 1, "add_part")
        )
        .await
        .status(),
        409
    );
    let old = ok(f
        .library(
            "alice",
            "project_read",
            json!({"app":"cad","id":p["id"],"revision":1}),
        )
        .await)
    .await;
    assert_eq!(old["writable"], false);
    assert_eq!(old["project"], p["project"]);
    let current = ok(f.library("alice", "project_read", read(&p["id"])).await).await;
    assert_eq!(current["project"], changed["project"]);
    assert!(current.get("data_base64").is_none());
    let mut collision = edit(&p["id"], "add-part", 1, "add_assembly");
    assert_eq!(
        f.library("alice", "project_edit", collision.clone())
            .await
            .status(),
        409
    );
    collision["expected_revision"] = json!(2);
    collision["operation_id"] = json!("assembly");
    let assembly = ok(f.library("alice", "project_edit", collision).await).await;
    assert_eq!(
        assembly["project"]["assemblies"].as_array().unwrap().len(),
        2
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn project_branch_edits_save_parts_and_restore_without_changing_main() {
    let f = fixture(None).await;
    let p = create_project(&f).await;
    let fork=ok(f.library("alice","branch_create",json!({"app":"cad","id":p["id"],"operation_id":"fork","expected_revision":1,"from_revision":1,"name":"Variant"})).await).await;
    let mut request = edit(&p["id"], "branch-part", 1, "save_part");
    request["branch"] = fork["branch_id"].clone();
    request["part_id"] = p["project"]["parts"][0]["id"].clone();
    request["document"] =
        json!({"format":"aether-part","formatVersion":3,"name":"Revised","features":[]});
    let result = ok(f.library("alice", "project_edit", request).await).await;
    assert_eq!(result["revision"], 2);
    assert_eq!(result["branch_id"], fork["branch_id"]);
    assert_eq!(result["project"]["parts"][0]["name"], "Revised");
    let main = ok(f.library("alice", "project_read", read(&p["id"])).await).await;
    assert_eq!(main["project"], p["project"]);
    let branch = ok(f
        .library(
            "alice",
            "project_read",
            json!({"app":"cad","id":p["id"],"branch":fork["branch_id"]}),
        )
        .await)
    .await;
    assert_eq!(branch["project"], result["project"]);
    ok(f.library("alice","restore",json!({"app":"cad","id":p["id"],"branch":fork["branch_id"],"revision":1,"expected_revision":2,"operation_id":"restore"})).await).await;
    let branch = ok(f
        .library(
            "alice",
            "project_read",
            json!({"app":"cad","id":p["id"],"branch":fork["branch_id"]}),
        )
        .await)
    .await;
    assert_eq!(branch["project"], p["project"]);
}
async fn source(f: &Fixture) -> Value {
    let raw = std::fs::read(std::env::var("AETHER_TEST_CAD_FIXTURE").unwrap()).unwrap();
    ok(f.library("alice","create",json!({"app":"cad","operation_id":"source","name":"Part.acpart","data_base64":STANDARD.encode(raw)})).await).await
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn project_links_pin_revisions_and_enforce_source_access_and_readonly_parts() {
    let f = fixture(None).await;
    let p = create_project(&f).await;
    let src = source(&f).await;
    let mut link = edit(&p["id"], "link", 1, "link_part");
    link["source_id"] = src["id"].clone();
    link["source_revision"] = json!(1);
    let result = ok(f.library("alice", "project_edit", link.clone()).await).await;
    let part = result["project"]["parts"][1].clone();
    assert_eq!(part["source"]["kind"], "linked");
    let mut save = edit(&p["id"], "save-linked", 2, "save_part");
    save["part_id"] = part["id"].clone();
    save["document"] = part["document"].clone();
    assert_eq!(f.library("alice", "project_edit", save).await.status(), 400);
    f.docs
        .grant(
            &token("alice"),
            p["id"].as_str().unwrap(),
            "bob",
            Some(Role::Editor),
        )
        .await
        .unwrap();
    link["operation_id"] = json!("bob-link");
    link["expected_revision"] = json!(2);
    assert_eq!(
        f.library("bob", "project_edit", link.clone())
            .await
            .status(),
        404
    );
    f.docs
        .grant(
            &token("alice"),
            src["id"].as_str().unwrap(),
            "bob",
            Some(Role::Viewer),
        )
        .await
        .unwrap();
    let linked = ok(f.library("bob", "project_edit", link).await).await;
    assert_eq!(linked["revision"], 3);
    let mut insert = edit(&p["id"], "insert", 3, "insert_part");
    insert["part_id"] = part["id"].clone();
    insert["assembly_id"] = p["project"]["assemblies"][0]["id"].clone();
    ok(f.library("alice", "project_edit", insert).await).await;
    let mut updated = part["document"].clone();
    updated["name"] = json!("Updated source");
    ok(f.library("alice","save",json!({"app":"cad","id":src["id"],"expected_revision":1,"operation_id":"source-save","data_base64":STANDARD.encode(serde_json::to_vec(&updated).unwrap())})).await).await;
    let pinned = ok(f.library("alice", "project_read", read(&p["id"])).await).await;
    assert_eq!(pinned["project"]["parts"][1]["source"], part["source"]);
    let mut update = edit(&p["id"], "update-link", 4, "update_link");
    update["part_id"] = part["id"].clone();
    update["source_id"] = src["id"].clone();
    update["source_revision"] = json!(2);
    let updated = ok(f.library("alice", "project_edit", update).await).await;
    assert_eq!(updated["project"]["parts"][1]["name"], "Updated source");
    assert_eq!(
        updated["project"]["parts"][1]["source"]["asset_ref"],
        format!("library:{}@2", src["id"].as_str().unwrap())
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn project_validation_authority_missing_runtime_and_internal_route_refusal() {
    let f = fixture(None).await;
    let p = create_project(&f).await;
    assert_eq!(
        f.library("bob", "project_read", read(&p["id"]))
            .await
            .status(),
        404
    );
    f.docs
        .grant(
            &token("alice"),
            p["id"].as_str().unwrap(),
            "bob",
            Some(Role::Viewer),
        )
        .await
        .unwrap();
    assert_eq!(
        ok(f.library("bob", "project_read", read(&p["id"])).await).await["writable"],
        false
    );
    assert_eq!(
        f.library(
            "bob",
            "project_edit",
            edit(&p["id"], "viewer", 1, "add_part")
        )
        .await
        .status(),
        404
    );
    for request in [
        json!({"app":"cad","name":"x"}),
        json!({"app":"cad","name":"x","operation_id":"x","packaging":"bad"}),
        json!({"app":"cad","name":"../x","operation_id":"x"}),
    ] {
        assert_eq!(
            f.library("alice", "project_create", request).await.status(),
            400
        );
    }
    let assembly=ok(f.library("alice","project_create",json!({"app":"cad","name":"Assembly","operation_id":"new-assembly","packaging":"assembly"})).await).await;
    assert_eq!(assembly["name"], "Assembly.acasm");
    assert!(assembly["project"]["parts"].as_array().unwrap().is_empty());
    let missing = Fixture::new().await;
    missing
        .docs
        .configure_app(&token("admin"), "cad", true, false)
        .await
        .unwrap();
    assert_eq!(
        missing
            .library(
                "alice",
                "project_create",
                json!({"app":"cad","name":"x","operation_id":"x"})
            )
            .await
            .status(),
        503
    );
    let r = f
        .client
        .post(format!("{}/api/cad/project-create", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({}))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn project_file_and_linked_source_revocation_during_worker_prevents_commit() {
    for revoke_source in [false, true] {
        let dir = tempfile::tempdir().unwrap();
        let marker = dir.path().join("started");
        let release = dir.path().join("release");
        let script = format!(
            "import json,sys,time,pathlib\njson.load(sys.stdin)\npathlib.Path({}).touch()\nwhile not pathlib.Path({}).exists(): time.sleep(0.01)\nprint('{{\"result\":{{\"project\":{{\"parts\":[],\"assemblies\":[]}},\"data_base64\":\"e30=\"}}}}')",
            serde_json::to_string(marker.to_str().unwrap()).unwrap(),
            serde_json::to_string(release.to_str().unwrap()).unwrap()
        );
        let f = fixture(Some(&script)).await;
        let target=ok(f.library("alice","create",json!({"app":"cad","operation_id":"target","name":"Project.acad","data_base64":"e30="})).await).await;
        let src = source(&f).await;
        for file in [&target, &src] {
            f.docs
                .grant(
                    &token("alice"),
                    file["id"].as_str().unwrap(),
                    "bob",
                    Some(Role::Editor),
                )
                .await
                .unwrap();
        }
        let mut args = edit(&target["id"], "race", 1, "link_part");
        args["source_id"] = src["id"].clone();
        args["source_revision"] = json!(1);
        let client = f.client.clone();
        let url = f.url.clone();
        let pending = tokio::spawn(async move {
            client
                .post(format!("{url}/api/library/project_edit"))
                .header("origin", &url)
                .header("cookie", format!("{COOKIE}={}", token("bob")))
                .json(&args)
                .send()
                .await
                .unwrap()
        });
        tokio::time::timeout(Duration::from_secs(5), async {
            while !marker.exists() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        f.docs
            .grant(
                &token("alice"),
                if revoke_source {
                    src["id"].as_str().unwrap()
                } else {
                    target["id"].as_str().unwrap()
                },
                "bob",
                None,
            )
            .await
            .unwrap();
        std::fs::write(release, b"go").unwrap();
        assert!(matches!(
            pending.await.unwrap().status().as_u16(),
            403 | 404
        ));
        let saved = ok(f.library("alice", "read", read(&target["id"])).await).await;
        assert_eq!(saved["revision"], 1);
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and Chromium"]
async fn actual_project_home_factory_and_cad_browser_adapter() {
    let f = fixture(None).await;
    let result = tokio::process::Command::new(std::env::var("AETHER_TEST_NODE").unwrap())
        .arg(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../dev/rebuild/cad_project_browser.mjs"),
        )
        .arg(&f.url)
        .arg(token("alice"))
        .arg(std::env::var("AETHER_TEST_CAD_FIXTURE").unwrap())
        .output()
        .await
        .unwrap();
    assert!(
        result.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
    println!("{}", String::from_utf8_lossy(&result.stdout));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn project_read_rechecks_file_access_after_worker() {
    let dir = tempfile::tempdir().unwrap();
    let marker = dir.path().join("started");
    let release = dir.path().join("release");
    let script = format!(
        "import json,sys,time,pathlib\njson.load(sys.stdin)\npathlib.Path({}).touch()\nwhile not pathlib.Path({}).exists(): time.sleep(0.01)\nprint('{{\"result\":{{\"project\":{{\"parts\":[],\"assemblies\":[],\"name\":\"private-graph\"}}}}}}')",
        serde_json::to_string(marker.to_str().unwrap()).unwrap(),
        serde_json::to_string(release.to_str().unwrap()).unwrap()
    );
    let f = fixture(Some(&script)).await;
    let file=ok(f.library("alice","create",json!({"app":"cad","operation_id":"read-target","name":"Project.acad","data_base64":"e30="})).await).await;
    f.docs
        .grant(
            &token("alice"),
            file["id"].as_str().unwrap(),
            "bob",
            Some(Role::Viewer),
        )
        .await
        .unwrap();
    let client = f.client.clone();
    let url = f.url.clone();
    let args = read(&file["id"]);
    let pending = tokio::spawn(async move {
        client
            .post(format!("{url}/api/library/project_read"))
            .header("origin", &url)
            .header("cookie", format!("{COOKIE}={}", token("bob")))
            .json(&args)
            .send()
            .await
            .unwrap()
    });
    tokio::time::timeout(Duration::from_secs(5), async {
        while !marker.exists() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    f.docs
        .grant(&token("alice"), file["id"].as_str().unwrap(), "bob", None)
        .await
        .unwrap();
    std::fs::write(release, b"go").unwrap();
    let result = pending.await.unwrap();
    assert_eq!(result.status(), 404);
    assert!(!result.text().await.unwrap().contains("private-graph"));
}
