//! CAD moves and link refreshes commit content, structure and exact retry results
//! together. Product transforms run without holding database transactions.
use super::{
    AuthorizedScope, ContentAuthority, DocumentChange, Documents, Error, Mutation, Result, Role,
    cad_projects::bytes,
    cad_settings::{Request, validate},
    commit, db, library,
};
use aether_protocol_core::resources::{ResourceChange, ResourceMutation};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

impl Documents {
    pub(super) async fn cad_settings_action(&self, token: &str, input: &Request) -> Result<Value> {
        let moving = input.operation.as_deref() == Some("move");
        let branch = library::branch_target(&input.branch)?;
        // Folder location belongs to the whole file, not an individual branch.
        if moving && branch != "Main" {
            return Err(Error::Unsupported);
        }
        if input.revision.is_some() {
            return Err(Error::Denied);
        }
        let operation = input
            .operation_id
            .as_deref()
            .filter(|v| super::valid_id(v))
            .ok_or(Error::Invalid)?;
        let expected = input
            .expected_revision
            .filter(|v| *v > 0)
            .ok_or(Error::Invalid)?;
        let fingerprint = format!(
            "{:x}",
            Sha256::digest(
                serde_json::to_vec(&json!(["cad-settings", input])).map_err(|_| Error::Invalid)?
            )
        );
        let minimum = if moving { Role::Owner } else { Role::Editor };
        let (saved, initial) = {
            let mut c = self.client().await?;
            let tx = c
                .build_transaction()
                .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
                .start()
                .await
                .map_err(db)?;
            let user = self.begin(&tx, token, moving).await?;
            self.app(&tx, &user, "cad").await?;
            let resource = self.require(&tx, &user, &input.id, minimum).await?;
            if resource.app != "cad" || resource.kind != "document" {
                return Err(Error::Denied);
            }
            // Also requires the selected branch to still exist on a retry.
            let saved = self
                .store
                .read_target_in(
                    &tx,
                    &AuthorizedScope::new(self.tenant(), &user.id)?,
                    &input.id,
                    branch,
                )
                .await?;
            if let Some(result) = self
                .cad_action_receipt(&tx, &user, operation, &fingerprint, &input.id)
                .await?
            {
                commit(tx).await?;
                return Ok(result);
            }
            if saved.document.revision != expected {
                return Err(Error::Conflict);
            }
            let initial = self.resource_snapshot(&tx, &user, &input.id).await?;
            commit(tx).await?;
            (saved, initial)
        };
        let mut args = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        args.as_object_mut()
            .ok_or(Error::Invalid)?
            .retain(|_, v| !v.is_null());
        args["data_base64"] = json!(saved.content_base64);
        let mut sources = Vec::new();
        if !moving {
            let chosen = input.parts.as_deref().unwrap_or_default();
            if chosen.len() > 256
                || chosen
                    .iter()
                    .collect::<std::collections::HashSet<_>>()
                    .len()
                    != chosen.len()
            {
                return Err(Error::Invalid);
            }
            let projection = self
                .product_service(token, "cad", "/api/cad/settings-read", &args)
                .await?;
            validate(&projection)?;
            let links = projection["linked_sources"]
                .as_array()
                .ok_or(Error::Incompatible)?;
            let mut resolved = serde_json::Map::new();
            // Bound accumulation before collecting potentially hundreds of large
            // sources. Reserve space for the service envelope and object keys.
            let mut argument_bytes =
                serde_json::to_vec(&args).map_err(|_| Error::Invalid)?.len() + 512;
            for part in chosen {
                let link = links
                    .iter()
                    .find(|v| v["part_id"].as_str() == Some(part))
                    .ok_or(Error::Invalid)?;
                let id = link["source_id"].as_str().ok_or(Error::Incompatible)?;
                let source = self
                    .library(
                        token,
                        &library::Request::Read {
                            app: "cad".into(),
                            id: id.into(),
                            branch: None,
                        },
                    )
                    .await?;
                let revision = source["revision"]
                    .as_u64()
                    .and_then(|v| u32::try_from(v).ok())
                    .ok_or(Error::Incompatible)?;
                let resolved_source = json!({"data_base64":bytes(&source)?, "source_label":source["name"], "source_ref":format!("library:{id}@{revision}")});
                argument_bytes += serde_json::to_vec(&resolved_source)
                    .map_err(|_| Error::Invalid)?
                    .len()
                    + serde_json::to_vec(part).map_err(|_| Error::Invalid)?.len()
                    + 2;
                if argument_bytes > crate::products::MAX_INPUT {
                    return Err(Error::TooLarge);
                }
                resolved.insert(part.clone(), resolved_source);
                sources.push((id.to_owned(), revision));
            }
            args["resolved_sources"] = json!(resolved);
        }
        let worker = self
            .product_service(token, "cad", "/api/cad/settings-edit", &args)
            .await?;
        validate(&worker)?;
        let payload = bytes(&worker)?;
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, moving).await?;
        self.app(&tx, &user, "cad").await?;
        let resource = self.require(&tx, &user, &input.id, minimum).await?;
        if resource.app != "cad" || resource.kind != "document" {
            return Err(Error::Denied);
        }
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        self.store
            .read_target_in(&tx, &scope, &input.id, branch)
            .await?;
        if let Some(result) = self
            .cad_action_receipt(&tx, &user, operation, &fingerprint, &input.id)
            .await?
        {
            commit(tx).await?;
            return Ok(result);
        }
        // Lock the chosen source heads until commit, so an update cannot claim
        // to use the latest source while committing a superseded snapshot.
        sources.sort();
        sources.dedup();
        for (id, revision) in &sources {
            let source = self.require(&tx, &user, id, Role::Viewer).await?;
            if source.app != "cad" || source.kind != "document" {
                return Err(Error::Denied);
            }
            let head = tx.query_opt("SELECT head_revision FROM aether_store.documents WHERE tenant=$1 AND id=$2 FOR SHARE", &[&self.tenant(), id]).await.map_err(db)?.ok_or(Error::Denied)?;
            if head.get::<_, i64>(0) != i64::from(*revision) {
                return Err(Error::Conflict);
            }
        }
        let internal = format!(
            "cad-settings-{:x}",
            Sha256::digest(
                serde_json::to_vec(&json!([self.tenant(), user.id, operation]))
                    .map_err(|_| Error::Invalid)?
            )
        );
        if moving {
            let current = self.resource_snapshot(&tx, &user, &input.id).await?;
            if current.structure_revision != initial.structure_revision {
                return Err(Error::Conflict);
            }
            let mut destination = initial.location.clone();
            destination.parent = input.parent.clone().filter(|s| !s.is_empty());
            if let Some(parent) = &destination.parent {
                let folder = self.require(&tx, &user, parent, Role::Editor).await?;
                if folder.app != "cad" {
                    return Err(Error::Denied);
                }
            }
            self.change_resource_in(
                &tx,
                &user,
                &ResourceMutation {
                    id: input.id.clone(),
                    operation_id: format!("{internal}-move"),
                    expected_structure_revision: initial.structure_revision,
                    change: ResourceChange::Move { destination },
                },
                false,
                Some("cad"),
            )
            .await?;
        }
        let receipt = self
            .mutate_target_authorized_in(
                &tx,
                &user,
                &Mutation {
                    operation_id: internal,
                    document_id: input.id.clone(),
                    location: None,
                    change: DocumentChange::Save {
                        expected_revision: expected,
                        content_base64: payload,
                    },
                },
                Some("cad"),
                if branch == "Main" {
                    ContentAuthority::Ordinary
                } else {
                    ContentAuthority::Branch(branch)
                },
            )
            .await?;
        let mut result = self.library_metadata(&tx, &user, &receipt.document).await?;
        result["branch_id"] = json!(branch);
        result["operation_id"] = json!(operation);
        result["replayed"] = json!(false);
        tx.execute("INSERT INTO aether_access.library_recents(tenant,user_id,resource) VALUES($1,$2,$3) ON CONFLICT(tenant,user_id,resource) DO UPDATE SET opened=clock_timestamp()", &[&self.tenant(), &user.id, &input.id]).await.map_err(db)?;
        self.audit(
            &tx,
            &user,
            if moving {
                "document_move"
            } else {
                "document_update"
            },
            &input.id,
        )
        .await?;
        let response =
            json!({"result":result,"sources":sources.iter().map(|(id,_)|id).collect::<Vec<_>>()});
        tx.execute("INSERT INTO aether_access.automation_receipts(tenant,actor,operation_id,fingerprint,document_id,response) VALUES($1,$2,$3,$4,$5,$6)", &[&self.tenant(), &user.id, &operation, &fingerprint, &input.id, &response]).await.map_err(db)?;
        commit(tx).await?;
        Ok(result)
    }
    async fn cad_action_receipt(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        user: &aether_identity::User,
        operation: &str,
        fingerprint: &str,
        id: &str,
    ) -> Result<Option<Value>> {
        let Some(response) = self
            .product_receipt(tx, &user.id, operation, fingerprint, id)
            .await?
        else {
            return Ok(None);
        };
        for source in response["sources"].as_array().ok_or(Error::Incompatible)? {
            let resource = self
                .require(
                    tx,
                    user,
                    source.as_str().ok_or(Error::Incompatible)?,
                    Role::Viewer,
                )
                .await?;
            if resource.app != "cad" || resource.kind != "document" {
                return Err(Error::Denied);
            }
        }
        Ok(Some(response["result"].clone()))
    }
}
