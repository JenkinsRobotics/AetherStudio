use super::*;
async fn call(f: &Fixture, who: &str, action: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(who)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn administration_read_is_admin_only_and_does_not_enroll_or_grant_content() {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("private-document"))
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.organizations(tenant,id,name) VALUES('company','private','Private organization'); INSERT INTO aether_access.workspaces(tenant,id,organization,name,is_default) VALUES('company','private-space','private','Private workspace',false); DELETE FROM aether_access.members WHERE user_id='admin'; DELETE FROM aether_access.workspace_members WHERE user_id='admin'").await;
    for who in ["alice", "bob"] {
        assert_eq!(
            call(&f, who, "administration", json!({})).await.status(),
            404
        );
    }
    let response = call(&f, "admin", "administration", json!({})).await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let v: Value = response.json().await.unwrap();
    assert_eq!(v["user"]["admin"], true);
    assert_eq!(v["apps"], json!([]));
    assert!(
        v["organizations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|o| o["id"] == "private")
    );
    assert!(
        v["workspaces"]
            .as_array()
            .unwrap()
            .iter()
            .any(|o| o["id"] == "private-space")
    );
    assert!(
        f.docs
            .read(&token("admin"), "private-document", None)
            .await
            .is_err()
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.members WHERE user_id='admin'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        call(&f, "admin", "administration", json!({"user":"alice"}))
            .await
            .status(),
        400
    );
    f.sql("INSERT INTO aether_access.organizations(tenant,id,name) SELECT 'company','large-'||n,'Large '||n FROM generate_series(1,1001)n").await;
    assert_eq!(
        call(&f, "admin", "administration", json!({}))
            .await
            .status(),
        501
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn provisioning_atomic_retries_create_one_organization_and_workspace() {
    let f = Fixture::new().await;
    let input = json!({"name":" Engineering ","organization":"","operation_id":"new-company"});
    let (a, b) = tokio::join!(
        call(&f, "admin", "organization_create", input.clone()),
        call(&f, "admin", "organization_create", input.clone())
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_eq!(a["id"], b["id"]);
    assert_ne!(a["replayed"], b["replayed"]);
    let org = a["id"].as_str().unwrap();
    let space = json!({"name":"Design","organization":org,"operation_id":"new-space"});
    let r = call(&f, "admin", "workspace_create", space.clone()).await;
    assert_eq!(r.status(), 200);
    let r: Value = r.json().await.unwrap();
    let replay: Value = call(&f, "admin", "workspace_create", space)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(replay["id"], r["id"]);
    assert_eq!(replay["replayed"], true);
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.workspaces WHERE organization=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
    assert_eq!(
        c.query_one(
            "SELECT name FROM aether_access.organizations WHERE id=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, String>(0),
        "Engineering"
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resource_receipts", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
    assert_eq!(
        call(
            &f,
            "admin",
            "organization_create",
            json!({"name":"Different","operation_id":"new-company","organization":""})
        )
        .await
        .status(),
        409
    );
    // An old operation cannot recreate membership removed after provisioning.
    c.execute(
        "DELETE FROM aether_access.members WHERE user_id='admin' AND organization=$1",
        &[&org],
    )
    .await
    .unwrap();
    assert_eq!(
        call(&f, "admin", "organization_create", input.clone())
            .await
            .status(),
        200
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.members WHERE user_id='admin' AND organization=$1",
            &[&org]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.sql("UPDATE aether_identity.users SET role='member' WHERE id='admin'")
        .await;
    assert_eq!(
        call(&f, "admin", "organization_create", input)
            .await
            .status(),
        404
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn provisioning_rejects_invalid_authority_and_rolls_back_all_created_rows() {
    let f = Fixture::new().await;
    let input = json!({"name":"Company","operation_id":"new-company"});
    assert_eq!(
        call(&f, "alice", "organization_create", input.clone())
            .await
            .status(),
        404
    );
    for name in ["", "   ", "Bad\nName"] {
        assert_eq!(
            call(
                &f,
                "admin",
                "organization_create",
                json!({"name":name,"operation_id":"invalid"})
            )
            .await
            .status(),
            400
        );
    }
    assert_eq!(
        call(
            &f,
            "admin",
            "workspace_create",
            json!({"name":"Space","organization":"missing","operation_id":"missing"})
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        call(
            &f,
            "admin",
            "organization_create",
            json!({"name":"Company"})
        )
        .await
        .status(),
        400
    );
    f.sql("CREATE FUNCTION reject_provision_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER reject_provision_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_provision_audit()").await;
    assert!(
        !call(&f, "admin", "organization_create", input.clone())
            .await
            .status()
            .is_success()
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.organizations WHERE name='Company'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resource_receipts", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    f.sql("DROP TRIGGER reject_provision_audit ON aether_access.audit")
        .await;
    assert_eq!(
        call(&f, "admin", "organization_create", input)
            .await
            .status(),
        200
    );
}
