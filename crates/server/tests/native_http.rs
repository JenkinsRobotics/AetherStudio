//! Native identity over real loopback HTTP and disposable PostgreSQL. No mock
//! credential authority, production data, frontend fallback or automatic retry.
use aether_identity::Identity;
use aether_server::native::{COOKIE, NativeHost, router};
use deadpool_postgres::{Manager, Pool, Runtime};
use reqwest::{Client, Response, StatusCode};
use serde_json::{Value, json};
use std::{
    net::SocketAddr,
    sync::atomic::{AtomicU32, Ordering},
    time::Duration,
};
use tokio_postgres::{Config, NoTls};

static NEXT: AtomicU32 = AtomicU32::new(1);
const PASSWORD: &str = "account-test-password-2026";
const NEW: &str = "changed-account-password-2026";
struct Fixture {
    identity: Identity,
    pool: Pool,
    client: Client,
    url: String,
    origin: String,
    authority: String,
    task: tokio::task::JoinHandle<()>,
    dsn: String,
}
impl Fixture {
    async fn new(secure: bool, admission: usize, deadline: Duration) -> Self {
        let dsn = std::env::var("AETHER_TEST_PG").expect("Use private PostgreSQL runner");
        let mut config: Config = dsn.parse().unwrap();
        fn pool(config: Config) -> Pool {
            Pool::builder(Manager::new(config, NoTls))
                .max_size(8)
                .runtime(Runtime::Tokio1)
                .wait_timeout(Some(Duration::from_secs(5)))
                .build()
                .unwrap()
        }
        let admin = pool(config.clone());
        let name = format!("aether_http_{}", NEXT.fetch_add(1, Ordering::Relaxed));
        admin
            .get()
            .await
            .unwrap()
            .batch_execute(&format!("CREATE DATABASE {name}"))
            .await
            .unwrap();
        admin.close();
        config.dbname(&name);
        let pool = pool(config);
        let identity = Identity::new(pool.clone(), "company", 2).unwrap();
        assert_eq!(
            identity.check_schema().await.unwrap_err(),
            aether_identity::Error::Incompatible
        );
        identity.migrate().await.unwrap();
        identity.check_schema().await.unwrap();
        for (user, role) in [("owner", "admin"), ("member", "member")] {
            pool.get().await.unwrap().execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change,full_name,email) VALUES('company',$1,$1,$2,$3,false,$1,$4)",&[&user,&include_str!("../../identity/tests/legacy-hash.txt").trim(),&role,&format!("{user}@example.test")]).await.unwrap();
        }
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let authority = if secure {
            "studio.example.test".to_string()
        } else {
            listener.local_addr().unwrap().to_string()
        };
        let url = format!("http://{}", listener.local_addr().unwrap());
        let origin = if secure {
            format!("https://{authority}")
        } else {
            url.clone()
        };
        let host = NativeHost::new(identity.clone(), &origin, admission, deadline).unwrap();
        let task = tokio::spawn(async move {
            axum::serve(
                listener,
                router(host).into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await
            .unwrap();
        });
        let client = Client::builder()
            .no_proxy()
            .retry(reqwest::retry::never())
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap();
        Self {
            identity,
            pool,
            client,
            url,
            origin,
            authority,
            task,
            dsn: format!("{dsn} dbname={name}"),
        }
    }
    async fn normal() -> Self {
        Self::new(false, 64, Duration::from_secs(45)).await
    }
    async fn post(&self, path: &str, cookie: &str, body: Value) -> Response {
        self.client
            .post(format!("{}{path}", self.url))
            .header("host", &self.authority)
            .header("origin", &self.origin)
            .header("cookie", cookie)
            .json(&body)
            .send()
            .await
            .unwrap()
    }
    async fn get(&self, path: &str, cookie: &str) -> Response {
        self.client
            .get(format!("{}{path}", self.url))
            .header("host", &self.authority)
            .header("cookie", cookie)
            .send()
            .await
            .unwrap()
    }
    async fn login(&self, user: &str, password: &str) -> String {
        let response = self
            .post(
                "/api/login",
                "",
                json!({"username":user,"password":password}),
            )
            .await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["cache-control"], "no-store");
        let cookie = response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .to_string();
        assert!(cookie.contains("HttpOnly; SameSite=Strict; Max-Age=43200"));
        assert_eq!(response.json::<Value>().await.unwrap(), json!({"ok":true}));
        cookie.split(';').next().unwrap().to_string()
    }
    async fn sql(&self, sql: &str) {
        self.pool
            .get()
            .await
            .unwrap()
            .batch_execute(sql)
            .await
            .unwrap();
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        self.task.abort();
        self.pool.close();
    }
}

