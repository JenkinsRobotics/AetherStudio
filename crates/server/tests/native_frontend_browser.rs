//! Separate mandatory local qualification of the full app catalog and UI gallery,
//! plus the actual built Studio/Map/CAD interfaces. The frontend manifest and browser toolchain must exist; no skips.
use aether_identity::Identity;
use aether_server::{
    documents::Documents,
    native::{NativeHost, frontends::Frontends, router},
};
use aether_store::hosted::{ContentStore, HostedStore};
use base64::{Engine, engine::general_purpose::STANDARD};
use deadpool_postgres::{Manager, Pool, Runtime};
use sha2::{Digest, Sha256};
use std::{net::SocketAddr, path::PathBuf, time::Duration};
use tokio_postgres::{Config, NoTls};
#[tokio::test]
#[ignore = "private PostgreSQL plus explicit built frontend manifest and Chromium"]
async fn real_built_frontends_browser() {
    run_built_frontends("suite").await;
}
#[tokio::test]
#[ignore = "private PostgreSQL plus frozen CAD frontend, native worker and Chromium"]
async fn real_built_cad_agents_browser() {
    run_built_frontends("cad").await;
}
#[tokio::test]
#[ignore = "private PostgreSQL, frozen Studio frontend, native worker and Chromium"]
async fn real_built_agent_access_browser() {
    run_built_frontends("agent-access").await;
}
async fn run_built_frontends(mode: &str) {
    let mut config: Config = std::env::var("AETHER_TEST_PG")
        .expect("Disposable runner required")
        .parse()
        .unwrap();
    let pool = |c| {
        Pool::builder(Manager::new(c, NoTls))
            .max_size(8)
            .runtime(Runtime::Tokio1)
            .build()
            .unwrap()
    };
    let admin = pool(config.clone());
    admin
        .get()
        .await
        .unwrap()
        .batch_execute("CREATE DATABASE aether_frontend_browser")
        .await
        .unwrap();
    admin.close();
    config.dbname("aether_frontend_browser");
    let pool = pool(config.clone());
    let identity = Identity::new(pool.clone(), "browser-fixture", 2).unwrap();
    identity.migrate().await.unwrap();
    let token = format!("{:x}", Sha256::digest("frontend-browser-fixture-only"));
    let c = pool.get().await.unwrap();
    c.execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change,full_name) VALUES('browser-fixture','editor','editor',$1,'admin',false,'Browser Fixture')",&[&include_str!("../../identity/tests/legacy-hash.txt").trim()]).await.unwrap();
    c.execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES('browser-fixture',$1,'editor',clock_timestamp()+interval '1 hour')",&[&format!("{:x}",Sha256::digest(&token))]).await.unwrap();
    drop(c);
    let objects = tempfile::tempdir().unwrap();
    let installed = tempfile::tempdir().unwrap();
    let products_config = installed.path().join("products.json");
    std::fs::write(&products_config, serde_json::to_vec(&serde_json::json!({
        "schema":1,"node":std::env::var("AETHER_TEST_NODE").unwrap(),
        "python":std::env::var("AETHER_TEST_CAD_PYTHON").unwrap(),
        "freecad":std::env::var("AETHER_TEST_CAD_FREECAD").unwrap(),
        "manifests":[std::env::var("AETHER_TEST_MAP_WORKER").unwrap(), std::env::var("AETHER_TEST_CAD_WORKER").unwrap()]
    })).unwrap()).unwrap();
    let products = aether_server::products::Products::load(&products_config).unwrap();
    let documents = Documents::new(
        pool.clone(),
        identity.clone(),
        HostedStore::new(pool.clone(), ContentStore::local(objects.path()).unwrap()),
    )
    .with_products(products);
    documents.migrate().await.unwrap();
    let settings = aether_server::settings::Settings::new(pool.clone(), identity.clone());
    settings.migrate(&Default::default()).await.unwrap();
    let catalog: serde_json::Value =
        serde_json::from_str(include_str!("../../../core/host/application-catalog.json")).unwrap();
    let apps: Vec<&str> = catalog
        .as_array()
        .unwrap()
        .iter()
        .map(|app| app["id"].as_str().unwrap())
        .collect();
    // UI is a reserved administrator gallery, seeded by installation/import
    // rather than configurable through the ordinary application switch.
    pool.get()
        .await
        .unwrap()
        .execute(
            "INSERT INTO aether_access.applications VALUES('browser-fixture','ui',true,false)",
            &[],
        )
        .await
        .unwrap();
    for app in apps.iter().filter(|app| **app != "ui") {
        documents
            .configure_app(&token, app, true, false)
            .await
            .unwrap();
    }
    pool.get().await.unwrap().execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change,full_name) VALUES('browser-fixture','recipient','recipient',$1,'member',false,'Sharing Recipient')", &[&include_str!("../../identity/tests/legacy-hash.txt").trim()]).await.unwrap();
    documents
        .set_organization_member(&token, "default", "recipient", Some("member"))
        .await
        .unwrap();
    let manifest = PathBuf::from(
        std::env::var_os("AETHER_TEST_FRONTEND_MANIFEST")
            .expect("Supply an explicit public-build manifest"),
    );
    let web =
        Frontends::load(&manifest).expect("All actual builds must load; no placeholder fallback");
    let configured: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&manifest).unwrap()).unwrap();
    for app in apps {
        assert!(
            configured["apps"].get(app).is_some(),
            "Frontend manifest is missing {app}; use dev/rebuild/frontends.example.json for the complete suite"
        );
    }
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let executable = std::process::Command::new("node")
        .args(["-p", "process.execPath"])
        .output()
        .unwrap();
    assert!(executable.status.success());
    let agent_script = objects.path().join("fixture-agent.mjs");
    std::fs::write(
        &agent_script,
        include_str!("native_documents/agent_fixture.mjs"),
    )
    .unwrap();
    let provider_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let provider = |name| {
        Some(aether_server::agents::CliProvider {
            adapter: provider_root.join(format!("providers/{name}.mjs")),
            cli: provider_root.join("tests/native_documents/official_cli_fixture.mjs"),
        })
    };
    let agents = aether_server::agents::Agents::open(
        aether_server::agents::Configuration {
            root: objects.path().join("agents"),
            node: String::from_utf8(executable.stdout).unwrap().trim().into(),
            chatgpt_adapter: agent_script,
            claude: provider("claude"),
            gemini: provider("gemini"),
        },
        "browser-fixture",
    )
    .unwrap();
    let attachments_root = installed.path().join("attachments");
    let workspace_root = installed.path().join("workspaces");
    std::fs::create_dir(&attachments_root).unwrap();
    std::fs::create_dir_all(workspace_root.join("editor")).unwrap();
    std::fs::write(workspace_root.join("editor/image.png"), STANDARD.decode("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIUlEQVR4nGP8z0AaYCJRPcOoBmIAE1GqkMCoBmIAyaEEAEAuAR9UPEsJAAAAAElFTkSuQmCC").unwrap()).unwrap();
    let signals = aether_server::native::revision_signals::RevisionSignals::connect_local(config)
        .await
        .unwrap();
    let host = NativeHost::new(identity, &url, 64, Duration::from_secs(45))
        .unwrap()
        .with_documents(documents)
        .with_revision_signals(signals)
        .with_settings(settings)
        .with_attachments(aether_server::attachments::Attachments::load(&attachments_root).unwrap())
        .with_workspace_assets(
            aether_server::workspace_assets::WorkspaceAssets::load(&workspace_root).unwrap(),
        )
        .with_animation(
            aether_server::native::animation::Animation::load(&PathBuf::from(
                std::env::var("AETHER_TEST_ANIMATION").unwrap(),
            ))
            .unwrap(),
        )
        .with_map_distribution(
            aether_server::native::map_distribution::Distribution::load(&PathBuf::from(
                std::env::var("AETHER_TEST_MAP_DOWNLOADS").unwrap(),
            ))
            .unwrap(),
        )
        .with_frontends(web)
        .with_agents(agents.clone());
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
        Duration::from_secs(240),
        tokio::process::Command::new("node")
            .arg(root.join(if mode == "agent-access" {
                "dev/rebuild/agent_access_browser.mjs"
            } else if mode == "cad" {
                "dev/rebuild/cad_agents_browser.mjs"
            } else {
                "dev/rebuild/frontend_browser.mjs"
            }))
            .env("AETHER_TEST_ORIGIN", &url)
            .current_dir(&root)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .expect("Browser deadline")
    .unwrap();
    let animation = tokio::time::timeout(
        Duration::from_secs(90),
        tokio::process::Command::new("node")
            .arg(root.join("dev/rebuild/animation_browser.mjs"))
            .args([
                &url,
                &token,
                &std::env::var("AETHER_TEST_ANIMATION_ROOT").unwrap(),
            ])
            .current_dir(&root)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .expect("Animation browser deadline")
    .unwrap();
    agents.shutdown().await;
    task.abort();
    pool.close();
    println!("{}", String::from_utf8_lossy(&result.stdout));
    println!("{}", String::from_utf8_lossy(&animation.stdout));
    assert!(
        animation.status.success(),
        "{}",
        String::from_utf8_lossy(&animation.stderr)
    );
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
}
