//! Authorized subtree copies: a new snapshot, never a second access/history tree.
use super::{Documents, Error, Location, Result, Role, commit, db, valid_id};
use crate::attachments::Attachments;
use aether_protocol_core::storage::{DocumentChange, DocumentMutation};
use aether_store::hosted::AuthorizedScope;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    time::Duration,
};

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub id: String,
    pub operation_id: String,
    pub expected_revision: u32,
    pub expected_structure_revision: u32,
    pub destination: Location,
    pub name: Option<String>,
}
struct Item {
    id: String,
    app: String,
    name: String,
    location: Location,
    content: Option<String>,
}
impl Documents {
    pub async fn drive_copy(
        &self,
        token: &str,
        input: &Request,
        attachments: Option<&Attachments>,
    ) -> Result<Value> {
        if !valid_id(&input.id)
            || !valid_id(&input.operation_id)
            || input.expected_revision == 0
            || input.expected_structure_revision == 0
        {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(20),
            self.drive_copy_inner(token, input, attachments),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn drive_copy_inner(
        &self,
        token: &str,
        input: &Request,
        attachments: Option<&Attachments>,
    ) -> Result<Value> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        let source = self.require(&tx, &user, &input.id, Role::Viewer).await?;
        self.app(&tx, &user, &source.app).await?;
        let make_id = |id: &str| -> Result<String> {
            let bytes = serde_json::to_vec(&(self.tenant(), &user.id, &input.operation_id, id))
                .map_err(|_| Error::Invalid)?;
            Ok(format!("copy-{:x}", Sha256::digest(bytes)))
        };
        let root = make_id(&input.id)?;
        let request = json!({"action":"drive_copy", "input":input});
        if let Some(row) = tx.query_opt("SELECT request FROM aether_access.resource_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3", &[&self.tenant(), &user.id, &input.operation_id]).await.map_err(db)? {
            if row.get::<_, Value>(0) != request {return Err(Error::Conflict);}
            let copied = self.require(&tx, &user, &root, Role::Viewer).await?;
            self.app(&tx, &user, &copied.app).await?;
            let mut result = self.drive_entry(&tx, &user, &root, &mut 0).await?;
            result["operation_id"] = json!(input.operation_id);result["replayed"] = json!(true);
            commit(tx).await?;return Ok(result);
        }
        let snapshot = self.resource_snapshot(&tx, &user, &input.id).await?;
        if snapshot.structure_revision != input.expected_structure_revision
            || snapshot
                .document_revision
                .unwrap_or(snapshot.structure_revision)
                != input.expected_revision
        {
            return Err(Error::Conflict);
        }
        self.destination(&tx, &user, &input.destination).await?;
        let name = input
            .name
            .clone()
            .unwrap_or_else(|| format!("Copy of {}", snapshot.name));
        let name = name.trim();
        if name.is_empty() || name.len() > 1024 || name.chars().any(char::is_control) {
            return Err(Error::Invalid);
        }
        let mut rows = tx.query("WITH RECURSIVE tree(id,depth,path,cycle) AS (SELECT id,0,ARRAY[id],false FROM aether_access.resources WHERE tenant=$1 AND id=$2 UNION ALL SELECT r.id,t.depth+1,t.path||r.id,r.id=ANY(t.path) FROM tree t JOIN aether_access.resources r ON r.tenant=$1 AND r.parent=t.id WHERE NOT t.cycle AND t.depth<128 AND NOT r.trashed) SELECT id,depth,cycle FROM tree LIMIT 257", &[&self.tenant(), &input.id]).await.map_err(db)?;
        if rows.len() > 256 {
            return Err(Error::Unsupported);
        }
        rows.sort_by(|a, b| {
            a.get::<_, i32>(1)
                .cmp(&b.get::<_, i32>(1))
                .then_with(|| a.get::<_, String>(0).cmp(&b.get::<_, String>(0)))
        });
        let source_ids: HashSet<String> = rows.iter().map(|r| r.get(0)).collect();
        let mut depth = rows
            .iter()
            .map(|r| r.get::<_, i32>(1))
            .max()
            .ok_or(Error::Incompatible)?;
        let mut parent = input.destination.parent.clone();
        while let Some(id) = parent {
            depth += 1;
            if source_ids.contains(&id) || depth >= 128 {
                return Err(Error::Invalid);
            }
            parent = self
                .resource(&tx, &id)
                .await?
                .ok_or(Error::Denied)?
                .location
                .parent;
        }
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let mut mapping = HashMap::new();
        let mut items = Vec::new();
        let mut total = 0usize;
        // Validate every included child before writing anything. Never silently
        // omit an inaccessible child and acknowledge an incomplete copy.
        for row in rows {
            let id: String = row.get(0);
            if row.get::<_, bool>(2) || row.get::<_, i32>(1) >= 128 {
                return Err(Error::Invalid);
            }
            let resource = self.require(&tx, &user, &id, Role::Viewer).await?;
            self.app(&tx, &user, &resource.app).await?;
            if resource.location.organization != source.location.organization
                || resource.location.workspace != source.location.workspace
            {
                return Err(Error::Incompatible);
            }
            let saved = self.resource_snapshot(&tx, &user, &id).await?;
            let content = if let Some(revision) = saved.document_revision {
                let file = self.store.read_in(&tx, &scope, &id, Some(revision)).await?;
                if file.document.app != resource.app {
                    return Err(Error::Incompatible);
                }
                // Only bytes already authorized through the source can supply
                // an attachment descriptor. Verify its immutable backing blob.
                let bytes = self
                    .resolve_content(&tx, &user, &resource.app, &file.content_base64, attachments)
                    .await?;
                total = total.checked_add(bytes.len()).ok_or(Error::TooLarge)?;
                if total > 64 * 1024 * 1024 {
                    return Err(Error::TooLarge);
                }
                bytes.verify().await?;
                Some(file.content_base64)
            } else {
                None
            };
            let target_id = make_id(&id)?;
            if self.resource(&tx, &target_id).await?.is_some() {
                return Err(Error::Conflict);
            }
            let parent = if id == input.id {
                input.destination.parent.clone()
            } else {
                Some(
                    mapping
                        .get(
                            resource
                                .location
                                .parent
                                .as_ref()
                                .ok_or(Error::Incompatible)?,
                        )
                        .cloned()
                        .ok_or(Error::Incompatible)?,
                )
            };
            mapping.insert(id.clone(), target_id.clone());
            items.push(Item {
                id: target_id,
                app: resource.app,
                name: if id == input.id {
                    name.into()
                } else {
                    saved.name
                },
                location: Location {
                    parent,
                    ..input.destination.clone()
                },
                content,
            });
        }
        for item in items {
            self.drive_name_available(&tx, &item.id, &item.name, &item.location, &user.id)
                .await?;
            self.insert_resource(
                &tx,
                &user,
                &item.id,
                &item.app,
                &item.location,
                if item.content.is_some() {
                    "document"
                } else {
                    "folder"
                },
            )
            .await?;
            if let Some(content_base64) = item.content {
                // Internal creation from a verified source; the public mutation
                // boundary still refuses caller-supplied attachment descriptors.
                self.store
                    .mutate_in(
                        &tx,
                        &scope,
                        &DocumentMutation {
                            operation_id: format!("content-{}", item.id),
                            document_id: item.id,
                            actor: user.id.clone(),
                            change: DocumentChange::Create {
                                app: item.app,
                                name: item.name,
                                content_base64,
                            },
                        },
                    )
                    .await?;
            } else {
                tx.execute(
                    "UPDATE aether_access.resources SET folder_name=$3 WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), &item.id, &item.name],
                )
                .await
                .map_err(db)?;
                self.audit(&tx, &user, "create_folder", &item.id).await?;
            }
        }
        self.audit(&tx, &user, "copy", &root).await?;
        let receipt = json!({"operation_id":input.operation_id,"id":root});
        tx.execute("INSERT INTO aether_access.resource_receipts(tenant,actor,operation_id,request,receipt) VALUES($1,$2,$3,$4,$5)", &[&self.tenant(), &user.id, &input.operation_id, &request, &receipt]).await.map_err(db)?;
        let mut result = self.drive_entry(&tx, &user, &root, &mut 0).await?;
        result["operation_id"] = json!(input.operation_id);
        result["replayed"] = json!(false);
        commit(tx).await?;
        Ok(result)
    }
}