#[tokio::test]
#[ignore = "private PostgreSQL acceptance"]
async fn http_session_profile_password_and_revocation_follow_native_authority() {
    let f = Fixture::normal().await;
    let owner = f.login("owner", PASSWORD).await;
    let second = f.login("owner", PASSWORD).await;
    let response = f.get("/api/v1/identity/session", &owner).await;
    assert_eq!(response.status(), StatusCode::OK);
    let user = response.json::<Value>().await.unwrap();
    assert_eq!(user["user"]["username"], "owner");
    assert!(!user.to_string().contains("password"));
    let bad=f.post("/api/profile",&owner,json!({"current_password":"wrong-password","full_name":"Changed","email":"changed@example.test"})).await;
    assert_eq!(bad.status(), StatusCode::UNAUTHORIZED);
    let good=f.post("/api/profile",&owner,json!({"current_password":PASSWORD,"full_name":"Changed","email":"changed@example.test"})).await;
    assert_eq!(good.status(), StatusCode::OK);
    let user = f
        .get("/api/v1/identity/session", &owner)
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(user["user"]["email"], "changed@example.test");
    assert_eq!(user["user"]["email_verified"], false);
    let change = f
        .post(
            "/api/password",
            &owner,
            json!({"current_password":PASSWORD,"password":NEW}),
        )
        .await;
    assert_eq!(change.status(), StatusCode::OK);
    assert!(
        change.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    for token in [owner, second] {
        assert_eq!(
            f.get("/api/v1/identity/session", &token).await.status(),
            StatusCode::UNAUTHORIZED
        );
    }
    assert_eq!(
        f.post(
            "/api/login",
            "",
            json!({"username":"owner","password":PASSWORD})
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED
    );
    let fresh = f.login("changed@example.test", NEW).await;
    assert_eq!(
        f.post("/api/logout", &fresh, json!({})).await.status(),
        StatusCode::OK
    );
    assert_eq!(
        f.get("/api/v1/identity/session", &fresh).await.status(),
        StatusCode::UNAUTHORIZED
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL acceptance"]
async fn http_admin_changes_force_password_change_and_recheck_account_state() {
    let f = Fixture::normal().await;
    let owner = f.login("owner", PASSWORD).await;
    let member = f.login("member", PASSWORD).await;
    let create = json!({"username":"new-member","password":PASSWORD,"role":"member","full_name":"New Member","email":"new@example.test"});
    assert_eq!(
        f.post("/api/admin/users", &member, create.clone())
            .await
            .status(),
        StatusCode::FORBIDDEN
    );
    let response = f.post("/api/admin/users", &owner, create).await;
    assert_eq!(response.status(), StatusCode::OK);
    let created = response.json::<Value>().await.unwrap();
    let id = created["user"]["id"].as_str().unwrap();
    assert_eq!(created["user"]["must_change"], true);
    let temporary = f.login("new-member", PASSWORD).await;
    assert_eq!(
        f.post(
            "/api/profile",
            &temporary,
            json!({"current_password":PASSWORD,"full_name":"Test","email":"test@example.test"})
        )
        .await
        .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        f.post(
            "/api/password",
            &temporary,
            json!({"current_password":PASSWORD,"password":NEW})
        )
        .await
        .status(),
        StatusCode::OK
    );
    let ready = f.login("new-member", NEW).await;
    assert_eq!(
        f.get("/api/v1/identity/session", &ready)
            .await
            .json::<Value>()
            .await
            .unwrap()["user"]["must_change"],
        false
    );
    assert_eq!(
        f.post(
            "/api/admin/user",
            &member,
            json!({"action":"update","id":"owner","role":"member","active":false})
        )
        .await
        .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        f.post(
            "/api/admin/user",
            &owner,
            json!({"action":"update","id":"owner","role":"member","active":false})
        )
        .await
        .status(),
        StatusCode::CONFLICT
    );
    assert_eq!(
        f.post(
            "/api/admin/user",
            &owner,
            json!({"action":"reset_password","id":id,"password":PASSWORD})
        )
        .await
        .status(),
        StatusCode::OK
    );
    assert_eq!(
        f.get("/api/v1/identity/session", &ready).await.status(),
        StatusCode::UNAUTHORIZED
    );
    let reset = f.login("new-member", PASSWORD).await;
    assert_eq!(
        f.get("/api/v1/identity/session", &reset)
            .await
            .json::<Value>()
            .await
            .unwrap()["user"]["must_change"],
        true
    );
    assert_eq!(
        f.post(
            "/api/admin/user",
            &owner,
            json!({"action":"revoke_sessions","id":"member"})
        )
        .await
        .status(),
        StatusCode::OK
    );
    assert_eq!(
        f.get("/api/v1/identity/session", &member).await.status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        f.post(
            "/api/admin/user",
            &owner,
            json!({"action":"update","id":id,"role":"member","active":false})
        )
        .await
        .status(),
        StatusCode::OK
    );
    assert_eq!(
        f.get("/api/v1/identity/session", &reset).await.status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        f.post(
            "/api/login",
            "",
            json!({"username":"new-member","password":PASSWORD})
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL acceptance"]
async fn http_origin_rejections_do_not_revoke_or_leak_sessions() {
    let f = Fixture::new(true, 64, Duration::from_secs(45)).await;
    let response = f
        .post(
            "/api/login",
            "",
            json!({"username":"owner","password":PASSWORD}),
        )
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(
        response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .ends_with("; Secure")
    );
    let cookie = response.headers()["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string();
    for origin in ["https://evil.test", "null", "http://studio.example.test"] {
        let r = f
            .client
            .post(format!("{}/api/logout", f.url))
            .header("host", &f.authority)
            .header("origin", origin)
            .header("cookie", &cookie)
            .json(&json!({}))
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), StatusCode::FORBIDDEN);
    }
    assert_eq!(
        f.get("/api/v1/identity/session", &cookie).await.status(),
        StatusCode::OK
    );
    let secret = cookie.strip_prefix(&format!("{COOKIE}=")).unwrap();
    let r = f
        .client
        .get(format!("{}/api/v1/identity/session", f.url))
        .header("host", &f.authority)
        .bearer_auth(secret)
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), StatusCode::UNAUTHORIZED);
    f.sql("UPDATE aether_identity.sessions SET expires=clock_timestamp()-interval '1 second'")
        .await;
    assert_eq!(
        f.get("/api/v1/identity/session", &cookie).await.status(),
        StatusCode::UNAUTHORIZED
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL acceptance"]
async fn schema_checks_are_read_only_and_operator_cli_refuses_uninitialized_serving() {
    let f = Fixture::normal().await;
    let binary = env!("CARGO_BIN_EXE_aether-native-host");
    f.sql("DROP SCHEMA aether_identity CASCADE").await;
    assert_eq!(
        f.get("/readyz", "").await.status(),
        StatusCode::SERVICE_UNAVAILABLE
    );
    let run = |action: &str| {
        std::process::Command::new(binary)
            .arg(action)
            .env("AETHER_NATIVE_PG", &f.dsn)
            .env("AETHER_NATIVE_TENANT", "company")
            .output()
            .unwrap()
    };
    let result = run("serve");
    assert!(!result.status.success());
    assert!(!String::from_utf8_lossy(&result.stderr).contains(&f.dsn));
    assert_eq!(
        f.identity.check_schema().await.unwrap_err(),
        aether_identity::Error::Incompatible
    );
    assert!(run("migrate").status.success());
    f.identity.check_schema().await.unwrap();
    // Binary bootstrap accepts credentials through stdin only; no HTTP setup route.
    use std::io::Write;
    let mut child = std::process::Command::new(binary)
        .arg("bootstrap")
        .env("AETHER_NATIVE_PG", &f.dsn)
        .env("AETHER_NATIVE_TENANT", "company")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(json!({"username":"owner","password":PASSWORD,"full_name":"Owner","email":"owner@example.test"}).to_string().as_bytes()).unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    assert!(!String::from_utf8_lossy(&output.stderr).contains(PASSWORD));
    assert!(output.stdout.is_empty());
    let session = f.login("owner", PASSWORD).await;
    assert_eq!(
        f.get("/api/v1/identity/session", &session).await.status(),
        StatusCode::OK
    );
    f.sql("UPDATE aether_identity.schema_state SET version=99")
        .await;
    assert!(!run("serve").status.success());
    assert!(!run("migrate").status.success());
}
#[tokio::test]
#[ignore = "private PostgreSQL acceptance"]
async fn slow_body_has_bounded_admission_and_unknown_timeout_without_mutation() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let f = Fixture::new(false, 1, Duration::from_secs(2)).await;
    let mut stream = tokio::net::TcpStream::connect(&f.authority).await.unwrap();
    stream.write_all(format!("POST /api/profile HTTP/1.1\r\nHost: {}\r\nOrigin: {}\r\nContent-Type: application/json\r\nContent-Length: 300\r\nConnection: close\r\n\r\n{{",f.authority,f.origin).as_bytes()).await.unwrap();
    let mut busy = false;
    for _ in 0..50 {
        if f.get("/healthz", "").await.status() == StatusCode::TOO_MANY_REQUESTS {
            busy = true;
            break;
        }
        tokio::task::yield_now().await;
    }
    assert!(busy);
    let mut bytes = Vec::new();
    tokio::time::timeout(Duration::from_secs(5), stream.read_to_end(&mut bytes))
        .await
        .unwrap()
        .unwrap();
    let response = String::from_utf8(bytes).unwrap();
    assert!(response.contains("504 Gateway Timeout"));
    assert!(response.contains("outcome_unknown"));
    assert_eq!(f.get("/healthz", "").await.status(), StatusCode::OK);
    let count: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT count(*) FROM aether_identity.audit", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 0);
}

#[tokio::test]
#[ignore = "private PostgreSQL acceptance"]
async fn five_hundred_http_reads_are_bounded_and_revocation_is_immediate() {
    let f = Fixture::normal().await;
    let session = f.login("member", PASSWORD).await;
    for revoked in [false, true] {
        if revoked {
            assert_eq!(
                f.post("/api/logout", &session, json!({})).await.status(),
                StatusCode::OK
            );
        }
        let started = std::time::Instant::now();
        let mut tasks = tokio::task::JoinSet::new();
        for _ in 0..500 {
            let client = f.client.clone();
            let url = format!("{}/api/v1/identity/session", f.url);
            let authority = f.authority.clone();
            let session = session.clone();
            tasks.spawn(async move {
                let started = std::time::Instant::now();
                let response = client
                    .get(url)
                    .header("host", authority)
                    .header("cookie", session)
                    .send()
                    .await
                    .unwrap();
                let status = response.status();
                let body = response.json::<Value>().await.unwrap();
                (status, body, started.elapsed().as_millis())
            });
        }
        let mut served = Vec::new();
        let mut busy = 0;
        while let Some(result) = tasks.join_next().await {
            let (status, body, latency) = result.unwrap();
            if status == StatusCode::TOO_MANY_REQUESTS {
                assert_eq!(body["execution"], "not_started");
                busy += 1;
            } else {
                assert_eq!(
                    status,
                    if revoked {
                        StatusCode::UNAUTHORIZED
                    } else {
                        StatusCode::OK
                    }
                );
                if !revoked {
                    assert_eq!(body["user"]["username"], "member");
                }
                served.push(latency);
            }
        }
        assert!(!served.is_empty());
        assert_eq!(served.len() + busy, 500);
        served.sort_unstable();
        eprintln!(
            "native HTTP burst: requests=500; revoked={revoked}; served={}; admission_refused={busy}; total_ms={}; served_p95_ms={}; admission_limit=64; pool_limit=8",
            served.len(),
            started.elapsed().as_millis(),
            served[(served.len() * 95 / 100).min(served.len() - 1)]
        );
    }
}
