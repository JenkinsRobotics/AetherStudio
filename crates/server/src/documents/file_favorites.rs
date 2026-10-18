//! Private file/folder favorites with permission-safe retry receipts.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub operation_id: String,
    pub id: String,
    pub favorite: bool,
}
impl Documents {
    pub async fn change_file_favorite(&self, token: &str, input: &Request) -> Result<Value> {
        if !valid_id(&input.id) || !valid_id(&input.operation_id) {
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
        let resource = self.require(&tx, &user, &input.id, Role::Viewer).await?;
        self.app(&tx, &user, &resource.app).await?;
        let request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        let current=tx.query_opt("SELECT favorite,revision FROM aether_access.file_favorites WHERE tenant=$1 AND user_id=$2 AND resource=$3", &[&self.tenant(),&user.id,&input.id]).await.map_err(db)?;
        if let Some(receipt)=tx.query_opt("SELECT request,applied_revision FROM aether_access.file_favorite_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3", &[&self.tenant(),&user.id,&input.operation_id]).await.map_err(db)? {
            if receipt.get::<_,Value>(0)!=request { return Err(Error::Conflict); }
            let response=json!({"ok":true,"applied_revision":receipt.get::<_,i64>(1),"favorite":current.as_ref().is_some_and(|r| r.get::<_,bool>(0)),"replayed":true});
            commit(tx).await?;
            return Ok(response);
        }
        let before = current
            .as_ref()
            .map(|r| json!({"favorite":r.get::<_,bool>(0),"revision":r.get::<_,i64>(1)}))
            .unwrap_or(Value::Null);
        let revision = current.as_ref().map_or(0, |r| r.get::<_, i64>(1)) + 1;
        if revision > u32::MAX as i64 {
            return Err(Error::Unsupported);
        }
        tx.execute("INSERT INTO aether_access.file_favorites VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant,user_id,resource) DO UPDATE SET favorite=excluded.favorite,revision=excluded.revision", &[&self.tenant(),&user.id,&input.id,&input.favorite,&revision]).await.map_err(db)?;
        self.audit(&tx, &user, "file_favorite", &input.id).await?;
        tx.execute(
            "INSERT INTO aether_access.file_favorite_receipts VALUES($1,$2,$3,$4,$5)",
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
        let after = json!({"favorite":input.favorite,"revision":revision});
        tx.execute("INSERT INTO aether_access.file_favorite_events(tenant,actor,resource,revision,operation_id,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7)", &[&self.tenant(),&user.id,&input.id,&revision,&input.operation_id,&before,&after]).await.map_err(db)?;
        commit(tx).await?;
        Ok(
            json!({"ok":true,"applied_revision":revision,"favorite":input.favorite,"replayed":false}),
        )
    }
}
