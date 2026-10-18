use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_identity::User;
use aether_protocol_core::{browsing::*, storage::DocumentSummary};
use aether_store::hosted::AuthorizedScope;
use std::{collections::HashMap, time::Duration};
use tokio_postgres::Transaction;

impl Documents {
    pub async fn browse(&self, token: &str, input: &BrowseRequest) -> Result<BrowsePage> {
        if !valid_id(&input.organization)
            || [&input.workspace, &input.parent, &input.app, &input.after]
                .into_iter()
                .flatten()
                .any(|id| !valid_id(id))
            || !(1..=100).contains(&input.limit)
            || input.query.len() > 1024
            || input.query.chars().any(char::is_control)
        {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(Duration::from_secs(10), self.browse_inner(token, input))
            .await
            .map_err(|_| Error::Unavailable)?
    }
    async fn browse_path(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        input: &BrowseRequest,
    ) -> Result<Vec<FolderSummary>> {
        if self
            .member(tx, &user.id, &input.organization)
            .await?
            .is_none()
        {
            return Err(Error::Denied);
        }
        let mut path = Vec::new();
        if let Some(parent) = &input.parent {
            self.app(tx, user, "drive").await?;
            let mut next = Some(parent.clone());
            while let Some(id) = next {
                let resource = match self.require(tx, user, &id, Role::Viewer).await {
                    Ok(resource) => resource,
                    // A shared nested folder does not disclose private ancestors.
                    Err(Error::Denied) if !path.is_empty() => break,
                    Err(error) => return Err(error),
                };
                if resource.kind != "folder"
                    || resource.location.organization != input.organization
                    || resource.location.workspace != input.workspace
                {
                    return Err(Error::Denied);
                }
                if resource.app != "drive" {
                    return Err(Error::Incompatible);
                }
                let name=tx.query_one("SELECT coalesce(folder_name,id) FROM aether_access.resources WHERE tenant=$1 AND id=$2",&[&self.tenant(),&id]).await.map_err(db)?.get(0);
                path.push(FolderSummary { id, name });
                next = resource.location.parent;
            }
            path.reverse();
        } else if let Some(ws) = &input.workspace {
            // Workspace root navigation requires workspace access. Separately
            // shared folders can still be opened directly above.
            if self
                .workspace_role(tx, &user.id, &input.organization, ws)
                .await?
                .is_none()
            {
                return Err(Error::Denied);
            }
        }
        Ok(path)
    }
    async fn browse_inner(&self, token: &str, input: &BrowseRequest) -> Result<BrowsePage> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        let path = self.browse_path(&tx, &user, input).await?;
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let query = input.query.to_lowercase();
        let mut after = input.after.clone();
        let mut entries = Vec::new();
        let mut apps = HashMap::new();
        let mut scanned = 0;
        loop {
            let rows=tx.query("SELECT id,kind,app,coalesce(folder_name,id) FROM aether_access.resources WHERE tenant=$1 AND organization=$2 AND workspace IS NOT DISTINCT FROM $3 AND parent IS NOT DISTINCT FROM $4 AND NOT trashed AND ($5::text IS NULL OR id COLLATE \"C\">$5 COLLATE \"C\") ORDER BY id COLLATE \"C\" LIMIT 64",&[&self.tenant(),&input.organization,&input.workspace,&input.parent,&after]).await.map_err(db)?;
            let exhausted = rows.len() < 64;
            for row in rows {
                scanned += 1;
                let id: String = row.get(0);
                let kind: &str = row.get(1);
                let app: String = row.get(2);
                after = Some(id.clone());
                if kind == "document" && input.app.as_ref().is_some_and(|v| v != &app) {
                    continue;
                }
                let allowed = if let Some(allowed) = apps.get(&app) {
                    *allowed
                } else {
                    let allowed = match self.app(&tx, &user, &app).await {
                        Ok(()) => true,
                        Err(Error::Denied) => false,
                        Err(error) => return Err(error),
                    };
                    apps.insert(app.clone(), allowed);
                    allowed
                };
                if !allowed {
                    continue;
                }
                let resource = match self.require(&tx, &user, &id, Role::Viewer).await {
                    Ok(resource) => resource,
                    Err(Error::Denied) => continue,
                    Err(error) => return Err(error),
                };
                if resource.kind != kind || resource.app != app {
                    return Err(Error::Incompatible);
                }
                let entry = match kind {
                    "folder" => {
                        if app != "drive" {
                            return Err(Error::Incompatible);
                        }
                        let name: String = row.get(3);
                        if !name.to_lowercase().contains(&query) {
                            continue;
                        }
                        BrowseEntry::Folder {
                            folder: FolderSummary { id, name },
                        }
                    }
                    "document" => {
                        let metadata = self.store.metadata_in(&tx, &scope, &id).await?;
                        if metadata.app != app {
                            return Err(Error::Incompatible);
                        }
                        if !metadata.name.to_lowercase().contains(&query) {
                            continue;
                        }
                        BrowseEntry::Document {
                            document: DocumentSummary {
                                document_id: id,
                                app,
                                name: metadata.name,
                                revision: metadata.revision,
                                size_bytes: metadata.size_bytes,
                                saved_unix_ms: metadata.saved_unix_ms,
                            },
                        }
                    }
                    _ => return Err(Error::Incompatible),
                };
                if entries.len() == input.limit as usize {
                    let next_after = entries.last().map(|v: &BrowseEntry| v.id().to_owned());
                    commit(tx).await?;
                    return Ok(BrowsePage {
                        entries,
                        path,
                        next_after,
                    });
                }
                entries.push(entry);
            }
            if exhausted {
                commit(tx).await?;
                return Ok(BrowsePage {
                    entries,
                    path,
                    next_after: None,
                });
            }
            if scanned >= 2048 {
                return Err(Error::Unavailable);
            }
        }
    }
}
