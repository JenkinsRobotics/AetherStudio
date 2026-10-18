//! Guarded browser sharing writes over the existing grant authority.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::Duration;

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub id: String,
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
    pub async fn drive_grant(&self, token: &str, input: &Request) -> Result<Value> {
        if [&input.id, &input.user, &input.operation_id]
            .into_iter()
            .any(|v| !valid_id(v))
            || !matches!(input.role.as_str(), "viewer" | "editor" | "remove")
            || input
                .expected_role
                .as_deref()
                .is_some_and(|r| !matches!(r, "viewer" | "editor"))
        {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(20),
            self.drive_grant_inner(token, input),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn drive_grant_inner(&self, token: &str, input: &Request) -> Result<Value> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        let resource = self.require(&tx, &user, &input.id, Role::Owner).await?;
        self.app(&tx, &user, &resource.app).await?;
        let current: Option<String> = tx.query_opt("SELECT role FROM aether_access.grants WHERE tenant=$1 AND resource=$2 AND user_id=$3", &[&self.tenant(), &input.id, &input.user]).await.map_err(db)?.map(|r| r.get(0));
        let request = json!({"action":"drive_grant", "input":input});
        // Replayed commands report the current state but never apply their old
        // decision again. Permissions are checked before disclosing the receipt.
        if let Some(row) = tx.query_opt("SELECT request,receipt FROM aether_access.resource_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3", &[&self.tenant(), &user.id, &input.operation_id]).await.map_err(db)? {
            if row.get::<_, Value>(0) != request { return Err(Error::Conflict); }
            let mut result: Value = row.get(1);
            result["role"] = json!(current);
            result["replayed"] = json!(true);
            commit(tx).await?;
            return Ok(result);
        }
        if current != input.expected_role {
            return Err(Error::Conflict);
        }
        let role = match input.role.as_str() {
            "viewer" => Some(Role::Viewer),
            "editor" => Some(Role::Editor),
            _ => None,
        };
        // Revocation of an existing grant remains possible after an account is
        // disabled. Adding access must never enroll or rejoin its recipient.
        let target = tx
            .query_opt(
                "SELECT active FROM aether_identity.users WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &input.user],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Denied)?;
        if role.is_some()
            && (!target.get::<_, bool>(0)
                || self
                    .member(&tx, &input.user, &resource.location.organization)
                    .await?
                    .is_none())
        {
            return Err(Error::Denied);
        }
        if role.is_some() && current.is_none() {
            let count: i64 = tx.query_one("SELECT (SELECT count(*) FROM aether_access.grants WHERE tenant=$1 AND resource=$2)+(SELECT count(*) FROM aether_access.links WHERE tenant=$1 AND resource=$2)", &[&self.tenant(), &input.id]).await.map_err(db)?.get(0);
            if count >= 1000 {
                return Err(Error::Unsupported);
            }
        }
        self.grant_in(&tx, &user, &input.id, &input.user, role)
            .await?;
        let applied = role.map(|r| r.sql());
        let result = json!({"ok":true,"id":input.id,"user":input.user,"operation_id":input.operation_id,"role":applied,"applied_role":applied,"replayed":false});
        tx.execute("INSERT INTO aether_access.resource_receipts(tenant,actor,operation_id,request,receipt) VALUES($1,$2,$3,$4,$5)", &[&self.tenant(), &user.id, &input.operation_id, &request, &result]).await.map_err(db)?;
        commit(tx).await?;
        Ok(result)
    }
}
