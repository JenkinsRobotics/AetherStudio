//! Exercise the directory through the native HTTP/session/SQL boundary.
use super::*;
use aether_protocol_core::directory::{OrganizationListRequest, WorkspaceListRequest};

async fn ok(f: &Fixture, user: &str, path: &str, input: Value) -> Value {
    let response = f.post(user, path, input).await;
    let status = response.status();
    let value: Value = response.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
async fn organization(f: &Fixture, id: &str) {
    ok(f,"admin","directory",json!({"action":"create_organization","id":id,"name":"  Design company  ","default_workspace_id":format!("{id}-default")})).await;
}
async fn workspace(f: &Fixture, id: &str) {
    ok(
        f,
        "admin",
        "directory",
        json!({"action":"create_workspace","id":id,"name":id,"organization":"design"}),
    )
    .await;
}
async fn member(f: &Fixture, user: &str, role: Value) {
    ok(
        f,
        "admin",
        "admin",
        json!({"action":"organization_member","organization":"design","user":user,"role":role}),
    )
    .await;
}
fn assignment(workspace: &str, user: &str, role: Value) -> Value {
    json!({"action":"workspace_member","organization":"design","workspace":workspace,"user":user,"role":role})
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn directory_creation_paging_and_private_membership() {
    let f = Fixture::new().await;
    organization(&f, "design").await;
    organization(&f, "hidden").await;
    member(&f, "alice", json!("member")).await;
    workspace(&f, "a-private").await;
    workspace(&f, "z-private").await;
    let list = ok(&f, "alice", "organizations", json!({"limit":1})).await;
    assert_eq!(list["organizations"][0]["id"], "default");
    assert_eq!(list["next_after"], "default");
    let list = ok(
        &f,
        "alice",
        "organizations",
        json!({"limit":1,"after":"default"}),
    )
    .await;
    assert_eq!(list["organizations"][0]["name"], "Design company");
    assert_eq!(list["organizations"][0]["role"], "member");
    assert!(list["next_after"].is_null());
    let list = ok(
        &f,
        "alice",
        "workspaces",
        json!({"organization":"design","limit":1}),
    )
    .await;
    assert_eq!(list["workspaces"][0]["id"], "design-default");
    assert_eq!(list["workspaces"][0]["role"], "viewer");
    assert_eq!(list["workspaces"][0]["is_default"], true);
    assert!(list["next_after"].is_null());
    assert!(!list.to_string().contains("private"));
    assert_eq!(
        f.post(
            "alice",
            "workspaces",
            json!({"organization":"hidden","limit":10})
        )
        .await
        .status(),
        404
    );
    ok(
        &f,
        "admin",
        "directory",
        assignment("z-private", "alice", json!("editor")),
    )
    .await;
    let list = ok(
        &f,
        "alice",
        "workspaces",
        json!({"organization":"design","limit":1}),
    )
    .await;
    assert_eq!(list["next_after"], "design-default");
    let list = ok(
        &f,
        "alice",
        "workspaces",
        json!({"organization":"design","limit":1,"after":"design-default"}),
    )
    .await;
    assert_eq!(list["workspaces"][0]["role"], "editor");
    assert!(list["next_after"].is_null());
    // Organization ownership does not authorize server administration.
    member(&f, "alice", json!("owner")).await;
    assert_eq!(
        f.post(
            "alice",
            "directory",
            json!({"action":"create_workspace","organization":"design","id":"bad","name":"Bad"})
        )
        .await
        .status(),
        404
    );
    member(&f, "alice", json!("owner")).await;
    member(&f, "admin", json!(null)).await;
    // Administrators may provision without gaining access to private contents.
    workspace(&f, "admin-provisioned").await;
    assert_eq!(
        f.post(
            "admin",
            "workspaces",
            json!({"organization":"design","limit":10})
        )
        .await
        .status(),
        404
    );
    let list = ok(&f, "admin", "organizations", json!({"limit":100})).await;
    assert!(
        !list["organizations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["id"] == "design")
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn directory_roles_drive_actual_document_access_and_revocation() {
    let f = Fixture::new().await;
    organization(&f, "design").await;
    member(&f, "alice", json!("member")).await;
    member(&f, "bob", json!("member")).await;
    workspace(&f, "production").await;
    ok(
        &f,
        "admin",
        "directory",
        assignment("production", "alice", json!("editor")),
    )
    .await;
    let mut request = create("show");
    request.location = Some(Location {
        organization: "design".into(),
        workspace: Some("production".into()),
        parent: None,
    });
    f.docs.mutate(&token("alice"), &request).await.unwrap();
    assert!(matches!(
        f.docs.read(&token("bob"), "show", None).await,
        Err(Error::Denied)
    ));
    ok(
        &f,
        "admin",
        "directory",
        assignment("production", "alice", json!("viewer")),
    )
    .await;
    assert!(f.docs.read(&token("alice"), "show", None).await.is_ok());
    assert!(matches!(
        f.docs
            .mutate(&token("alice"), &save("show", "save-denied", 1))
            .await,
        Err(Error::Denied)
    ));
    ok(
        &f,
        "admin",
        "directory",
        assignment("production", "alice", json!(null)),
    )
    .await;
    assert!(matches!(
        f.docs.read(&token("alice"), "show", None).await,
        Err(Error::Denied)
    ));
    ok(
        &f,
        "admin",
        "grant",
        json!({"id":"show","user":"alice","role":"viewer"}),
    )
    .await;
    assert!(f.docs.read(&token("alice"), "show", None).await.is_ok());
    // An explicit document grant survives workspace removal, but not org removal.
    member(&f, "alice", json!(null)).await;
    assert!(matches!(
        f.docs.read(&token("alice"), "show", None).await,
        Err(Error::Denied)
    ));
    member(&f, "alice", json!("member")).await;
    assert!(matches!(
        f.docs.read(&token("alice"), "show", None).await,
        Err(Error::Denied)
    ));
    request.document_id = "default-show".into();
    request.operation_id = "default-create".into();
    request.location.as_mut().unwrap().workspace = Some("design-default".into());
    assert!(matches!(
        f.docs.mutate(&token("alice"), &request).await,
        Err(Error::Denied)
    ));
    f.docs.mutate(&token("admin"), &request).await.unwrap();
    assert!(
        f.docs
            .read(&token("alice"), "default-show", None)
            .await
            .is_ok()
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn directory_last_owner_is_serialized_and_invalid_requests_do_not_mutate() {
    let f = Fixture::new().await;
    organization(&f, "design").await;
    member(&f, "alice", json!("member")).await;
    workspace(&f, "production").await;
    assert_eq!(
        f.post(
            "admin",
            "directory",
            assignment("production", "admin", json!(null))
        )
        .await
        .status(),
        409
    );
    ok(
        &f,
        "admin",
        "directory",
        assignment("production", "alice", json!("owner")),
    )
    .await;
    let (a, b) = tokio::join!(
        f.post(
            "admin",
            "directory",
            assignment("production", "admin", json!(null))
        ),
        f.post(
            "admin",
            "directory",
            assignment("production", "alice", json!("editor"))
        )
    );
    let mut statuses = [a.status().as_u16(), b.status().as_u16()];
    statuses.sort();
    assert_eq!(statuses, [200, 409]);
    for (request, status) in [
        (assignment("production", "eve", json!("owner")), 404),
        (
            json!({"action":"workspace_member","organization":"default","workspace":"production","user":"admin","role":"owner"}),
            404,
        ),
        (
            json!({"action":"workspace_member","organization":"design","workspace":"production","user":"admin"}),
            400,
        ),
        (
            json!({"action":"create_organization","id":"new","name":" ","default_workspace_id":"ws"}),
            400,
        ),
        (
            json!({"action":"create_workspace","id":"new","name":"x".repeat(81),"organization":"design"}),
            400,
        ),
        (
            json!({"action":"create_workspace","id":"new","name":"Nice","organization":"design","actor":"admin"}),
            400,
        ),
    ] {
        assert_eq!(f.post("admin", "directory", request).await.status(), status);
    }
    for query in [
        json!({"limit":0}),
        json!({"limit":101}),
        json!({"limit":1,"after":"x/y"}),
        json!({"limit":1,"tenant":"other"}),
    ] {
        assert_eq!(f.post("admin", "organizations", query).await.status(), 400);
    }
    assert_eq!(
        f.client
            .post(format!("{}/api/v1/documents/directory", f.url))
            .header("origin", "https://untrusted.example")
            .header("cookie", format!("{COOKIE}={}", token("admin")))
            .json(&assignment("production", "admin", json!(null)))
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn directory_creation_and_audit_are_atomic() {
    let f = Fixture::new().await;
    organization(&f, "design").await;
    assert_eq!(f.post("admin","directory",json!({"action":"create_organization","id":"rolled-back","name":"No partial organization","default_workspace_id":"design-default"})).await.status(),409);
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.organizations WHERE id='rolled-back'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.sql("CREATE FUNCTION reject_directory_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_directory_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_directory_audit()").await;
    assert_eq!(f.post("admin","directory",json!({"action":"create_organization","id":"audit-fail","name":"Fail","default_workspace_id":"audit-workspace"})).await.status(),503);
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.organizations WHERE id='audit-fail'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.workspaces WHERE id='audit-workspace'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        f.post(
            "admin",
            "directory",
            assignment("design-default", "admin", json!("editor"))
        )
        .await
        .status(),
        409
    );
    f.sql("DROP TRIGGER reject_directory_audit ON aether_access.audit")
        .await;
    member(&f, "alice", json!("member")).await;
    ok(
        &f,
        "admin",
        "directory",
        assignment("design-default", "alice", json!("editor")),
    )
    .await;
    assert_eq!(c.query_one("SELECT count(*) FROM aether_access.audit WHERE tenant='company' AND actor='admin' AND action='workspace_member' AND target='design-default'",&[]).await.unwrap().get::<_,i64>(0),1);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn directory_schema_upgrade_preserves_data_and_refuses_tampering() {
    let f = Fixture::new().await;
    let c = f.pool.get().await.unwrap();
    // Restore the exact frozen v1 schema, with real identity and store intact.
    f.sql("DROP SCHEMA aether_access CASCADE").await;
    f.sql(include_str!("../../src/documents/schema.sql")).await;
    let checksum = format!(
        "{:x}",
        Sha256::digest(include_str!("../../src/documents/schema.sql"))
    );
    c.execute(
        "INSERT INTO aether_access.schema_state VALUES(true,1,$1)",
        &[&checksum],
    )
    .await
    .unwrap();
    f.sql("INSERT INTO aether_access.organizations VALUES('company','original'); INSERT INTO aether_access.members VALUES('company','original','alice','owner'); INSERT INTO aether_access.workspaces VALUES('company','original-ws','original',true); INSERT INTO aether_access.workspace_members VALUES('company','original-ws','alice','editor'); INSERT INTO aether_access.resources VALUES('company','original-folder','original','original-ws',NULL,'alice','folder','drive',false)").await;
    assert!(matches!(
        f.docs.check_schema().await,
        Err(Error::Incompatible)
    ));
    assert_eq!(
        c.query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        1
    );
    // A partially conflicting migration must roll all DDL back.
    f.sql("ALTER TABLE aether_access.workspaces ADD COLUMN name text")
        .await;
    assert!(f.docs.migrate().await.is_err());
    assert_eq!(c.query_one("SELECT count(*) FROM information_schema.columns WHERE table_schema='aether_access' AND table_name='organizations' AND column_name='name'",&[]).await.unwrap().get::<_,i64>(0),0);
    f.sql("ALTER TABLE aether_access.workspaces DROP COLUMN name")
        .await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    let row=c.query_one("SELECT w.name,w.is_default,r.workspace,m.role FROM aether_access.workspaces w JOIN aether_access.resources r ON r.tenant=w.tenant AND r.workspace=w.id JOIN aether_access.workspace_members m ON m.tenant=w.tenant AND m.workspace=w.id WHERE w.id='original-ws'",&[]).await.unwrap();
    assert_eq!(row.get::<_, String>(0), "original-ws");
    assert!(row.get::<_, bool>(1));
    assert_eq!(row.get::<_, String>(2), "original-ws");
    assert_eq!(row.get::<_, String>(3), "editor");
    f.sql("UPDATE aether_access.schema_state SET checksum='tampered'")
        .await;
    assert!(matches!(
        f.docs.check_schema().await,
        Err(Error::Incompatible)
    ));
    assert!(matches!(f.docs.migrate().await, Err(Error::Incompatible)));
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn directory_tenant_isolation_and_disabled_identity() {
    let f = Fixture::new().await;
    organization(&f, "design").await;
    let identity = Identity::new(f.pool.clone(), "other-company", 2).unwrap();
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('other-company','admin','admin','unused','admin',false)").await;
    f.pool.get().await.unwrap().execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES('other-company',$1,'admin',clock_timestamp()+interval '1 hour')",&[&format!("{:x}",Sha256::digest(token("admin")))]).await.unwrap();
    let docs = Documents::new(
        f.pool.clone(),
        identity,
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    let page = docs
        .list_organizations(
            &token("admin"),
            &OrganizationListRequest {
                after: None,
                limit: 100,
            },
        )
        .await
        .unwrap();
    assert_eq!(page.organizations.len(), 1);
    assert_eq!(page.organizations[0].id, "default");
    assert!(matches!(
        docs.list_workspaces(
            &token("admin"),
            &WorkspaceListRequest {
                organization: "design".into(),
                after: None,
                limit: 100
            }
        )
        .await,
        Err(Error::Denied)
    ));
    f.sql("UPDATE aether_identity.users SET active=false WHERE tenant='company' AND id='admin'")
        .await;
    assert_eq!(
        f.post("admin", "organizations", json!({"limit":10}))
            .await
            .status(),
        401
    );
}
