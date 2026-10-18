//! Legacy workspace navigation, using current Studio membership in one snapshot.
use super::{Documents, Error, Result, commit, db, valid_id};
use aether_identity::User;
use serde_json::{Value, json};
use tokio_postgres::Transaction;

const MAX_DIRECTORY: i64 = 1000;
impl Documents {
    /// Does not enroll users or write preferences. The unpaged legacy response
    /// must be complete; larger installations use the paged directory endpoints.
    pub async fn drive_context(
        &self,
        token: &str,
        candidates: &[&str],
    ) -> Result<(User, Value, Vec<String>)> {
        if candidates.len() > 64 || candidates.iter().any(|id| !valid_id(id)) {
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
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        let mut allowed = Vec::new();
        for app in candidates {
            match self.app(&tx, &user, app).await {
                Ok(()) => allowed.push((*app).to_owned()),
                Err(Error::Denied) => (),
                Err(error) => return Err(error),
            }
        }
        let directory = self.drive_directory(&tx, &user).await?;
        commit(tx).await?;
        Ok((user, directory, allowed))
    }
    pub(super) async fn drive_directory(&self, tx: &Transaction<'_>, user: &User) -> Result<Value> {
        let orgs = tx.query("SELECT o.id,o.name,m.role FROM aether_access.organizations o JOIN aether_access.members m ON m.tenant=o.tenant AND m.organization=o.id WHERE o.tenant=$1 AND m.user_id=$2 ORDER BY o.id COLLATE \"C\" LIMIT $3", &[&self.tenant(), &user.id, &(MAX_DIRECTORY+1)]).await.map_err(db)?;
        // Apply visibility before the limit: private workspaces cannot consume
        // the result budget, leak names or turn a permitted directory into 501.
        let rows = tx.query("SELECT w.id,w.organization,w.name,w.is_default,CASE WHEN m.role='owner' THEN 'owner' ELSE coalesce(wm.role,'viewer') END,coalesce(p.favorite,false),p.opened,coalesce(p.revision,0) FROM aether_access.workspaces w JOIN aether_access.members m ON m.tenant=w.tenant AND m.organization=w.organization LEFT JOIN aether_access.workspace_members wm ON wm.tenant=w.tenant AND wm.workspace=w.id AND wm.user_id=m.user_id LEFT JOIN aether_access.workspace_preferences p ON p.tenant=w.tenant AND p.workspace=w.id AND p.user_id=m.user_id WHERE w.tenant=$1 AND m.user_id=$2 AND (m.role='owner' OR wm.role IS NOT NULL OR (w.is_default AND w.id<>'shared')) ORDER BY w.organization COLLATE \"C\",w.id COLLATE \"C\" LIMIT $3", &[&self.tenant(), &user.id, &(MAX_DIRECTORY+1)]).await.map_err(db)?;
        if orgs.len() > MAX_DIRECTORY as usize || rows.len() > MAX_DIRECTORY as usize {
            return Err(Error::Unsupported);
        }
        let organizations: Vec<Value> = orgs.iter().map(|r| json!({"id":r.get::<_,String>(0),"name":r.get::<_,String>(1),"role":r.get::<_,String>(2)})).collect();
        let workspaces: Vec<Value> = rows.iter().map(|r| json!({"id":r.get::<_,String>(0),"organization":r.get::<_,String>(1),"name":r.get::<_,String>(2),"is_default":r.get::<_,bool>(3),"role":r.get::<_,String>(4),"favorite":r.get::<_,bool>(5),"opened":r.get::<_,Option<f64>>(6),"preference_revision":r.get::<_,i64>(7)})).collect();
        Ok(
            json!({"organizations":organizations,"workspaces":workspaces,"capabilities":{"workspace_preferences":true,"directory_paging":true}}),
        )
    }
}
