//! Personal workspace navigation preferences never change document history.
use super::{Documents, Error, Result, commit, db, valid_id};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    WorkspaceOpen,
    WorkspaceFavorite,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub action: Action,
    pub operation_id: String,
    pub workspace: String,
    pub favorite: Option<bool>,
}
impl Documents {
    pub async fn change_workspace_preference(&self, token: &str, input: &Request) -> Result<Value> {
        if !valid_id(&input.workspace)
            || !valid_id(&input.operation_id)
            || matches!(input.action, Action::WorkspaceFavorite) != input.favorite.is_some()
        {
            return Err(Error::Invalid);
        }
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
        let organization: String = tx
            .query_opt(
                "SELECT organization FROM aether_access.workspaces WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &input.workspace],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Denied)?
            .get(0);
        self.workspace_role(&tx, &user.id, &organization, &input.workspace)
            .await?
            .ok_or(Error::Denied)?;
        let request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        if let Some(row)=tx.query_opt("SELECT request,applied_revision FROM aether_access.workspace_preference_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3",&[&self.tenant(),&user.id,&input.operation_id]).await.map_err(db)? {
            if row.get::<_,Value>(0)!=request {return Err(Error::Conflict);}
            let directory=self.drive_directory(&tx,&user).await?;
            let response=json!({"workspaces":directory["workspaces"],"applied_revision":row.get::<_,i64>(1),"replayed":true});
            commit(tx).await?;
            return Ok(response);
        }
        let row=tx.query_opt("SELECT favorite,opened,revision FROM aether_access.workspace_preferences WHERE tenant=$1 AND user_id=$2 AND workspace=$3",&[&self.tenant(),&user.id,&input.workspace]).await.map_err(db)?;
        let before=row.as_ref().map(|r|json!({"favorite":r.get::<_,bool>(0),"opened":r.get::<_,Option<f64>>(1),"revision":r.get::<_,i64>(2)})).unwrap_or(Value::Null);
        let mut favorite = row.as_ref().is_some_and(|r| r.get::<_, bool>(0));
        let mut opened = row.as_ref().and_then(|r| r.get::<_, Option<f64>>(1));
        let revision = row.as_ref().map_or(0, |r| r.get::<_, i64>(2)) + 1;
        if revision > u32::MAX as i64 {
            return Err(Error::Unsupported);
        }
        let event = match input.action {
            Action::WorkspaceFavorite => {
                favorite = input.favorite.ok_or(Error::Invalid)?;
                "workspace_favorite"
            }
            Action::WorkspaceOpen => {
                let now: f64 = tx
                    .query_one(
                        "SELECT extract(epoch from clock_timestamp())::double precision",
                        &[],
                    )
                    .await
                    .map_err(db)?
                    .get(0);
                let stamp = opened.map_or(now, |prior| now.max(prior.next_up()));
                if !stamp.is_finite() {
                    return Err(Error::Incompatible);
                }
                opened = Some(stamp);
                "workspace_open"
            }
        };
        tx.execute("INSERT INTO aether_access.workspace_preferences(tenant,user_id,workspace,favorite,opened,revision) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant,user_id,workspace) DO UPDATE SET favorite=excluded.favorite,opened=excluded.opened,revision=excluded.revision",&[&self.tenant(),&user.id,&input.workspace,&favorite,&opened,&revision]).await.map_err(db)?;
        self.audit(&tx, &user, event, &input.workspace).await?;
        tx.execute(
            "INSERT INTO aether_access.workspace_preference_receipts VALUES($1,$2,$3,$4,$5)",
            &[
                &self.tenant(),
                &user.id,
                &input.operation_id,
                &request,
                &revision,
            ],
        )
        .await
        .map_err(db)?;
        let after = json!({"favorite":favorite,"opened":opened,"revision":revision});
        tx.execute("INSERT INTO aether_access.workspace_preference_events(tenant,actor,workspace,revision,operation_id,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7)",&[&self.tenant(),&user.id,&input.workspace,&revision,&input.operation_id,&before,&after]).await.map_err(db)?;
        let directory = self.drive_directory(&tx, &user).await?;
        let response = json!({"workspaces":directory["workspaces"],"applied_revision":revision,"replayed":false});
        commit(tx).await?;
        Ok(response)
    }
}
