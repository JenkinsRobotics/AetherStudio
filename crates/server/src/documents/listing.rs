use super::{Documents, Error, Result, Role, commit, db};
use aether_protocol_core::storage::{DocumentListPage, DocumentListRequest, DocumentSummary};
use aether_store::hosted::AuthorizedScope;
use std::{collections::HashMap, time::Duration};

const SCAN_BUDGET: usize = 2048;
const BATCH_SIZE: u32 = 64;

impl Documents {
    /// Discovery shares the read authority and revocation locks. Pages are live,
    /// not a frozen multi-request snapshot; callers restart after changing filters.
    pub async fn list(&self, token: &str, input: &DocumentListRequest) -> Result<DocumentListPage> {
        if !(1..=100).contains(&input.limit)
            || input.app.as_ref().is_some_and(|id| !super::valid_id(id))
            || input.after.as_ref().is_some_and(|id| !super::valid_id(id))
            || input.query.len() > 1024
            || input.query.chars().any(char::is_control)
        {
            return Err(Error::Invalid);
        }
        // Bounds include the whole scan, not only each individual SQL statement.
        tokio::time::timeout(Duration::from_secs(10), self.list_inner(token, input))
            .await
            .map_err(|_| Error::Unavailable)?
    }

    async fn list_inner(
        &self,
        token: &str,
        input: &DocumentListRequest,
    ) -> Result<DocumentListPage> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let mut scan = input.clone();
        scan.limit = BATCH_SIZE;
        let mut result = Vec::new();
        let mut scanned = 0;
        let mut apps = HashMap::new();
        loop {
            let candidates = self.store.list_candidates_in(&tx, &scope, &scan).await?;
            let exhausted = candidates.len() < BATCH_SIZE as usize;
            for candidate in candidates {
                scanned += 1;
                scan.after = Some(candidate.document_id.clone());
                let allowed = if let Some(allowed) = apps.get(&candidate.app) {
                    *allowed
                } else {
                    let allowed = match self.app(&tx, &user, &candidate.app).await {
                        Ok(()) => true,
                        Err(Error::Denied) => false,
                        Err(error) => return Err(error),
                    };
                    apps.insert(candidate.app.clone(), allowed);
                    allowed
                };
                if !allowed {
                    continue;
                }
                let resource = match self
                    .require(&tx, &user, &candidate.document_id, Role::Viewer)
                    .await
                {
                    Ok(resource) => resource,
                    Err(Error::Denied) => continue,
                    Err(error) => return Err(error),
                };
                if resource.kind != "document" || resource.app != candidate.app {
                    return Err(Error::Incompatible);
                }
                // Lookahead is authorized too: hidden candidates never produce
                // a cursor, a count, an empty intermediate page or has_more.
                if result.len() == input.limit as usize {
                    let next_after = result
                        .last()
                        .map(|d: &DocumentSummary| d.document_id.clone());
                    commit(tx).await?;
                    return Ok(DocumentListPage {
                        documents: result,
                        next_after,
                    });
                }
                result.push(DocumentSummary {
                    document_id: candidate.document_id,
                    app: candidate.app,
                    name: candidate.name,
                    revision: candidate.revision,
                    size_bytes: candidate.size_bytes,
                    saved_unix_ms: candidate.saved_unix_ms,
                });
            }
            if exhausted {
                commit(tx).await?;
                return Ok(DocumentListPage {
                    documents: result,
                    next_after: None,
                });
            }
            if scanned >= SCAN_BUDGET {
                // Fail explicitly instead of incorrectly claiming a complete
                // directory or revealing a private continuation position.
                return Err(Error::Unavailable);
            }
        }
    }
}
