use super::*;
use aether_server::{
    backup::{self, Configuration},
    native::presentation::Presentation,
    settings::Settings,
};
use std::{collections::BTreeMap, path::PathBuf};
async fn fixture() -> (
    Fixture,
    tempfile::TempDir,
    Configuration,
    zeroize::Zeroizing<String>,
) {
    let f = Fixture::new().await;
    Settings::new(f.pool.clone(), f.identity.clone())
        .migrate(&Presentation::default())
        .await
        .unwrap();
    f.docs
        .mutate(&token("admin"), &create("backup-file"))
        .await
        .unwrap();
    let root = tempfile::tempdir().unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let pg_dump = PathBuf::from(std::env::var("AETHER_PG_BIN").unwrap()).join("pg_dump");
    #[cfg(unix)]
    let pg_dump = {
        use std::os::unix::fs::PermissionsExt;
        let wrapper = root.path().join("fixture-dump");
        let quote =
            |p: &std::path::Path| format!("'{}'", p.to_str().unwrap().replace('\'', "'\\''"));
        std::fs::write(
            &wrapper,
            format!(
                "#!/bin/sh\n/bin/sleep 0.3\nexec {} \"$@\" 2>{}\n",
                quote(&pg_dump),
                quote(&root.path().join("fixture-dump-errors"))
            ),
        )
        .unwrap();
        std::fs::set_permissions(&wrapper, std::fs::Permissions::from_mode(0o700)).unwrap();
        wrapper
    };
    let config = Configuration {
        pg_dump,
        objects: f._objects.path().to_owned(),
        destination: root.path().join("snapshot"),
    };
    let database: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get(0);
    let dsn = zeroize::Zeroizing::new(format!(
        "{} dbname={database}",
        std::env::var("AETHER_TEST_PG").unwrap()
    ));
    (f, root, config, dsn)
}

