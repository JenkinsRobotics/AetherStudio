use super::{Documents, Result, commit, db};
use serde_json::{Value, json};

impl Documents {
    pub async fn record_backup_request(&self, token: &str) -> Result<()> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        if user.role != aether_identity::Role::Admin {
            return Err(aether_identity::Error::Forbidden.into());
        }
        self.audit(&tx, &user, "native_backup_requested", "")
            .await?;
        commit(tx).await
    }
    /// Aggregate tenant counts, under the same current authority as document APIs.
    /// Never expose account IDs, filenames, content or credential material.
    pub async fn maintenance_counts(&self, token: &str) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        if user.role != aether_identity::Role::Admin {
            return Err(aether_identity::Error::Forbidden.into());
        }
        let row = tx.query_one("SELECT (SELECT count(*) FROM aether_identity.users WHERE tenant=$1), (SELECT count(*) FROM aether_access.resources WHERE tenant=$1 AND kind='document'), (SELECT count(*) FROM aether_access.resources WHERE tenant=$1 AND kind='document' AND trashed)", &[&self.tenant()]).await.map_err(db)?;
        let result = json!({"users":row.get::<_,i64>(0), "documents":row.get::<_,i64>(1), "trashed_documents":row.get::<_,i64>(2)});
        commit(tx).await?;
        Ok(result)
    }
}
