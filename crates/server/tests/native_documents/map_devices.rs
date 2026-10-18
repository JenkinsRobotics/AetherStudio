use super::*;

fn announcement(id: &str) -> Value {
    json!({"device_id":id,"name":"Workshop Pi","pairing_secret":"private-device-possession-proof-0123456789"})
}
async fn ok(response: reqwest::Response) -> Value {
    let status = response.status();
    let value = response.json::<Value>().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
async fn announce(f: &Fixture, input: Value, credential: Option<&str>) -> reqwest::Response {
    let mut request = f
        .client
        .post(format!("{}/api/map/devices/announce", f.url))
        .json(&input);
    if let Some(token) = credential {
        request = request.bearer_auth(token);
    }
    request.send().await.unwrap()
}
async fn action(f: &Fixture, user: &str, action: &str, value: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/map/devices/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&value)
        .send()
        .await
        .unwrap()
}
async fn show(f: &Fixture, credential: &str) -> reqwest::Response {
    f.client
        .get(format!("{}/api/map/device/show", f.url))
        .bearer_auth(credential)
        .send()
        .await
        .unwrap()
}
async fn paired(f: &Fixture, id: &str, user: &str) -> String {
    let hello = ok(announce(f, announcement(id), None).await).await;
    ok(action(f, user, "claim", json!({"code":hello["code"]})).await).await;
    ok(announce(f, announcement(id), None).await).await["token"]
        .as_str()
        .unwrap()
        .into()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn device_lifecycle_current_show_and_private_bearer_storage() {
    let f = Fixture::new().await;
    let first = ok(announce(&f, announcement("pi"), None).await).await;
    assert_eq!(first["claimed"], false);
    assert_eq!(
        first,
        ok(announce(&f, announcement("pi"), None).await).await
    );
    ok(action(&f, "alice", "claim", json!({"code":first["code"]})).await).await;
    assert_eq!(
        action(&f, "bob", "claim", json!({"code":first["code"]}))
            .await
            .status(),
        404
    );
    let claimed = ok(announce(&f, announcement("pi"), None).await).await;
    let credential = claimed["token"].as_str().unwrap();
    assert_eq!(claimed["owner"], "alice");
    let row = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT pairing_hash,token_hash,code FROM aether_access.map_devices",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, String>(0).len(), 64);
    assert_eq!(
        row.get::<_, String>(1),
        format!("{:x}", Sha256::digest(credential))
    );
    assert_eq!(row.get::<_, Option<String>>(2), None);
    assert_eq!(ok(show(&f, credential).await).await["show"], Value::Null);
    f.docs
        .mutate(&token("alice"), &create("show"))
        .await
        .unwrap();
    ok(action(
        &f,
        "alice",
        "assign",
        json!({"device_id":"pi","document":"show"}),
    )
    .await)
    .await;
    let delivered = ok(show(&f, credential).await).await;
    assert_eq!(delivered["show"]["layout_base64"], "e30=");
    f.docs
        .mutate(&token("alice"), &save("show", "new-show", 1))
        .await
        .unwrap();
    assert_eq!(ok(show(&f, credential).await).await["show"]["revision"], 2);
    ok(action(
        &f,
        "alice",
        "rename",
        json!({"device_id":"pi","name":"Stage"}),
    )
    .await)
    .await;
    let mine = ok(action(&f, "alice", "list", json!({})).await).await;
    assert_eq!(mine["devices"][0]["name"], "Stage");
    assert_eq!(mine["devices"][0]["document"], "show");
    let others = ok(action(&f, "bob", "list", json!({})).await).await;
    assert_eq!(others["devices"][0]["document"], Value::Null);
    assert_eq!(others["devices"][0]["mine"], false);
    assert!(!others.to_string().contains(credential));
    for who in ["bob", "admin"] {
        assert_eq!(
            action(&f, who, "forget", json!({"device_id":"pi"}))
                .await
                .status(),
            404
        );
    }
    ok(action(
        &f,
        "alice",
        "assign",
        json!({"device_id":"pi","document":null}),
    )
    .await)
    .await;
    assert_eq!(ok(show(&f, credential).await).await["show"], Value::Null);
    ok(action(&f, "alice", "forget", json!({"device_id":"pi"})).await).await;
    assert_eq!(show(&f, credential).await.status(), 401);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn possession_recovery_rotation_and_expired_codes() {
    let f = Fixture::new().await;
    let hello = ok(announce(&f, announcement("pi"), None).await).await;
    let mut impostor = announcement("pi");
    impostor["pairing_secret"] = json!("different-private-possession-proof-0123456789");
    assert_eq!(announce(&f, impostor.clone(), None).await.status(), 401);
    f.sql(
        "UPDATE aether_access.map_devices SET code_expires=clock_timestamp()-interval '1 second'",
    )
    .await;
    assert_eq!(
        action(&f, "alice", "claim", json!({"code":hello["code"]}))
            .await
            .status(),
        404
    );
    let refreshed = ok(announce(&f, announcement("pi"), None).await).await;
    assert_ne!(refreshed["code"], hello["code"]);
    ok(action(&f, "alice", "claim", json!({"code":refreshed["code"]})).await).await;
    let first = ok(announce(&f, announcement("pi"), None).await).await;
    let token1 = first["token"].as_str().unwrap();
    assert_eq!(
        ok(announce(&f, impostor, Some(token1)).await).await["token"],
        token1
    );
    let second = ok(announce(&f, announcement("pi"), None).await).await;
    let token2 = second["token"].as_str().unwrap();
    assert_ne!(token1, token2);
    assert_eq!(show(&f, token1).await.status(), 401);
    ok(show(&f, token2).await).await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn assignments_recheck_file_account_and_app_authority_on_every_pull() {
    let f = Fixture::new().await;
    let player = paired(&f, "pi", "alice").await;
    f.docs
        .mutate(&token("bob"), &create("private"))
        .await
        .unwrap();
    let assignment = json!({"device_id":"pi","document":"private"});
    assert_eq!(
        action(&f, "alice", "assign", assignment.clone())
            .await
            .status(),
        404
    );
    f.docs
        .grant(&token("bob"), "private", "alice", Some(Role::Viewer))
        .await
        .unwrap();
    ok(action(&f, "alice", "assign", assignment).await).await;
    assert_eq!(ok(show(&f, &player).await).await["show"]["id"], "private");
    f.docs
        .grant(&token("bob"), "private", "alice", None)
        .await
        .unwrap();
    assert_eq!(ok(show(&f, &player).await).await["show"], Value::Null);
    f.docs
        .grant(&token("bob"), "private", "alice", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(ok(show(&f, &player).await).await["show"]["id"], "private");
    f.docs
        .configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    assert_eq!(show(&f, &player).await.status(), 404);
    f.docs
        .configure_app(&token("admin"), "map", true, false)
        .await
        .unwrap();
    f.identity
        .set_account_state(
            &token("admin"),
            "alice",
            aether_identity::Role::Member,
            false,
        )
        .await
        .unwrap();
    assert_eq!(show(&f, &player).await.status(), 401);
    assert_eq!(
        announce(&f, announcement("pi"), Some(&player))
            .await
            .status(),
        401
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn device_credentials_never_authorize_browser_agent_or_cross_site_calls() {
    let f = Fixture::new().await;
    let player = paired(&f, "pi", "alice").await;
    for path in [
        "/api/map/devices/list",
        "/api/library/list",
        "/api/automation/commands/list",
    ] {
        assert_eq!(
            f.client
                .post(format!("{}{path}", f.url))
                .bearer_auth(&player)
                .header("origin", &f.url)
                .json(&json!({}))
                .send()
                .await
                .unwrap()
                .status(),
            401
        );
    }
    assert_eq!(
        f.client
            .get(format!("{}/api/map/device/show", f.url))
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(
        f.client
            .get(format!("{}/api/map/device/show", f.url))
            .bearer_auth(&player)
            .header("cookie", "arbitrary=1")
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(
        f.client
            .post(format!("{}/api/map/devices/announce", f.url))
            .header("origin", "https://evil.test")
            .json(&announcement("evil"))
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    assert_eq!(
        f.client
            .post(format!("{}/api/map/devices/list", f.url))
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .json(&json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    assert_eq!(show(&f, &token("alice")).await.status(), 401);
    assert_eq!(
        action(
            &f,
            "alice",
            "assign",
            json!({"device_id":"pi","document":null,"owner":"bob"})
        )
        .await
        .status(),
        400
    );
    assert_eq!(
        f.client
            .get(format!("{}/api/map/device/show?token={player}", f.url))
            .send()
            .await
            .unwrap()
            .status(),
        400
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn registration_validation_caps_and_pairing_guess_limits_are_durable() {
    let f = Fixture::new().await;
    for id in ["", "../pi", "has space"] {
        assert_eq!(announce(&f, announcement(id), None).await.status(), 400);
    }
    let mut input = announcement("bad");
    input["pairing_secret"] = json!("public");
    assert_eq!(announce(&f, input, None).await.status(), 400);
    let hello = ok(announce(&f, announcement("pi"), None).await).await;
    for _ in 0..12 {
        assert_eq!(
            action(&f, "alice", "claim", json!({"code":"invalid"}))
                .await
                .status(),
            404
        );
    }
    assert_eq!(
        action(&f, "alice", "claim", json!({"code":hello["code"]}))
            .await
            .status(),
        429
    );
    ok(action(&f, "bob", "claim", json!({"code":hello["code"]})).await).await;
    f.sql(
        "UPDATE aether_access.map_device_limits SET started=clock_timestamp()-interval '2 minutes'",
    )
    .await;
    for i in 1..64 {
        ok(announce(&f, announcement(&format!("pi-{i}")), None).await).await;
    }
    assert_eq!(
        announce(&f, announcement("overflow"), None).await.status(),
        409
    );
    f.sql("UPDATE aether_access.map_device_limits SET attempts=1024,started=clock_timestamp() WHERE bucket='announcements'").await;
    assert_eq!(announce(&f, announcement("pi"), None).await.status(), 429);
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(announce(&f, announcement("pi"), None).await.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn concurrent_claims_and_forgotten_device_credentials_have_single_owner() {
    let f = Fixture::new().await;
    let hello = ok(announce(&f, announcement("pi"), None).await).await;
    let input = json!({"code":hello["code"]});
    let (a, b) = tokio::join!(
        action(&f, "alice", "claim", input.clone()),
        action(&f, "bob", "claim", input)
    );
    assert_eq!(
        [a.status().as_u16(), b.status().as_u16()]
            .iter()
            .filter(|&&s| s == 200)
            .count(),
        1
    );
    assert_eq!(
        [a.status().as_u16(), b.status().as_u16()]
            .iter()
            .filter(|&&s| s == 404)
            .count(),
        1
    );
    let paired = ok(announce(&f, announcement("pi"), None).await).await;
    let owner = paired["owner"].as_str().unwrap();
    let player = paired["token"].as_str().unwrap();
    ok(action(&f, owner, "forget", json!({"device_id":"pi"})).await).await;
    assert_eq!(show(&f, player).await.status(), 401);
    let again = ok(announce(&f, announcement("pi"), None).await).await;
    assert_eq!(again["claimed"], false);
    assert_eq!(show(&f, player).await.status(), 401);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn additive_schema18_upgrade_preserves_content_and_requires_explicit_migration() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("retained"))
        .await
        .unwrap();
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/documents");
    let mut sources: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|p| p.unwrap().path())
        .filter(|p| {
            p.extension().is_some_and(|e| e == "sql")
                && p.file_name().unwrap() != "018-map-devices.sql"
                && p.file_name().unwrap() < std::ffi::OsStr::new("019")
                && p.file_name().unwrap() != "schema.sql"
        })
        .collect();
    sources.sort();
    sources.insert(0, dir.join("schema.sql"));
    let mut hash = Sha256::new();
    for path in sources {
        hash.update(std::fs::read(path).unwrap());
    }
    let checksum = format!("{:x}", hash.finalize());
    f.sql("DROP TABLE aether_access.live_editor_calls,aether_access.live_editors,aether_access.workspace_files, aether_access.team_labels, aether_access.map_media_refs, aether_access.map_media, aether_access.map_cast, aether_access.map_devices,aether_access.map_device_limits")
        .await;
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_access.schema_state SET version=17,checksum=$1",
            &[&checksum],
        )
        .await
        .unwrap();
    assert!(f.docs.check_schema().await.is_err());
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(
        f.docs
            .read(&token("alice"), "retained", None)
            .await
            .unwrap()
            .content_base64,
        "e30="
    );
    paired(&f, "pi", "alice").await;
    f.docs.migrate().await.unwrap();
    assert_eq!(
        ok(action(&f, "alice", "list", json!({})).await).await["devices"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and real Map player"]
async fn existing_python_player_pairs_and_stops_cached_show_on_revocation() {
    let f = Fixture::new().await;
    let root = tempfile::tempdir().unwrap();
    let script = r#"
import importlib.util,json,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('aether_player',sys.argv[1])
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
root=Path(sys.argv[2]);path=root/'player.json'
config=json.loads(path.read_text()) if path.exists() else {'server_url':sys.argv[3],'device_id':'python-pi','show_dir':str(root/'show'),'port':8777,'_path':str(path)}
config['_path']=str(path)
if sys.argv[4]=='announce':
    p.announce(config)
    assert config.get('_pairing')
    print(json.dumps(config['_pairing']))
elif sys.argv[4]=='read':
    assert config.get('token')
    payload=json.loads(p.request(config,'/api/map/device/show'))
    assert payload['show']['id']=='python-show'
    target=Path(config['show_dir']);target.mkdir(exist_ok=True)
    (target/'layout.json').write_text('{"activeSceneId":"cached"}')
    config.update(document='python-show',revision=1);p.save_config(config)
    print('{}')
else:
    p.pull_show(config)
    assert json.loads((Path(config['show_dir'])/'layout.json').read_text())['activeSceneId']=='stopped'
    assert 'document' not in json.loads(path.read_text())
    print('{}')
"#;
    let player = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../Aether-Map/player/aether_player.py");
    async fn run(
        script: &str,
        player: &std::path::Path,
        root: &std::path::Path,
        url: &str,
        phase: &str,
    ) -> Value {
        let out = tokio::process::Command::new("python3")
            .args(["-I", "-c", script])
            .arg(player)
            .arg(root)
            .arg(url)
            .arg(phase)
            .output()
            .await
            .unwrap();
        assert!(
            out.status.success(),
            "{}",
            String::from_utf8_lossy(&out.stderr)
        );
        serde_json::from_slice(&out.stdout).unwrap()
    }
    let first = run(script, &player, root.path(), &f.url, "announce").await;
    ok(action(&f, "alice", "claim", json!({"code":first["code"]})).await).await;
    assert_eq!(
        run(script, &player, root.path(), &f.url, "announce").await["claimed"],
        true
    );
    f.docs
        .mutate(&token("alice"), &create("python-show"))
        .await
        .unwrap();
    ok(action(
        &f,
        "alice",
        "assign",
        json!({"device_id":"python-pi","document":"python-show"}),
    )
    .await)
    .await;
    run(script, &player, root.path(), &f.url, "read").await;
    ok(action(&f, "alice", "forget", json!({"device_id":"python-pi"})).await).await;
    run(script, &player, root.path(), &f.url, "stop").await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn assignment_audit_failure_rolls_back_and_disabled_accounts_do_not_poll() {
    let f = Fixture::new().await;
    let player = paired(&f, "pi", "alice").await;
    f.docs
        .mutate(&token("alice"), &create("show"))
        .await
        .unwrap();
    f.sql("CREATE FUNCTION fail_device_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='map_device_assign' THEN RAISE EXCEPTION 'fixture rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_device_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION fail_device_audit()").await;
    assert_eq!(
        action(
            &f,
            "alice",
            "assign",
            json!({"device_id":"pi","document":"show"})
        )
        .await
        .status(),
        503
    );
    assert_eq!(ok(show(&f, &player).await).await["show"], Value::Null);
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(show(&f, &player).await.status(), 403);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn polling_waits_for_revocation_commit_and_never_uses_a_stale_permit() {
    let f = Fixture::new().await;
    let player = paired(&f, "pi", "alice").await;
    f.docs
        .mutate(&token("bob"), &create("shared-show"))
        .await
        .unwrap();
    f.docs
        .grant(&token("bob"), "shared-show", "alice", Some(Role::Viewer))
        .await
        .unwrap();
    ok(action(
        &f,
        "alice",
        "assign",
        json!({"device_id":"pi","document":"shared-show"}),
    )
    .await)
    .await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let docs = f.docs.clone();
    let pending = tokio::spawn(async move { docs.map_device_show(&player).await });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))")
        .await;
    tx.execute(
        "DELETE FROM aether_access.grants WHERE resource='shared-show' AND user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().unwrap()["show"], Value::Null);
}

async fn cast_player(f: &Fixture, player: &str, input: Option<Value>) -> reqwest::Response {
    let url = format!("{}/api/map/device/cast", f.url);
    let request = if let Some(input) = input {
        f.client.post(url).json(&input)
    } else {
        f.client.get(url)
    };
    request.bearer_auth(player).send().await.unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn cast_offer_answer_lease_stop_and_saved_show_are_independent() {
    let f = Fixture::new().await;
    let player = paired(&f, "pi", "alice").await;
    f.docs
        .mutate(&token("alice"), &create("show"))
        .await
        .unwrap();
    ok(action(
        &f,
        "alice",
        "assign",
        json!({"device_id":"pi","document":"show"}),
    )
    .await)
    .await;
    assert_eq!(
        ok(cast_player(&f, &player, None).await).await["session"],
        Value::Null
    );
    let input = json!({"device_id":"pi","sdp":"v=0\r\no=fixture-offer"});
    assert_eq!(
        action(&f, "bob", "cast-start", input.clone())
            .await
            .status(),
        404
    );
    let started = ok(action(&f, "alice", "cast-start", input.clone()).await).await;
    assert_eq!(started["state"], "waiting");
    let session = started["session_id"].clone();
    assert_eq!(action(&f, "alice", "cast-start", input).await.status(), 409);
    let offer = ok(cast_player(&f, &player, None).await).await;
    assert_eq!(offer["session"]["id"], session);
    assert_eq!(offer["session"]["offer"]["type"], "offer");
    assert_eq!(
        cast_player(
            &f,
            &player,
            Some(json!({"session_id":"wrong","state":"connected"}))
        )
        .await
        .status(),
        409
    );
    ok(cast_player(
        &f,
        &player,
        Some(json!({"session_id":session,"state":"connecting","sdp":"v=0\r\no=fixture-answer"})),
    )
    .await)
    .await;
    let poll = json!({"device_id":"pi","session_id":session});
    let answer = ok(action(&f, "alice", "cast-poll", poll.clone()).await).await;
    assert_eq!(answer["answer"]["type"], "answer");
    assert_eq!(answer["state"], "connecting");
    assert_eq!(ok(show(&f, &player).await).await["show"]["id"], "show");
    ok(action(&f, "alice", "cast-stop", poll.clone()).await).await;
    assert_eq!(
        ok(cast_player(&f, &player, None).await).await["session"],
        Value::Null
    );
    assert_eq!(action(&f, "alice", "cast-poll", poll).await.status(), 409);
    assert_eq!(ok(show(&f, &player).await).await["show"]["revision"], 1);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn cast_expiration_rotation_revocation_and_body_limits() {
    let f = Fixture::new().await;
    let player = paired(&f, "pi", "alice").await;
    for sdp in ["invalid".to_owned(), format!("v=0{}", "a".repeat(65536))] {
        assert_eq!(
            action(
                &f,
                "alice",
                "cast-start",
                json!({"device_id":"pi","sdp":sdp})
            )
            .await
            .status(),
            400
        );
    }
    assert_eq!(
        action(
            &f,
            "alice",
            "cast-start",
            json!({"device_id":"pi","sdp":"x".repeat(71000)})
        )
        .await
        .status(),
        413
    );
    let start = json!({"device_id":"pi","sdp":"v=0"});
    let first = ok(action(&f, "alice", "cast-start", start.clone()).await).await;
    f.sql("UPDATE aether_access.map_cast SET expires=clock_timestamp()-interval '1 second'")
        .await;
    assert_eq!(
        ok(cast_player(&f, &player, None).await).await["session"],
        Value::Null
    );
    assert_eq!(
        cast_player(
            &f,
            &player,
            Some(json!({"session_id":first["session_id"],"state":"connected"}))
        )
        .await
        .status(),
        409
    );
    let second = ok(action(&f, "alice", "cast-start", start.clone()).await).await;
    assert_ne!(first["session_id"], second["session_id"]);
    let new = ok(announce(&f, announcement("pi"), None).await).await;
    let newtoken = new["token"].as_str().unwrap();
    assert_eq!(cast_player(&f, &player, None).await.status(), 401);
    assert_eq!(
        ok(cast_player(&f, newtoken, None).await).await["session"],
        Value::Null
    );
    ok(action(&f, "alice", "cast-start", start).await).await;
    ok(action(&f, "alice", "forget", json!({"device_id":"pi"})).await).await;
    assert_eq!(cast_player(&f, newtoken, None).await.status(), 401);
    let rows: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT count(*) FROM aether_access.map_cast", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(rows, 0);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and Chromium"]
async fn actual_map_players_panel_pairs_renames_assigns_stops_and_forgets() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("browser-show"))
        .await
        .unwrap();
    let announcement = ok(announce(&f, announcement("browser-pi"), None).await).await;
    let output = tokio::process::Command::new(
        std::env::var("AETHER_TEST_NODE").unwrap_or_else(|_| "node".into()),
    )
    .arg(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../dev/rebuild/map_devices_browser.mjs"),
    )
    .arg(&f.url)
    .arg(token("alice"))
    .arg(announcement["code"].as_str().unwrap())
    .output()
    .await
    .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{}", String::from_utf8_lossy(&output.stdout));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn initial_device_credential_lookups_have_database_lock_deadlines() {
    let f = Fixture::new().await;
    let player = paired(&f, "pi", "alice").await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.batch_execute("LOCK TABLE aether_access.map_devices IN ACCESS EXCLUSIVE MODE")
        .await
        .unwrap();
    let input: aether_server::documents::map_devices::Announcement =
        serde_json::from_value(announcement("pi")).unwrap();
    let responses = tokio::time::timeout(Duration::from_secs(6), async {
        tokio::join!(
            f.docs.map_device_show(&player),
            f.docs.map_player_cast(&player, None),
            f.docs.map_announce(&input, Some(&player))
        )
    })
    .await
    .expect("Initial proof lookups must time out inside PostgreSQL, not just the HTTP future");
    assert!(matches!(responses.0, Err(Error::Unavailable)));
    assert!(matches!(responses.1, Err(Error::Unavailable)));
    assert!(matches!(responses.2, Err(Error::Unavailable)));
    tx.commit().await.unwrap();
    ok(show(&f, &player).await).await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn live_receiver_kind_is_immutable_and_cannot_receive_saved_show() {
    let f = Fixture::new().await;
    let mut input = announcement("tv");
    input["kind"] = json!("live_receiver");
    let hello = ok(announce(&f, input.clone(), None).await).await;
    assert_eq!(hello["kind"], "live_receiver");
    ok(action(&f, "alice", "claim", json!({"code":hello["code"]})).await).await;
    let paired = ok(announce(&f, input.clone(), None).await).await;
    let credential = paired["token"].as_str().unwrap();
    assert_eq!(paired["kind"], "live_receiver");
    // Old clients omitting kind cannot silently change an existing receiver.
    let legacy = ok(announce(&f, announcement("tv"), Some(credential)).await).await;
    assert_eq!(legacy["kind"], "live_receiver");
    input["kind"] = json!("player");
    assert_eq!(
        announce(&f, input.clone(), Some(credential)).await.status(),
        409
    );
    input["kind"] = json!("future");
    assert_eq!(announce(&f, input, Some(credential)).await.status(), 400);
    let list = ok(action(&f, "alice", "list", json!({})).await).await;
    assert_eq!(list["devices"][0]["kind"], "live_receiver");
    f.docs
        .mutate(&token("alice"), &create("tv-show"))
        .await
        .unwrap();
    assert_eq!(
        action(
            &f,
            "alice",
            "assign",
            json!({"device_id":"tv","document":"tv-show"})
        )
        .await
        .status(),
        400
    );
    assert_eq!(
        action(
            &f,
            "bob",
            "assign",
            json!({"device_id":"tv","document":"tv-show"})
        )
        .await
        .status(),
        404
    );
    assert!(
        f.pool
            .get()
            .await
            .unwrap()
            .execute(
                "UPDATE aether_access.map_devices SET document='tv-show' WHERE id='tv'",
                &[]
            )
            .await
            .is_err()
    );
    ok(action(
        &f,
        "alice",
        "assign",
        json!({"device_id":"tv","document":null}),
    )
    .await)
    .await;
    let cast = ok(action(
        &f,
        "alice",
        "cast-start",
        json!({"device_id":"tv","sdp":"v=0\r\n"}),
    )
    .await)
    .await;
    let offer = ok(cast_player(&f, credential, None).await).await;
    assert_eq!(offer["session"]["id"], cast["session_id"]);
    ok(cast_player(
        &f,
        credential,
        Some(json!({"session_id":cast["session_id"],"sdp":"v=0\r\n","state":"connected"})),
    )
    .await)
    .await;
    assert_eq!(ok(show(&f, credential).await).await["show"], Value::Null);
    ok(action(&f, "alice", "forget", json!({"device_id":"tv"})).await).await;
    assert_eq!(cast_player(&f, credential, None).await.status(), 401);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn schema22_upgrade_preserves_deployed_player_and_requires_explicit_migration() {
    let f = Fixture::new().await;
    let credential = paired(&f, "retained-pi", "alice").await;
    f.docs
        .mutate(&token("alice"), &create("retained-show"))
        .await
        .unwrap();
    ok(action(
        &f,
        "alice",
        "assign",
        json!({"device_id":"retained-pi","document":"retained-show"}),
    )
    .await)
    .await;
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/documents");
    let mut sources: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|p| p.unwrap().path())
        .filter(|p| {
            p.extension().is_some_and(|e| e == "sql")
                && p.file_name().unwrap() < std::ffi::OsStr::new("023")
        })
        .collect();
    sources.sort();
    sources.insert(0, dir.join("schema.sql"));
    let mut hash = Sha256::new();
    for p in sources {
        hash.update(std::fs::read(p).unwrap());
    }
    f.sql("ALTER TABLE aether_access.map_devices DROP COLUMN kind CASCADE")
        .await;
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_access.schema_state SET version=22,checksum=$1",
            &[&format!("{:x}", hash.finalize())],
        )
        .await
        .unwrap();
    assert!(f.docs.check_schema().await.is_err());
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(
        ok(show(&f, &credential).await).await["show"]["id"],
        "retained-show"
    );
    assert_eq!(
        ok(action(&f, "alice", "list", json!({})).await).await["devices"][0]["kind"],
        "player"
    );
}