async fn browser_fixture() -> (
    Fixture,
    tempfile::TempDir,
    aether_server::native::backups::Backups,
) {
    let (mut f, root, config, dsn) = fixture().await;
    let backups = aether_server::native::backups::Backups::new(
        f.pool.clone(),
        "company",
        dsn,
        root.path(),
        &config.objects,
        &config.pg_dump,
        BTreeMap::new(),
    )
    .unwrap();
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let frontend = root.path().join("frontends.json");
    std::fs::write(&frontend,serde_json::to_vec(&json!({"schema":1,"studio":repo.join("studio/dist"),"session":repo.join("core/session"),"icons":repo.join("core/assets/icons"),"branding":repo.join("core/assets/branding/apps"),"apps":{}})).unwrap()).unwrap();
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_settings(Settings::new(f.pool.clone(), f.identity.clone()))
        .with_backups(backups.clone())
        .with_frontends(aether_server::native::frontends::Frontends::load(&frontend).unwrap());
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    (f, root, backups)
}
async fn backup_request(
    f: &Fixture,
    user: &str,
    path: &str,
    body: Option<Value>,
) -> reqwest::Response {
    let mut request = if let Some(body) = body {
        f.client
            .post(format!("{}{path}", f.url))
            .header("origin", &f.url)
            .json(&body)
    } else {
        f.client.get(format!("{}{path}", f.url))
    };
    if !user.is_empty() {
        request = request.header("cookie", format!("{COOKIE}={}", token(user)));
    }
    request.send().await.unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and pg_dump"]
async fn browser_backup_is_admin_only_atomic_downloadable_and_retained_after_restart() {
    let (mut f, root, _backups) = browser_fixture().await;
    for (user, status) in [("", 401), ("alice", 403)] {
        assert_eq!(
            backup_request(&f, user, "/api/admin/backup", Some(json!({})))
                .await
                .status(),
            status
        );
    }
    assert_eq!(
        backup_request(
            &f,
            "admin",
            "/api/admin/backup",
            Some(json!({"destination":"/tmp/untrusted"}))
        )
        .await
        .status(),
        400
    );
    assert_eq!(
        backup_request(&f, "admin", "/api/admin/backup", Some(json!({})))
            .await
            .status(),
        202
    );
    assert_eq!(
        backup_request(&f, "admin", "/api/admin/backup", Some(json!({})))
            .await
            .status(),
        409
    );
    let state = tokio::time::timeout(Duration::from_secs(60), async {
        loop {
            let state: Value = backup_request(&f, "admin", "/api/admin/state", None)
                .await
                .json()
                .await
                .unwrap();
            if state["storage"]["in_progress"] == false {
                break state;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(state["storage"]["error"], "");
    assert_eq!(state["backups"].as_array().unwrap().len(), 1);
    assert_eq!(state["capabilities"]["backups"], true);
    let name = state["backups"][0]["name"].as_str().unwrap();
    let path = format!("/api/admin/backups/{name}");
    assert_eq!(backup_request(&f, "alice", &path, None).await.status(), 403);
    let response = backup_request(&f, "admin", &path, None).await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let bytes = response.bytes().await.unwrap();
    assert_eq!(
        bytes.len() as u64,
        state["backups"][0]["size"].as_u64().unwrap()
    );
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
    let manifest: Value = serde_json::from_reader(zip.by_name("manifest.json").unwrap()).unwrap();
    assert_eq!(manifest["delegated_credentials_restored"], false);
    for (name, item) in manifest["files"].as_object().unwrap() {
        use std::io::Read;
        let mut bytes = Vec::new();
        zip.by_name(name).unwrap().read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes.len() as u64, item["size"].as_u64().unwrap());
        assert_eq!(
            format!("{:x}", Sha256::digest(&bytes)),
            item["sha256"].as_str().unwrap()
        );
    }
    // A new controller/HTTP listener discovers the retained archive after restart.
    let database: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get(0);
    let dsn = zeroize::Zeroizing::new(format!(
        "{} dbname={database}",
        std::env::var("AETHER_TEST_PG").unwrap()
    ));
    let dump = PathBuf::from(std::env::var("AETHER_PG_BIN").unwrap()).join("pg_dump");
    let restored = aether_server::native::backups::Backups::new(
        f.pool.clone(),
        "company",
        dsn,
        root.path(),
        f._objects.path(),
        &dump,
        BTreeMap::new(),
    )
    .unwrap();
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_settings(Settings::new(f.pool.clone(), f.identity.clone()))
        .with_backups(restored);
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    let listed: Value = backup_request(&f, "admin", "/api/admin/state", None)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(listed["backups"], state["backups"]);
    #[cfg(unix)]
    {
        let directory =
            std::path::Path::new(state["storage"]["backup_directory"].as_str().unwrap());
        let link = format!("studio-{}.zip", "a".repeat(32));
        std::os::unix::fs::symlink(root.path().join("frontends.json"), directory.join(&link))
            .unwrap();
        assert!(
            !backup_request(&f, "admin", &format!("/api/admin/backups/{link}"), None)
                .await
                .status()
                .is_success()
        );
        let listed: Value = backup_request(&f, "admin", "/api/admin/state", None)
            .await
            .json()
            .await
            .unwrap();
        assert_eq!(listed["backups"].as_array().unwrap().len(), 1);
    }
    f.sql("UPDATE aether_identity.users SET role='member' WHERE id='admin'")
        .await;
    assert_eq!(backup_request(&f, "admin", &path, None).await.status(), 403);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL, pg_dump and built Studio frontend"]
async fn actual_browser_creates_and_downloads_native_backup() {
    let (f, _root, _backups) = browser_fixture().await;
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = tokio::process::Command::new("node")
        .arg(repo.join("dev/rebuild/backup_browser.mjs"))
        .arg(&f.url)
        .arg(token("admin"))
        .output()
        .await
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{}", String::from_utf8_lossy(&output.stdout));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and pg_dump"]
async fn backup_schedule_upgrade_permissions_atomic_audit_and_due_execution() {
    let (f, _root, backups) = browser_fixture().await;
    let settings = Settings::new(f.pool.clone(), f.identity.clone());
    // Frozen schema2 upgrades without modifying presentation or identity rows.
    f.sql("DROP TABLE aether_settings.backups,aether_settings.network")
        .await;
    let mut hash = Sha256::new();
    hash.update(include_str!("../../src/settings/schema.sql"));
    hash.update(include_str!("../../src/settings/002-mail.sql"));
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_settings.schema_state SET version=2,checksum=$1",
            &[&format!("{:x}", hash.finalize())],
        )
        .await
        .unwrap();
    assert!(settings.check_schema().await.is_err());
    settings.migrate(&Presentation::default()).await.unwrap();
    settings.check_schema().await.unwrap();
    let path = "/api/admin/storage";
    assert_eq!(
        backup_request(&f, "alice", path, Some(json!({"interval_hours":24})))
            .await
            .status(),
        403
    );
    for input in [
        json!({"interval_hours":1}),
        json!({"interval_hours":24,"export_directory":"/tmp/not-allowed"}),
    ] {
        assert_eq!(
            backup_request(&f, "admin", path, Some(input))
                .await
                .status(),
            400
        );
    }
    assert_eq!(
        backup_request(&f, "admin", path, Some(json!({"interval_hours":24})))
            .await
            .status(),
        200
    );
    f.sql("ALTER TABLE aether_identity.audit ADD CONSTRAINT fail_backup_audit CHECK(action<>'backup_schedule_changed') NOT VALID").await;
    assert_eq!(
        backup_request(&f, "admin", path, Some(json!({"interval_hours":6})))
            .await
            .status(),
        503
    );
    let state: Value = backup_request(&f, "admin", "/api/admin/state", None)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(state["storage"]["interval_hours"], 24);
    f.sql("ALTER TABLE aether_identity.audit DROP CONSTRAINT fail_backup_audit")
        .await;
    backups.run_scheduled().await.unwrap();
    let state = tokio::time::timeout(Duration::from_secs(60), async {
        loop {
            let state: Value = backup_request(&f, "admin", "/api/admin/state", None)
                .await
                .json()
                .await
                .unwrap();
            if state["storage"]["in_progress"] == false {
                break state;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(state["storage"]["error"], "");
    assert_eq!(state["backups"].as_array().unwrap().len(), 1);
    backups.run_scheduled().await.unwrap(); // Not due: no duplicate archive.
    let next: Value = backup_request(&f, "admin", "/api/admin/state", None)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(next["backups"], state["backups"]);
    assert_eq!(next["storage"]["in_progress"], false);
    assert!(next["storage"]["next_backup"].as_i64().unwrap() > 0);
    assert_eq!(
        backup_request(&f, "admin", path, Some(json!({"interval_hours":0})))
            .await
            .status(),
        200
    );
    f.sql("UPDATE aether_settings.backups SET last_attempt=0")
        .await;
    backups.run_scheduled().await.unwrap(); // Disabled remains disabled after time passes.
    let next: Value = backup_request(&f, "admin", "/api/admin/state", None)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(next["backups"], state["backups"]);
    assert!(next["storage"]["next_backup"].is_null());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and pg_dump"]
async fn native_recovery_snapshot_restores_database_objects_and_excludes_live_keys() {
    let (f, root, config, dsn) = fixture().await;
    let content = ContentStore::local(f._objects.path()).unwrap();
    let store = HostedStore::new(f.pool.clone(), content);
    let media = b"native upload chunk".to_vec();
    let digest = store
        .put_upload_chunk(
            &aether_store::hosted::AuthorizedScope::new("company", "admin").unwrap(),
            media.clone(),
        )
        .await
        .unwrap();
    let parts = json!([{"digest":digest,"size":media.len()}]);
    f.pool.get().await.unwrap().execute("INSERT INTO aether_access.upload_blobs(tenant,digest,size,chunks) VALUES('company',$1,$2,$3)",&[&digest,&(media.len() as i64),&parts]).await.unwrap();
    let report = backup::create(
        f.pool.clone(),
        "company".into(),
        dsn.clone(),
        config.clone(),
        BTreeMap::from([("workspaces/admin/example.txt".into(), b"workspace".to_vec())]),
    )
    .await
    .unwrap_or_else(|e| {
        panic!(
            "{e} {}",
            std::fs::read_to_string(root.path().join("fixture-dump-errors")).unwrap_or_default()
        )
    });
    assert_eq!(report["sessions_restored"], false);
    assert_eq!(report["files"].as_object().unwrap().len(), 4);
    assert_eq!(
        std::fs::read(config.destination.join("workspaces/admin/example.txt")).unwrap(),
        b"workspace"
    );
    let sql = std::fs::read(config.destination.join("native.sql")).unwrap();
    let restore = format!(
        "backup_restore_{}_{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    f.pool
        .get()
        .await
        .unwrap()
        .batch_execute(&format!("CREATE DATABASE {restore}"))
        .await
        .unwrap();
    let restored_dsn = format!("{} dbname={restore}", dsn.as_str());
    let result = tokio::process::Command::new(
        PathBuf::from(std::env::var("AETHER_PG_BIN").unwrap()).join("psql"),
    )
    .env_clear()
    .arg("--dbname")
    .arg(&restored_dsn)
    .args(["-X", "-v", "ON_ERROR_STOP=1"])
    .stdin(std::fs::File::open(config.destination.join("native.sql")).unwrap())
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::piped())
    .kill_on_drop(true)
    .output()
    .await
    .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let pool = aether_server::native::configuration::local_pool(&restored_dsn).unwrap();
    let identity = Identity::new(pool.clone(), "company", 2).unwrap();
    identity.check_schema().await.unwrap();
    assert_eq!(
        pool.get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_identity.sessions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    assert_eq!(
        pool.get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_identity.users", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        4
    );
    let store = HostedStore::new(
        pool.clone(),
        ContentStore::local(config.destination.join("objects")).unwrap(),
    );
    let checked = store
        .verify(&aether_store::hosted::AuthorizedScope::new("company", "backup-audit").unwrap())
        .await
        .unwrap();
    let restored_docs = Documents::new(pool, identity, store.clone());
    assert_eq!(restored_docs.verify_uploads().await.unwrap(), 1);
    assert_eq!(checked.documents, 1);
    assert_eq!(checked.revisions, 1);
    assert_eq!(
        report["files"]["native.sql"]["sha256"],
        format!("{:x}", Sha256::digest(sql))
    );
    assert!(
        backup::create(
            f.pool.clone(),
            "company".into(),
            dsn,
            config,
            BTreeMap::new()
        )
        .await
        .is_err()
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL and pg_dump"]
async fn snapshot_refuses_other_tenants_corrupt_objects_and_untrusted_extra_paths() {
    let (f, _root, config, dsn) = fixture().await;
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role) VALUES('other-company','other','other','private-fixture','admin')").await;
    assert!(
        backup::create(
            f.pool.clone(),
            "company".into(),
            dsn.clone(),
            config.clone(),
            BTreeMap::new()
        )
        .await
        .is_err()
    );
    assert!(!config.destination.exists());
    f.sql("DELETE FROM aether_identity.users WHERE tenant='other-company'")
        .await;
    assert!(
        backup::create(
            f.pool.clone(),
            "company".into(),
            dsn.clone(),
            config.clone(),
            BTreeMap::from([("workspaces/../../escape".into(), vec![1])])
        )
        .await
        .is_err()
    );
    assert!(!config.destination.exists());
    let key = format!(
        "v1/{:x}/{:x}",
        Sha256::digest(b"company"),
        Sha256::digest(b"{}")
    );
    std::fs::write(config.objects.join(&key), b"xx").unwrap();
    assert!(
        backup::create(
            f.pool.clone(),
            "company".into(),
            dsn,
            config.clone(),
            BTreeMap::new()
        )
        .await
        .is_err()
    );
    assert!(!config.destination.exists());
}
#[cfg(unix)]
#[tokio::test]
#[ignore = "disposable PostgreSQL and pg_dump"]
async fn exported_snapshot_keeps_database_and_objects_consistent_during_saves() {
    use std::os::unix::fs::PermissionsExt;
    let (f, root, mut config, dsn) = fixture().await;
    let wrapper = root.path().join("delayed-dump");
    let marker = root.path().join("snapshot-started");
    let quote = |p: &std::path::Path| format!("'{}'", p.to_str().unwrap().replace('\'', "'\\''"));
    std::fs::write(
        &wrapper,
        format!(
            "#!/bin/sh\n/usr/bin/touch {}\n/bin/sleep 1\nexec {} \"$@\"\n",
            quote(&marker),
            quote(&config.pg_dump)
        ),
    )
    .unwrap();
    std::fs::set_permissions(&wrapper, std::fs::Permissions::from_mode(0o700)).unwrap();
    config.pg_dump = wrapper;
    let task = tokio::spawn(backup::create(
        f.pool.clone(),
        "company".into(),
        dsn,
        config.clone(),
        BTreeMap::new(),
    ));
    tokio::time::timeout(Duration::from_secs(15), async {
        while !marker.exists() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    f.docs
        .mutate(&token("admin"), &save("backup-file", "during-backup", 1))
        .await
        .unwrap();
    let report = task.await.unwrap().unwrap_or_else(|e| {
        panic!(
            "{e} {}",
            std::fs::read_to_string(root.path().join("fixture-dump-errors")).unwrap_or_default()
        )
    });
    assert_eq!(report["files"].as_object().unwrap().len(), 2);
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
    let sql = std::fs::read_to_string(config.destination.join("native.sql")).unwrap();
    assert!(!sql.contains("during-backup"));
}
