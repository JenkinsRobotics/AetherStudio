use super::*;

/// Synthetic company workflow: real distinct identities/documents and persistent
/// connections, but no password hashing, CAD rendering or production LAN latency.
#[tokio::test]
#[ignore = "disposable PostgreSQL runner; bounded multiuser qualification"]
async fn company_users_keep_live_subscriptions_while_saving_private_documents() {
    use base64::{Engine, engine::general_purpose::STANDARD};
    use futures_util::{StreamExt, stream};
    let users = std::env::var("AETHER_COMPANY_USERS")
        .map_or(64, |v| v.parse::<usize>().expect("integer user count"));
    assert!((2..=500).contains(&users));
    let per_user = if users > 256 { 1 } else { 2 };
    const ROUNDS: usize = 3;
    let f = Fixture::new().await;
    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    let mut subscriptions = Vec::new();
    for index in 0..users {
        let user = format!("company-{index}");
        let id = format!("private-{index}");
        let c = f.pool.get().await.unwrap();
        c.execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('company',$1,$1,'unused-fixture-hash','member',false)",&[&user]).await.unwrap();
        c.execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES('company',$1,$2,clock_timestamp()+interval '1 hour')",&[&format!("{:x}",Sha256::digest(token(&user))),&user]).await.unwrap();
        drop(c);
        f.docs.mutate(&token(&user), &create(&id)).await.unwrap();
        for _ in 0..per_user {
            let response = client
                .get(format!("{}/api/library/changes?app=map&id={id}", f.url))
                .header("cookie", format!("{COOKIE}={}", token(&user)))
                .send()
                .await
                .unwrap();
            let mut subscription = Subscription::new(response);
            assert_eq!(subscription.state().await["main_revision"], 1);
            subscriptions.push(subscription);
        }
    }
    let started = std::time::Instant::now();
    let mut samples = Vec::new();
    for round in 1..=ROUNDS {
        let round_samples = stream::iter(subscriptions.chunks_mut(per_user).enumerate()).map(|(index, watchers)| {
            let f=&f;
            async move {
                let user=format!("company-{index}");let id=format!("private-{index}");
                let status_start=std::time::Instant::now();
                let status=f.client.get(format!("{}/api/status",f.url)).header("cookie",format!("{COOKIE}={}",token(&user))).send().await.unwrap();
                assert_eq!(status.status(),200);
                let status_ms=status_start.elapsed().as_secs_f64()*1000.0;
                let bytes=STANDARD.encode(serde_json::to_vec(&json!({"round":round,"owner":index,"fixture":"x".repeat(16*1024)})).unwrap());
                let save_start=std::time::Instant::now();
                let save = async {
                    let saved=f.library(&user,"save",json!({"app":"map","id":id,"operation_id":format!("round-{round}-{index}"),"expected_revision":round,"data_base64":bytes})).await;
                    assert_eq!(saved.status(),200);
                    let reply:Value=saved.json().await.unwrap();
                    assert_eq!(reply["revision"],round+1);
                    std::time::Instant::now()
                };
                let observe = async {
                    for watcher in watchers {
                        assert_eq!(watcher.state().await["main_revision"],round+1);
                    }
                    std::time::Instant::now()
                };
                let (saved_at, observed_at)=tokio::join!(save,observe);
                let read_start=std::time::Instant::now();
                let read=f.library(&user,"read",json!({"app":"map","id":id})).await;
                assert_eq!(read.status(),200);
                let read:Value=read.json().await.unwrap();
                assert_eq!(read["data_base64"],bytes);
                assert_eq!(read["revision"],round+1);
                json!({"user_index":index,"round":round,"status_ms":status_ms,
                    "save_ms":saved_at.duration_since(save_start).as_secs_f64()*1000.0,
                    "save_start_to_visible_ms":observed_at.duration_since(save_start).as_secs_f64()*1000.0,
                    "visible_after_save_response_ms":observed_at.saturating_duration_since(saved_at).as_secs_f64()*1000.0,
                    "read_ms":read_start.elapsed().as_secs_f64()*1000.0})
            }
        }).buffer_unordered(8).collect::<Vec<_>>().await;
        samples.extend(round_samples);
    }
    for index in 0..users {
        assert_eq!(
            f.library(
                &format!("company-{index}"),
                "read",
                json!({"app":"map","id":format!("private-{}",(index+1)%users)})
            )
            .await
            .status(),
            404
        );
    }
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='company-0'")
        .await;
    for subscription in subscriptions.iter_mut().take(per_user) {
        assert_eq!(
            subscription.event().await,
            ("unavailable".into(), json!({"reconnect":true}))
        );
    }
    let response = client
        .get(format!(
            "{}/api/library/changes?app=map&id=private-1",
            f.url
        ))
        .header("cookie", format!("{COOKIE}={}", token("company-1")))
        .send()
        .await
        .unwrap();
    assert_eq!(
        Subscription::new(response).state().await["main_revision"],
        ROUNDS + 1
    );
    let mut measurements = serde_json::Map::new();
    for name in [
        "status_ms",
        "save_ms",
        "read_ms",
        "save_start_to_visible_ms",
        "visible_after_save_response_ms",
    ] {
        let mut values = samples
            .iter()
            .map(|s| s[name].as_f64().unwrap())
            .collect::<Vec<_>>();
        values.sort_by(f64::total_cmp);
        let percentile = |p: f64| values[(values.len() as f64 * p).ceil() as usize - 1];
        measurements.insert(name.into(),json!({"p50":percentile(0.5),"p95":percentile(0.95),"p99":percentile(0.99),"max":values.last()}));
    }
    let report = json!({"company_fixture":"passed","distinct_active_users":users,"persistent_subscriptions":users*per_user,"max_parallel_edit_workflows":8,"guarded_saves":users*ROUNDS,"http_status_save_read_requests":users*ROUNDS*3,"cross_user_denials":users,"live_revocation":true,"reconnect":true,"elapsed_workload_seconds":started.elapsed().as_secs_f64(),"production_capacity_certificate":false,"release_build":!cfg!(debug_assertions),"measurements":measurements,"measurement_scope":"Loopback, synthetic16KiB documents, eight concurrent editing workflows. Visibility is last subscriber arrival; post-response lag clamps events preceding HTTP completion to zero. Not engine-command or LAN latency."});
    if let Ok(destination) = std::env::var("AETHER_COMPANY_EVIDENCE") {
        let destination = std::path::Path::new(&destination);
        assert!(destination.is_absolute());
        std::fs::create_dir_all(destination).unwrap();
        std::fs::write(
            destination.join("report.json"),
            serde_json::to_vec_pretty(&report).unwrap(),
        )
        .unwrap();
        std::fs::write(
            destination.join("samples.json"),
            serde_json::to_vec(&samples).unwrap(),
        )
        .unwrap();
    }
    println!("{report}");
}

