//! Branch-aware history projection for existing editor controls. No content reads for
//! the listing; historical content is always returned read-only, under current ACL.
use super::*;
use std::collections::BTreeMap;
const MAX_REVISIONS: u32 = 1000;
impl Documents {
    pub(super) async fn library_history(&self, token: &str, input: &Request) -> Result<Value> {
        let (app, id, branch) = match input {
            Request::History { app, id, branch }
            | Request::ReadRevision {
                app, id, branch, ..
            } => (app, id, branch),
            _ => return Err(Error::Invalid),
        };
        let target = branch_target(branch)?;
        if !valid_id(id) {
            return Err(Error::Invalid);
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
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        if resource.app != *app || resource.kind != "document" {
            return Err(Error::Denied);
        }
        // Drive descriptors are delivered through the authorized download API.
        if app == "drive" {
            return Err(Error::Unsupported);
        }
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let heads = self.store.branch_snapshot_in(&tx, &scope, id).await?;
        if !heads
            .iter()
            .any(|h| !h.deleted && h.id.as_deref().unwrap_or("Main") == target)
        {
            return Err(Error::Denied);
        }
        let result = if let Request::ReadRevision { revision, .. } = input {
            if *revision == 0 {
                return Err(Error::Invalid);
            }
            let old = self.store.read_in(&tx, &scope, id, Some(*revision)).await?;
            if old.document.app != *app
                || old.document.document_id != *id
                || old.document.revision != *revision
            {
                return Err(Error::Incompatible);
            }
            json!({"id":id,"name":old.document.name,"revision":old.document.revision,"data_base64":old.content_base64,"writable":false})
        } else {
            let head = self.store.metadata_in(&tx, &scope, id).await?;
            if head.app != *app || head.document_id != *id || head.revision == 0 {
                return Err(Error::Incompatible);
            }
            let writable = match self.require(&tx, &user, id, Role::Editor).await {
                Ok(_) => true,
                Err(Error::Denied) => false,
                Err(e) => return Err(e),
            };
            let latest = heads
                .iter()
                .map(|h| h.head_revision)
                .max()
                .ok_or(Error::Incompatible)?;
            let projected = self
                .history_projection(&tx, &scope, id, app, latest)
                .await?;
            let branches: Vec<Value> = heads.iter().filter(|h| !h.deleted).map(|h| {
                if h.id.is_none() { json!({"name":"Main","head_revision":h.head_revision,"created_from":null,"created":null}) }
                else { json!({"id":h.id,"name":h.name,"head_revision":h.head_revision,"created_from":h.created_from,"created":h.created_unix_ms.map(|t| t as f64/1000.0),"message":h.message}) }
            }).collect();
            json!({"branch_identity":"stable","writable":writable,"scope":if resource.location.workspace.is_some() {"workspace"} else {"personal"},"revisions":projected,"versions":self.named_versions(&tx, id).await?,"branches":branches})
        };
        commit(tx).await?;
        Ok(result)
    }
    pub(super) async fn history_projection(
        &self,
        tx: &Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
        app: &str,
        head: u32,
    ) -> Result<Vec<Value>> {
        // This legacy response has no pagination contract. Never silently
        // truncate history or fetch unbounded rows to simulate completeness.
        if head > MAX_REVISIONS {
            return Err(Error::Unsupported);
        }
        let mut revisions = self
            .store
            .history_in(tx, scope, id, 0, MAX_REVISIONS)
            .await?;
        // Later commits may appear under READ COMMITTED. Immutable rows at
        // or before the captured head provide a consistent bounded snapshot.
        revisions.retain(|r| r.revision <= head);
        if revisions.len() != head as usize
            || revisions
                .iter()
                .enumerate()
                .any(|(n, r)| r.document_id != *id || r.app != app || r.revision != n as u32 + 1)
        {
            return Err(Error::Incompatible);
        }
        let actors: Vec<String> = revisions.iter().map(|r| r.actor.clone()).collect();
        let names: BTreeMap<String,String> = tx.query("SELECT id,coalesce(nullif(full_name,''),username) FROM aether_identity.users WHERE tenant=$1 AND id=ANY($2)", &[&self.tenant(),&actors]).await.map_err(db)?.into_iter().map(|r| (r.get(0),r.get(1))).collect();
        let annotations: BTreeMap<i64,(String,f64,Option<i64>)> = tx.query("SELECT revision,note,saved,parent_revision FROM aether_access.legacy_history_annotations WHERE tenant=$1 AND document_id=$2 AND revision<=$3", &[&self.tenant(),&id,&i64::from(head)]).await.map_err(db)?.into_iter().map(|r| (r.get(0),(r.get(1),r.get(2),r.get(3)))).collect();
        let labels: BTreeMap<String, String> = tx
            .query(
                "SELECT id,name FROM aether_store.branches WHERE tenant=$1 AND document_id=$2",
                &[&self.tenant(), &id],
            )
            .await
            .map_err(db)?
            .into_iter()
            .map(|r| (r.get(0), r.get(1)))
            .collect();
        let mut projected = Vec::with_capacity(revisions.len());
        for r in revisions.iter().rev() {
            let author = names.get(&r.actor).ok_or(Error::Incompatible)?;
            let import_key = format!(
                "legacy-{:x}",
                Sha256::digest(
                    serde_json::to_vec(&(id, r.revision)).map_err(|_| Error::Incompatible)?
                )
            );
            let annotation = annotations.get(&i64::from(r.revision));
            let (note, saved, parent) = if r.operation_id == import_key {
                // Older native staging targets must be re-imported from the
                // retained archive; missing notes must not become empty notes.
                let (note, saved, parent) = annotation.ok_or(Error::Incompatible)?;
                // The legacy writer omitted implicit previous-head parents.
                // Keep its exact Main-only response, but branch graphs need
                // canonical lineage so interleaved revisions do not detach or
                // connect to a different branch. Raw annotations stay intact.
                let parent = if labels.is_empty() {
                    *parent
                } else {
                    r.parent_revision.map(i64::from)
                };
                (note.clone(), *saved, parent)
            } else {
                if annotation.is_some() {
                    return Err(Error::Incompatible);
                }
                (
                    r.restored_from_revision
                        .map(|v| format!("Restored revision {v}"))
                        .unwrap_or_default(),
                    r.saved_unix_ms as f64 / 1000.0,
                    r.parent_revision.map(i64::from),
                )
            };
            let branch = match &r.branch_id {
                None => "Main",
                Some(id) => labels.get(id).ok_or(Error::Incompatible)?.as_str(),
            };
            let mut row = json!({"revision":r.revision,"name":r.name,"saved":saved,"event":r.event,"note":note,"blob_hash":r.content_sha256,"branch":branch,"parent_revision":parent,"merge_parent_revision":r.merge_parent_revision,"author":author});
            if let Some(id) = &r.branch_id {
                row["branch_id"] = json!(id);
            }
            projected.push(row);
        }
        Ok(projected)
    }
}
