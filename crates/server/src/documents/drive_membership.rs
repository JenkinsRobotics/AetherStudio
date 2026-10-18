//! Guarded Admin Center membership writes over canonical access rules.
use super::{Documents, Error, Result, commit, db, valid_id};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub organization: String,
    pub workspace: Option<String>,
    pub user: String,
    pub role: String,
    pub operation_id: String,
    #[serde(deserialize_with = "required_role")]
    pub expected_role: Option<String>,
}
fn required_role<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> std::result::Result<Option<String>, D::Error> {
    Option::<String>::deserialize(d)
}
impl Documents {
    pub async fn drive_member_update(&self, token: &str, input: &Request) -> Result<Value> {
        let valid_role = |r: &str| {
            if input.workspace.is_some() {
                matches!(r, "owner" | "editor" | "viewer")
            } else {
                matches!(r, "owner" | "member")
            }
        };
        if !valid_id(&input.organization)
            || !valid_id(&input.operation_id)
            || input.workspace.as_deref().is_some_and(|w| !valid_id(w))
            || input.user.is_empty()
            || input.user.len() > 256
            || input.user.chars().any(char::is_control)
            || (input.role != "remove" && !valid_role(&input.role))
            || input
                .expected_role
                .as_deref()
                .is_some_and(|r| !valid_role(r))
        {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            std::time::Duration::from_secs(20),
            self.member_update_inner(token, input),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn member_update_inner(&self, token: &str, input: &Request) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let actor = self.identity.authorize_transaction(&tx, token).await?;
        Self::admin(&actor)?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        let request = json!({"action":"drive_member_update","input":input});
        let saved=tx.query_opt("SELECT request,receipt FROM aether_access.resource_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3", &[&self.tenant(),&actor.id,&input.operation_id]).await.map_err(db)?;
        // An exact retry remains tied to the original immutable account ID even
        // if that account's username has subsequently changed.
        let target = if let Some(row) = &saved {
            if row.get::<_, Value>(0) != request {
                return Err(Error::Conflict);
            }
            row.get::<_, Value>(1)["member_id"]
                .as_str()
                .ok_or(Error::Incompatible)?
                .to_owned()
        } else {
            let matches=tx.query("SELECT id FROM aether_identity.users WHERE tenant=$1 AND (id=$2 OR username=$2) LIMIT 2", &[&self.tenant(),&input.user]).await.map_err(db)?;
            if matches.len() != 1 {
                return Err(Error::Denied);
            }
            matches[0].get::<_, String>(0)
        };
        let active: bool = tx
            .query_opt(
                "SELECT active FROM aether_identity.users WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &target],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Denied)?
            .get(0);
        let exists:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM aether_access.organizations WHERE tenant=$1 AND id=$2)", &[&self.tenant(),&input.organization]).await.map_err(db)?.get(0);
        if !exists {
            return Err(Error::Denied);
        }
        let current: Option<String> = if let Some(workspace) = &input.workspace {
            let exists:bool=tx.query_one("SELECT EXISTS(SELECT 1 FROM aether_access.workspaces WHERE tenant=$1 AND id=$2 AND organization=$3)", &[&self.tenant(),workspace,&input.organization]).await.map_err(db)?.get(0);
            if !exists {
                return Err(Error::Denied);
            }
            tx.query_opt("SELECT role FROM aether_access.workspace_members WHERE tenant=$1 AND workspace=$2 AND user_id=$3", &[&self.tenant(),workspace,&target]).await.map_err(db)?.map(|r|r.get(0))
        } else {
            self.member(&tx, &target, &input.organization).await?
        };
        if let Some(row) = saved {
            let mut receipt: Value = row.get(1);
            receipt["role"] = json!(current);
            receipt["replayed"] = json!(true);
            commit(tx).await?;
            return Ok(receipt);
        }
        if current != input.expected_role {
            return Err(Error::Conflict);
        }
        let role = (input.role != "remove").then_some(input.role.as_str());
        if role.is_some() && !active {
            return Err(Error::Denied);
        }
        if let Some(workspace) = &input.workspace {
            self.workspace_member_in(&tx, &input.organization, workspace, &target, role)
                .await?;
            self.audit(&tx, &actor, "workspace_member_user", &target)
                .await?;
            self.audit(&tx, &actor, "workspace_member", workspace)
                .await?;
        } else {
            self.organization_member_in(&tx, &actor, &input.organization, &target, role)
                .await?;
        }
        let result = json!({"ok":true,"organization":input.organization,"workspace":input.workspace,"user":input.user,"member_id":target,"operation_id":input.operation_id,"role":role,"applied_role":role,"replayed":false});
        tx.execute("INSERT INTO aether_access.resource_receipts(tenant,actor,operation_id,request,receipt) VALUES($1,$2,$3,$4,$5)", &[&self.tenant(),&actor.id,&input.operation_id,&request,&result]).await.map_err(db)?;
        commit(tx).await?;
        Ok(result)
    }
}
