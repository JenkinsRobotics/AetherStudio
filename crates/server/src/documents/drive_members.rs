//! Read-only organization directory for existing sharing/member controls.
use super::{Documents, Error, Result, commit, db, valid_id};
use serde::Deserialize;
use serde_json::{Value, json};
use std::time::Duration;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub organization: Option<String>,
    pub workspace: Option<String>,
}
impl Documents {
    pub async fn drive_members(&self, token: &str, input: &Request) -> Result<Value> {
        let org = input.organization.as_deref().unwrap_or("default");
        if !valid_id(org) || input.workspace.as_deref().is_some_and(|w| !valid_id(w)) {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(10),
            self.drive_members_inner(token, org, input.workspace.as_deref()),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }
    async fn drive_members_inner(
        &self,
        token: &str,
        org: &str,
        workspace: Option<&str>,
    ) -> Result<Value> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        let admin = user.role == aether_identity::Role::Admin;
        let exists:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM aether_access.organizations WHERE tenant=$1 AND id=$2)",&[&self.tenant(),&org]).await.map_err(db)?.get(0);
        if !exists || (!admin && self.member(&tx, &user.id, org).await?.is_none()) {
            return Err(Error::Denied);
        }
        if let Some(workspace) = workspace {
            let exists:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM aether_access.workspaces WHERE tenant=$1 AND organization=$2 AND id=$3)",&[&self.tenant(),&org,&workspace]).await.map_err(db)?.get(0);
            if !exists
                || (!admin
                    && self
                        .workspace_role(&tx, &user.id, org, workspace)
                        .await?
                        .is_none())
            {
                return Err(Error::Denied);
            }
        }
        // Administrative directory access grants no organization or file access.
        let rows=tx.query("SELECT u.id,u.username,coalesce(nullif(u.full_name,''),u.username) AS name,m.role FROM aether_identity.users u JOIN aether_access.members m ON m.tenant=u.tenant AND m.user_id=u.id WHERE u.tenant=$1 AND m.organization=$2 AND u.active ORDER BY coalesce(nullif(u.full_name,''),u.username) COLLATE \"C\",u.id COLLATE \"C\" LIMIT 1001",&[&self.tenant(),&org]).await.map_err(db)?;
        if rows.len() > 1000 {
            return Err(Error::Unsupported);
        }
        let mut members = Vec::new();
        for row in rows {
            let id: String = row.get(0);
            let mut member = json!({"id":id,"username":row.get::<_,String>(1),"name":row.get::<_,String>(2),"role":row.get::<_,String>(3)});
            if let Some(workspace) = workspace {
                let assigned = tx.query_opt("SELECT role FROM aether_access.workspace_members WHERE tenant=$1 AND workspace=$2 AND user_id=$3", &[&self.tenant(), &workspace, &id]).await.map_err(db)?.map(|r| r.get::<_, String>(0));
                member["assigned_workspace_role"] = json!(assigned);
                member["workspace_role"] = json!(
                    self.workspace_role(&tx, &id, org, workspace)
                        .await?
                        .map(|role| role.sql())
                );
            }
            members.push(member);
        }
        let result = json!({"members":members});
        if serde_json::to_vec(&result)
            .map_err(|_| Error::Incompatible)?
            .len()
            > 4 * 1024 * 1024
        {
            return Err(Error::Unsupported);
        }
        commit(tx).await?;
        Ok(result)
    }
}
