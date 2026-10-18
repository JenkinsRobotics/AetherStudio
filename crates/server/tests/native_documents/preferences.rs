use super::*;
use aether_identity::{Error as IdentityError, PreferencePatch};
use base64::{Engine, engine::general_purpose::STANDARD};

async fn update(f: &Fixture, user: &str, value: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/preferences", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&value)
        .send()
        .await
        .unwrap()
}
async fn profile(f: &Fixture, user: &str) -> Value {
    let r = f
        .client
        .get(format!("{}/api/status", f.url))
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 200);
    r.json::<Value>().await.unwrap()["user"].clone()
}
fn patch(value: Value) -> PreferencePatch {
    serde_json::from_value(value).unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn preferences_roundtrip_partial_clear_large_avatar_and_reopen() {
    let f = Fixture::new().await;
    let before = profile(&f, "alice").await;
    assert_eq!(before["theme"], "dark");
    assert_eq!(before["avatar"], "");
    let mut raw = vec![0; 262144];
    raw[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
    let avatar = format!("data:image/png;base64,{}", STANDARD.encode(raw));
    let r = update(
        &f,
        "alice",
        json!({"theme":"light","theme_id":"  custom-theme  ","avatar":avatar}),
    )
    .await;
    assert_eq!(r.status(), 200);
    assert_eq!(r.json::<Value>().await.unwrap(), json!({"ok":true}));
    let mut expected = before.clone();
    expected["theme"] = json!("light");
    expected["theme_id"] = json!("custom-theme");
    expected["avatar"] = json!(avatar);
    assert_eq!(profile(&f, "alice").await, expected);
    assert_eq!(profile(&f, "bob").await["theme"], "dark");
    assert_eq!(
        update(&f, "alice", json!({"theme":"system"}))
            .await
            .status(),
        200
    );
    let reopened = Identity::new(f.pool.clone(), "company", 2).unwrap();
    let user = reopened.session_profile(&token("alice")).await.unwrap();
    assert_eq!(user.preferences.theme, "system");
    assert_eq!(user.preferences.avatar, avatar);
    assert_eq!(
        update(&f, "alice", json!({"avatar":"","theme_id":""}))
            .await
            .status(),
        200
    );
    assert_eq!(profile(&f, "alice").await["avatar"], "");
    // Private app authorization does not carry a large display image.
    let small = f.identity.authenticate(&token("alice")).await.unwrap();
    assert!(
        !serde_json::to_value(small)
            .unwrap()
            .as_object()
            .unwrap()
            .contains_key("avatar")
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn preferences_validation_bounds_and_authority_are_current() {
    let f = Fixture::new().await;
    for value in [
        json!({"theme":null}),
        json!({"theme":"blue"}),
        json!({"theme_id":"x".repeat(65)}),
        json!({"avatar":"data:image/svg+xml;base64,PHN2Zz4="}),
        json!({"user_id":"bob","theme":"light"}),
    ] {
        assert_eq!(update(&f, "alice", value).await.status(), 400);
    }
    assert_eq!(
        update(&f, "alice", json!({"avatar":"x".repeat(400000)}))
            .await
            .status(),
        413
    );
    assert_eq!(profile(&f, "alice").await["theme"], "dark");
    let cross = f
        .client
        .post(format!("{}/api/preferences", f.url))
        .header("origin", "https://elsewhere.test")
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({"theme":"light"}))
        .send()
        .await
        .unwrap();
    assert_eq!(cross.status(), 403);
    assert_eq!(
        update(&f, "missing", json!({"theme":"light"}))
            .await
            .status(),
        401
    );
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='alice'")
        .await;
    assert_eq!(
        update(&f, "alice", json!({"theme":"light"})).await.status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET must_change=false,active=false WHERE id='alice'")
        .await;
    assert_eq!(
        update(&f, "alice", json!({"theme":"light"})).await.status(),
        401
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn preferences_concurrent_patches_and_failed_audit_preserve_state() {
    let f = Fixture::new().await;
    let (a, b) = tokio::join!(
        update(&f, "alice", json!({"theme":"light"})),
        update(&f, "alice", json!({"theme_id":"custom"}))
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let saved = profile(&f, "alice").await;
    assert_eq!(saved["theme"], "light");
    assert_eq!(saved["theme_id"], "custom");
    f.sql("ALTER TABLE aether_identity.audit ADD CONSTRAINT fail_preferences CHECK(action<>'preferences_updated') NOT VALID").await;
    assert!(
        !update(&f, "alice", json!({"theme":"dark"}))
            .await
            .status()
            .is_success()
    );
    assert_eq!(profile(&f, "alice").await, saved);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn preferences_queued_update_observes_session_revocation() {
    let f = Fixture::new().await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
        &[],
    )
    .await
    .unwrap();
    let identity = f.identity.clone();
    let pending = tokio::spawn(async move {
        identity
            .update_preferences(&token("alice"), &patch(json!({"theme":"light"})))
            .await
    });
    f.waiting("pg_advisory_xact_lock(hashtextextended($1,1095062603))")
        .await;
    tx.execute(
        "DELETE FROM aether_identity.sessions WHERE tenant='company' AND user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(
        pending.await.unwrap(),
        Err(IdentityError::Unauthorized)
    ));
    let count: i64 = c
        .query_one(
            "SELECT count(*) FROM aether_identity.preferences WHERE user_id='alice'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 0);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn preferences_schema_upgrade_preserves_v1_and_refuses_unknown_or_corrupt_markers() {
    let f = Fixture::new().await;
    let checksum = format!(
        "{:x}",
        Sha256::digest(include_str!("../../../identity/src/schema.sql"))
    );
    f.sql(&format!("DROP TABLE IF EXISTS aether_access.live_editor_calls; DROP TABLE aether_identity.oauth_grants, aether_identity.oauth_requests, aether_identity.oauth_clients, aether_identity.agent_connections; DROP TABLE aether_identity.preferences; UPDATE aether_identity.schema_state SET version=1,checksum='{checksum}'")).await;
    assert!(matches!(
        f.identity.check_schema().await,
        Err(IdentityError::Incompatible)
    ));
    f.identity.migrate().await.unwrap();
    f.identity.migrate().await.unwrap();
    f.identity.check_schema().await.unwrap();
    assert_eq!(profile(&f, "alice").await["theme"], "dark");
    assert_eq!(
        f.identity.authenticate(&token("alice")).await.unwrap().id,
        "alice"
    );
    assert_eq!(
        update(&f, "alice", json!({"theme":"light"})).await.status(),
        200
    );
    f.sql("UPDATE aether_identity.schema_state SET checksum='corrupt'")
        .await;
    assert!(matches!(
        f.identity.migrate().await,
        Err(IdentityError::Incompatible)
    ));
    f.sql("UPDATE aether_identity.schema_state SET version=999")
        .await;
    assert!(matches!(
        f.identity.migrate().await,
        Err(IdentityError::Incompatible)
    ));
    // Failed upgrade rolls back the marker and leaves credentials/sessions intact.
    f.sql(&format!("DROP TABLE IF EXISTS aether_access.live_editor_calls; DROP TABLE aether_identity.oauth_grants, aether_identity.oauth_requests, aether_identity.oauth_clients, aether_identity.agent_connections; DROP TABLE aether_identity.preferences; UPDATE aether_identity.schema_state SET version=1,checksum='{checksum}'; CREATE VIEW aether_identity.preferences AS SELECT 1 AS conflict")).await;
    assert!(f.identity.migrate().await.is_err());
    let version: i32 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT version FROM aether_identity.schema_state", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(version, 1);
    assert_eq!(
        f.identity.authenticate(&token("alice")).await.unwrap().id,
        "alice"
    );
    f.sql("DROP VIEW aether_identity.preferences").await;
    f.identity.migrate().await.unwrap();
    assert_eq!(profile(&f, "alice").await["theme"], "dark");
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn preferences_tenants_do_not_share_same_user_ids_or_sessions() {
    let f = Fixture::new().await;
    f.sql("INSERT INTO aether_identity.users SELECT 'other',id,username,password,role,active,must_change,full_name,email,email_verified FROM aether_identity.users; INSERT INTO aether_identity.sessions SELECT 'other',token_hash,user_id,created,expires FROM aether_identity.sessions").await;
    let other = Identity::new(f.pool.clone(), "other", 2).unwrap();
    other
        .update_preferences(
            &token("alice"),
            &patch(json!({"theme":"light","theme_id":"other-tenant"})),
        )
        .await
        .unwrap();
    assert_eq!(
        other
            .session_profile(&token("alice"))
            .await
            .unwrap()
            .preferences
            .theme,
        "light"
    );
    assert_eq!(profile(&f, "alice").await["theme"], "dark");
    assert_eq!(
        update(&f, "alice", json!({"theme":"system"}))
            .await
            .status(),
        200
    );
    assert_eq!(
        other
            .session_profile(&token("alice"))
            .await
            .unwrap()
            .preferences
            .theme,
        "light"
    );
}
