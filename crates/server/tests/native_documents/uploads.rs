use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
async fn call(f: &Fixture, user: &str, action: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn ok(f: &Fixture, user: &str, action: &str, input: Value) -> Value {
    let r = call(f, user, action, input).await;
    let status = r.status();
    let body: Value = r.json().await.unwrap();
    assert_eq!(status, 200, "{body}");
    body
}
async fn begin(f: &Fixture, op: &str, size: usize) -> String {
    ok(
        f,
        "alice",
        "upload_begin",
        json!({"operation_id":op,"name":format!("{op}.bin"),"size":size}),
    )
    .await["id"]
        .as_str()
        .unwrap()
        .to_string()
}
async fn chunk(f: &Fixture, id: &str, offset: usize, bytes: &[u8]) -> Value {
    ok(
        f,
        "alice",
        "upload_chunk",
        json!({"upload":id,"offset":offset,"data_base64":STANDARD.encode(bytes)}),
    )
    .await
}
async fn get(
    f: &Fixture,
    id: &str,
    revision: Option<u32>,
    range: Option<&str>,
) -> reqwest::Response {
    let mut r = f
        .client
        .get(format!(
            "{}/api/drive/download?id={id}{}",
            f.url,
            revision
                .map(|r| format!("&revision={r}"))
                .unwrap_or_default()
        ))
        .header("cookie", format!("{COOKIE}={}", token("alice")));
    if let Some(range) = range {
        r = r.header("range", range);
    }
    r.send().await.unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_resume_restart_completion_retry_ranges_and_replacement_history() {
    let f = Fixture::new().await;
    let bytes = vec![73u8; 1024 * 1024];
    let id = begin(&f, "resume", bytes.len() + 3).await;
    assert_eq!(chunk(&f, &id, 0, &bytes).await["offset"], bytes.len());
    assert_eq!(
        call(&f, "alice", "upload_finish", json!({"upload":id}))
            .await
            .status(),
        409
    );
    assert_eq!(
        call(
            &f,
            "alice",
            "upload_chunk",
            json!({"upload":id,"offset":0,"data_base64":"YWJj"})
        )
        .await
        .status(),
        409
    );
    // Reconstruct services over the same disk and DB (no process-local upload state).
    let reopened = Documents::new(
        f.pool.clone(),
        f.identity.clone(),
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    let status = reopened
        .upload(
            &token("alice"),
            "upload_status",
            &serde_json::from_value(json!({"upload":id})).unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(status["offset"], bytes.len());
    assert_eq!(
        status["chunks"][0]["digest"],
        format!("{:x}", Sha256::digest(&bytes))
    );
    chunk(&f, &id, bytes.len(), b"end").await;
    assert_eq!(
        call(
            &f,
            "alice",
            "upload_finish",
            json!({"upload":id,"sha256":"0".repeat(64)})
        )
        .await
        .status(),
        409
    );
    let (a, b) = tokio::join!(
        ok(&f, "alice", "upload_finish", json!({"upload":id})),
        ok(&f, "alice", "upload_finish", json!({"upload":id}))
    );
    assert_eq!(a["id"], b["id"]);
    assert_ne!(a["replayed"], b["replayed"]);
    assert_eq!(a["size"], bytes.len() + 3);
    let file = a["id"].as_str().unwrap();
    let copied=ok(&f,"alice","copy",json!({"id":file,"operation_id":"copy-upload","expected_revision":1,"expected_structure_revision":1,"destination":{"organization":"default"},"name":"Copy.bin"})).await;
    let copied_id = copied["file"]["id"]
        .as_str()
        .or_else(|| copied["id"].as_str())
        .expect("copy returns file");
    let copied_range = get(&f, copied_id, None, Some("bytes=1048576-")).await;
    assert_eq!(copied_range.status(), 206);
    assert_eq!(copied_range.bytes().await.unwrap(), &b"end"[..]);

    let r = get(&f, file, None, Some("bytes=1048574-1048578")).await;
    assert_eq!(r.status(), 206);
    assert_eq!(r.bytes().await.unwrap(), &b"IIend"[..]);
    let read = ok(&f, "alice", "read", json!({"id":file})).await;
    let mut full = bytes;
    full.extend(b"end");
    assert_eq!(
        STANDARD
            .decode(read["data_base64"].as_str().unwrap())
            .unwrap(),
        full
    );
    let input = json!({"operation_id":"replace","name":"ignored.bin","size":3,"id":file,"expected_revision":1});
    let replacement = ok(&f, "alice", "upload_begin", input.clone()).await;
    assert_eq!(
        ok(&f, "alice", "upload_begin", input).await["id"],
        replacement["id"]
    );
    let replacement = replacement["id"].as_str().unwrap();
    chunk(&f, replacement, 0, b"new").await;
    assert_eq!(
        ok(&f, "alice", "upload_finish", json!({"upload":replacement})).await["revision"],
        2
    );
    assert_eq!(
        get(&f, file, None, None).await.bytes().await.unwrap(),
        &b"new"[..]
    );
    assert_eq!(
        get(&f, file, Some(1), None)
            .await
            .bytes()
            .await
            .unwrap()
            .to_vec(),
        full
    );
    assert_eq!(
        ok(&f, "alice", "upload_finish", json!({"upload":id})).await["revision"],
        2
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_authority_expiry_cancellation_quotas_and_native_import() {
    let f = Fixture::new().await;
    let id = begin(&f, "private", 3).await;
    for action in ["upload_status", "upload_cancel", "upload_finish"] {
        assert_eq!(
            call(&f, "eve", action, json!({"upload":id})).await.status(),
            404
        );
    }
    chunk(&f, &id, 0, b"one").await;
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    assert_eq!(
        call(&f, "alice", "upload_finish", json!({"upload":id}))
            .await
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "drive", true, false)
        .await
        .unwrap();
    ok(&f, "alice", "upload_cancel", json!({"upload":id})).await;
    ok(&f, "alice", "upload_cancel", json!({"upload":id})).await;
    assert_eq!(
        call(&f, "alice", "upload_finish", json!({"upload":id}))
            .await
            .status(),
        409
    );
    for n in 0..8 {
        begin(&f, &format!("quota-{n}"), 0).await;
    }
    assert_eq!(
        call(
            &f,
            "alice",
            "upload_begin",
            json!({"operation_id":"ninth","name":"ninth","size":0})
        )
        .await
        .status(),
        409
    );
    f.sql("UPDATE aether_access.uploads SET created=clock_timestamp()-interval '25 hours' WHERE state='active'").await;
    let native = ok(
        &f,
        "alice",
        "upload_begin",
        json!({"operation_id":"native","name":"Show.aethermap","size":2}),
    )
    .await;
    let native = native["id"].as_str().unwrap();
    chunk(&f, native, 0, b"{}").await;
    let result = ok(&f, "alice", "upload_finish", json!({"upload":native})).await;
    assert_eq!(result["app"], "map");
    assert_eq!(
        f.docs
            .read(&token("alice"), result["id"].as_str().unwrap(), None)
            .await
            .unwrap()
            .content_base64,
        "e30="
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        call(&f, "alice", "upload_finish", json!({"upload":native}))
            .await
            .status(),
        404
    );
    assert_eq!(
        call(
            &f,
            "alice",
            "upload_begin",
            json!({"operation_id":"large","name":"large","size":536870913u64})
        )
        .await
        .status(),
        413
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_finish_rechecks_destination_revision_and_rolls_back_failed_publication() {
    let f = Fixture::new().await;
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Folder")
        .await
        .unwrap();
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let begin = ok(
        &f,
        "bob",
        "upload_begin",
        json!({"operation_id":"child","name":"child","size":0,"parent":"folder"}),
    )
    .await;
    f.docs
        .grant(&token("alice"), "folder", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        call(&f, "bob", "upload_finish", json!({"upload":begin["id"]}))
            .await
            .status(),
        404
    );
    let id = super::uploads::begin(&f, "rollback", 3).await;
    f.sql("CREATE FUNCTION reject_chunk() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_chunk BEFORE UPDATE OF chunks ON aether_access.uploads FOR EACH ROW EXECUTE FUNCTION reject_chunk()").await;
    assert!(
        !call(
            &f,
            "alice",
            "upload_chunk",
            json!({"upload":id,"offset":0,"data_base64":"YWJj"})
        )
        .await
        .status()
        .is_success()
    );
    assert_eq!(
        ok(&f, "alice", "upload_status", json!({"upload":id})).await["offset"],
        0
    );
    f.sql("DROP TRIGGER reject_chunk ON aether_access.uploads")
        .await;

    chunk(&f, &id, 0, b"abc").await;
    f.sql("CREATE FUNCTION reject_upload() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_upload BEFORE INSERT ON aether_store.revisions FOR EACH ROW EXECUTE FUNCTION reject_upload()").await;
    assert!(
        !call(&f, "alice", "upload_finish", json!({"upload":id}))
            .await
            .status()
            .is_success()
    );
    assert_eq!(
        ok(&f, "alice", "upload_status", json!({"upload":id})).await["state"],
        "active"
    );
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_access.upload_blobs", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    f.sql("DROP TRIGGER reject_upload ON aether_store.revisions")
        .await;
    let file = ok(&f, "alice", "upload_finish", json!({"upload":id})).await;
    let replace=ok(&f,"alice","upload_begin",json!({"operation_id":"stale","name":"unused","size":0,"id":file["id"],"expected_revision":1})).await;
    f.docs.mutate(&token("alice"),&mutation(json!({"operation_id":"rename","document_id":file["id"],"change":{"kind":"rename","name":"Later","expected_revision":1}}))).await.unwrap();
    assert_eq!(
        call(
            &f,
            "alice",
            "upload_finish",
            json!({"upload":replace["id"]})
        )
        .await
        .status(),
        409
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_corrupt_chunks_never_publish_and_public_descriptors_stay_forbidden() {
    let f = Fixture::new().await;
    let id = begin(&f, "corruption", 3).await;
    chunk(&f, &id, 0, b"abc").await;
    let tenant = format!("{:x}", Sha256::digest(b"company"));
    let digest = format!("{:x}", Sha256::digest(b"abc"));
    let path = f
        ._objects
        .path()
        .join("uploads-v1")
        .join(tenant)
        .join(&digest);
    std::fs::write(&path, b"bad").unwrap();
    assert!(f.docs.verify_uploads().await.is_err());
    assert!(
        !call(&f, "alice", "upload_finish", json!({"upload":id}))
            .await
            .status()
            .is_success()
    );
    assert_eq!(
        ok(&f, "alice", "upload_status", json!({"upload":id})).await["state"],
        "active"
    );
    let descriptor =
        STANDARD.encode(serde_json::to_vec(&json!({"aether_drive_blob":digest,"size":3})).unwrap());
    assert_eq!(
        call(
            &f,
            "alice",
            "create",
            json!({"operation_id":"forge","name":"Forged","app":"drive","data_base64":descriptor})
        )
        .await
        .status(),
        501
    );
    std::fs::write(path, b"abc").unwrap();
    ok(&f, "alice", "upload_finish", json!({"upload":id})).await;
    assert_eq!(f.docs.verify_uploads().await.unwrap(), 2);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_512_mib_limit_streams_without_a_whole_file_response_buffer() {
    let mut f = Fixture::new().await;
    // This transfer-size qualification runs separately with the production build.
    // The host keeps its30s request deadline; only the download client's total
    // network timeout is longer than the ordinary small-document fixture.
    f.client = reqwest::Client::builder()
        .no_proxy()
        .retry(reqwest::retry::never())
        .timeout(Duration::from_secs(120))
        .build()
        .unwrap();
    let block = vec![41u8; 1024 * 1024];
    let id = begin(&f, "limit", 512 * block.len()).await;
    let encoded = STANDARD.encode(&block);
    let mut hash = Sha256::new();
    for n in 0..512usize {
        ok(
            &f,
            "alice",
            "upload_chunk",
            json!({"upload":id,"offset":n*block.len(),"data_base64":encoded}),
        )
        .await;
        hash.update(&block);
    }
    let expected = format!("{:x}", hash.finalize());
    let saved = ok(
        &f,
        "alice",
        "upload_finish",
        json!({"upload":id,"sha256":expected}),
    )
    .await;
    let file = saved["id"].as_str().unwrap();
    assert_eq!(saved["size"], 536870912usize);
    assert_eq!(
        call(&f, "alice", "read", json!({"id":file})).await.status(),
        413
    );
    let mut response = get(&f, file, None, None).await;
    assert_eq!(response.status(), 200);
    let mut hash = Sha256::new();
    let mut size = 0;
    while let Some(chunk) = response.chunk().await.unwrap() {
        size += chunk.len();
        hash.update(chunk);
    }
    assert_eq!(size, 536870912usize);
    assert_eq!(format!("{:x}", hash.finalize()), expected);
    let tail = get(&f, file, None, Some("bytes=536870908-")).await;
    assert_eq!(tail.status(), 206);
    assert_eq!(tail.bytes().await.unwrap(), &[41u8; 4][..]);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_schema14_failed_upgrade_rolls_back_and_keeps_existing_history() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("retained"))
        .await
        .unwrap();
    let directory = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/documents");
    let names = [
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
    ];
    let mut hash = Sha256::new();
    for name in names {
        hash.update(std::fs::read(directory.join(name)).unwrap());
    }
    let checksum = format!("{:x}", hash.finalize());
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; UPDATE aether_access.schema_state SET version=13,checksum='{checksum}'; CREATE VIEW aether_access.upload_blobs AS SELECT 1 AS conflict")).await;
    assert!(f.docs.migrate().await.is_err());
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        13
    );
    assert!(
        !c.query_one(
            "SELECT to_regclass('aether_access.uploads') IS NOT NULL",
            &[]
        )
        .await
        .unwrap()
        .get::<_, bool>(0)
    );
    drop(c);
    f.sql("DROP VIEW aether_access.upload_blobs").await;
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
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn upload_dump_restore_recovers_finished_and_interrupted_files_independently() {
    use std::process::Command;
    let f = Fixture::new().await;
    let id = begin(&f, "backup-complete", 3).await;
    chunk(&f, &id, 0, b"abc").await;
    let saved = ok(&f, "alice", "upload_finish", json!({"upload":id})).await;
    let partial = begin(&f, "backup-partial", 1024 * 1024 + 1).await;
    chunk(&f, &partial, 0, &vec![9u8; 1024 * 1024]).await;
    let c = f.pool.get().await.unwrap();
    let source: String = c
        .query_one("SELECT current_database()", &[])
        .await
        .unwrap()
        .get(0);
    let destination = format!("{source}_restored");
    c.batch_execute(&format!("CREATE DATABASE {destination}"))
        .await
        .unwrap();
    drop(c);
    let base = std::env::var("AETHER_TEST_PG").unwrap();
    let binaries = std::path::PathBuf::from(std::env::var_os("AETHER_PG_BIN").unwrap());
    let backup = tempfile::tempdir().unwrap();
    let dump = backup.path().join("backup.sql");
    assert!(
        Command::new(binaries.join("pg_dump"))
            .args([
                "--dbname",
                &base.replace("dbname=postgres", &format!("dbname={source}")),
                "--no-owner",
                "--no-privileges",
                "--file"
            ])
            .arg(&dump)
            .output()
            .unwrap()
            .status
            .success()
    );
    let restored_dsn = base.replace("dbname=postgres", &format!("dbname={destination}"));
    assert!(
        Command::new(binaries.join("psql"))
            .args([
                "--dbname",
                &restored_dsn,
                "--set",
                "ON_ERROR_STOP=1",
                "--file"
            ])
            .arg(&dump)
            .output()
            .unwrap()
            .status
            .success()
    );
    fn copy(source: &std::path::Path, destination: &std::path::Path) {
        std::fs::create_dir(destination).unwrap();
        for entry in std::fs::read_dir(source).unwrap() {
            let entry = entry.unwrap();
            let dest = destination.join(entry.file_name());
            if entry.file_type().unwrap().is_dir() {
                copy(&entry.path(), &dest);
            } else {
                std::fs::copy(entry.path(), dest).unwrap();
            }
        }
    }
    let objects = backup.path().join("objects");
    copy(f._objects.path(), &objects);
    let pool = Pool::builder(Manager::new(restored_dsn.parse::<Config>().unwrap(), NoTls))
        .max_size(8)
        .runtime(Runtime::Tokio1)
        .build()
        .unwrap();
    let identity = Identity::new(pool.clone(), "company", 2).unwrap();
    let restored = Documents::new(
        pool.clone(),
        identity,
        HostedStore::new(pool.clone(), ContentStore::local(&objects).unwrap()),
    );
    restored.check_schema().await.unwrap();
    assert_eq!(restored.verify_uploads().await.unwrap(), 3);
    let file = restored
        .download(&token("alice"), saved["id"].as_str().unwrap(), None, None)
        .await
        .unwrap();
    assert_eq!(
        axum::body::to_bytes(file.content.body(0, 3), 3)
            .await
            .unwrap(),
        &b"abc"[..]
    );
    let tail =
        serde_json::from_value(json!({"upload":partial,"offset":1024*1024,"data_base64":"eA=="}))
            .unwrap();
    restored
        .upload(&token("alice"), "upload_chunk", &tail)
        .await
        .unwrap();
    let finish = serde_json::from_value(json!({"upload":partial})).unwrap();
    restored
        .upload(&token("alice"), "upload_finish", &finish)
        .await
        .unwrap();
    assert_eq!(restored.verify_uploads().await.unwrap(), 4);
    assert_eq!(
        ok(&f, "alice", "upload_status", json!({"upload":partial})).await["offset"],
        1024 * 1024
    );
}
