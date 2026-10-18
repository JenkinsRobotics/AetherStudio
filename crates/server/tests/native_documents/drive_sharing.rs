use super::*;
async fn list(f: &Fixture, user: &str, input: Value) -> Value {
    let reply = f
        .client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap();
    assert_eq!(reply.status(), 200);
    reply.json().await.unwrap()
}
fn ids(value: &Value) -> Vec<&str> {
    value["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["id"].as_str().unwrap())
        .collect()
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    for user in ["bob", "eve"] {
        f.docs
            .set_organization_member(&token("admin"), "default", user, Some("member"))
            .await
            .unwrap();
    }
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Folder")
        .await
        .unwrap();
    let input = mutation(
        json!({"operation_id":"new","document_id":"drawing","change":{"kind":"create","app":"map","name":"Drawing","content_base64":"e30="},"location":{"organization":"default","workspace":null,"parent":"folder"}}),
    );
    f.docs.mutate(&token("alice"), &input).await.unwrap();
    f
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_inherited_current_grants_preserve_author_and_time_without_recipients() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("UPDATE aether_access.grant_provenance SET shared_at=1234.125")
        .await;
    for (user, direction) in [("bob", "with"), ("alice", "by")] {
        let page = list(&f, user, json!({"view":"shared","shared_scope":direction})).await;
        assert_eq!(ids(&page), ["folder", "drawing"]);
        for row in page["files"].as_array().unwrap() {
            assert_eq!(row["shared_by"], "alice");
            assert_eq!(row["shared_at"], 1234.125);
            assert!(row.get("recipients").is_none());
            assert!(row.get("grants").is_none());
        }
    }
    assert!(ids(&list(&f, "alice", json!({"view":"shared"})).await).is_empty());
    assert!(ids(&list(&f, "bob", json!({"view":"shared","shared_scope":"by"})).await).is_empty());
    assert!(ids(&list(&f, "eve", json!({"view":"shared","query":"Drawing"})).await).is_empty());
    let found = list(&f, "bob", json!({"view":"shared","query":"Drawing"})).await;
    assert_eq!(ids(&found), ["drawing"]);
    f.docs
        .grant(&token("alice"), "folder", "bob", None)
        .await
        .unwrap();
    assert!(ids(&list(&f, "alice", json!({"view":"shared","shared_scope":"by"})).await).is_empty());
    assert!(ids(&list(&f, "bob", json!({"view":"shared"})).await).is_empty());
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_access.grant_provenance", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_unknown_provenance_stays_unknown_and_inactive_recipients_are_excluded() {
    let f = seed().await;
    f.sql("INSERT INTO aether_access.grants VALUES('company','folder','bob','viewer')")
        .await;
    let page = list(&f, "alice", json!({"view":"shared","shared_scope":"by"})).await;
    assert_eq!(ids(&page), ["folder", "drawing"]);
    for row in page["files"].as_array().unwrap() {
        assert!(row["shared_by"].is_null());
        assert!(row["shared_at"].is_null());
    }
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let unchanged = list(&f, "bob", json!({"view":"shared"})).await;
    assert!(unchanged["files"][0]["shared_at"].is_null());
    assert!(unchanged["files"][0]["shared_by"].is_null());
    f.sql("UPDATE aether_identity.users SET active=false WHERE tenant='company' AND id='bob'")
        .await;
    assert!(ids(&list(&f, "alice", json!({"view":"shared","shared_scope":"by"})).await).is_empty());
    f.sql("UPDATE aether_identity.users SET active=true WHERE tenant='company' AND id='bob'; DELETE FROM aether_access.members WHERE tenant='company' AND user_id='bob'").await;
    assert!(ids(&list(&f, "alice", json!({"view":"shared","shared_scope":"by"})).await).is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_workspace_and_active_link_views_follow_existing_access() {
    let f = seed().await;
    let input = mutation(
        json!({"operation_id":"team","document_id":"team","change":{"kind":"create","app":"map","name":"Team","content_base64":"e30="},"location":{"organization":"default","workspace":"shared","parent":null}}),
    );
    f.docs.mutate(&token("alice"), &input).await.unwrap();
    assert_eq!(
        ids(&list(&f, "bob", json!({"view":"shared"})).await),
        ["team"]
    );
    assert_eq!(
        ids(&list(&f, "alice", json!({"view":"shared","shared_scope":"by"})).await),
        ["team"]
    );
    f.sql("INSERT INTO aether_access.links VALUES('company','link','folder','viewer',clock_timestamp()+interval '1 hour',false); INSERT INTO aether_access.link_visits VALUES('company','link','bob')").await;
    assert_eq!(
        ids(&list(&f, "bob", json!({"view":"shared"})).await),
        ["folder", "drawing", "team"]
    );
    f.sql("UPDATE aether_access.links SET revoked=true").await;
    assert_eq!(
        ids(&list(&f, "bob", json!({"view":"shared"})).await),
        ["team"]
    );
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'",
    )
    .await;
    assert!(ids(&list(&f, "bob", json!({"view":"shared"})).await).is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_author_role_change_and_audit_failure_cannot_leave_false_provenance() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("UPDATE aether_access.grant_provenance SET shared_by='admin',shared_at=1234.125")
        .await;
    assert!(ids(&list(&f, "alice", json!({"view":"shared","shared_scope":"by"})).await).is_empty());
    let before = list(&f, "bob", json!({"view":"shared"})).await;
    assert_eq!(before["files"][0]["shared_by"], "admin");
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Editor))
        .await
        .unwrap();
    let changed = list(&f, "bob", json!({"view":"shared"})).await;
    assert_eq!(changed["files"][0]["shared_by"], "admin");
    assert_eq!(changed["files"][0]["shared_at"], 1234.125);
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("CREATE FUNCTION reject_grant_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER reject_grant_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_grant_audit()").await;
    assert!(
        f.docs
            .grant(&token("alice"), "folder", "bob", Some(Role::Editor))
            .await
            .is_err()
    );
    assert_eq!(list(&f, "bob", json!({"view":"shared"})).await, before);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_schema12_upgrade_is_explicit_atomic_and_retains_grants() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let prior = [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
        include_str!("../../src/documents/006-legacy-history.sql"),
        include_str!("../../src/documents/007-named-versions.sql"),
        include_str!("../../src/documents/008-collaboration.sql"),
        include_str!("../../src/documents/009-workspace-preferences.sql"),
        include_str!("../../src/documents/010-legacy-file-metadata.sql"),
        include_str!("../../src/documents/011-file-favorites.sql"),
    ]
    .concat();
    let checksum = format!("{:x}", Sha256::digest(prior.as_bytes()));
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; UPDATE aether_access.schema_state SET version=11,checksum='{checksum}'; CREATE VIEW aether_access.grant_provenance AS SELECT 1 AS conflict")).await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        11
    );
    f.sql("DROP VIEW aether_access.grant_provenance").await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    let page = list(&f, "bob", json!({"view":"shared"})).await;
    assert_eq!(ids(&page), ["folder", "drawing"]);
    assert!(page["files"][0]["shared_by"].is_null());
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_queued_revocation_and_tenant_ids_never_leak_other_shared_names() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('other','alice','Other Alice','unused','member',false),('other','bob','Other Bob','unused','member',false); INSERT INTO aether_access.organizations VALUES('other','default','Other'); INSERT INTO aether_access.members VALUES('other','default','bob','member'); INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,folder_name) VALUES('other','folder','default','alice','folder','drive','Other secret'); INSERT INTO aether_access.grants VALUES('other','folder','bob','viewer'); INSERT INTO aether_access.grant_provenance VALUES('other','folder','bob','alice',987654321.0)").await;
    let page = list(&f, "bob", json!({"view":"shared","organization":"all"})).await;
    assert_eq!(ids(&page), ["folder", "drawing"]);
    assert_eq!(page["files"][0]["shared_by"], "alice");
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let request = f
        .client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({"view":"shared"}));
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.execute(
        "DELETE FROM aether_access.grants WHERE tenant='company' AND user_id='bob'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let response = pending.await.unwrap();
    assert_eq!(response.status(), 200);
    assert!(ids(&response.json::<Value>().await.unwrap()).is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_scan_budget_fails_without_partial_success() {
    let f = seed().await;
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) SELECT 'company','many-'||n,'many-'||n,'unused','member',false FROM generate_series(1,4097) n; INSERT INTO aether_access.members SELECT 'company','default','many-'||n,'member' FROM generate_series(1,4097) n; INSERT INTO aether_access.grants SELECT 'company','folder','many-'||n,'viewer' FROM generate_series(1,4097) n").await;
    let response = f
        .client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({"view":"shared","shared_scope":"by"}))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 501);
    assert!(
        response
            .json::<Value>()
            .await
            .unwrap()
            .get("files")
            .is_none()
    );
}

