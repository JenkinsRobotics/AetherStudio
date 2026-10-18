use super::{change_stream::Subscription, *};
use aether_server::native::revision_signals::RevisionSignals;
use aether_store::hosted::{AuthorizedScope, revision_signal_key};

async fn watch(f: &Fixture, origin: &str) -> Subscription {
    let response = f
        .client
        .get(format!("{origin}/api/library/changes?app=map&id=watched"))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .send()
        .await
        .unwrap();
    let mut subscription = Subscription::new(response);
    assert_eq!(subscription.state().await["main_revision"], 1);
    subscription
}

fn store(f: &Fixture) -> HostedStore {
    HostedStore::new(
        f.pool.clone(),
        ContentStore::local(f._objects.path()).unwrap(),
    )
}
fn edit(operation: &str, revision: u32) -> aether_protocol_core::storage::DocumentMutation {
    serde_json::from_value(json!({"operation_id":operation,"document_id":"watched","actor":"alice","change":{"kind":"save","expected_revision":revision,"content_base64":"eyJhIjoyfQ=="}})).unwrap()
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn committed_saves_wake_independent_hosts_without_waiting_for_heartbeat() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("watched"))
        .await
        .unwrap();
    // A separate host and LISTEN connection share only the authoritative DB.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    let signals = RevisionSignals::connect_local(f.pg_config.clone())
        .await
        .unwrap();
    let host = NativeHost::new(f.identity.clone(), &origin, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_revision_signals(signals);
    let second = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    let mut a = watch(&f, &f.url).await;
    let mut b = watch(&f, &origin).await;
    let scope = AuthorizedScope::new("company", "alice").unwrap();
    let store = store(&f);
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    store
        .mutate_in(&tx, &scope, &edit("uncommitted", 1))
        .await
        .unwrap();
    assert!(
        tokio::time::timeout(Duration::from_millis(100), a.state())
            .await
            .is_err()
    );
    tx.rollback().await.unwrap();
    assert_eq!(
        f.docs
            .read(&token("alice"), "watched", None)
            .await
            .unwrap()
            .document
            .revision,
        1
    );
    let mut samples = Vec::new();
    for revision in 1..=12 {
        let tx = client.transaction().await.unwrap();
        store
            .mutate_in(
                &tx,
                &scope,
                &edit(&format!("committed-{revision}"), revision),
            )
            .await
            .unwrap();
        let started = std::time::Instant::now();
        tx.commit().await.unwrap();
        let committed = std::time::Instant::now();
        let result = tokio::time::timeout(Duration::from_millis(800), async {
            tokio::join!(a.state(), b.state())
        })
        .await
        .expect("revision signal should beat the one-second heartbeat");
        assert_eq!(result.0["main_revision"], revision + 1);
        assert_eq!(result.1["main_revision"], revision + 1);
        samples.push(json!({"commit_ms":committed.duration_since(started).as_secs_f64()*1000.0,"both_hosts_after_commit_ms":committed.elapsed().as_secs_f64()*1000.0}));
    }
    println!(
        "{}",
        json!({"revision_notifications":"passed","hosts":2,"samples":samples,"physical_lan":false,"engine_command_latency":false})
    );
    second.abort();
    let _ = second.await;
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn notification_disconnect_recovers_and_hints_never_bypass_authority() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("watched"))
        .await
        .unwrap();
    let mut subscription = watch(&f, &f.url).await;
    let connection = f.pool.get().await.unwrap();
    let query = "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND application_name='aether-revision-listener'";
    let old: i32 = connection.query_one(query, &[]).await.unwrap().get(0);
    connection
        .query_one("SELECT pg_terminate_backend($1)", &[&old])
        .await
        .unwrap();
    f.docs
        .mutate(&token("alice"), &save("watched", "during-reconnect", 1))
        .await
        .unwrap();
    assert_eq!(subscription.state().await["main_revision"], 2);
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if connection
                .query(query, &[])
                .await
                .unwrap()
                .iter()
                .any(|r| r.get::<_, i32>(0) != old)
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("listener reconnect");
    // NOTIFY contains no content and does not confer access even when spoofed by
    // a trusted database operator. Re-check identity before sending any state.
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='alice'")
        .await;
    let key = revision_signal_key("company", "watched");
    connection
        .query_one("SELECT pg_notify('aether_revision_v1',$1)", &[&key])
        .await
        .unwrap();
    assert_eq!(
        subscription.event().await,
        ("unavailable".into(), json!({"reconnect":true}))
    );
    assert_eq!(
        f.library("alice", "read", json!({"app":"map","id":"watched"}))
            .await
            .status(),
        401
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn listener_shutdown_releases_its_dedicated_database_connection() {
    let f = Fixture::new().await;
    let connection = f.pool.get().await.unwrap();
    let query = "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='aether-revision-listener'";
    assert_eq!(
        connection
            .query_one(query, &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    f.task.abort();
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            if connection
                .query_one(query, &[])
                .await
                .unwrap()
                .get::<_, i64>(0)
                == 0
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("host shutdown must close the notification connection");
}
