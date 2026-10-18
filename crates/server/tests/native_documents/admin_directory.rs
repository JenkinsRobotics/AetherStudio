use super::*;
async fn post(f: &Fixture, user: &str, path: &str, data: Value) -> reqwest::Response {
    f.client
        .post(format!("{}{path}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&data)
        .send()
        .await
        .unwrap()
}
async fn read(f: &Fixture, user: &str) -> reqwest::Response {
    f.client
        .get(format!("{}/api/v1/admin/directory", f.url))
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn team_grants_and_revocation_use_current_authority_and_redacted_directory() {
    let f = Fixture::new().await;
    assert_eq!(read(&f, "alice").await.status(), 403);
    assert_eq!(
        post(
            &f,
            "alice",
            "/api/admin/team",
            json!({"name":"Operators","members":["alice"],"apps":["map"]})
        )
        .await
        .status(),
        403
    );
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/access",
            json!({"id":"map","restricted":true})
        )
        .await
        .status(),
        200
    );
    assert!(
        f.docs
            .application_status(Some(&token("alice")), &["map"])
            .await
            .unwrap()
            .1
            .is_empty()
    );
    let response = post(
        &f,
        "admin",
        "/api/admin/team",
        json!({"name":"Operators","members":["alice","alice"],"apps":["map"]}),
    )
    .await;
    assert_eq!(response.status(), 200);
    let id = response.json::<Value>().await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(
        f.docs
            .application_status(Some(&token("alice")), &["map"])
            .await
            .unwrap()
            .1,
        vec!["map"]
    );
    let snapshot = read(&f, "admin").await.json::<Value>().await.unwrap();
    assert_eq!(snapshot["teams"][0]["name"], "Operators");
    assert_eq!(snapshot["teams"][0]["members"], json!(["alice"]));
    assert_eq!(snapshot["access"]["map"], 1);
    for user in snapshot["users"].as_array().unwrap() {
        assert!(user.get("password").is_none());
    }
    assert!(!snapshot.to_string().contains(&token("admin")));
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/team",
            json!({"id":id,"action":"delete"})
        )
        .await
        .status(),
        200
    );
    assert!(
        f.docs
            .application_status(Some(&token("alice")), &["map"])
            .await
            .unwrap()
            .1
            .is_empty()
    );
    assert_eq!(
        read(&f, "admin").await.json::<Value>().await.unwrap()["teams"],
        json!([])
    );
    f.sql("UPDATE aether_identity.users SET role='member' WHERE id='admin'")
        .await;
    assert_eq!(read(&f, "admin").await.status(), 403);
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/access",
            json!({"id":"map","restricted":false})
        )
        .await
        .status(),
        403
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn invalid_teams_and_duplicate_names_do_not_partially_change_permissions() {
    let f = Fixture::new().await;
    for data in [
        json!({"name":"Bad","members":["alice"],"apps":["ui"]}),
        json!({"name":"Bad","members":["alice"],"apps":["unknown"]}),
        json!({"name":" ","members":[],"apps":[]}),
        json!({"action":"unexpected","name":"Bad","members":[],"apps":[]}),
    ] {
        assert_eq!(
            post(&f, "admin", "/api/admin/team", data).await.status(),
            400
        );
    }
    let first = json!({"id":"one","name":"Operators","members":["alice"],"apps":["map"]});
    assert_eq!(
        post(&f, "admin", "/api/admin/team", first).await.status(),
        200
    );
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/team",
            json!({"id":"two","name":"Operators","members":["bob"],"apps":["map"]})
        )
        .await
        .status(),
        409
    );
    let directory = read(&f, "admin").await.json::<Value>().await.unwrap();
    assert_eq!(directory["teams"].as_array().unwrap().len(), 1);
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/access",
            json!({"id":"ui","restricted":false})
        )
        .await
        .status(),
        400
    );
    f.sql("CREATE FUNCTION reject_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_admin_change BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_admin_audit()").await;
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/team",
            json!({"id":"one","name":"Replaced","members":[],"apps":[]})
        )
        .await
        .status(),
        503
    );
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/access",
            json!({"id":"map","restricted":true})
        )
        .await
        .status(),
        503
    );
    let directory = read(&f, "admin").await.json::<Value>().await.unwrap();
    assert_eq!(directory["teams"][0]["name"], "Operators");
    assert_eq!(directory["teams"][0]["members"], json!(["alice"]));
    assert_eq!(directory["access"]["map"], 0);
}
