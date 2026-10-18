//! Authorized invalidation snapshots, not an edit log or a second write authority.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize)]
pub struct ChangeState {
    pub schema: u8,
    pub document_id: String,
    pub state_token: String,
    pub main_revision: i64,
    pub latest_revision: i64,
    pub collaboration_revision: i64,
    pub writable: bool,
}

impl Documents {
    pub async fn change_state(&self, token: &str, app: &str, id: &str) -> Result<ChangeState> {
        if !valid_id(id) || !valid_id(app) {
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
        self.app(&tx, &user, app).await?;
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        if resource.app != app || resource.kind != "document" {
            return Err(Error::Denied);
        }
        let writable = match self.require(&tx, &user, id, Role::Editor).await {
            Ok(_) => true,
            Err(Error::Denied) => false,
            Err(e) => return Err(e),
        };
        // One MVCC statement captures all content and metadata state coherently.
        // Bounds match native history/branch listing contracts. Nothing scans
        // document bytes or grows with the number of metadata operations.
        let row = tx.query_opt("SELECT d.head_revision,
            (SELECT max(revision) FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2),
            COALESCE((SELECT revision FROM aether_access.collaboration_heads WHERE tenant=$1 AND document_id=$2),0),
            (SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.id),'[]') FROM
              (SELECT id,name,head_revision,created_from,deleted FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 ORDER BY id LIMIT 4097) b),
            (SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.name),'[]') FROM
              (SELECT name,revision,author,created,message,branch,branch_id,status,origin,status_updated,status_note
               FROM aether_access.named_versions WHERE tenant=$1 AND document_id=$2 ORDER BY name LIMIT 1001) v),
            (SELECT to_jsonb(r) FROM aether_access.resources r WHERE tenant=$1 AND id=$2)
            FROM aether_store.documents d WHERE d.tenant=$1 AND d.id=$2 AND d.app=$3",
            &[&self.tenant(), &id, &app]).await.map_err(db)?.ok_or(Error::Incompatible)?;
        let branches: Value = row.get(3);
        let versions: Value = row.get(4);
        if branches.as_array().ok_or(Error::Incompatible)?.len() > 4096
            || versions.as_array().ok_or(Error::Incompatible)?.len() > 1000
        {
            return Err(Error::Unsupported);
        }
        let main: i64 = row.get(0);
        let latest: Option<i64> = row.get(1);
        let latest = latest
            .filter(|n| *n >= main && main > 0)
            .ok_or(Error::Incompatible)?;
        let collaboration: i64 = row.get(2);
        let state = json!([
            1,
            self.tenant(),
            user.id,
            app,
            id,
            main,
            latest,
            collaboration,
            writable,
            branches,
            versions,
            row.get::<_, Value>(5)
        ]);
        let state_token = format!(
            "state-{:x}",
            Sha256::digest(serde_json::to_vec(&state).map_err(|_| Error::Incompatible)?)
        );
        commit(tx).await?;
        Ok(ChangeState {
            schema: 1,
            document_id: id.into(),
            state_token,
            main_revision: main,
            latest_revision: latest,
            collaboration_revision: collaboration,
            writable,
        })
    }
}