async fn details(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/sharing", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_details_are_owner_only_current_and_do_not_expose_link_secrets() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "folder", "bob", Some(Role::Editor))
        .await
        .unwrap();
    f.sql("INSERT INTO aether_access.links VALUES('company','secret-link','folder','viewer',to_timestamp(123456.25),true)").await;
    for user in ["bob", "eve"] {
        assert_eq!(
            details(&f, user, json!({"id":"folder"})).await.status(),
            404
        );
    }
    let result = details(&f, "alice", json!({"id":"folder"})).await;
    assert_eq!(result.status(), 200);
    let result: Value = result.json().await.unwrap();
    assert_eq!(
        result["grants"],
        json!([{"user_id":"bob","role":"editor","name":"bob"}])
    );
    assert_eq!(
        result["links"],
        json!([{"id":"secret-link","role":"viewer","expires":123456.25,"revoked":true,"audience":"organization"}])
    );
    assert!(result["links"][0].get("token").is_none());
    // The child inherits access, not a fictional duplicate direct grant.
    let child: Value = details(&f, "alice", json!({"id":"drawing"}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(child, json!({"grants":[],"links":[]}));
    for input in [
        json!({}),
        json!({"id":"../folder"}),
        json!({"id":"folder","user":"bob"}),
    ] {
        assert_eq!(details(&f, "alice", input).await.status(), 400);
    }
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='drive'",
    )
    .await;
    assert_eq!(
        details(&f, "alice", json!({"id":"folder"})).await.status(),
        404
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_details_queued_membership_removal_does_not_reenroll() {
    let f = seed().await;
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let request = f
        .client
        .post(format!("{}/api/drive/sharing", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({"id":"folder"}));
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.execute(
        "DELETE FROM aether_access.members WHERE tenant='company' AND user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    assert_eq!(f.pool.get().await.unwrap().query_one("SELECT count(*) FROM aether_access.members WHERE tenant='company' AND user_id='alice'",&[]).await.unwrap().get::<_,i64>(0),0);
}

async fn members(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/members", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_members_are_current_public_fields_and_explicit_workspace_roles() {
    let f = seed().await;
    f.sql("UPDATE aether_identity.users SET full_name='Bob Person' WHERE tenant='company' AND id='bob'; UPDATE aether_identity.users SET active=false WHERE tenant='company' AND id='eve'").await;
    let response = members(&f, "alice", json!({"workspace":"shared"})).await;
    assert_eq!(response.status(), 200);
    let value: Value = response.json().await.unwrap();
    let users = value["members"].as_array().unwrap();
    assert_eq!(users.len(), 3);
    let bob = users.iter().find(|v| v["id"] == "bob").unwrap();
    assert_eq!(
        bob,
        &json!({"id":"bob","username":"bob","name":"Bob Person","role":"member","workspace_role":"viewer","assigned_workspace_role":"viewer"})
    );
    for member in users {
        assert_eq!(member.as_object().unwrap().len(), 6);
    }
    f.sql("DELETE FROM aether_access.workspace_members WHERE tenant='company' AND workspace='shared' AND user_id='bob'").await;
    assert_eq!(
        members(&f, "bob", json!({"workspace":"shared"}))
            .await
            .status(),
        404
    );
    let response = members(&f, "alice", json!({"workspace":"shared"})).await;
    let value: Value = response.json().await.unwrap();
    assert!(
        value["members"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| v["id"] == "bob")
            .unwrap()["workspace_role"]
            .is_null()
    );
    assert_eq!(members(&f, "bob", json!({})).await.status(), 200);
    for input in [
        json!({"organization":"../invalid"}),
        json!({"organization":"default","user":"admin"}),
        json!({"workspace":"../invalid"}),
    ] {
        assert_eq!(members(&f, "alice", input).await.status(), 400);
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_member_directory_admin_access_does_not_grant_file_access_or_membership() {
    let f = seed().await;
    f.sql("INSERT INTO aether_access.organizations VALUES('company','private-org','Private'); INSERT INTO aether_access.members VALUES('company','private-org','alice','owner'); INSERT INTO aether_access.workspaces(tenant,id,organization,name,is_default) VALUES('company','private-workspace','private-org','Private workspace',true)").await;
    assert_eq!(
        members(&f, "bob", json!({"organization":"private-org"}))
            .await
            .status(),
        404
    );
    assert_eq!(
        members(
            &f,
            "admin",
            json!({"organization":"private-org","workspace":"private-workspace"})
        )
        .await
        .status(),
        200
    );
    assert_eq!(
        members(
            &f,
            "alice",
            json!({"organization":"default","workspace":"private-workspace"})
        )
        .await
        .status(),
        404
    );
    assert_eq!(
        members(&f, "admin", json!({"organization":"missing"}))
            .await
            .status(),
        404
    );
    assert_eq!(f.pool.get().await.unwrap().query_one("SELECT count(*) FROM aether_access.members WHERE tenant='company' AND organization='private-org' AND user_id='admin'",&[]).await.unwrap().get::<_,i64>(0),0);
    // Matching identifiers in another tenant never enter the directory.
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('other','alice','Other Alice','unused','member',false); INSERT INTO aether_access.organizations VALUES('other','private-org','Other'); INSERT INTO aether_access.members VALUES('other','private-org','alice','owner')").await;
    let value: Value = members(&f, "alice", json!({"organization":"private-org"}))
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(value["members"].as_array().unwrap().len(), 1);
    assert_eq!(value["members"][0]["name"], "alice");
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn sharing_members_queued_revocation_and_directory_budget_fail_closed() {
    let f = seed().await;
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let request = f
        .client
        .post(format!("{}/api/drive/members", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({}));
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.execute(
        "DELETE FROM aether_access.members WHERE tenant='company' AND user_id='bob'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) SELECT 'company','many-'||n,'many-'||n,'unused','member',false FROM generate_series(1,1001) n; INSERT INTO aether_access.members SELECT 'company','default','many-'||n,'member' FROM generate_series(1,1001) n").await;
    let response = members(&f, "alice", json!({})).await;
    assert_eq!(response.status(), 501);
    assert!(
        response
            .json::<Value>()
            .await
            .unwrap()
            .get("members")
            .is_none()
    );
    let response = details(&f, "alice", json!({"id":"folder"})).await;
    assert_eq!(response.status(), 200);
}
