use super::*;
fn request(f: &Fixture, user: &str, action: &str, value: Value) -> reqwest::RequestBuilder {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&value)
}
async fn context(f: &Fixture, user: &str) -> Value {
    let response = request(f, user, "context", json!({})).send().await.unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(response.headers().get("set-cookie").is_none());
    response.json().await.unwrap()
}
fn ids(value: &Value, key: &str) -> Vec<String> {
    value[key]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["id"].as_str().unwrap().to_owned())
        .collect()
}
async fn seed(f: &Fixture) {
    f.sql("INSERT INTO aether_access.organizations VALUES('company','design','Design'),('company','hidden','Secret'); INSERT INTO aether_access.members VALUES('company','design','alice','member'),('company','hidden','bob','owner'); INSERT INTO aether_access.workspaces VALUES('company','design-default','design',true,'Everyone'),('company','private','design',false,'Private'),('company','hidden-default','hidden',true,'Secret workspace'); UPDATE aether_identity.users SET full_name='Alice Example' WHERE tenant='company' AND id='alice';").await;
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_context_current_memberships_and_app_catalog_are_readonly() {
    let f = Fixture::new().await;
    let initial = context(&f, "alice").await;
    assert!(ids(&initial, "organizations").is_empty());
    assert!(ids(&initial, "workspaces").is_empty());
    assert_eq!(ids(&initial, "apps"), ["drive", "map"]);
    seed(&f).await;
    let value = context(&f, "alice").await;
    assert_eq!(ids(&value, "organizations"), ["design"]);
    assert_eq!(
        value["user"],
        json!({"id":"alice","username":"alice","name":"Alice Example","admin":false})
    );
    assert_eq!(
        value["workspaces"],
        json!([{"id":"design-default","organization":"design","name":"Everyone","role":"viewer","is_default":true,"favorite":false,"opened":null,"preference_revision":0}])
    );
    assert_eq!(value["capabilities"]["workspace_preferences"], true);
    assert!(!value.to_string().contains("Secret"));
    f.sql(
        "INSERT INTO aether_access.workspace_members VALUES('company','private','alice','editor')",
    )
    .await;
    assert_eq!(
        context(&f, "alice").await["workspaces"][1]["role"],
        "editor"
    );
    f.sql("UPDATE aether_access.members SET role='owner' WHERE tenant='company' AND organization='design' AND user_id='alice'").await;
    assert!(
        context(&f, "alice").await["workspaces"]
            .as_array()
            .unwrap()
            .iter()
            .all(|r| r["role"] == "owner")
    );
    assert!(!ids(&context(&f, "admin").await, "organizations").contains(&"design".to_owned()));
    f.docs
        .configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    assert_eq!(ids(&context(&f, "alice").await, "apps"), ["drive"]);
    let c = f.pool.get().await.unwrap();
    for sql in [
        "SELECT count(*) FROM aether_access.enrolled WHERE user_id='alice'",
        "SELECT count(*) FROM aether_access.audit WHERE actor='alice'",
    ] {
        assert_eq!(c.query_one(sql, &[]).await.unwrap().get::<_, i64>(0), 0);
    }
    f.docs
        .configure_team(
            &token("admin"),
            "design-team",
            &["alice".into()],
            &["map".into()],
        )
        .await
        .unwrap();
    assert_eq!(ids(&context(&f, "alice").await, "apps"), ["drive", "map"]);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_context_refuses_impersonation_unmigrated_actions_and_revoked_accounts() {
    let f = Fixture::new().await;
    for body in [
        json!({"user":"admin"}),
        json!({"organization":"hidden"}),
        json!({"action":"list"}),
        json!([]),
        Value::Null,
    ] {
        assert_eq!(
            request(&f, "alice", "context", body)
                .send()
                .await
                .unwrap()
                .status(),
            400
        );
    }
    for (action, expected) in [("upload_start", 501), ("upload_finish", 400)] {
        let r = request(&f, "alice", action, json!({}))
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), expected);
        assert_eq!(r.json::<Value>().await.unwrap()["execution"], "rejected");
    }
    assert_eq!(
        f.client
            .post(format!("{}/api/drive/context", f.url))
            .header("origin", &f.url)
            .json(&json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
    assert_eq!(
        request(&f, "alice", "context", json!({}))
            .header("origin", "https://other.example")
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    f.docs
        .configure_app(&token("admin"), "drive", false, false)
        .await
        .unwrap();
    assert_eq!(
        request(&f, "alice", "context", json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        404
    );
    f.docs
        .configure_app(&token("admin"), "drive", true, false)
        .await
        .unwrap();
    f.sql(
        "UPDATE aether_identity.users SET must_change=true WHERE tenant='company' AND id='alice'",
    )
    .await;
    assert_eq!(
        request(&f, "alice", "context", json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET must_change=false,active=false WHERE tenant='company' AND id='alice'").await;
    assert_eq!(
        request(&f, "alice", "context", json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        401
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_context_limits_visible_directory_without_leaking_private_rows() {
    let f = Fixture::new().await;
    seed(&f).await;
    f.sql("INSERT INTO aether_access.workspaces(tenant,id,organization,name) SELECT 'company','private-'||n,'design','Hidden '||n FROM generate_series(1,1001) n").await;
    assert_eq!(
        ids(&context(&f, "alice").await, "workspaces"),
        ["design-default"]
    );
    f.sql("UPDATE aether_access.members SET role='owner' WHERE tenant='company' AND organization='design' AND user_id='alice'").await;
    assert_eq!(
        request(&f, "alice", "context", json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        501
    );
    f.sql("UPDATE aether_access.members SET role='member' WHERE tenant='company' AND organization='design' AND user_id='alice'; INSERT INTO aether_access.organizations SELECT 'company','large-'||n,'Visible '||n FROM generate_series(1,1000)n; INSERT INTO aether_access.members SELECT 'company','large-'||n,'alice','member' FROM generate_series(1,1000)n;").await;
    assert_eq!(
        request(&f, "alice", "context", json!({}))
            .send()
            .await
            .unwrap()
            .status(),
        501
    );
    // Existing paged endpoints continue to work beyond the old all-in-one limit.
    assert_eq!(
        f.post("alice", "organizations", json!({"limit":100}))
            .await
            .status(),
        200
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_context_rechecks_membership_after_waiting_and_does_not_reenroll() {
    let f = Fixture::new().await;
    seed(&f).await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute("DELETE FROM aether_access.members WHERE tenant='company' AND organization='design' AND user_id='alice'",&[]).await.unwrap();
    let req = request(&f, "alice", "context", json!({}));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    let r = pending.await.unwrap();
    assert_eq!(r.status(), 200);
    assert!(ids(&r.json::<Value>().await.unwrap(), "organizations").is_empty());
    assert!(ids(&context(&f, "alice").await, "organizations").is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_context_never_joins_another_tenants_matching_ids() {
    let f = Fixture::new().await;
    seed(&f).await;
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('other','alice','Other Alice','unused','member',false); INSERT INTO aether_access.organizations VALUES('other','design','Other secret'); INSERT INTO aether_access.members VALUES('other','design','alice','owner'); INSERT INTO aether_access.workspaces VALUES('other','design-default','design',true,'Other workspace'); INSERT INTO aether_access.workspace_members VALUES('other','design-default','alice','owner');").await;
    let value = context(&f, "alice").await;
    assert_eq!(value["workspaces"][0]["name"], "Everyone");
    assert_eq!(value["workspaces"][0]["role"], "viewer");
    assert!(!value.to_string().contains("Other"));
}
