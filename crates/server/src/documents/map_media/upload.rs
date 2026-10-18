use super::super::uploads::{Chunk, MAX_UPLOAD};
use super::*;
use aether_store::hosted::UPLOAD_CHUNK_BYTES;
use axum::body::Body;
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::time::Duration;
impl Documents {
    /// Authenticate before accepting bytes, then authenticate again at publication.
    /// No SQL connection or authority lock is held during network transfer.
    pub async fn map_media_upload(
        &self,
        token: &str,
        name: &str,
        size: usize,
        body: Body,
    ) -> Result<()> {
        if mime(name).is_none() {
            return Err(Error::Invalid);
        }
        if size == 0 || size > MAX_UPLOAD {
            return Err(Error::TooLarge);
        }
        let owner = self.map_media_upload_check(token, name).await?;
        let scope = AuthorizedScope::new(self.tenant(), &owner)?;
        let mut stream = body.into_data_stream();
        let mut received = 0usize;
        let mut buffer = Vec::with_capacity(UPLOAD_CHUNK_BYTES);
        let mut parts = Vec::new();
        let mut hash = Sha256::new();
        let deadline = tokio::time::Instant::now() + Duration::from_secs(600);
        while let Some(frame) = tokio::time::timeout_at(
            deadline.min(tokio::time::Instant::now() + Duration::from_secs(15)),
            stream.next(),
        )
        .await
        .map_err(|_| Error::Unavailable)?
        {
            let frame = frame.map_err(|_| Error::Invalid)?;
            received = received.checked_add(frame.len()).ok_or(Error::TooLarge)?;
            if received > size {
                return Err(Error::TooLarge);
            }
            hash.update(&frame);
            let mut bytes = frame.as_ref();
            while !bytes.is_empty() {
                let take = bytes.len().min(UPLOAD_CHUNK_BYTES - buffer.len());
                buffer.extend_from_slice(&bytes[..take]);
                bytes = &bytes[take..];
                if buffer.len() == UPLOAD_CHUNK_BYTES {
                    let digest = self
                        .store
                        .put_upload_chunk(
                            &scope,
                            std::mem::replace(&mut buffer, Vec::with_capacity(UPLOAD_CHUNK_BYTES)),
                        )
                        .await?;
                    parts.push(Chunk {
                        digest,
                        size: UPLOAD_CHUNK_BYTES,
                    });
                }
            }
        }
        if received != size {
            return Err(Error::Invalid);
        }
        if !buffer.is_empty() {
            let size = buffer.len();
            let digest = self.store.put_upload_chunk(&scope, buffer).await?;
            parts.push(Chunk { digest, size });
        }
        let digest = format!("{:x}", hash.finalize());
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, "map").await?;
        if user.id != owner {
            return Err(Error::Denied);
        }
        self.map_media_lock(&tx).await?;
        self.map_media_upload_authority(&tx, &user, name).await?;
        if let Some(row) = tx
            .query_opt(
                "SELECT size,digest FROM aether_access.map_media WHERE tenant=$1 AND name=$2",
                &[&self.tenant(), &name],
            )
            .await
            .map_err(db)?
        {
            if row.get::<_, i64>(0) != size as i64 || row.get::<_, String>(1) != digest {
                return Err(Error::Conflict);
            }
        } else {
            tx.execute("INSERT INTO aether_access.map_media(tenant,name,owner,size,digest,chunks) VALUES($1,$2,$3,$4,$5,$6)", &[&self.tenant(), &name, &owner, &(size as i64), &digest, &serde_json::to_value(parts).map_err(|_| Error::Invalid)?]).await.map_err(db)?;
            self.audit(&tx, &user, "map_media_upload", name).await?;
        }
        commit(tx).await
    }
    async fn map_media_upload_check(&self, token: &str, name: &str) -> Result<String> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, "map").await?;
        self.map_media_upload_authority(&tx, &user, name).await?;
        commit(tx).await?;
        Ok(user.id)
    }
    async fn map_media_upload_authority(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        name: &str,
    ) -> Result<()> {
        if let Some(row) = tx
            .query_opt(
                "SELECT owner,deleted FROM aether_access.map_media WHERE tenant=$1 AND name=$2",
                &[&self.tenant(), &name],
            )
            .await
            .map_err(db)?
        {
            if row.get::<_, String>(0) != user.id {
                return Err(Error::Denied);
            }
            if row.get::<_, bool>(1) {
                return Err(Error::Conflict);
            }
        } else {
            let count: i64 = tx
                .query_one(
                    "SELECT count(*) FROM aether_access.map_media WHERE tenant=$1 AND owner=$2",
                    &[&self.tenant(), &user.id],
                )
                .await
                .map_err(db)?
                .get(0);
            if count >= 4096 {
                return Err(Error::TooLarge);
            }
        }
        Ok(())
    }
}
