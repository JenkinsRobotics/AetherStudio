//! Compatibility projection for existing editors. All content, revision and ACL
//! decisions remain in the native authorities; no legacy forwarding occurs.
use super::{Documents, Error, Location, Mutation, Result, Role, commit, db, valid_id};
use aether_identity::User;
use aether_protocol_core::storage::{DocumentChange, DocumentRevision};
use aether_store::hosted::AuthorizedScope;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tokio_postgres::Transaction;

#[path = "library_compare.rs"]
mod compare;
#[path = "library_history.rs"]
mod history;
#[path = "library_listing.rs"]
mod listing;

pub const MAX_FILE_BYTES: usize = 6 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Compare {
        app: String,
        id: String,
        from: u32,
        to: u32,
        branch: Option<String>,
    },
    Restore {
        app: String,
        id: String,
        operation_id: String,
        expected_revision: u32,
        revision: u32,
        branch: Option<String>,
    },
    History {
        app: String,
        id: String,
        branch: Option<String>,
    },
    ReadRevision {
        app: String,
        id: String,
        revision: u32,
        branch: Option<String>,
    },
    List {
        app: String,
        view: Option<String>,
        parent: Option<String>,
        query: Option<String>,
    },
    Read {
        app: String,
        id: String,
        branch: Option<String>,
    },
    Create {
        app: String,
        operation_id: String,
        name: String,
        kind: Option<String>,
        scope: Option<String>,
        organization: Option<String>,
        workspace: Option<String>,
        parent: Option<String>,
        #[serde(default)]
        data_base64: String,
    },
    Save {
        app: String,
        operation_id: String,
        id: String,
        expected_revision: u32,
        branch: Option<String>,
        data_base64: String,
    },
    Rename {
        app: String,
        operation_id: String,
        id: String,
        expected_revision: u32,
        name: String,
    },
}
// Main remains backward compatible. Named branches require the permanent ID
// returned by history/branch creation; old name-only clients must not write to
// a different branch after deletion and reuse of a display name.
pub(super) fn branch_target(branch: &Option<String>) -> Result<&str> {
    match branch.as_deref() {
        None | Some("") | Some("Main") => Ok("Main"),
        Some(id)
            if id
                .strip_prefix("branch-")
                .is_some_and(|v| v.len() == 64 && v.bytes().all(|c| c.is_ascii_hexdigit())) =>
        {
            Ok(id)
        }
        _ => Err(Error::Unsupported),
    }
}
fn content(value: &str) -> Result<String> {
    if value.len() > MAX_FILE_BYTES.div_ceil(3) * 4 {
        return Err(Error::Invalid);
    }
    let bytes = STANDARD.decode(value).map_err(|_| Error::Invalid)?;
    if bytes.len() > MAX_FILE_BYTES {
        return Err(Error::Invalid);
    }
    Ok(value.into())
}
pub(super) fn name(value: &str) -> Result<String> {
    let value = value.trim();
    if value.is_empty()
        || value.chars().count() > 180
        || matches!(value, "." | "..")
        || value
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\'))
    {
        return Err(Error::Invalid);
    }
    Ok(value.into())
}
impl Documents {
    pub async fn library(&self, token: &str, input: &Request) -> Result<Value> {
        self.library_guarded(token, input, &[]).await
    }
    // Product-linked sources are re-authorized under the same transaction/ACL
    // locks as the target save. A worker never conveys a reusable permission.
    pub(super) async fn library_guarded(
        &self,
        token: &str,
        input: &Request,
        sources: &[String],
    ) -> Result<Value> {
        self.library_named_save(token, input, sources, None).await
    }
    // Product adapters may update an embedded title and filename atomically.
    // This is not a second persistence implementation or a public override.
    pub(super) async fn library_named_save(
        &self,
        token: &str,
        input: &Request,
        sources: &[String],
        title: Option<&str>,
    ) -> Result<Value> {
        if title.is_some() && !matches!(input, Request::Save { .. }) {
            return Err(Error::Invalid);
        }
        if let Request::Create {
            app,
            operation_id,
            name: title,
            kind,
            scope,
            organization,
            workspace,
            parent,
            data_base64,
        } = input
            && kind.as_deref() == Some("folder")
        {
            if app == "drive"
                || scope
                    .as_deref()
                    .is_some_and(|v| !matches!(v, "personal" | "workspace"))
            {
                return Err(Error::Invalid);
            }
            return self
                .library_create_folder(
                    token,
                    &super::drive_create::Request {
                        operation_id: operation_id.clone(),
                        name: name(title)?,
                        kind: kind.clone(),
                        app: Some(app.clone()),
                        organization: organization.clone(),
                        workspace: workspace.clone(),
                        parent: parent.clone(),
                        data_base64: Some(data_base64.clone()),
                    },
                    scope.as_deref(),
                )
                .await;
        }

        if let Request::Compare { .. } = input {
            return self.library_compare(token, input).await;
        }
        if matches!(
            input,
            Request::History { .. } | Request::ReadRevision { .. }
        ) {
            return self.library_history(token, input).await;
        }
        if let Request::List {
            app,
            view,
            parent,
            query,
        } = input
        {
            return self
                .library_list(
                    token,
                    app,
                    view.as_deref(),
                    parent.as_deref(),
                    query.as_deref(),
                )
                .await;
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self
            .begin(&tx, token, matches!(input, Request::Create { .. }))
            .await?;
        let app = match input {
            Request::Read { app, .. }
            | Request::Create { app, .. }
            | Request::Save { app, .. }
            | Request::Restore { app, .. }
            | Request::Rename { app, .. } => app,
            Request::List { .. }
            | Request::History { .. }
            | Request::ReadRevision { .. }
            | Request::Compare { .. } => {
                unreachable!()
            }
        };
        self.app(&tx, &user, app).await?;
        for id in sources {
            let source = self.require(&tx, &user, id, Role::Viewer).await?;
            if source.app != *app || source.kind != "document" {
                return Err(Error::Denied);
            }
        }
        // Drive upload descriptors require a verified upload service, not arbitrary JSON.
        if app == "drive" {
            return Err(Error::Unsupported);
        }
        if let Request::Rename {
            id,
            operation_id,
            expected_revision,
            name: title,
            ..
        } = input
            && self
                .resource(&tx, id)
                .await?
                .is_some_and(|r| r.kind == "folder")
        {
            let title = name(title)?;
            // Re-enter the canonical structural command with its own exclusive
            // lock; no preliminary read or lazy enrollment is committed here.
            tx.rollback().await.map_err(db)?;
            drop(c);
            let receipt = self
                .rename_library_folder(
                    token,
                    app,
                    &aether_protocol_core::resources::ResourceMutation {
                        id: id.clone(),
                        operation_id: operation_id.clone(),
                        expected_structure_revision: *expected_revision,
                        change: aether_protocol_core::resources::ResourceChange::RenameFolder {
                            name: title,
                        },
                    },
                )
                .await?;
            return Ok(
                json!({"id":receipt.resource.id,"name":receipt.resource.name,"app":receipt.resource.app,"kind":"folder","revision":receipt.resource.structure_revision,"writable":true,"operation_id":receipt.operation_id,"replayed":receipt.replayed}),
            );
        }
        let selected = match input {
            Request::Read { branch, .. }
            | Request::Save { branch, .. }
            | Request::Restore { branch, .. } => branch_target(branch)?,
            _ => "Main",
        };
        let mut bytes = None;
        let mut replayed = false;
        let document = if let Request::Read { id, .. } = input {
            let resource = self.require(&tx, &user, id, Role::Viewer).await?;
            if resource.app != *app || resource.kind != "document" {
                return Err(Error::Denied);
            }
            let result = self
                .store
                .read_target_in(
                    &tx,
                    &AuthorizedScope::new(self.tenant(), &user.id)?,
                    id,
                    selected,
                )
                .await?;
            bytes = Some(result.content_base64);
            result.document
        } else {
            let (operation_id, document_id, change, location) = match input {
                Request::Create {
                    operation_id,
                    name: title,
                    kind,
                    scope,
                    organization,
                    workspace,
                    parent,
                    data_base64,
                    ..
                } => {
                    if !valid_id(operation_id) {
                        return Err(Error::Invalid);
                    }
                    if kind.as_deref().is_some_and(|v| v != "file") {
                        return Err(Error::Unsupported);
                    }
                    if scope
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "personal" | "workspace"))
                    {
                        return Err(Error::Invalid);
                    }
                    let mut location = Location {
                        organization: organization.clone().unwrap_or_else(|| "default".into()),
                        workspace: workspace.clone().or_else(|| {
                            (scope.as_deref() == Some("workspace")).then(|| "shared".into())
                        }),
                        parent: parent.clone(),
                    };
                    if let Some(parent) = parent {
                        let folder = self.require(&tx, &user, parent, Role::Editor).await?;
                        if folder.kind != "folder" {
                            return Err(Error::Denied);
                        }
                        if scope.as_deref().is_some_and(|s| {
                            (s == "workspace") != folder.location.workspace.is_some()
                        }) {
                            return Err(Error::Invalid);
                        }
                        location.organization = folder.location.organization;
                        location.workspace = folder.location.workspace;
                    }
                    // Deterministic per actor and tenant so a lost create reply cannot
                    // create a second document on exact operation replay.
                    let key = serde_json::to_vec(&(self.tenant(), &user.id, operation_id))
                        .map_err(|_| Error::Invalid)?;
                    let id = format!("library-{:x}", Sha256::digest(key));
                    (
                        operation_id,
                        id,
                        DocumentChange::Create {
                            app: app.clone(),
                            name: name(title)?,
                            content_base64: content(data_base64)?,
                        },
                        Some(location),
                    )
                }
                Request::Save {
                    operation_id,
                    id,
                    expected_revision,
                    branch,
                    data_base64,
                    ..
                } => {
                    branch_target(branch)?;
                    (
                        operation_id,
                        id.clone(),
                        match title {
                            Some(title) => DocumentChange::SaveNamed {
                                expected_revision: *expected_revision,
                                content_base64: content(data_base64)?,
                                name: name(title)?,
                            },
                            None => DocumentChange::Save {
                                expected_revision: *expected_revision,
                                content_base64: content(data_base64)?,
                            },
                        },
                        None,
                    )
                }
                Request::Restore {
                    operation_id,
                    id,
                    expected_revision,
                    revision,
                    branch,
                    ..
                } => {
                    branch_target(branch)?;
                    (
                        operation_id,
                        id.clone(),
                        DocumentChange::Restore {
                            expected_revision: *expected_revision,
                            source_revision: *revision,
                            preserve_name: Some(true),
                        },
                        None,
                    )
                }
                Request::Rename {
                    operation_id,
                    id,
                    expected_revision,
                    name: title,
                    ..
                } => (
                    operation_id,
                    id.clone(),
                    DocumentChange::Rename {
                        expected_revision: *expected_revision,
                        name: name(title)?,
                    },
                    None,
                ),
                Request::Read { .. }
                | Request::List { .. }
                | Request::History { .. }
                | Request::ReadRevision { .. }
                | Request::Compare { .. } => unreachable!(),
            };
            let receipt = self
                .mutate_target_authorized_in(
                    &tx,
                    &user,
                    &Mutation {
                        operation_id: operation_id.clone(),
                        document_id,
                        change,
                        location,
                    },
                    Some(app),
                    if selected == "Main" {
                        super::ContentAuthority::Ordinary
                    } else {
                        super::ContentAuthority::Branch(selected)
                    },
                )
                .await?;
            replayed = receipt.replayed;
            receipt.document
        };
        if document.app != *app {
            return Err(Error::Incompatible);
        }
        let mut result = self.library_metadata(&tx, &user, &document).await?;
        if matches!(input, Request::Restore { .. }) {
            result = json!({"ok":true,"revision":document.revision,"branch":selected});
        }
        if selected != "Main" {
            result["branch_id"] = json!(selected);
            // Labels are presentation metadata. The permanent selector above remains
            // authoritative, including when replaying a write after rename/deletion.
            let label = tx.query_opt(
                "SELECT name FROM aether_store.branches WHERE tenant=$1 AND document_id=$2 AND id=$3",
                &[&self.tenant(), &document.document_id, &selected],
            ).await.map_err(super::db)?.ok_or(Error::Incompatible)?.get::<_, String>(0);
            result["branch_label"] = json!(label);
        }
        if let Some(bytes) = bytes {
            result["data_base64"] = json!(bytes);
        }
        if !matches!(input, Request::Read { .. }) {
            result["replayed"] = json!(replayed);
        }
        // Recents and the accepted mutation share one commit. A failed recent
        // write must not acknowledge a partially completed save.
        if !matches!(input, Request::Rename { .. } | Request::Restore { .. }) {
            tx.execute("INSERT INTO aether_access.library_recents(tenant,user_id,resource) VALUES($1,$2,$3) ON CONFLICT(tenant,user_id,resource) DO UPDATE SET opened=clock_timestamp()", &[&self.tenant(), &user.id, &document.document_id]).await.map_err(db)?;
        }
        commit(tx).await?;
        Ok(result)
    }
    pub(in crate::documents) async fn library_metadata(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        doc: &DocumentRevision,
    ) -> Result<Value> {
        self.library_metadata_visibility(tx, user, doc, false).await
    }
    pub(super) async fn library_metadata_visibility(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        doc: &DocumentRevision,
        include_trash: bool,
    ) -> Result<Value> {
        let (resource, role) = self
            .resource_role(tx, user, &doc.document_id, include_trash)
            .await?;
        let writable = role >= Role::Editor;
        let mut parent = resource.location.parent;
        let mut parent_hidden = false;
        if let Some(id) = &parent {
            match self
                .require_resource(tx, user, id, Role::Viewer, include_trash)
                .await
            {
                Ok(_) => (),
                Err(Error::Denied) => {
                    parent = None;
                    parent_hidden = true;
                }
                Err(e) => return Err(e),
            }
        }
        let owner: String = tx.query_one("SELECT coalesce(nullif(full_name,''),username) FROM aether_identity.users WHERE tenant=$1 AND id=$2", &[&self.tenant(), &resource.owner]).await.map_err(db)?.get(0);
        let history = self
            .store
            .history_in(
                tx,
                &AuthorizedScope::new(self.tenant(), &user.id)?,
                &doc.document_id,
                0,
                1,
            )
            .await?;
        let first = history.first().ok_or(Error::Incompatible)?;
        let baseline = tx.query_opt("SELECT revision,created,modified FROM aether_access.legacy_file_metadata WHERE tenant=$1 AND document_id=$2", &[&self.tenant(), &doc.document_id]).await.map_err(db)?;
        let created = baseline
            .as_ref()
            .map_or(first.saved_unix_ms as f64 / 1000.0, |r| r.get::<_, f64>(1));
        let modified = baseline
            .as_ref()
            .filter(|r| r.get::<_, i64>(0) == i64::from(doc.revision))
            .map_or(doc.saved_unix_ms as f64 / 1000.0, |r| r.get::<_, f64>(2));
        Ok(
            json!({"id":doc.document_id,"app":doc.app,"scope":if resource.location.workspace.is_some() {"workspace"} else {"personal"},
            "parent":parent,"parent_hidden":parent_hidden,"name":doc.name,"kind":"file","revision":doc.revision,
            "created":created,"modified":modified,
            "size":doc.size_bytes,"owner":owner,"writable":writable,"organization":resource.location.organization,"workspace":resource.location.workspace}),
        )
    }
}
