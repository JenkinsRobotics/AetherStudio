//! Internal metadata candidates. Authorization belongs to the caller; this is
//! never a public tenant directory and never fetches content objects.
use super::*;
use aether_protocol_core::storage::DocumentListRequest;

impl HostedStore {
    /// Metadata only. The caller must authorize current document/app access and
    /// retain its permission locks; this method does not read content objects.
    pub async fn metadata_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
    ) -> Result<DocumentRevision> {
        validate_id(id)?;
        deadlines(tx).await?;
        revision(tx, &scope.tenant, id, None)
            .await?
            .ok_or_else(not_found)
    }

    /// Trusted Studio discovery only. The caller MUST filter each candidate
    /// through current document and application permissions before disclosure,
    /// including lookahead/cursors. No total count or hidden scan cursor is public.
    pub async fn list_candidates_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        input: &DocumentListRequest,
    ) -> Result<Vec<DocumentRevision>> {
        if let Some(id) = &input.after {
            validate_id(id)?;
        }
        if let Some(app) = &input.app {
            validate_id(app)?;
        }
        if !(1..=100).contains(&input.limit)
            || input.query.len() > 1024
            || input.query.chars().any(char::is_control)
        {
            return Err(StoreError::new(
                StoreErrorCode::InvalidRequest,
                "Use a page size of 1–100 and a search of at most 1024 bytes without control characters.",
            ));
        }
        deadlines(tx).await?;
        // C collation makes the seek boundary agree with ORDER BY on every host.
        // strpos is literal substring search: '%' and '_' are not wildcards.
        let rows = tx.query(
            "SELECT r.metadata,d.id,d.app,d.head_revision FROM aether_store.documents d
             JOIN aether_store.revisions r ON (r.tenant,r.document_id,r.revision)=(d.tenant,d.id,d.head_revision)
             WHERE d.tenant=$1 AND ($2::text IS NULL OR d.id COLLATE \"C\">$2 COLLATE \"C\")
             AND ($3::text IS NULL OR d.app=$3)
             AND strpos(lower(r.metadata->>'name'),lower($4))>0
             ORDER BY d.id COLLATE \"C\" LIMIT $5",
            &[&scope.tenant, &input.after, &input.app, &input.query, &i64::from(input.limit)],
        ).await.map_err(pg_error)?;
        rows.into_iter()
            .map(|row| {
                let document: DocumentRevision = serde_json::from_value(row.get(0))?;
                if document.document_id != row.get::<_, String>(1)
                    || document.app != row.get::<_, String>(2)
                    || i64::from(document.revision) != row.get::<_, i64>(3)
                {
                    return Err(corrupt("Revision metadata mismatch."));
                }
                Ok(document)
            })
            .collect()
    }
}