async fn count(f: &Fixture, table: &str) -> i64 {
    f.pool
        .get()
        .await
        .unwrap()
        .query_one(&format!("SELECT count(*) FROM {table}"), &[])
        .await
        .unwrap()
        .get(0)
}

async fn seed(f: &Fixture) {
    f.docs
        .mutate(&token("alice"), &create("watched"))
        .await
        .unwrap();
}
async fn state(f: &Fixture) -> String {
    f.docs
        .change_state(&token("alice"), "map", "watched")
        .await
        .unwrap()
        .state_token
}
async fn change(f: &Fixture, action: &str, mut request: Value) -> Value {
    request["app"] = json!("map");
    request["id"] = json!("watched");
    let r = f.library("alice", action, request).await;
    let status = r.status();
    let body: Value = r.json().await.unwrap();
    assert_eq!(status, 200, "{body}");
    body
}
async fn watch(f: &Fixture, user: &str, last: Option<&str>) -> reqwest::Response {
    let mut r = f
        .client
        .get(format!("{}/api/library/changes?app=map&id=watched", f.url))
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .header("origin", &f.url);
    if let Some(last) = last {
        r = r.header("last-event-id", last);
    }
    r.send().await.unwrap()
}
pub(super) struct Subscription {
    response: reqwest::Response,
    buffer: String,
}
impl Subscription {
    pub(super) fn new(response: reqwest::Response) -> Self {
        assert_eq!(response.status(), 200);
        assert!(
            response.headers()["content-type"]
                .to_str()
                .unwrap()
                .starts_with("text/event-stream")
        );
        assert_eq!(response.headers()["x-accel-buffering"], "no");
        assert!(
            response.headers()["cache-control"]
                .to_str()
                .unwrap()
                .contains("no-store")
        );
        Self {
            response,
            buffer: String::new(),
        }
    }
    pub(super) async fn event(&mut self) -> (String, Value) {
        tokio::time::timeout(Duration::from_secs(7), async {
            loop {
                if let Some(end) = self.buffer.find("\n\n") {
                    let frame: String = self.buffer.drain(..end + 2).collect();
                    let kind = frame.lines().find_map(|l| l.strip_prefix("event: "));
                    if let Some(kind) = kind {
                        let data = frame
                            .lines()
                            .find_map(|l| l.strip_prefix("data: "))
                            .unwrap();
                        return (kind.to_owned(), serde_json::from_str(data).unwrap());
                    }
                    continue;
                }
                let bytes = self
                    .response
                    .chunk()
                    .await
                    .unwrap()
                    .expect("expected stream event");
                self.buffer.push_str(std::str::from_utf8(&bytes).unwrap());
            }
        })
        .await
        .expect("timely change notification")
    }
    pub(super) async fn state(&mut self) -> Value {
        let (kind, value) = self.event().await;
        assert_eq!(kind, "state");
        value
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn durable_state_tracks_branch_metadata_versions_and_discussions_without_content_reads() {
    let f = Fixture::new().await;
    seed(&f).await;
    let original = state(&f).await;
    let fork = json!({"operation_id":"fork","name":"Work","expected_revision":1,"from_revision":1});
    let branch = change(&f, "branch_create", fork.clone()).await["branch_id"].clone();
    let created = state(&f).await;
    assert_ne!(created, original);
    change(&f, "branch_create", fork).await;
    assert_eq!(
        state(&f).await,
        created,
        "exact replay does not invent a change"
    );
    change(
        &f,
        "branch_rename",
        json!({"operation_id":"rename","branch":branch,"expected_revision":1,"new_name":"Renamed"}),
    )
    .await;
    let renamed = state(&f).await;
    assert_ne!(created, renamed);
    change(&f,"save",json!({"operation_id":"save-branch","branch":branch,"expected_revision":1,"data_base64":"e30="})).await;
    let saved = f
        .docs
        .change_state(&token("alice"), "map", "watched")
        .await
        .unwrap();
    assert_eq!((saved.main_revision, saved.latest_revision), (1, 2));
    change(
        &f,
        "version",
        json!({"operation_id":"version","branch":branch,"expected_revision":2,"name":"Milestone"}),
    )
    .await;
    let versioned = state(&f).await;
    assert_ne!(versioned, saved.state_token);
    change(&f,"collaboration_mutate",json!({"operation_id":"comment","branch":branch,"expected_revision":0,"collection":"comments","operation":"add","value":{"text":"review"}})).await;
    let commented = state(&f).await;
    assert_ne!(commented, versioned);
    change(&f,"branch_delete",json!({"operation_id":"delete","branch":branch,"expected_revision":2,"expected_main_revision":1,"force":true})).await;
    assert_ne!(state(&f).await, commented);
    let before = count(&f, "aether_store.audit").await;
    let recents = count(&f, "aether_access.library_recents").await;
    for _ in 0..3 {
        state(&f).await;
    }
    assert_eq!(count(&f, "aether_store.audit").await, before);
    assert_eq!(count(&f, "aether_access.library_recents").await, recents);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn subscribers_receive_commits_and_reconnect_to_current_durable_state() {
    let f = Fixture::new().await;
    seed(&f).await;
    let mut a = Subscription::new(watch(&f, "alice", None).await);
    let mut b = Subscription::new(watch(&f, "alice", None).await);
    let first = a.state().await;
    assert_eq!(b.state().await, first);
    f.docs
        .mutate(&token("alice"), &save("watched", "update", 1))
        .await
        .unwrap();
    let updated = a.state().await;
    assert_eq!(updated["main_revision"], 2);
    assert_eq!(b.state().await, updated);
    drop(a);
    drop(b);
    change(
        &f,
        "branch_create",
        json!({"operation_id":"missed-fork","name":"Away","expected_revision":2,"from_revision":2}),
    )
    .await;
    let mut reconnected =
        Subscription::new(watch(&f, "alice", first["state_token"].as_str()).await);
    let current = reconnected.state().await;
    assert_ne!(current["state_token"], updated["state_token"]);
    assert_eq!(current["state_token"], state(&f).await);
    // A second coordinator reconstructs the identical token from the database.
    let other = Documents::new(
        f.pool.clone(),
        f.identity.clone(),
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    assert_eq!(
        other
            .change_state(&token("alice"), "map", "watched")
            .await
            .unwrap()
            .state_token,
        current["state_token"]
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn authority_is_rechecked_during_stream_and_revocation_closes_without_data() {
    let f = Fixture::new().await;
    seed(&f).await;
    f.docs
        .grant(&token("alice"), "watched", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let mut stream = Subscription::new(watch(&f, "bob", None).await);
    assert_eq!(stream.state().await["writable"], true);
    f.docs
        .grant(&token("alice"), "watched", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    assert_eq!(stream.state().await["writable"], false);
    f.docs
        .grant(&token("alice"), "watched", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        stream.event().await,
        ("unavailable".into(), json!({"reconnect":true}))
    );
    assert!(stream.response.chunk().await.unwrap().is_none());
    assert_eq!(watch(&f, "bob", None).await.status(), 404);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn session_expiry_and_disabled_app_stop_live_streams() {
    for mode in ["session", "app"] {
        let f = Fixture::new().await;
        seed(&f).await;
        let mut stream = Subscription::new(watch(&f, "alice", None).await);
        stream.state().await;
        if mode == "session" {
            f.sql("DELETE FROM aether_identity.sessions WHERE user_id='alice'")
                .await;
        } else {
            f.docs
                .configure_app(&token("admin"), "map", false, false)
                .await
                .unwrap();
        }
        assert_eq!(stream.event().await.0, "unavailable");
        assert!(stream.response.chunk().await.unwrap().is_none());
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn stream_capacity_is_bounded_and_disconnect_releases_it_without_blocking_commands() {
    let f = Fixture::with_stream_capacity(1).await;
    seed(&f).await;
    let mut stream = Subscription::new(watch(&f, "alice", None).await);
    stream.state().await;
    assert_eq!(watch(&f, "alice", None).await.status(), 429);
    f.docs
        .mutate(&token("alice"), &save("watched", "while-connected", 1))
        .await
        .unwrap();
    assert_eq!(stream.state().await["main_revision"], 2);
    let idle:i64=f.pool.get().await.unwrap().query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'",&[]).await.unwrap().get(0);
    assert_eq!(idle, 0);
    drop(stream);
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert_eq!(watch(&f, "alice", None).await.status(), 200);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn stream_rejects_private_cross_app_cross_origin_and_invalid_requests_without_enrollment() {
    let f = Fixture::new().await;
    seed(&f).await;
    let enrolled = count(&f, "aether_access.enrolled").await;
    assert_eq!(watch(&f, "eve", None).await.status(), 404);
    assert_eq!(count(&f, "aether_access.enrolled").await, enrolled);
    assert_eq!(watch(&f, "alice", Some("made-up")).await.status(), 400);
    let root = format!("{}/api/library/changes", f.url);
    let anonymous = f
        .client
        .get(format!("{root}?app=map&id=watched"))
        .send()
        .await
        .unwrap();
    assert_eq!(anonymous.status(), 401);
    for (query, origin, expected) in [
        ("app=drive&id=watched", f.url.as_str(), 404),
        ("app=map&id=watched", "https://elsewhere.invalid", 403),
        ("app=map&id=watched&unexpected=1", f.url.as_str(), 400),
        ("app=map&id=watched&token=secret", f.url.as_str(), 400),
        ("app=map&id=missing", f.url.as_str(), 404),
    ] {
        let response = f
            .client
            .get(format!("{root}?{query}"))
            .header("origin", origin)
            .header("cookie", format!("{COOKIE}={}", token("alice")))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), expected);
    }
}
