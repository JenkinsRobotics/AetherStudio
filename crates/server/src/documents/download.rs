use super::uploads::{Chunk, chunks};
use super::*;
use crate::attachments::{Attachments, valid_digest};
use axum::body::{Body, Bytes};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::Value;

pub struct Download {
    pub name: String,
    pub content: Content,
}
impl Documents {
    /// A complete authorized read snapshot. Lock order matches ordinary reads;
    /// grants revoked while queued cannot authorize a later download. A response
    /// already prepared may finish, just as an ordinary document read does.
    pub async fn download(
        &self,
        token: &str,
        id: &str,
        revision: Option<u32>,
        attachments: Option<&Attachments>,
    ) -> Result<Download> {
        if revision == Some(0) {
            return Err(Error::Invalid);
        }
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, "drive").await?;
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        self.app(&tx, &user, &resource.app).await?;
        if resource.kind != "document" {
            return Err(Error::Unsupported);
        }
        let saved = self
            .store
            .read_in(
                &tx,
                &AuthorizedScope::new(self.tenant(), &user.id)?,
                id,
                revision,
            )
            .await?;
        if saved.document.app != resource.app {
            return Err(Error::Incompatible);
        }
        let content = self
            .resolve_content(
                &tx,
                &user,
                &resource.app,
                &saved.content_base64,
                attachments,
            )
            .await?;
        tx.commit().await.map_err(db)?;
        Ok(Download {
            name: saved.document.name,
            content,
        })
    }
}

/// An authorized immutable content manifest; never accepts a public digest.
pub struct Content {
    data: Data,
}
enum Data {
    Bytes(Bytes),
    Chunks {
        store: HostedStore,
        scope: AuthorizedScope,
        parts: Vec<Chunk>,
        size: usize,
    },
}
impl Content {
    pub(super) fn from_chunks(
        store: HostedStore,
        scope: AuthorizedScope,
        parts: Vec<Chunk>,
        size: usize,
    ) -> Self {
        Self {
            data: Data::Chunks {
                store,
                scope,
                parts,
                size,
            },
        }
    }
    pub fn len(&self) -> usize {
        match &self.data {
            Data::Bytes(b) => b.len(),
            Data::Chunks { size, .. } => *size,
        }
    }
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
    pub(super) async fn collect(self, limit: usize) -> Result<Bytes> {
        if self.len() > limit {
            return Err(Error::TooLarge);
        }
        match self.data {
            Data::Bytes(b) => Ok(b),
            Data::Chunks {
                store,
                scope,
                parts,
                size,
            } => {
                let mut bytes = Vec::with_capacity(size);
                for part in parts {
                    bytes.extend(
                        store
                            .read_upload_chunk(&scope, &part.digest, part.size)
                            .await?,
                    );
                }
                Ok(Bytes::from(bytes))
            }
        }
    }
    // Copy verifies every referenced chunk before creating another reference,
    // without retaining the full attachment in memory.
    pub(super) async fn verify(&self) -> Result<()> {
        if let Data::Chunks {
            store,
            scope,
            parts,
            ..
        } = &self.data
        {
            for part in parts {
                store
                    .read_upload_chunk(scope, &part.digest, part.size)
                    .await?;
            }
        }
        Ok(())
    }
    pub fn body(self, start: usize, end: usize) -> Body {
        match self.data {
            Data::Bytes(b) => Body::from(b.slice(start..end)),
            Data::Chunks {
                store,
                scope,
                parts,
                ..
            } => {
                let stream = futures_util::stream::try_unfold(
                    (parts.into_iter(), 0usize, store, scope),
                    move |(mut parts, mut position, store, scope)| async move {
                        for part in parts.by_ref() {
                            let next = position + part.size;
                            if position >= end {
                                return Ok(None);
                            }
                            if next > start {
                                let bytes = store
                                    .read_upload_chunk(&scope, &part.digest, part.size)
                                    .await
                                    .map_err(|_| {
                                        std::io::Error::other("Stored upload content unavailable.")
                                    })?;
                                let slice = Bytes::from(bytes).slice(
                                    start.saturating_sub(position)..(end.min(next) - position),
                                );
                                return Ok::<_, std::io::Error>(Some((
                                    slice,
                                    (parts, next, store, scope),
                                )));
                            }
                            position = next;
                        }
                        Ok(None)
                    },
                );
                Body::from_stream(stream)
            }
        }
    }
}
impl Documents {
    pub(super) async fn resolve_content(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        app: &str,
        content_base64: &str,
        attachments: Option<&Attachments>,
    ) -> Result<Content> {
        let bytes = STANDARD
            .decode(content_base64)
            .map_err(|_| Error::Incompatible)?;
        let descriptor = serde_json::from_slice::<Value>(&bytes).ok();
        if app == "drive"
            && descriptor
                .as_ref()
                .is_some_and(|v| v.get("aether_drive_blob").is_some())
        {
            let descriptor = descriptor.ok_or(Error::Incompatible)?;
            let sha = descriptor["aether_drive_blob"]
                .as_str()
                .filter(|s| valid_digest(s))
                .ok_or(Error::Incompatible)?;
            let size = descriptor["size"].as_u64().ok_or(Error::Incompatible)?;
            if let Some(bytes) = attachments.and_then(|a| a.get(sha, size)) {
                return Ok(Content {
                    data: Data::Bytes(bytes),
                });
            }
            let row=tx.query_opt("SELECT size,chunks FROM aether_access.upload_blobs WHERE tenant=$1 AND digest=$2", &[&self.tenant(),&sha]).await.map_err(db)?.ok_or(Error::Unavailable)?;
            if row.get::<_, i64>(0) as u64 != size {
                return Err(Error::Incompatible);
            }
            let size = usize::try_from(size).map_err(|_| Error::Incompatible)?;
            return Ok(Content {
                data: Data::Chunks {
                    store: self.store.clone(),
                    scope: AuthorizedScope::new(self.tenant(), &user.id)?,
                    parts: chunks(row.get(1), size)?,
                    size,
                },
            });
        }
        Ok(Content {
            data: Data::Bytes(Bytes::from(bytes)),
        })
    }
}

// Only the verified upload/import authority can introduce blob references.
// A digest proves content identity, never permission to claim somebody's upload.
pub(super) fn validate_public_change(change: &DocumentChange) -> Result<()> {
    if let DocumentChange::Create { content_base64, .. }
    | DocumentChange::Save { content_base64, .. }
    | DocumentChange::SaveNamed { content_base64, .. } = change
    {
        let bytes = STANDARD
            .decode(content_base64)
            .map_err(|_| Error::Invalid)?;
        if serde_json::from_slice::<Value>(&bytes)
            .ok()
            .is_some_and(|v| v.get("aether_drive_blob").is_some())
        {
            return Err(Error::Unsupported);
        }
    }
    Ok(())
}

#[cfg(test)]
mod public_change_tests {
    use super::*;
    #[test]
    fn named_save_cannot_bypass_verified_upload_authority() {
        let change = DocumentChange::SaveNamed {
            expected_revision: 1,
            name: "private.png".into(),
            content_base64: STANDARD.encode(br#"{"aether_drive_blob":"not-an-authority"}"#),
        };
        assert!(matches!(
            validate_public_change(&change),
            Err(Error::Unsupported)
        ));
    }
}
