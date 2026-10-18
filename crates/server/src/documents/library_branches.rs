//! Authorized editor branch commands. Stable IDs cross the HTTP boundary;
//! labels never select mutations, and receipts are reauthorized before replay.
use super::*;
use aether_protocol_core::branches::{BranchChange, BranchCommand, BranchResult, MergeResolution};
use serde_json::{Value, json};

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    BranchCreate {
        app: String,
        id: String,
        operation_id: String,
        expected_revision: u32,
        from_revision: u32,
        name: String,
        #[serde(default)]
        message: String,
    },
    BranchRename {
        app: String,
        id: String,
        operation_id: String,
        branch: String,
        expected_revision: u32,
        new_name: String,
    },
    BranchDelete {
        app: String,
        id: String,
        operation_id: String,
        branch: String,
        expected_revision: u32,
        expected_main_revision: u32,
        #[serde(default)]
        force: bool,
    },
    Merge {
        app: String,
        id: String,
        operation_id: String,
        source: String,
        target: String,
        expected_source_revision: u32,
        expected_revision: u32,
        resolution: Option<MergeResolution>,
    },
}
impl Documents {
    pub async fn library_branch(&self, token: &str, input: &Request) -> Result<Value> {
        let (app, id, operation_id, change) = match input {
            Request::BranchCreate {
                app,
                id,
                operation_id,
                expected_revision,
                from_revision,
                name,
                message,
            } => (
                app,
                id,
                operation_id,
                BranchChange::Create {
                    name: name.clone(),
                    expected_revision: *expected_revision,
                    from_revision: *from_revision,
                    message: message.clone(),
                },
            ),
            Request::BranchRename {
                app,
                id,
                operation_id,
                branch,
                expected_revision,
                new_name,
            } => (
                app,
                id,
                operation_id,
                BranchChange::Rename {
                    branch: branch.clone(),
                    expected_revision: *expected_revision,
                    new_name: new_name.clone(),
                },
            ),
            Request::BranchDelete {
                app,
                id,
                operation_id,
                branch,
                expected_revision,
                expected_main_revision,
                force,
            } => (
                app,
                id,
                operation_id,
                BranchChange::Delete {
                    branch: branch.clone(),
                    expected_revision: *expected_revision,
                    expected_main_revision: *expected_main_revision,
                    force: *force,
                },
            ),
            Request::Merge {
                app,
                id,
                operation_id,
                source,
                target,
                expected_source_revision,
                expected_revision,
                resolution,
            } => (
                app,
                id,
                operation_id,
                BranchChange::Merge {
                    source: source.clone(),
                    target: target.clone(),
                    expected_source_revision: *expected_source_revision,
                    expected_revision: *expected_revision,
                    resolution: *resolution,
                },
            ),
        };
        if !valid_id(id) || !valid_id(operation_id) {
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
        let resource = self.require(&tx, &user, id, Role::Editor).await?;
        if resource.app != *app || resource.kind != "document" {
            return Err(Error::Denied);
        }
        // Drive upload descriptors are not editable document contents.
        if app == "drive" {
            return Err(Error::Unsupported);
        }
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let document = self.store.metadata_in(&tx, &scope, id).await?;
        if document.app != *app || document.document_id != *id {
            return Err(Error::Incompatible);
        }
        let request = BranchCommand {
            operation_id: operation_id.clone(),
            document_id: id.clone(),
            actor: user.id.clone(),
            change,
        };
        let outcome = self.store.branch_command_in(&tx, &scope, &request).await;
        if let Err(error) = &outcome
            && error.code == aether_protocol_core::storage::StoreErrorCode::RevisionConflict
            && let BranchChange::Merge {
                source,
                target,
                expected_source_revision,
                expected_revision,
                resolution: None,
            } = &request.change
        {
            // The store has acquired the document lock. Only equal guarded heads
            // can expose a resolvable conflict; stale commands require a refresh.
            let heads = self.store.branch_snapshot_in(&tx, &scope, id).await?;
            let head = |selector: &str| {
                heads
                    .iter()
                    .find(|h| !h.deleted && h.id.as_deref().unwrap_or("Main") == selector)
                    .map(|h| h.head_revision)
            };
            if head(source) == Some(*expected_source_revision)
                && head(target) == Some(*expected_revision)
            {
                return Err(Error::MergeConflict {
                    source_head: *expected_source_revision,
                    target_head: *expected_revision,
                });
            }
        }
        let receipt = outcome?;
        if !receipt.replayed
            && let BranchResult::Merge {
                document,
                merged: true,
                ..
            } = &receipt.result
        {
            self.merge_checkpoint(&tx, &user, &request, document)
                .await?;
        }
        let result = match receipt.result {
            BranchResult::Head { branch } => {
                json!({"ok":true,"branch":branch.name,"branch_id":branch.id,"head_revision":branch.head_revision,"deleted":branch.deleted,"replayed":receipt.replayed})
            }
            BranchResult::Merge {
                document,
                merged,
                fast_forward,
                merge_base_revision,
            } => {
                if document.app != *app || document.document_id != *id {
                    return Err(Error::Incompatible);
                }
                let Request::Merge {
                    target,
                    expected_source_revision,
                    ..
                } = input
                else {
                    return Err(Error::Incompatible);
                };
                let branch_id = (target != "Main").then_some(target);
                json!({"ok":true,"target":target,"source_head":expected_source_revision,"merged":merged,"fast_forward":fast_forward,"revision":document.revision,"branch_id":branch_id,"merge_base_revision":merge_base_revision,"replayed":receipt.replayed})
            }
        };
        commit(tx).await?;
        Ok(result)
    }
}
