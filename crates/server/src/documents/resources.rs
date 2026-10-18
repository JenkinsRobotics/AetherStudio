//! Atomic, guarded Drive organization. Content revisions remain in the store.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_identity::User;
use aether_protocol_core::resources::*;
use aether_store::hosted::AuthorizedScope;
use std::{collections::HashSet, time::Duration};
use tokio_postgres::Transaction;

impl Documents {
    pub(super) async fn resource_snapshot(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
    ) -> Result<ResourceState> {
        let resource = self.resource(tx, id).await?.ok_or(Error::Denied)?;
        let row = tx.query_one("SELECT structure_revision,coalesce(folder_name,id) FROM aether_access.resources WHERE tenant=$1 AND id=$2", &[&self.tenant(), &id]).await.map_err(db)?;
        let (kind, name, document_revision) = match resource.kind.as_str() {
            // Imported folders retain their original CAD/Map app identity.
            // Permissions still check that app; kind owns folder semantics.
            "folder" => (ResourceKind::Folder, row.get(1), None),
            "document" => {
                let document = self
                    .store
                    .metadata_in(tx, &AuthorizedScope::new(self.tenant(), &user.id)?, id)
                    .await?;
                if document.app != resource.app {
                    return Err(Error::Incompatible);
                }
                (
                    ResourceKind::Document,
                    document.name,
                    Some(document.revision),
                )
            }
            _ => return Err(Error::Incompatible),
        };
        Ok(ResourceState {
            id: id.into(),
            kind,
            app: resource.app,
            name,
            owner: resource.owner,
            location: resource.location,
            parent_hidden: false,
            structure_revision: u32::try_from(row.get::<_, i64>(0))
                .map_err(|_| Error::Incompatible)?,
            document_revision,
            trashed: resource.trashed,
        })
    }
    pub(super) async fn visible_resource_state(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        mut state: ResourceState,
    ) -> Result<ResourceState> {
        if self
            .member(tx, &user.id, &state.location.organization)
            .await?
            .is_none()
        {
            return Err(Error::Denied);
        }
        if let Some(parent) = &state.location.parent {
            match self
                .require_resource(tx, user, parent, Role::Viewer, true)
                .await
            {
                Ok(_) => {}
                Err(Error::Denied) => {
                    state.location.parent = None;
                    state.parent_hidden = true;
                }
                Err(error) => return Err(error),
            }
        }
        Ok(state)
    }
    pub async fn resource_state(&self, token: &str, id: &str) -> Result<ResourceState> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        let resource = self
            .require_resource(&tx, &user, id, Role::Viewer, true)
            .await?;
        self.app(&tx, &user, &resource.app).await?;
        let state = self
            .visible_resource_state(&tx, &user, self.resource_snapshot(&tx, &user, id).await?)
            .await?;
        commit(tx).await?;
        Ok(state)
    }
    pub async fn change_resource(
        &self,
        token: &str,
        input: &ResourceMutation,
    ) -> Result<ResourceMutationReceipt> {
        self.change_resource_service(token, input, false, None)
            .await
    }
    /// Drive uses the same transaction and receipt authority, without enrollment.
    pub async fn change_drive_resource(
        &self,
        token: &str,
        input: &ResourceMutation,
    ) -> Result<ResourceMutationReceipt> {
        self.change_resource_service(token, input, true, None).await
    }
    pub(super) async fn rename_library_folder(
        &self,
        token: &str,
        app: &str,
        input: &ResourceMutation,
    ) -> Result<ResourceMutationReceipt> {
        if !valid_id(app) || !matches!(input.change, ResourceChange::RenameFolder { .. }) {
            return Err(Error::Invalid);
        }
        self.change_resource_service(token, input, false, Some(app))
            .await
    }
    async fn change_resource_service(
        &self,
        token: &str,
        input: &ResourceMutation,
        drive: bool,
        library_app: Option<&str>,
    ) -> Result<ResourceMutationReceipt> {
        if !valid_id(&input.id)
            || !valid_id(&input.operation_id)
            || input.expected_structure_revision == 0
        {
            return Err(Error::Invalid);
        }
        // A deadline after dispatch is an uncertain write outcome. The receipt
        // lets the caller safely retry this exact request, never a new operation.
        tokio::time::timeout(
            Duration::from_secs(20),
            self.change_resource_inner(token, input, drive, library_app),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn change_resource_inner(
        &self,
        token: &str,
        input: &ResourceMutation,
        drive: bool,
        library_app: Option<&str>,
    ) -> Result<ResourceMutationReceipt> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = if drive || library_app.is_some() {
            let user = self.identity.authorize_transaction(&tx, token).await?;
            tx.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?;
            if drive {
                self.app(&tx, &user, "drive").await?;
            }
            if let Some(app) = library_app {
                self.app(&tx, &user, app).await?;
            }
            user
        } else {
            self.begin(&tx, token, true).await?
        };
        let receipt = self
            .change_resource_in(&tx, &user, input, drive, library_app)
            .await?;
        commit(tx).await?;
        Ok(receipt)
    }
    // Callers must hold the exclusive tenant structure lock and fresh identity
    // authority. Allows content and folder changes to share a single commit.
    pub(super) async fn change_resource_in(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        input: &ResourceMutation,
        drive: bool,
        library_app: Option<&str>,
    ) -> Result<ResourceMutationReceipt> {
        let minimum = if matches!(input.change, ResourceChange::RenameFolder { .. }) {
            Role::Editor
        } else {
            Role::Owner
        };
        let resource = self
            .require_resource(tx, user, &input.id, minimum, true)
            .await?;
        self.app(tx, user, &resource.app).await?;
        let request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        if let Some(row) = tx.query_opt("SELECT request,receipt FROM aether_access.resource_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3", &[&self.tenant(), &user.id, &input.operation_id]).await.map_err(db)? {
            if row.get::<_, serde_json::Value>(0) != request { return Err(Error::Conflict); }
            let mut receipt: ResourceMutationReceipt = serde_json::from_value(row.get(1)).map_err(|_| Error::Incompatible)?;
            receipt.resource = self.visible_resource_state(tx, user, receipt.resource).await?;
            receipt.replayed = true;
            return Ok(receipt);
        }
        let initial = self.resource_snapshot(tx, user, &input.id).await?;
        if initial.structure_revision != input.expected_structure_revision {
            return Err(Error::Conflict);
        }
        if !matches!(input.change, ResourceChange::Restore { .. }) {
            self.require(tx, user, &input.id, minimum).await?;
        }
        let mut before = vec![initial];
        let action = match &input.change {
            ResourceChange::RenameFolder { name } => {
                let name = name.trim();
                if resource.kind != "folder"
                    || name.is_empty()
                    || name.len() > 1024
                    || name.chars().any(char::is_control)
                {
                    return Err(Error::Invalid);
                }
                if drive || library_app.is_some() {
                    self.drive_name_available(
                        tx,
                        &input.id,
                        name,
                        &resource.location,
                        &resource.owner,
                    )
                    .await?;
                }
                tx.execute(
                    "UPDATE aether_access.resources SET folder_name=$3 WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), &input.id, &name],
                )
                .await
                .map_err(db)?;
                "rename_folder"
            }
            ResourceChange::Trash {} | ResourceChange::Restore {} => {
                let trash = matches!(input.change, ResourceChange::Trash { .. });
                if resource.trashed == trash {
                    return Err(Error::Conflict);
                }
                if !trash && let Some(parent) = &resource.location.parent {
                    // Restore never silently moves an item out of its containing
                    // folder, and never resurrects a separately recycled child.
                    self.require(tx, user, parent, Role::Viewer).await?;
                }
                if drive && !trash {
                    self.drive_name_available(
                        tx,
                        &input.id,
                        &before[0].name,
                        &resource.location,
                        &resource.owner,
                    )
                    .await?;
                }
                tx.execute(
                    "UPDATE aether_access.resources SET trashed=$3 WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), &input.id, &trash],
                )
                .await
                .map_err(db)?;
                if trash { "trash" } else { "restore" }
            }
            ResourceChange::Move { destination } => {
                self.destination(tx, user, destination).await?;
                if drive || library_app.is_some() {
                    self.drive_name_available(
                        tx,
                        &input.id,
                        &before[0].name,
                        destination,
                        &user.id,
                    )
                    .await?;
                }
                // UNION traversal is bounded both in depth and number of rows;
                // invalid descendants must fail the entire move before any edit.
                let rows = tx.query("WITH RECURSIVE tree(id,depth,path,cycle) AS (SELECT id,0,ARRAY[id],false FROM aether_access.resources WHERE tenant=$1 AND id=$2 UNION ALL SELECT r.id,t.depth+1,t.path||r.id,r.id=ANY(t.path) FROM tree t JOIN aether_access.resources r ON r.tenant=$1 AND r.parent=t.id WHERE NOT t.cycle AND t.depth<128) SELECT id,depth,cycle FROM tree LIMIT 1025", &[&self.tenant(), &input.id]).await.map_err(db)?;
                if rows.len() > 1024 {
                    return Err(Error::Unavailable);
                }
                let ids: HashSet<String> = rows.iter().map(|row| row.get(0)).collect();
                let mut depth = 0;
                before.clear();
                for row in rows {
                    let id: String = row.get(0);
                    let child_depth: i32 = row.get(1);
                    if row.get::<_, bool>(2) || child_depth >= 128 {
                        return Err(Error::Invalid);
                    }
                    depth = depth.max(child_depth);
                    let child = self
                        .require_resource(tx, user, &id, Role::Owner, true)
                        .await?;
                    self.app(tx, user, &child.app).await?;
                    if child.location.organization != resource.location.organization
                        || child.location.workspace != resource.location.workspace
                    {
                        return Err(Error::Denied);
                    }
                    before.push(self.resource_snapshot(tx, user, &id).await?);
                }
                let mut next = destination.parent.clone();
                while let Some(parent) = next {
                    depth += 1;
                    if ids.contains(&parent) || depth >= 128 {
                        return Err(Error::Invalid);
                    }
                    next = self
                        .resource(tx, &parent)
                        .await?
                        .ok_or(Error::Denied)?
                        .location
                        .parent;
                }
                for state in &before {
                    let parent = if state.id == input.id {
                        &destination.parent
                    } else {
                        &state.location.parent
                    };
                    let owner = if destination.workspace.is_none() {
                        &user.id
                    } else {
                        &state.owner
                    };
                    tx.execute("UPDATE aether_access.resources SET organization=$3,workspace=$4,parent=$5,owner=$6 WHERE tenant=$1 AND id=$2", &[&self.tenant(), &state.id, &destination.organization, &destination.workspace, parent, owner]).await.map_err(db)?;
                    if resource.location.organization != destination.organization {
                        tx.execute(
                            "DELETE FROM aether_access.grants WHERE tenant=$1 AND resource=$2",
                            &[&self.tenant(), &state.id],
                        )
                        .await
                        .map_err(db)?;
                        tx.execute("UPDATE aether_access.links SET revoked=true WHERE tenant=$1 AND resource=$2", &[&self.tenant(), &state.id]).await.map_err(db)?;
                    }
                }
                "move"
            }
        };
        for old in &before {
            if old.structure_revision == u32::MAX {
                return Err(Error::Conflict);
            }
            tx.execute("UPDATE aether_access.resources SET structure_revision=structure_revision+1 WHERE tenant=$1 AND id=$2", &[&self.tenant(), &old.id]).await.map_err(db)?;
            let after = self.resource_snapshot(tx, user, &old.id).await?;
            tx.execute("INSERT INTO aether_access.resource_events(tenant,resource,revision,actor,operation_id,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7)", &[&self.tenant(), &old.id, &i64::from(after.structure_revision), &user.id, &input.operation_id, &serde_json::to_value(old).map_err(|_| Error::Incompatible)?, &serde_json::to_value(after).map_err(|_| Error::Incompatible)?]).await.map_err(db)?;
            self.audit(tx, user, action, &old.id).await?;
        }
        let mut receipt = ResourceMutationReceipt {
            operation_id: input.operation_id.clone(),
            resource: self.resource_snapshot(tx, user, &input.id).await?,
            replayed: false,
        };
        tx.execute(
            "INSERT INTO aether_access.resource_receipts VALUES($1,$2,$3,$4,$5)",
            &[
                &self.tenant(),
                &user.id,
                &input.operation_id,
                &request,
                &serde_json::to_value(&receipt).map_err(|_| Error::Incompatible)?,
            ],
        )
        .await
        .map_err(db)?;
        receipt.resource = self
            .visible_resource_state(tx, user, receipt.resource)
            .await?;
        Ok(receipt)
    }
}
