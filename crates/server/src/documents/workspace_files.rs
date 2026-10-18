//! Compatibility for private workspace paths. Guarded heads and retained versions
//! live in Studio; immutable bytes use the same durable object store as uploads.
use super::{
    download::Content,
    uploads::{Chunk, chunks},
    *,
};
use crate::workspace_assets::{Asset, WorkspaceAssets, relative};
use aether_store::hosted::UPLOAD_CHUNK_BYTES;
use axum::body::Bytes;
use serde_json::json;
use sha2::{Digest, Sha256};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Save {
    pub path: String,
    pub text: String,
    pub expected_revision: Option<String>,
}
impl Documents {
    pub(crate) async fn workspace_read(
        &self,
        token: &str,
        app: &str,
        path: &str,
        base: Option<&WorkspaceAssets>,
    ) -> Result<Asset> {
        self.workspace_read_limited(token, app, path, base, 64 * 1024 * 1024)
            .await
    }
    pub(crate) async fn workspace_read_limited(
        &self,
        token: &str,
        app: &str,
        path: &str,
        base: Option<&WorkspaceAssets>,
        max_bytes: usize,
    ) -> Result<Asset> {
        if !relative(path) {
            return Err(Error::Denied);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, app).await?;
        let row = tx.query_opt("SELECT digest,size,chunks FROM aether_access.workspace_files WHERE tenant=$1 AND owner=$2 AND path=$3 ORDER BY sequence DESC LIMIT 1", &[&self.tenant(), &user.id, &path]).await.map_err(db)?;
        let result = if let Some(row) = row {
            let size = usize::try_from(row.get::<_, i64>(1)).map_err(|_| Error::Incompatible)?;
            if size > max_bytes {
                return Err(Error::TooLarge);
            }
            let bytes = Content::from_chunks(
                self.store.clone(),
                AuthorizedScope::new(self.tenant(), &user.id)?,
                chunks(row.get(2), size)?,
                size,
            )
            .collect(max_bytes)
            .await?;
            let revision: String = row.get(0);
            if format!("{:x}", Sha256::digest(&bytes)) != revision {
                return Err(Error::Incompatible);
            }
            Asset { bytes, revision }
        } else {
            base.ok_or(Error::Unavailable)?
                .get(&user.id, path)
                .ok_or(Error::Denied)?
        };
        if result.bytes.len() > max_bytes {
            return Err(Error::TooLarge);
        }
        commit(tx).await?;
        Ok(result)
    }
    async fn workspace_chunks(&self, user: &str, bytes: &[u8]) -> Result<serde_json::Value> {
        let scope = AuthorizedScope::new(self.tenant(), user)?;
        let mut parts = Vec::new();
        for bytes in bytes.chunks(UPLOAD_CHUNK_BYTES) {
            parts.push(Chunk {
                size: bytes.len(),
                digest: self.store.put_upload_chunk(&scope, bytes.to_vec()).await?,
            });
        }
        Ok(json!(parts))
    }
    pub async fn workspace_save(
        &self,
        token: &str,
        app: &str,
        input: &Save,
        base: Option<&WorkspaceAssets>,
    ) -> Result<String> {
        self.workspace_save_bytes(
            token,
            app,
            &input.path,
            input.text.as_bytes(),
            input.expected_revision.as_deref(),
            base,
        )
        .await
    }
    pub(crate) async fn workspace_save_bytes(
        &self,
        token: &str,
        app: &str,
        path: &str,
        content: &[u8],
        expected_revision: Option<&str>,
        base: Option<&WorkspaceAssets>,
    ) -> Result<String> {
        if !relative(path)
            || path.len() > 2048
            || expected_revision.is_some_and(|r| !crate::attachments::valid_digest(r))
        {
            return Err(Error::Invalid);
        }
        if content.len() > 4 * 1024 * 1024 {
            return Err(Error::TooLarge);
        }
        // Verify authorization before object writes; publication rechecks it after
        // upload. Lost authorization may leave unreferenced objects, never a save.
        let (status, allowed) = self.application_status(Some(token), &[app]).await?;
        let owner = status.user.ok_or(aether_identity::Error::Unauthorized)?;
        if owner.must_change {
            return Err(aether_identity::Error::Forbidden.into());
        }
        if !allowed.iter().any(|id| id == app) {
            return Err(Error::Denied);
        }
        let original = base.and_then(|s| s.get(&owner.id, path));
        let original_parts = if let Some(asset) = &original {
            Some(self.workspace_chunks(&owner.id, &asset.bytes).await?)
        } else {
            None
        };
        let bytes = Bytes::copy_from_slice(content);
        let revision = format!("{:x}", Sha256::digest(&bytes));
        let parts = self.workspace_chunks(&owner.id, &bytes).await?;
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, app).await?;
        if user.id != owner.id {
            return Err(Error::Denied);
        }
        // Serializes head creation and saves across host processes. The key is
        // unambiguous JSON and no caller controls tenant/owner.
        let key = json!([self.tenant(), user.id, path]).to_string();
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062621))",
            &[&key],
        )
        .await
        .map_err(db)?;
        let current = tx.query_opt("SELECT sequence,digest FROM aether_access.workspace_files WHERE tenant=$1 AND owner=$2 AND path=$3 ORDER BY sequence DESC LIMIT 1", &[&self.tenant(), &user.id, &path]).await.map_err(db)?;
        let previous = current
            .as_ref()
            .map(|r| r.get::<_, String>(1))
            .or_else(|| original.as_ref().map(|a| a.revision.clone()));
        if previous.as_deref() != expected_revision {
            return Err(Error::Conflict);
        }
        if previous.as_deref() == Some(&revision) {
            commit(tx).await?;
            return Ok(revision);
        }
        let sequence = current
            .as_ref()
            .map_or(0, |r| r.get::<_, i64>(0))
            .checked_add(1)
            .ok_or(Error::TooLarge)?;
        if current.is_none()
            && let Some(asset) = original
        {
            tx.execute("INSERT INTO aether_access.workspace_files(tenant,owner,path,sequence,digest,size,chunks) VALUES($1,$2,$3,0,$4,$5,$6)", &[&self.tenant(), &user.id, &path, &asset.revision, &(asset.bytes.len() as i64), &original_parts.ok_or(Error::Incompatible)?]).await.map_err(db)?;
        }
        tx.execute("INSERT INTO aether_access.workspace_files(tenant,owner,path,sequence,digest,size,chunks) VALUES($1,$2,$3,$4,$5,$6,$7)", &[&self.tenant(), &user.id, &path, &sequence, &revision, &(bytes.len() as i64), &parts]).await.map_err(db)?;
        self.audit(&tx, &user, "workspace_file_saved", path).await?;
        commit(tx).await?;
        Ok(revision)
    }
}
