//! Recycle navigation returns authorized roots, never inaccessible scan cursors.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_protocol_core::resources::{RecycleListRequest, RecyclePage, ResourceState};
use std::{collections::HashMap, time::Duration};

impl Documents {
    pub async fn recycle_bin(
        &self,
        token: &str,
        input: &RecycleListRequest,
    ) -> Result<RecyclePage> {
        if !valid_id(&input.organization)
            || [&input.workspace, &input.app, &input.after]
                .into_iter()
                .flatten()
                .any(|id| !valid_id(id))
            || !(1..=100).contains(&input.limit)
        {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(Duration::from_secs(10), self.recycle_inner(token, input))
            .await
            .map_err(|_| Error::Unavailable)?
    }
    async fn recycle_inner(&self, token: &str, input: &RecycleListRequest) -> Result<RecyclePage> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        if self
            .member(&tx, &user.id, &input.organization)
            .await?
            .is_none()
        {
            return Err(Error::Denied);
        }
        // A direct share is sufficient for its recycled item; this is not an
        // operation that grants or enumerates workspace membership.
        let mut after = input.after.clone();
        let mut resources = Vec::new();
        let mut apps = HashMap::new();
        let mut scanned = 0;
        loop {
            let rows=tx.query("SELECT id,app FROM aether_access.resources WHERE tenant=$1 AND organization=$2 AND workspace IS NOT DISTINCT FROM $3 AND trashed AND ($4::text IS NULL OR app=$4 OR kind='folder') AND ($5::text IS NULL OR id COLLATE \"C\">$5 COLLATE \"C\") ORDER BY id COLLATE \"C\" LIMIT 64",&[&self.tenant(),&input.organization,&input.workspace,&input.app,&after]).await.map_err(db)?;
            let exhausted = rows.len() < 64;
            for row in rows {
                scanned += 1;
                let id: String = row.get(0);
                let app: String = row.get(1);
                after = Some(id.clone());
                let allowed = if let Some(allowed) = apps.get(&app) {
                    *allowed
                } else {
                    let allowed = match self.app(&tx, &user, &app).await {
                        Ok(()) => true,
                        Err(Error::Denied) => false,
                        Err(error) => return Err(error),
                    };
                    apps.insert(app, allowed);
                    allowed
                };
                if !allowed {
                    continue;
                }
                let resource = match self
                    .require_resource(&tx, &user, &id, Role::Viewer, true)
                    .await
                {
                    Ok(resource) => resource,
                    Err(Error::Denied) => continue,
                    Err(error) => return Err(error),
                };
                // Validated complete, acyclic ancestry above. A separately
                // recycled child appears after its containing root is restored.
                let mut next = resource.location.parent;
                let mut inherited_trash = false;
                while let Some(parent) = next {
                    let parent = self.resource(&tx, &parent).await?.ok_or(Error::Denied)?;
                    if parent.trashed {
                        inherited_trash = true;
                        break;
                    }
                    next = parent.location.parent;
                }
                if inherited_trash {
                    continue;
                }
                if resources.len() == input.limit as usize {
                    let next_after = resources
                        .last()
                        .map(|state: &ResourceState| state.id.clone());
                    commit(tx).await?;
                    return Ok(RecyclePage {
                        resources,
                        next_after,
                    });
                }
                let state = self.resource_snapshot(&tx, &user, &id).await?;
                resources.push(self.visible_resource_state(&tx, &user, state).await?);
            }
            if exhausted {
                commit(tx).await?;
                return Ok(RecyclePage {
                    resources,
                    next_after: None,
                });
            }
            if scanned >= 2048 {
                return Err(Error::Unavailable);
            }
        }
    }
}
