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
async fn project(f: &Fixture) -> Value {
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
fn edit(id: &Value, operation: &str, expected: u32) -> Value {
    json!({"app":"cad","id":id,"operation":operation,"operation_id":format!("{operation}-{expected}"),"expected_revision":expected})
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn settings_revision_retry_units_properties_trash_and_atomic_rename() {
    let f = fixture(None).await;
    let p = project(&f).await;
    let id = &p["id"];
    let first = ok(f.library("alice", "cad_metadata", read(id)).await).await;
    assert_eq!(first["writable"], true);
    assert!(first.get("data_base64").is_none());
    let mut details = edit(id, "details", 1);
    details["description"] = json!("Notes");
    details["revisionManaged"] = json!(false);
    assert_eq!(
        ok(f.library("alice", "cad_operation", details.clone()).await).await["revision"],
        2
    );
    assert_eq!(
        ok(f.library("alice", "cad_operation", details.clone()).await).await["replayed"],
        true
    );
    details["description"] = json!("Different");
    assert_eq!(
        f.library("alice", "cad_operation", details.clone())
            .await
            .status(),
        409
    );
    details["operation_id"] = json!("stale");
    assert_eq!(
        f.library("alice", "cad_operation", details).await.status(),
        409
    );
    let mut units = edit(id, "units", 2);
    units["units"] = first["settings"]["units"].clone();
    units["units"]["length"]["unit"] = json!("in");
    ok(f.library("alice", "cad_operation", units).await).await;
    let mut props = edit(id, "properties", 3);
    props["item_id"] = json!("workspace");
    props["name"] = json!("Design");
    props["description"] = json!("Properties");
    ok(f.library("alice", "cad_operation", props).await).await;
    let part = &p["project"]["parts"][0]["id"];
    let mut trash = edit(id, "delete_item", 4);
    trash["item_id"] = part.clone();
    ok(f.library("alice", "cad_operation", trash).await).await;
    let deleted = ok(f.library("alice", "cad_metadata", read(id)).await).await;
    assert_eq!(deleted["deleted"][0]["id"], *part);
    let mut restore = edit(id, "restore_item", 5);
    restore["item_id"] = part.clone();
    ok(f.library("alice", "cad_operation", restore).await).await;
    let mut rename = edit(id, "rename", 6);
    rename["name"] = json!("New wheel");
    let changed = ok(f.library("alice", "cad_operation", rename.clone()).await).await;
    assert_eq!(changed["name"], "New wheel.acad");
    assert_eq!(changed["revision"], 7);
    assert_eq!(
        ok(f.library("alice", "cad_operation", rename).await).await["replayed"],
        true
    );
    let reopened = ok(f.library("alice", "project_read", read(id)).await).await;
    assert_eq!(reopened["project"]["name"], "New wheel");
    assert_eq!(reopened["project"]["parts"][0]["id"], *part);
    let metadata = ok(f.library("alice", "cad_metadata", read(id)).await).await;
    assert_eq!(metadata["settings"]["units"]["length"]["unit"], "in");
    assert_eq!(metadata["settings"]["workspaceName"], "Design");
    let mut historical = read(id);
    historical["revision"] = json!(1);
    let old = ok(f.library("alice", "cad_metadata", historical).await).await;
    assert_eq!(old["name"], "Wheel.acad");
    assert_eq!(old["writable"], false);
    assert_eq!(old["settings"]["description"], "");
    let mut invalid = edit(id, "units", 7);
    invalid["units"] = json!({});
    assert_eq!(
        f.library("alice", "cad_operation", invalid).await.status(),
        400
    );
    assert_eq!(
        ok(f.library("alice", "read", read(id)).await).await["revision"],
        7
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn branch_rename_and_historical_copy_preserve_main_and_authority() {
    let f = fixture(None).await;
    let p = project(&f).await;
    let id = &p["id"];
    let fork=ok(f.library("alice","branch_create",json!({"app":"cad","id":id,"operation_id":"fork","name":"Design","expected_revision":1,"from_revision":1})).await).await;
    let mut rename = edit(id, "rename", 1);
    rename["branch"] = fork["branch_id"].clone();
    rename["name"] = json!("Branch wheel");
    let changed = ok(f.library("alice", "cad_operation", rename).await).await;
    assert_eq!(changed["branch_id"], fork["branch_id"]);
    let mut branch = read(id);
    branch["branch"] = fork["branch_id"].clone();
    let metadata = ok(f.library("alice", "cad_metadata", branch).await).await;
    assert_eq!(metadata["name"], "Branch wheel.acad");
    assert_eq!(
        ok(f.library("alice", "read", read(id)).await).await["name"],
        "Wheel.acad"
    );
    f.docs
        .grant(
            &token("alice"),
            id.as_str().unwrap(),
            "bob",
            Some(Role::Viewer),
        )
        .await
        .unwrap();
    let mut copy = edit(id, "copy", 1);
    copy["name"] = json!("Bob copy");
    copy["revision"] = json!(1);
    let saved = ok(f.library("bob", "cad_operation", copy.clone()).await).await;
    assert_ne!(saved["id"], *id);
    assert_eq!(saved["revision"], 1);
    assert_eq!(
        ok(f.library("bob", "cad_operation", copy.clone()).await).await["id"],
        saved["id"]
    );
    let mut denied = edit(id, "rename", 1);
    denied["name"] = json!("No");
    assert_eq!(
        f.library("bob", "cad_operation", denied.clone())
            .await
            .status(),
        404
    );
    denied["revision"] = json!(1);
    assert_eq!(
        f.library("alice", "cad_operation", denied).await.status(),
        404
    );
    f.docs
        .grant(&token("alice"), id.as_str().unwrap(), "bob", None)
        .await
        .unwrap();
    assert_eq!(f.library("bob", "cad_operation", copy).await.status(), 404);
    assert_eq!(
        f.library("bob", "cad_metadata", read(id)).await.status(),
        404
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn linked_metadata_discloses_only_authorized_source_heads_and_strict_routes() {
    let f = fixture(None).await;
    let p = project(&f).await;
    let doc = json!({"format":"aether-part","formatVersion":3,"documentId":"source","name":"Source","features":[]});
    let src=ok(f.library("alice","create",json!({"app":"cad","operation_id":"source","name":"Source.acpart","data_base64":STANDARD.encode(serde_json::to_vec(&doc).unwrap())})).await).await;
    ok(f.library("alice","project_edit",json!({"app":"cad","id":p["id"],"operation_id":"link","expected_revision":1,"operation":"link_part","source_id":src["id"],"source_revision":1})).await).await;
    f.docs
        .grant(
            &token("alice"),
            p["id"].as_str().unwrap(),
            "bob",
            Some(Role::Viewer),
        )
        .await
        .unwrap();
    let hidden = ok(f.library("bob", "cad_metadata", read(&p["id"])).await).await;
    assert_eq!(hidden["updates"][0]["available"], false);
    assert!(hidden["updates"][0].get("latest").is_none());
    assert!(hidden.get("linked_sources").is_none());
    let visible = ok(f.library("alice", "cad_metadata", read(&p["id"])).await).await;
    assert_eq!(visible["updates"][0]["latest"], 1);
    let mut bad = read(&p["id"]);
    bad["sql"] = json!("no");
    assert_eq!(f.library("alice", "cad_metadata", bad).await.status(), 400);
    let mut bad = read(&p["id"]);
    bad["app"] = json!("map");
    assert_eq!(f.library("alice", "cad_metadata", bad).await.status(), 501);
    assert_eq!(
        f.library("bob", "cad_operation", edit(&p["id"], "move", 2))
            .await
            .status(),
        404
    );
    let public = f
        .client
        .post(format!("{}/api/cad/settings-read", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({}))
        .send()
        .await
        .unwrap();
    assert_eq!(public.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn settings_read_and_write_recheck_access_after_worker() {
    for action in ["cad_metadata", "cad_operation"] {
        let dir = tempfile::tempdir().unwrap();
        let marker = dir.path().join("started");
        let release = dir.path().join("release");
        let script = format!(
            "import json,sys,time,pathlib\njson.load(sys.stdin)\npathlib.Path({}).touch()\nwhile not pathlib.Path({}).exists(): time.sleep(0.01)\nprint(json.dumps({{'result':{{'settings':{{'description':'private-notes'}},'items':[],'deleted':[],'linked_sources':[],'data_base64':'e30='}}}}))",
            serde_json::to_string(marker.to_str().unwrap()).unwrap(),
            serde_json::to_string(release.to_str().unwrap()).unwrap()
        );
        let f = fixture(Some(&script)).await;
        let file=ok(f.library("alice","create",json!({"app":"cad","operation_id":"target","name":"Wheel.acpart","data_base64":"e30="})).await).await;
        f.docs
            .grant(
                &token("alice"),
                file["id"].as_str().unwrap(),
                "bob",
                Some(Role::Editor),
            )
            .await
            .unwrap();
        let client = f.client.clone();
        let url = f.url.clone();
        let args = if action == "cad_metadata" {
            read(&file["id"])
        } else {
            let mut v = edit(&file["id"], "details", 1);
            v["revisionManaged"] = json!(true);
            v
        };
        let pending = tokio::spawn(async move {
            client
                .post(format!("{url}/api/library/{action}"))
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
        let reply = pending.await.unwrap();
        assert_eq!(reply.status(), 404);
        assert!(!reply.text().await.unwrap().contains("private-notes"));
        assert_eq!(
            ok(f.library("alice", "read", read(&file["id"])).await).await["revision"],
            1
        );
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and Chromium"]
async fn actual_settings_dialog_saves_units_on_selected_branch() {
    let f = fixture(None).await;
    let result = tokio::process::Command::new(std::env::var("AETHER_TEST_NODE").unwrap())
        .arg(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../dev/rebuild/cad_settings_browser.mjs"),
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
async fn failed_named_save_rolls_back_title_content_history_and_receipt() {
    let f = fixture(None).await;
    let p = project(&f).await;
    let id = p["id"].as_str().unwrap();
    f.sql("CREATE FUNCTION reject_settings_recent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM aether_store.documents WHERE tenant=NEW.tenant AND id=NEW.resource AND head_revision > 1) THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_settings_recent BEFORE INSERT OR UPDATE ON aether_access.library_recents FOR EACH ROW EXECUTE FUNCTION reject_settings_recent()").await;
    let mut rename = edit(&p["id"], "rename", 1);
    rename["name"] = json!("Atomic rename");
    assert!(
        f.library("alice", "cad_operation", rename.clone())
            .await
            .status()
            .is_server_error()
    );
    let stored = f.docs.read(&token("alice"), id, None).await.unwrap();
    assert_eq!(stored.document.revision, 1);
    assert_eq!(stored.document.name, "Wheel.acad");
    f.sql("DROP TRIGGER reject_settings_recent ON aether_access.library_recents; DROP FUNCTION reject_settings_recent()").await;
    let saved = ok(f.library("alice", "cad_operation", rename).await).await;
    assert_eq!(saved["revision"], 2);
    assert_eq!(saved["replayed"], false);
    let reopened = ok(f.library("alice", "project_read", read(&p["id"])).await).await;
    assert_eq!(reopened["name"], "Atomic rename.acad");
    assert_eq!(reopened["project"]["name"], "Atomic rename");
}

async fn folder(f: &Fixture, name: &str) -> Value {
    ok(f.library(
        "alice",
        "create",
        json!({"app":"cad","operation_id":name,"name":name,"kind":"folder","data_base64":""}),
    )
    .await)
    .await
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn move_is_atomic_guarded_owner_only_and_replays_without_moving_again() {
    let f = fixture(None).await;
    let p = project(&f).await;
    let dest = folder(&f, "Destination").await;
    let mut request = edit(&p["id"], "move", 1);
    request["parent"] = dest["id"].clone();
    f.docs
        .grant(
            &token("alice"),
            p["id"].as_str().unwrap(),
            "bob",
            Some(Role::Editor),
        )
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "cad_operation", request.clone())
            .await
            .status(),
        404
    );
    let moved = ok(f.library("alice", "cad_operation", request.clone()).await).await;
    assert_eq!(moved["revision"], 2);
    assert_eq!(moved["parent"], dest["id"]);
    let state = f
        .docs
        .resource_state(&token("alice"), p["id"].as_str().unwrap())
        .await
        .unwrap();
    assert_eq!(state.structure_revision, 2);
    assert_eq!(
        ok(f.library("alice", "cad_operation", request.clone()).await).await["replayed"],
        true
    );
    let mut changed = request.clone();
    changed["parent"] = Value::Null;
    assert_eq!(
        f.library("alice", "cad_operation", changed).await.status(),
        409
    );
    let mut stale = request.clone();
    stale["operation_id"] = json!("stale-move");
    assert_eq!(
        f.library("alice", "cad_operation", stale).await.status(),
        409
    );
    let collision_folder = folder(&f, "Collision").await;
    ok(f.library("alice", "create", json!({"app":"cad","operation_id":"collision-file","name":"Wheel.acad","parent":collision_folder["id"],"data_base64":"e30="})).await).await;
    let mut collision = edit(&p["id"], "move", 2);
    collision["parent"] = collision_folder["id"].clone();
    assert_eq!(
        f.library("alice", "cad_operation", collision)
            .await
            .status(),
        409
    );
    let root = edit(&p["id"], "move", 2);
    assert_eq!(
        ok(f.library("alice", "cad_operation", root).await).await["revision"],
        3
    );
    assert_eq!(
        ok(f.library("alice", "cad_operation", request).await).await["replayed"],
        true
    );
    let current = ok(f.library("alice", "read", read(&p["id"])).await).await;
    assert_eq!(current["revision"], 3);
    assert!(current["parent"].is_null());
    let fork=ok(f.library("alice","branch_create",json!({"app":"cad","id":p["id"],"operation_id":"fork-move","name":"Design","expected_revision":3,"from_revision":3})).await).await;
    let mut branch = edit(&p["id"], "move", 3);
    branch["branch"] = fork["branch_id"].clone();
    assert_eq!(
        f.library("alice", "cad_operation", branch).await.status(),
        501
    );
    let mut invalid = edit(&p["id"], "move", 3);
    invalid["parent"] = p["id"].clone();
    assert_eq!(
        f.library("alice", "cad_operation", invalid).await.status(),
        404
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn move_late_failure_rolls_back_structure_history_and_retry_receipt() {
    let f = fixture(None).await;
    let p = project(&f).await;
    let dest = folder(&f, "Destination").await;
    let mut request = edit(&p["id"], "move", 1);
    request["parent"] = dest["id"].clone();
    f.sql("CREATE FUNCTION reject_cad_action() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_cad_action BEFORE INSERT ON aether_access.automation_receipts FOR EACH ROW EXECUTE FUNCTION reject_cad_action()").await;
    assert_eq!(
        f.library("alice", "cad_operation", request.clone())
            .await
            .status(),
        503
    );
    let state = f
        .docs
        .resource_state(&token("alice"), p["id"].as_str().unwrap())
        .await
        .unwrap();
    assert_eq!(state.structure_revision, 1);
    assert_eq!(state.document_revision, Some(1));
    assert!(state.location.parent.is_none());
    f.sql("DROP TRIGGER reject_cad_action ON aether_access.automation_receipts")
        .await;
    assert_eq!(
        ok(f.library("alice", "cad_operation", request).await).await["revision"],
        2
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn update_links_records_source_snapshot_and_replays_after_source_advances() {
    let f = fixture(None).await;
    let p = project(&f).await;
    let mut doc = json!({"format":"aether-part","formatVersion":3,"documentId":"source","name":"Source","features":[]});
    let src=ok(f.library("alice","create",json!({"app":"cad","operation_id":"source","name":"Source.acpart","data_base64":STANDARD.encode(serde_json::to_vec(&doc).unwrap())})).await).await;
    let linked=ok(f.library("alice","project_edit",json!({"app":"cad","id":p["id"],"operation_id":"link","expected_revision":1,"operation":"link_part","source_id":src["id"],"source_revision":1})).await).await;
    let key = linked["project"]["parts"]
        .as_array()
        .unwrap()
        .last()
        .unwrap()["id"]
        .clone();
    doc["name"] = json!("Updated source");
    ok(f.library("alice","save",json!({"app":"cad","id":src["id"],"operation_id":"source-2","expected_revision":1,"data_base64":STANDARD.encode(serde_json::to_vec(&doc).unwrap())})).await).await;
    let fork=ok(f.library("alice","branch_create",json!({"app":"cad","id":p["id"],"operation_id":"fork-update","name":"Design","expected_revision":2,"from_revision":2})).await).await;
    let mut request = edit(&p["id"], "update", 2);
    request["parts"] = json!([key]);
    request["branch"] = fork["branch_id"].clone();
    f.docs
        .grant(
            &token("alice"),
            p["id"].as_str().unwrap(),
            "bob",
            Some(Role::Editor),
        )
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "cad_operation", request.clone())
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
    let updated = ok(f.library("bob", "cad_operation", request.clone()).await).await;
    assert_eq!(updated["revision"], 3);
    assert_eq!(updated["branch_id"], fork["branch_id"]);
    let mut selected = read(&p["id"]);
    selected["branch"] = fork["branch_id"].clone();
    assert_eq!(
        ok(f.library("bob", "cad_metadata", selected.clone()).await).await["updates"][0]["current"],
        2
    );
    assert_eq!(
        ok(f.library("alice", "cad_metadata", read(&p["id"])).await).await["updates"][0]["current"],
        1
    );
    doc["name"] = json!("Even newer source");
    ok(f.library("alice","save",json!({"app":"cad","id":src["id"],"operation_id":"source-3","expected_revision":2,"data_base64":STANDARD.encode(serde_json::to_vec(&doc).unwrap())})).await).await;
    assert_eq!(
        ok(f.library("bob", "cad_operation", request.clone()).await).await["replayed"],
        true
    );
    assert_eq!(
        ok(f.library("bob", "cad_metadata", selected).await).await["updates"][0]["current"],
        2
    );
    let mut changed = request.clone();
    changed["parts"] = json!([]);
    assert_eq!(
        f.library("bob", "cad_operation", changed).await.status(),
        409
    );
    f.docs
        .grant(&token("alice"), src["id"].as_str().unwrap(), "bob", None)
        .await
        .unwrap();
    assert_eq!(
        f.library("bob", "cad_operation", request).await.status(),
        404
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and installed CAD codec"]
async fn update_feature_version_preserves_history_and_rejects_invalid_migrations() {
    let f = fixture(None).await;
    let old = json!({"format":"aether-part","formatVersion":2,"documentId":"source","name":"Source","features":[]});
    let p=ok(f.library("alice","create",json!({"app":"cad","operation_id":"source","name":"Source.acpart","data_base64":STANDARD.encode(serde_json::to_vec(&old).unwrap())})).await).await;
    let mut request = edit(&p["id"], "update", 1);
    request["parts"] = json!([]);
    assert_eq!(
        f.library("alice", "cad_operation", request.clone())
            .await
            .status(),
        400
    );
    let mut upgraded = old.clone();
    upgraded["formatVersion"] = json!(3);
    request["upgraded_documents"] = json!({"part":upgraded});
    assert_eq!(
        ok(f.library("alice", "cad_operation", request.clone()).await).await["revision"],
        2
    );
    assert_eq!(
        ok(f.library("alice", "cad_operation", request).await).await["replayed"],
        true
    );
    assert_eq!(
        ok(f.library("alice", "cad_metadata", read(&p["id"])).await).await["upgradeNeeded"],
        false
    );
    let mut history = read(&p["id"]);
    history["revision"] = json!(1);
    assert_eq!(
        ok(f.library("alice", "cad_metadata", history).await).await["upgradeNeeded"],
        true
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and paused installed worker"]
async fn update_rechecks_source_head_and_source_or_target_access_after_worker() {
    for scenario in ["head", "source", "target"] {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("source.json");
        let marker = dir.path().join("started");
        let release = dir.path().join("release");
        let script = format!(
            r#"import json,sys,time,pathlib
request=json.load(sys.stdin)
source=json.loads(pathlib.Path({}).read_text())
result={{'settings':{{}},'items':[],'deleted':[],'linked_sources':[{{'part_id':'linked','source_id':source,'current':1}}]}}
if request['service'].endswith('-edit'):
 pathlib.Path({}).touch()
 while not pathlib.Path({}).exists(): time.sleep(0.01)
 result['data_base64']='e30='
print(json.dumps({{'result':result}}))
"#,
            serde_json::to_string(config.to_str().unwrap()).unwrap(),
            serde_json::to_string(marker.to_str().unwrap()).unwrap(),
            serde_json::to_string(release.to_str().unwrap()).unwrap()
        );
        let f = fixture(Some(&script)).await;
        let target=ok(f.library("alice","create",json!({"app":"cad","operation_id":"target","name":"Target.acad","data_base64":"e30="})).await).await;
        let source=ok(f.library("alice","create",json!({"app":"cad","operation_id":"source","name":"Source.acpart","data_base64":"e30="})).await).await;
        std::fs::write(config, serde_json::to_vec(&source["id"]).unwrap()).unwrap();
        f.docs
            .grant(
                &token("alice"),
                target["id"].as_str().unwrap(),
                "bob",
                Some(Role::Editor),
            )
            .await
            .unwrap();
        f.docs
            .grant(
                &token("alice"),
                source["id"].as_str().unwrap(),
                "bob",
                Some(Role::Viewer),
            )
            .await
            .unwrap();
        let mut args = edit(&target["id"], "update", 1);
        args["parts"] = json!(["linked"]);
        let client = f.client.clone();
        let url = f.url.clone();
        let pending = tokio::spawn(async move {
            client
                .post(format!("{url}/api/library/cad_operation"))
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
        if scenario == "head" {
            ok(f.library("alice","save",json!({"app":"cad","id":source["id"],"operation_id":"source-next","expected_revision":1,"data_base64":"eyJ4IjoxfQ=="})).await).await;
        } else {
            let id = if scenario == "source" {
                &source["id"]
            } else {
                &target["id"]
            };
            f.docs
                .grant(&token("alice"), id.as_str().unwrap(), "bob", None)
                .await
                .unwrap();
        }
        std::fs::write(release, b"go").unwrap();
        assert_eq!(
            pending.await.unwrap().status(),
            if scenario == "head" { 409 } else { 404 }
        );
        assert_eq!(
            ok(f.library("alice", "read", read(&target["id"])).await).await["revision"],
            1
        );
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and installed worker input bounds"]
async fn update_bounds_aggregate_sources_before_dispatching_edit() {
    let dir = tempfile::tempdir().unwrap();
    let config = dir.path().join("source.json");
    let edited = dir.path().join("edited");
    let script = format!(
        r#"import json,sys,pathlib
request=json.load(sys.stdin)
source=json.loads(pathlib.Path({}).read_text())
if request['service'].endswith('-edit'): pathlib.Path({}).touch()
print(json.dumps({{'result':{{'settings':{{}},'items':[],'deleted':[],'linked_sources':[{{'part_id':str(i),'source_id':source,'current':1}} for i in range(3)],'data_base64':'e30='}}}}))
"#,
        serde_json::to_string(config.to_str().unwrap()).unwrap(),
        serde_json::to_string(edited.to_str().unwrap()).unwrap()
    );
    let f = fixture(Some(&script)).await;
    let target = ok(f
        .library(
            "alice",
            "create",
            json!({"app":"cad","operation_id":"target","name":"Target.acad","data_base64":"e30="}),
        )
        .await)
    .await;
    let large = json!({"format":"aether-part","formatVersion":3,"features":[],"payload":"x".repeat(5*1024*1024)});
    let source=ok(f.library("alice","create",json!({"app":"cad","operation_id":"source","name":"Large.acpart","data_base64":STANDARD.encode(serde_json::to_vec(&large).unwrap())})).await).await;
    std::fs::write(config, serde_json::to_vec(&source["id"]).unwrap()).unwrap();
    let mut request = edit(&target["id"], "update", 1);
    request["parts"] = json!(["0", "1", "2"]);
    assert_eq!(
        f.library("alice", "cad_operation", request).await.status(),
        413
    );
    assert!(!edited.exists());
    assert_eq!(
        ok(f.library("alice", "read", read(&target["id"])).await).await["revision"],
        1
    );
}
