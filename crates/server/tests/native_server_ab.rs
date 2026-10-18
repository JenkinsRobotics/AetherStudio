//! Release-mode, real HTTP comparison. Run only with the disposable PG runner.
use aether_identity::Identity;
use aether_server::{
    documents::Documents,
    native::{COOKIE, NativeHost, router},
};
use aether_store::hosted::{ContentStore, HostedStore};
use deadpool_postgres::{Manager, Pool, Runtime};
use sha2::{Digest, Sha256};
use std::{net::SocketAddr, path::PathBuf, time::Duration};
use tokio_postgres::{Config, NoTls};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "release build, private PostgreSQL and explicit original source/evidence paths"]
#[allow(clippy::assertions_on_constants)] // Reject accidental debug benchmark execution.
async fn matched_original_and_native_server_workloads() {
    // This ignored test is intentionally unusable in the default debug build.
    assert!(
        !cfg!(debug_assertions),
        "Use --release for a performance comparison"
    );
    let mut config: Config = std::env::var("AETHER_TEST_PG").unwrap().parse().unwrap();
    let pool = |c| {
        Pool::builder(Manager::new(c, NoTls))
            .max_size(8)
            .runtime(Runtime::Tokio1)
            .wait_timeout(Some(Duration::from_secs(5)))
            .create_timeout(Some(Duration::from_secs(5)))
            .recycle_timeout(Some(Duration::from_secs(5)))
            .build()
            .unwrap()
    };
    let admin = pool(config.clone());
    admin
        .get()
        .await
        .unwrap()
        .batch_execute("CREATE DATABASE aether_server_ab")
        .await
        .unwrap();
    admin.close();
    config.dbname("aether_server_ab");
    let pool = pool(config);
    let mut storage = serde_json::Map::new();
    storage.insert("pool_connections".into(), 8.into());
    storage.insert("document_handlers".into(), 4.into());
    storage.insert("document_slots".into(), 20.into());
    for key in [
        "server_version",
        "fsync",
        "synchronous_commit",
        "wal_sync_method",
        "full_page_writes",
    ] {
        let value: String = pool
            .get()
            .await
            .unwrap()
            .query_one(&format!("SHOW {key}"), &[])
            .await
            .unwrap()
            .get(0);
        storage.insert(key.into(), value.into());
    }
    let identity = Identity::new(pool.clone(), "ab-fixture", 2).unwrap();
    identity.migrate().await.unwrap();
    let settings = aether_server::settings::Settings::new(pool.clone(), identity.clone());
    settings.migrate(&Default::default()).await.unwrap();
    let token = format!("{:x}", Sha256::digest("disposable-ab-fixture-session"));
    let c = pool.get().await.unwrap();
    c.execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('ab-fixture','editor','editor','unused-fixture-password','admin',false)", &[]).await.unwrap();
    c.execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES('ab-fixture',$1,'editor',clock_timestamp()+interval '1 hour')", &[&format!("{:x}", Sha256::digest(&token))]).await.unwrap();
    drop(c);
    let objects = tempfile::tempdir().unwrap();
    let docs = Documents::new(
        pool.clone(),
        identity.clone(),
        HostedStore::new(pool.clone(), ContentStore::local(objects.path()).unwrap()),
    );
    docs.migrate().await.unwrap();
    docs.configure_app(&token, "map", true, false)
        .await
        .unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(identity, &origin, 64, Duration::from_secs(45))
        .unwrap()
        .with_settings(settings)
        .with_documents(docs);
    let task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let result = tokio::time::timeout(
        Duration::from_secs(480),
        tokio::process::Command::new("node")
            .arg(root.join("dev/rebuild/server_ab.mjs"))
            .env("AETHER_AB_NATIVE_ORIGIN", origin)
            .env(
                "AETHER_AB_NATIVE_STORAGE",
                serde_json::Value::Object(storage).to_string(),
            )
            .env("AETHER_AB_NATIVE_COOKIE", format!("{COOKIE}={token}"))
            .current_dir(root)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .expect("A/B deadline")
    .unwrap();
    task.abort();
    pool.close();
    println!("{}", String::from_utf8_lossy(&result.stdout));
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
}
