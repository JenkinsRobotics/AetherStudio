//! Real database acceptance; invoked explicitly by the private PostgreSQL runner.
use aether_identity::{Error, Identity, NewAccount, Role};
use deadpool_postgres::{Manager, Pool, Runtime};
use sha2::{Digest, Sha256};
use std::{
    sync::atomic::{AtomicU32, Ordering},
    time::Duration,
};
use tokio_postgres::{Config, NoTls};
const PASSWORD: &str = "account-test-password-2026";
const NEXT_PASSWORD: &str = "next-account-password-2026";
static NEXT: AtomicU32 = AtomicU32::new(1);
struct Fixture {
    identity: Identity,
    pool: Pool,
}
fn account(username: &str, role: Role) -> NewAccount {
    NewAccount {
        username: username.into(),
        role,
        must_change: false,
        full_name: format!("Test {username}"),
        email: format!("{username}@example.test"),
    }
}
impl Fixture {
    async fn new(seed: bool) -> Self {
        let mut config: Config = std::env::var("AETHER_TEST_PG")
            .expect("Use the private PostgreSQL acceptance runner")
            .parse()
            .unwrap();
        fn pool(config: Config) -> Pool {
            Pool::builder(Manager::new(config, NoTls))
                .max_size(8)
                .runtime(Runtime::Tokio1)
                .wait_timeout(Some(Duration::from_secs(5)))
                .create_timeout(Some(Duration::from_secs(5)))
                .recycle_timeout(Some(Duration::from_secs(5)))
                .build()
                .unwrap()
        }
        let admin = pool(config.clone());
        let name = format!("aether_identity_{}", NEXT.fetch_add(1, Ordering::Relaxed));
        admin
            .get()
            .await
            .unwrap()
            .batch_execute(&format!("CREATE DATABASE {name}"))
            .await
            .unwrap();
        admin.close();
        config.dbname(name);
        let pool = pool(config);
        let identity = Identity::new(pool.clone(), "company", 2).unwrap();
        identity.migrate().await.unwrap();
        identity.migrate().await.unwrap();
        if seed {
            // Import-shaped fixture only: use Python-generated legacy credentials,
            // not a public insert/bypass method in the production authority.
            for (name, role) in [
                ("owner", "admin"),
                ("member", "member"),
                ("second", "admin"),
            ] {
                pool.get().await.unwrap().execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change,full_name,email) VALUES('company',$1,$1,$2,$3,false,$1,$4)",&[&name,&include_str!("legacy-hash.txt").trim(),&role,&format!("{name}@example.test")]).await.unwrap();
            }
        }
        Self { identity, pool }
    }
    async fn login(&self, name: &str) -> aether_identity::Secret {
        self.identity
            .sign_in(name, PASSWORD, "127.0.0.1")
            .await
            .unwrap()
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
    async fn count(&self, sql: &str) -> i64 {
        self.pool
            .get()
            .await
            .unwrap()
            .query_one(sql, &[])
            .await
            .unwrap()
            .get(0)
    }
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn bootstrap_is_atomic_once_and_schema_refuses_unknown_versions() {
    let f = Fixture::new(false).await;
    let owner = account("owner", Role::Admin);
    let another = account("another", Role::Admin);
    let (a, b) = tokio::join!(
        f.identity.bootstrap(&owner, PASSWORD),
        f.identity.bootstrap(&another, PASSWORD)
    );
    assert_eq!(usize::from(a.is_ok()) + usize::from(b.is_ok()), 1);
    assert_eq!(a.err().or(b.err()), Some(Error::Conflict));
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.users").await,
        1
    );
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.audit WHERE action='bootstrap'")
            .await,
        1
    );
    let stored: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT password FROM aether_identity.users", &[])
        .await
        .unwrap()
        .get(0);
    assert!(stored.starts_with("scrypt-v1$17$8$1$"));
    f.sql("UPDATE aether_identity.schema_state SET version=900")
        .await;
    assert_eq!(f.identity.migrate().await.unwrap_err(), Error::Incompatible);
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.users").await,
        1
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn sessions_use_legacy_credentials_and_expire_revoke_and_isolate() {
    let f = Fixture::new(true).await;
    let token = f.login(" OWNER@example.test ").await;
    let user = f.identity.authenticate(token.expose()).await.unwrap();
    assert_eq!(user.id, "owner");
    assert_eq!(user.role, Role::Admin);
    let json = serde_json::to_string(&user).unwrap();
    assert!(!json.contains("password"));
    assert!(!json.contains(token.expose()));
    assert!(!format!("{token:?}").contains(token.expose()));
    let stored: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT token_hash FROM aether_identity.sessions", &[])
        .await
        .unwrap()
        .get(0);
    assert_ne!(stored, token.expose());
    assert_eq!(
        stored,
        format!("{:x}", Sha256::digest(token.expose().as_bytes()))
    );
    let other = Identity::new(f.pool.clone(), "another-company", 1).unwrap();
    assert_eq!(
        other.authenticate(token.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
    let reopened = Identity::new(f.pool.clone(), "company", 1).unwrap();
    assert_eq!(
        reopened.authenticate(token.expose()).await.unwrap().id,
        "owner"
    );
    reopened.sign_out(token.expose()).await.unwrap();
    assert_eq!(
        f.identity.authenticate(token.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
    let expired = f.login("owner").await;
    f.sql("UPDATE aether_identity.sessions SET expires=clock_timestamp()-interval '1 second'")
        .await;
    assert_eq!(
        f.identity.authenticate(expired.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
    assert_eq!(
        f.identity.authenticate("missing").await.unwrap_err(),
        Error::Unauthorized
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn persistent_throttle_reserves_concurrent_attempts_without_loopback_lockout() {
    let f = Fixture::new(true).await;
    f.sql("INSERT INTO aether_identity.attempts VALUES('company','login:user:owner',9,clock_timestamp()+interval '15 minutes')").await;
    let (a, b) = tokio::join!(
        f.identity
            .sign_in("owner", "incorrect-password", "127.0.0.1"),
        f.identity
            .sign_in("owner", "incorrect-password", "127.0.0.1")
    );
    let errors = [a.unwrap_err(), b.unwrap_err()];
    assert!(errors.contains(&Error::Throttled));
    assert!(errors.contains(&Error::InvalidCredentials));
    let reopened = Identity::new(f.pool.clone(), "company", 1).unwrap();
    assert_eq!(
        reopened
            .sign_in("owner", PASSWORD, "127.0.0.1")
            .await
            .unwrap_err(),
        Error::Throttled
    );
    assert_eq!(
        f.identity
            .authenticate(f.login("member").await.expose())
            .await
            .unwrap()
            .id,
        "member"
    );
    f.sql("UPDATE aether_identity.attempts SET until=clock_timestamp()-interval '1 second'")
        .await;
    f.login("owner").await;
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.attempts WHERE count<>0")
            .await,
        0
    );
    f.sql("INSERT INTO aether_identity.attempts VALUES('company','login:ip:192.0.2.2',10,clock_timestamp()+interval '15 minutes')").await;
    assert_eq!(
        f.identity
            .sign_in("member", PASSWORD, "192.0.2.2")
            .await
            .unwrap_err(),
        Error::Throttled
    );
    // Missing and disabled identities have the same externally visible refusal.
    assert_eq!(
        f.identity
            .sign_in("unknown", PASSWORD, "127.0.0.1")
            .await
            .unwrap_err(),
        Error::InvalidCredentials
    );
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='member'")
        .await;
    assert_eq!(
        f.identity
            .sign_in("member", PASSWORD, "127.0.0.1")
            .await
            .unwrap_err(),
        Error::InvalidCredentials
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn permissions_recheck_session_and_protect_administrator() {
    let f = Fixture::new(true).await;
    let owner = f.login("owner").await;
    let member = f.login("member").await;
    assert_eq!(
        f.identity
            .set_account_state(member.expose(), "owner", Role::Member, false)
            .await
            .unwrap_err(),
        Error::Forbidden
    );
    assert_eq!(
        f.identity
            .set_account_state(owner.expose(), "owner", Role::Member, true)
            .await
            .unwrap_err(),
        Error::Conflict
    );
    assert_eq!(
        f.identity
            .set_account_state(owner.expose(), "owner", Role::Admin, false)
            .await
            .unwrap_err(),
        Error::Conflict
    );
    f.identity
        .set_account_state(owner.expose(), "member", Role::Member, false)
        .await
        .unwrap();
    assert_eq!(
        f.identity.authenticate(member.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
    let second = f.login("second").await;
    f.identity
        .set_account_state(owner.expose(), "second", Role::Member, true)
        .await
        .unwrap();
    assert_eq!(
        f.identity
            .revoke_sessions(second.expose(), "owner")
            .await
            .unwrap_err(),
        Error::Unauthorized
    );
    let second = f.login("second").await;
    assert_eq!(
        f.identity
            .revoke_sessions(second.expose(), "owner")
            .await
            .unwrap_err(),
        Error::Forbidden
    );
    f.identity
        .revoke_sessions(owner.expose(), "owner")
        .await
        .unwrap();
    assert_eq!(
        f.identity.authenticate(owner.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn recovery_is_hashed_single_use_guarded_and_revokes_sessions() {
    let f = Fixture::new(true).await;
    let session = f.login("member").await;
    assert!(
        f.identity
            .request_recovery("unknown", "127.0.0.1")
            .await
            .unwrap()
            .is_none()
    );
    let first = f
        .identity
        .request_recovery("member", "127.0.0.1")
        .await
        .unwrap()
        .unwrap();
    let current = f
        .identity
        .request_recovery("MEMBER@example.test", "127.0.0.1")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        f.identity
            .recover_password(first.expose(), NEXT_PASSWORD)
            .await
            .unwrap_err(),
        Error::InvalidRecovery
    );
    let stored: String = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT token_hash FROM aether_identity.recovery", &[])
        .await
        .unwrap()
        .get(0);
    assert_ne!(stored, current.expose());
    assert_eq!(
        f.identity
            .recover_password(current.expose(), "short")
            .await
            .unwrap_err(),
        Error::InvalidInput
    );
    f.identity
        .recover_password(current.expose(), NEXT_PASSWORD)
        .await
        .unwrap();
    assert_eq!(
        f.identity
            .recover_password(current.expose(), PASSWORD)
            .await
            .unwrap_err(),
        Error::InvalidRecovery
    );
    assert_eq!(
        f.identity.authenticate(session.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
    let new = f
        .identity
        .sign_in("member", NEXT_PASSWORD, "127.0.0.1")
        .await
        .unwrap();
    let user = f.identity.authenticate(new.expose()).await.unwrap();
    assert!(user.email_verified);
    assert!(!user.must_change);
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.recovery")
            .await,
        0
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn identity_email_changes_invalidate_recovery_and_duplicate_email_rolls_back() {
    let f = Fixture::new(true).await;
    let session = f.login("member").await;
    let recovery = f
        .identity
        .request_recovery("member", "local")
        .await
        .unwrap()
        .unwrap();
    let user = f
        .identity
        .update_identity(session.expose(), " Changed Name ", "NEW@example.test")
        .await
        .unwrap();
    assert_eq!(user.email, "new@example.test");
    assert_eq!(user.full_name, "Changed Name");
    assert!(!user.email_verified);
    assert_eq!(
        f.identity
            .recover_password(recovery.expose(), NEXT_PASSWORD)
            .await
            .unwrap_err(),
        Error::InvalidRecovery
    );
    assert_eq!(
        f.identity
            .update_identity(session.expose(), "Duplicate", "OWNER@example.test")
            .await
            .unwrap_err(),
        Error::Conflict
    );
    assert_eq!(
        f.identity
            .authenticate(session.expose())
            .await
            .unwrap()
            .email,
        "new@example.test"
    );
    let expired = f
        .identity
        .request_recovery("member", "local")
        .await
        .unwrap()
        .unwrap();
    f.sql("UPDATE aether_identity.recovery SET expires=clock_timestamp()-interval '1 second'")
        .await;
    assert_eq!(
        f.identity
            .recover_password(expired.expose(), NEXT_PASSWORD)
            .await
            .unwrap_err(),
        Error::InvalidRecovery
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn password_reset_requires_change_and_change_revokes_every_session() {
    let f = Fixture::new(true).await;
    let owner = f.login("owner").await;
    let old = f.login("member").await;
    assert_eq!(
        f.identity
            .reset_password(owner.expose(), "owner", NEXT_PASSWORD)
            .await
            .unwrap_err(),
        Error::Forbidden
    );
    f.identity
        .reset_password(owner.expose(), "member", NEXT_PASSWORD)
        .await
        .unwrap();
    assert_eq!(
        f.identity.authenticate(old.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
    let forced = f
        .identity
        .sign_in("member", NEXT_PASSWORD, "local")
        .await
        .unwrap();
    assert!(
        f.identity
            .authenticate(forced.expose())
            .await
            .unwrap()
            .must_change
    );
    assert_eq!(
        f.identity
            .update_identity(forced.expose(), "Changed", "email@example.test")
            .await
            .unwrap_err(),
        Error::Forbidden
    );
    f.identity
        .change_password(forced.expose(), NEXT_PASSWORD, PASSWORD)
        .await
        .unwrap();
    assert_eq!(
        f.identity.authenticate(forced.expose()).await.unwrap_err(),
        Error::Unauthorized
    );
    let updated = f.login("member").await;
    assert!(
        !f.identity
            .authenticate(updated.expose())
            .await
            .unwrap()
            .must_change
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn audit_failure_rolls_back_sign_in_and_account_creation() {
    let f = Fixture::new(true).await;
    let owner = f.login("owner").await;
    f.sql("CREATE FUNCTION fail_identity_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER reject_identity_audit BEFORE INSERT ON aether_identity.audit FOR EACH ROW EXECUTE FUNCTION fail_identity_audit()").await;
    assert_eq!(
        f.identity
            .sign_in("member", PASSWORD, "local")
            .await
            .unwrap_err(),
        Error::Unavailable
    );
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.sessions WHERE user_id='member'")
            .await,
        0
    );
    assert_eq!(
        f.identity
            .create_user(owner.expose(), &account("newuser", Role::Member), PASSWORD)
            .await
            .unwrap_err(),
        Error::Unavailable
    );
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.users WHERE username='newuser'")
            .await,
        0
    );
    f.sql("DROP TRIGGER reject_identity_audit ON aether_identity.audit")
        .await;
    let user = f
        .identity
        .create_user(owner.expose(), &account("NEWUSER", Role::Member), PASSWORD)
        .await
        .unwrap();
    assert_eq!(user.username, "newuser");
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.audit WHERE action='user_created'")
            .await,
        1
    );
}
#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn disable_during_password_verification_cannot_create_a_session() {
    let f = Fixture::new(true).await;
    let mut client = f.pool.get().await.unwrap();
    let blocker = client.transaction().await.unwrap();
    blocker
        .execute(
            "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
            &[],
        )
        .await
        .unwrap();
    let authority = f.identity.clone();
    let login = tokio::spawn(async move { authority.sign_in("member", PASSWORD, "local").await });
    let deadline = tokio::time::Instant::now() + Duration::from_secs(25);
    loop {
        if f.count("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%1095062603%'").await>0 {break;}
        assert!(
            tokio::time::Instant::now() < deadline,
            "sign-in never reached commit recheck"
        );
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    blocker
        .execute(
            "UPDATE aether_identity.users SET active=false WHERE tenant='company' AND id='member'",
            &[],
        )
        .await
        .unwrap();
    blocker.commit().await.unwrap();
    assert_eq!(login.await.unwrap().unwrap_err(), Error::InvalidCredentials);
    assert_eq!(
        f.count("SELECT count(*) FROM aether_identity.sessions")
            .await,
        0
    );
}

#[tokio::test]
#[ignore = "private PostgreSQL runner required"]
async fn five_hundred_session_checks_recheck_revocation_with_a_bounded_pool() {
    let f = Fixture::new(true).await;
    let admin = f.login("owner").await;
    let member = f.login("member").await;
    for revoked in [false, true] {
        let mut jobs = tokio::task::JoinSet::new();
        let started = std::time::Instant::now();
        for _ in 0..500 {
            let identity = f.identity.clone();
            let token = member.expose().to_string();
            jobs.spawn(async move {
                let start = std::time::Instant::now();
                let result = identity.authenticate(&token).await;
                (start.elapsed(), result)
            });
        }
        let mut latencies = Vec::new();
        while let Some(job) = jobs.join_next().await {
            let (latency, result) = job.unwrap();
            if revoked {
                assert_eq!(result.unwrap_err(), Error::Unauthorized);
            } else {
                assert_eq!(result.unwrap().id, "member");
            }
            latencies.push(latency);
        }
        latencies.sort();
        assert_eq!(latencies.len(), 500);
        println!(
            "identity read burst: 500 checks; revoked={revoked}; total={}ms; p95={}ms; pool_size={}",
            started.elapsed().as_millis(),
            latencies[474].as_millis(),
            f.pool.status().size
        );
        assert!(f.pool.status().size <= 8);
        f.identity
            .revoke_sessions(admin.expose(), "member")
            .await
            .unwrap();
    }
}
