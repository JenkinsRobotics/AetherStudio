//! Backend-independent save rules. SQL adapters own transactions, never meaning.
use super::*;

pub(crate) struct PreparedMutation {
    pub fingerprint: String,
    pub content: Option<Vec<u8>>,
    pub expected_revision: Option<u32>,
}
impl PreparedMutation {
    pub fn new(request: &DocumentMutation) -> Result<Self> {
        validate_id(&request.document_id)?;
        validate_id(&request.operation_id)?;
        validate_text(&request.actor, 200)?;
        let (content, expected_revision) = match &request.change {
            DocumentChange::Create {
                app,
                name,
                content_base64,
            } => {
                validate_id(app)?;
                validate_text(name, 200)?;
                (Some(decode(content_base64)?), None)
            }
            DocumentChange::Save {
                expected_revision,
                content_base64,
            } => (Some(decode(content_base64)?), Some(*expected_revision)),
            DocumentChange::SaveNamed {
                expected_revision,
                content_base64,
                name,
            } => {
                validate_text(name, 200)?;
                (Some(decode(content_base64)?), Some(*expected_revision))
            }
            DocumentChange::Rename {
                expected_revision,
                name,
            } => {
                validate_text(name, 200)?;
                (None, Some(*expected_revision))
            }
            DocumentChange::Restore {
                expected_revision,
                source_revision,
                ..
            } => {
                if *source_revision == 0 {
                    return Err(StoreError::new(
                        StoreErrorCode::InvalidRequest,
                        "Source revision must be positive.",
                    ));
                }
                (None, Some(*expected_revision))
            }
        };
        if expected_revision == Some(0) {
            return Err(StoreError::new(
                StoreErrorCode::InvalidRequest,
                "Revision must be positive.",
            ));
        }
        Ok(Self {
            fingerprint: hash(&serde_json::to_vec(request)?),
            content,
            expected_revision,
        })
    }

    pub fn check_head(&self, head: Option<u32>) -> Result<()> {
        if self.expected_revision != head {
            return Err(StoreError::new(
                if head.is_none() {
                    StoreErrorCode::NotFound
                } else {
                    StoreErrorCode::RevisionConflict
                },
                "Document head does not match the expected revision.",
            ));
        }
        Ok(())
    }

    #[cfg(feature = "sqlite-reference")]
    pub fn revision(
        &self,
        request: &DocumentMutation,
        current: Option<&DocumentRevision>,
        source: Option<&DocumentRevision>,
    ) -> Result<DocumentRevision> {
        let revision = current
            .map_or(0, |d| d.revision)
            .checked_add(1)
            .ok_or_else(|| {
                StoreError::new(StoreErrorCode::RevisionConflict, "Revision limit reached.")
            })?;
        self.revision_at(request, current, source, revision)
    }

    pub fn revision_at(
        &self,
        request: &DocumentMutation,
        current: Option<&DocumentRevision>,
        source: Option<&DocumentRevision>,
        revision: u32,
    ) -> Result<DocumentRevision> {
        let head = current.map(|d| d.revision);
        self.check_head(head)?;
        if revision == 0 || head.is_some_and(|h| revision <= h) {
            return Err(StoreError::new(
                StoreErrorCode::RevisionConflict,
                "Revision limit reached.",
            ));
        }
        let missing =
            || StoreError::new(StoreErrorCode::NotFound, "Document or revision not found.");
        let (app, name, event, restored) = match &request.change {
            DocumentChange::Create { app, name, .. } => (app.clone(), name.clone(), "create", None),
            DocumentChange::Save { .. } => {
                let d = current.ok_or_else(missing)?;
                (d.app.clone(), d.name.clone(), "save", None)
            }
            DocumentChange::Rename { name, .. } | DocumentChange::SaveNamed { name, .. } => {
                let d = current.ok_or_else(missing)?;
                (d.app.clone(), name.clone(), "rename", None)
            }
            DocumentChange::Restore {
                source_revision,
                preserve_name,
                ..
            } => {
                let d = source.ok_or_else(missing)?;
                if d.revision != *source_revision || d.revision >= revision {
                    return Err(missing());
                }
                (
                    d.app.clone(),
                    if *preserve_name == Some(true) {
                        current.ok_or_else(missing)?.name.clone()
                    } else {
                        d.name.clone()
                    },
                    "restore",
                    Some(*source_revision),
                )
            }
        };
        let (digest, size) = if let Some(bytes) = &self.content {
            (hash(bytes), bytes.len() as u32)
        } else {
            let d = source.or(current).ok_or_else(missing)?;
            (d.content_sha256.clone(), d.size_bytes)
        };
        Ok(DocumentRevision {
            document_id: request.document_id.clone(),
            app,
            name,
            revision,
            parent_revision: head,
            branch_id: None,
            merge_parent_revision: None,
            restored_from_revision: restored,
            content_sha256: digest,
            size_bytes: size,
            actor: request.actor.clone(),
            operation_id: request.operation_id.clone(),
            event: event.into(),
            saved_unix_ms: now_ms()?,
        })
    }
}
