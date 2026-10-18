use super::*;
async fn call(f: &Fixture, who: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/member_update", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(who)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
fn request(op: &str, who: &str, workspace: Option<&str>, role: &str, expected: Value) -> Value {
    json!({"organization":"engineering","workspace":workspace,"user":who,"role":role,"expected_role":expected,"operation_id":op})
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.sql("INSERT INTO aether_access.organizations VALUES('company','engineering','Engineering'); INSERT INTO aether_access.members VALUES('company','engineering','alice','owner'); INSERT INTO aether_access.workspaces(tenant,id,organization,name,is_default) VALUES('company','design','engineering','Design',true); INSERT INTO aether_access.workspace_members VALUES('company','design','alice','owner'); UPDATE aether_identity.users SET username='bob.person' WHERE id='bob'; DELETE FROM aether_access.members WHERE user_id='admin'; DELETE FROM aether_access.workspace_members WHERE user_id='admin'").await;
    f
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn membership_guarded_retries_preserve_later_revocations_without_default_enrollment() {
    let f = seed().await;
    f.sql("DELETE FROM aether_access.workspace_members WHERE user_id='bob'; DELETE FROM aether_access.members WHERE user_id='bob'; DELETE FROM aether_access.enrolled WHERE user_id='bob'").await;
    let add = request("join", "bob.person", None, "member", Value::Null);
    let (a, b) = tokio::join!(
        call(&f, "admin", add.clone()),
        call(&f, "admin", add.clone())
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_eq!(a["member_id"], "bob");
    assert_ne!(a["replayed"], b["replayed"]);
    assert_eq!(
        call(
            &f,
            "admin",
            request("stale", "bob", None, "owner", Value::Null)
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        call(
            &f,
            "admin",
            request("space", "bob", Some("design"), "editor", Value::Null)
        )
        .await
        .status(),
        200
    );
    assert_eq!(
        call(
            &f,
            "admin",
            request("leave", "bob", None, "remove", json!("member"))
        )
        .await
        .status(),
        200
    );
    f.sql("UPDATE aether_identity.users SET username='renamed' WHERE id='bob'")
        .await;
    let replay = call(&f, "admin", add.clone()).await;
    assert_eq!(replay.status(), 200);
    let replay: Value = replay.json().await.unwrap();
    assert_eq!(replay["role"], Value::Null);
    assert_eq!(replay["applied_role"], "member");
    assert_eq!(replay["replayed"], true);
    let c = f.pool.get().await.unwrap();
    for table in ["members", "workspace_members"] {
        assert_eq!(
            c.query_one(
                &format!(
                    "SELECT count(*) FROM aether_access.{table} WHERE user_id IN ('bob','admin')"
                ),
                &[]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0
        );
    }
    assert_eq!(
        call(
            &f,
            "admin",
            request("join", "bob.person", None, "owner", Value::Null)
        )
        .await
        .status(),
        409
    );
    f.sql("UPDATE aether_identity.users SET role='member' WHERE id='admin'")
        .await;
    assert_eq!(call(&f, "admin", add).await.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn membership_current_admin_last_owner_validation_and_direct_role_projection() {
    let f = seed().await;
    // Organization owners cannot bypass server administration.
    assert_eq!(
        call(
            &f,
            "alice",
            request("no-admin", "bob", None, "member", Value::Null)
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        call(
            &f,
            "admin",
            request("last-org", "alice", None, "remove", json!("owner"))
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        call(
            &f,
            "admin",
            request(
                "last-space",
                "alice",
                Some("design"),
                "viewer",
                json!("owner")
            )
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        call(
            &f,
            "admin",
            request("not-member", "bob", Some("design"), "editor", Value::Null)
        )
        .await
        .status(),
        404
    );
    for bad in [
        json!({"organization":"engineering","user":"bob","role":"member","operation_id":"missing-guard"}),
        request("bad-role", "bob", None, "editor", Value::Null),
        request(
            "bad-expected",
            "bob",
            Some("design"),
            "editor",
            json!("member"),
        ),
    ] {
        assert_eq!(call(&f, "admin", bad).await.status(), 400);
    }
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='bob'")
        .await;
    assert_eq!(
        call(
            &f,
            "admin",
            request("disabled", "bob", None, "member", Value::Null)
        )
        .await
        .status(),
        404
    );
    f.sql("UPDATE aether_identity.users SET active=true WHERE id='bob'")
        .await;
    assert_eq!(
        call(
            &f,
            "admin",
            request("join", "bob", None, "owner", Value::Null)
        )
        .await
        .status(),
        200
    );
    let value: Value = f
        .client
        .post(format!("{}/api/drive/members", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("admin")))
        .json(&json!({"organization":"engineering","workspace":"design"}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let bob = value["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["id"] == "bob")
        .unwrap();
    assert_eq!(bob["workspace_role"], "owner");
    assert!(bob["assigned_workspace_role"].is_null());
    // Inherited ownership is not a direct assignment and cannot be used as its guard.
    assert_eq!(
        call(
            &f,
            "admin",
            request("inherited", "bob", Some("design"), "editor", json!("owner"))
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        call(
            &f,
            "admin",
            request("direct", "bob", Some("design"), "editor", Value::Null)
        )
        .await
        .status(),
        200
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn membership_audit_failure_rolls_back_cascades_and_receipts() {
    let f = seed().await;
    assert_eq!(
        call(
            &f,
            "admin",
            request("join", "bob", None, "member", Value::Null)
        )
        .await
        .status(),
        200
    );
    assert_eq!(
        call(
            &f,
            "admin",
            request("space", "bob", Some("design"), "editor", Value::Null)
        )
        .await
        .status(),
        200
    );
    let mutation = mutation(
        json!({"operation_id":"create-team-file","document_id":"team-file","change":{"kind":"create","app":"map","name":"Team File","content_base64":"e30="},"location":{"organization":"engineering","workspace":"design"}}),
    );
    f.docs.mutate(&token("alice"), &mutation).await.unwrap();
    f.docs
        .grant(&token("alice"), "team-file", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("CREATE FUNCTION reject_member_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='organization_member' THEN RAISE EXCEPTION 'audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_member_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_member_audit()").await;
    let removal = request("remove", "bob", None, "remove", json!("member"));
    assert_eq!(call(&f, "admin", removal.clone()).await.status(), 503);
    let c = f.pool.get().await.unwrap();
    for (table, predicate) in [
        ("members", "organization='engineering'"),
        ("workspace_members", "workspace='design'"),
        ("grants", "resource='team-file'"),
    ] {
        assert_eq!(
            c.query_one(
                &format!(
                    "SELECT count(*) FROM aether_access.{table} WHERE user_id='bob' AND {predicate}"
                ),
                &[]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            1
        );
    }
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.resource_receipts WHERE operation_id='remove'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.sql("DROP TRIGGER reject_member_audit ON aether_access.audit")
        .await;
    assert_eq!(call(&f, "admin", removal).await.status(), 200);
    assert!(f.docs.read(&token("bob"), "team-file", None).await.is_err());
    assert_eq!(
        call(
            &f,
            "admin",
            request("rejoin", "bob", None, "member", Value::Null)
        )
        .await
        .status(),
        200
    );
    assert_eq!(c.query_one("SELECT count(*) FROM aether_access.grants WHERE resource='team-file' AND user_id='bob'",&[]).await.unwrap().get::<_,i64>(0),0);
    assert_eq!(c.query_one("SELECT count(*) FROM aether_access.workspace_members WHERE workspace='design' AND user_id='bob'",&[]).await.unwrap().get::<_,i64>(0),0);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn membership_queued_request_observes_revoked_admin_authority() {
    let f = seed().await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
        &[],
    )
    .await
    .unwrap();
    tx.execute(
        "UPDATE aether_identity.users SET role='member' WHERE id='admin'",
        &[],
    )
    .await
    .unwrap();
    let req = f
        .client
        .post(format!("{}/api/drive/member_update", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("admin")))
        .json(&request("queued", "bob", None, "member", Value::Null));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062603").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
}
