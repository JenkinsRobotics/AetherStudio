//! Studio-only session/permissions/storage coordinator. All document operations
//! share the same transaction with identity and ACL locks; no stale permit object
//! or caller-provided actor authorizes a save. This is not a product engine.
pub mod admin_directory;
mod administration;
pub mod automation;
pub mod live_editors;
mod browsing;
pub mod cad_projects;
pub mod cad_settings;
mod cad_settings_actions;
pub mod change_state;
pub mod collaboration;
mod collaboration_model;
mod directory;
mod download;
pub mod drive_activity;
mod drive_context;
pub mod drive_copy;
pub mod drive_create;
pub mod drive_edits;
pub mod drive_grants;
pub mod drive_items;
pub mod drive_links;
pub mod drive_listing;
pub mod drive_members;
pub mod drive_membership;
pub mod drive_provisioning;
mod drive_recycle;
mod drive_sharing;
pub mod file_favorites;
pub mod library;
pub mod library_branches;
pub mod library_versions;
mod listing;
mod maintenance;
pub mod map_devices;
pub mod map_exports;
pub mod map_media;
pub mod policy;
mod product_commands;
mod product_services;
mod recycle;
mod repository;
mod resources;
mod schema;
mod services;
mod status;
pub mod uploads;
pub mod workspace_files;
pub mod workspace_preferences;
use aether_identity::{Identity, User};
pub use aether_protocol_core::resources::ResourceLocation as Location;
use aether_protocol_core::storage::{
    DocumentChange, DocumentMutation, DocumentRevision, MutationReceipt, StoredDocument,
};
use aether_store::hosted::{AuthorizedScope, HostedStore};
use deadpool_postgres::Pool;
pub use policy::Role;
use serde::Deserialize;
use std::time::Duration;
use tokio_postgres::Transaction;

#[derive(Debug)]
pub enum Error {
    Identity(aether_identity::Error),
    Storage(aether_store::StoreError),
    Denied,
    Invalid,
    Conflict,
    MergeConflict { source_head: u32, target_head: u32 },
    Unavailable,
    Incompatible,
    OutcomeUnknown,
    Unsupported,
    TooLarge,
}
impl From<aether_identity::Error> for Error {
    fn from(e: aether_identity::Error) -> Self {
        Self::Identity(e)
    }
}
impl From<aether_store::StoreError> for Error {
    fn from(e: aether_store::StoreError) -> Self {
        Self::Storage(e)
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Studio document operation failed.")
    }
}
impl std::error::Error for Error {}
pub type Result<T> = std::result::Result<T, Error>;
#[derive(Clone)]
pub struct Documents {
    delegation: Option<automation::Delegation>,
    products: Option<crate::products::Products>,
    pool: Pool,
    identity: Identity,
    store: HostedStore,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Mutation {
    pub operation_id: String,
    pub document_id: String,
    pub change: DocumentChange,
    pub location: Option<Location>,
}
// Internal capabilities; a caller cannot mark unverified Drive bytes as uploaded.
enum ContentAuthority<'a> {
    Ordinary,
    VerifiedUpload,
    Branch(&'a str),
}
impl Documents {
    /// Pool, identity and store must use the same PostgreSQL database. The content
    /// store is the matching private object authority. Tenant comes from identity.
    pub fn new(pool: Pool, identity: Identity, store: HostedStore) -> Self {
        Self {
            pool,
            identity,
            store,
            delegation: None,
            products: None,
        }
    }
    pub fn with_products(mut self, products: crate::products::Products) -> Self {
        self.products = Some(products);
        self
    }
    fn tenant(&self) -> &str {
        self.identity.tenant()
    }
    async fn client(&self) -> Result<deadpool_postgres::Object> {
        tokio::time::timeout(Duration::from_secs(5), self.pool.get())
            .await
            .map_err(|_| Error::Unavailable)?
            .map_err(|_| Error::Unavailable)
    }
    async fn begin(&self, tx: &Transaction<'_>, token: &str, exclusive: bool) -> Result<User> {
        let user = if let Some(delegate) = &self.delegation {
            let (user, grant) = self
                .identity
                .authorize_agent_transaction(
                    tx,
                    &delegate.token,
                    Some(&delegate.app),
                    delegate.access,
                )
                .await?;
            self.identity
                .audit_agent_command_in(tx, &user, &grant, &delegate.command)
                .await?;
            user
        } else {
            self.identity.authorize_transaction(tx, token).await?
        };
        let enrolled = tx
            .query_opt(
                "SELECT 1 FROM aether_access.enrolled WHERE tenant=$1 AND user_id=$2",
                &[&self.tenant(), &user.id],
            )
            .await
            .map_err(db)?
            .is_some();
        let sql = if exclusive || !enrolled {
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))"
        } else {
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))"
        };
        tx.execute(sql, &[&self.tenant()]).await.map_err(db)?;
        if !enrolled {
            self.enroll(tx, &user).await?;
        }
        self.authorize_delegation(tx, &user).await?;
        Ok(user)
    }
    async fn enroll(&self, tx: &Transaction<'_>, user: &User) -> Result<()> {
        self.enroll_id(tx, &user.id, user.role == aether_identity::Role::Admin)
            .await
    }
    async fn enroll_id(&self, tx: &Transaction<'_>, id: &str, admin: bool) -> Result<()> {
        // The enrolled marker is never removed by membership removal. Lazy
        // defaults must not silently rejoin a deliberately removed account.
        if tx
            .query_opt(
                "SELECT 1 FROM aether_access.enrolled WHERE tenant=$1 AND user_id=$2",
                &[&self.tenant(), &id],
            )
            .await
            .map_err(db)?
            .is_some()
        {
            return Ok(());
        }
        tx.execute(
            "INSERT INTO aether_access.organizations(tenant,id,name) VALUES($1,'default','Default') ON CONFLICT DO NOTHING",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        tx.execute("INSERT INTO aether_access.workspaces(tenant,id,organization,is_default,name) VALUES($1,'shared','default',false,'Shared') ON CONFLICT DO NOTHING",&[&self.tenant()]).await.map_err(db)?;
        let role = if admin { "owner" } else { "member" };
        tx.execute(
            "INSERT INTO aether_access.members VALUES($1,'default',$2,$3) ON CONFLICT DO NOTHING",
            &[&self.tenant(), &id, &role],
        )
        .await
        .map_err(db)?;
        tx.execute("INSERT INTO aether_access.workspace_members VALUES($1,'shared',$2,'viewer') ON CONFLICT DO NOTHING",&[&self.tenant(),&id]).await.map_err(db)?;
        tx.execute(
            "INSERT INTO aether_access.enrolled VALUES($1,$2)",
            &[&self.tenant(), &id],
        )
        .await
        .map_err(db)?;
        Ok(())
    }
    pub async fn mutate(&self, token: &str, input: &Mutation) -> Result<MutationReceipt> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self
            .begin(
                &tx,
                token,
                matches!(input.change, DocumentChange::Create { .. }),
            )
            .await?;
        let receipt = self.mutate_in(&tx, &user, input, None).await?;
        commit(tx).await?;
        Ok(receipt)
    }
    async fn mutate_in(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        input: &Mutation,
        requested_app: Option<&str>,
    ) -> Result<MutationReceipt> {
        self.mutate_authorized_in(tx, user, input, requested_app, false)
            .await
    }
    // Private capability used only after upload bytes were verified in this transaction.
    async fn mutate_authorized_in(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        input: &Mutation,
        requested_app: Option<&str>,
        verified_upload: bool,
    ) -> Result<MutationReceipt> {
        self.mutate_target_authorized_in(
            tx,
            user,
            input,
            requested_app,
            if verified_upload {
                ContentAuthority::VerifiedUpload
            } else {
                ContentAuthority::Ordinary
            },
        )
        .await
    }
    async fn mutate_target_authorized_in(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        input: &Mutation,
        requested_app: Option<&str>,
        authority: ContentAuthority<'_>,
    ) -> Result<MutationReceipt> {
        let branch = if let ContentAuthority::Branch(branch) = authority {
            Some(branch)
        } else {
            None
        };
        if branch.is_some()
            && !matches!(
                input.change,
                DocumentChange::Save { .. }
                    | DocumentChange::SaveNamed { .. }
                    | DocumentChange::Restore { .. }
            )
        {
            return Err(Error::Invalid);
        }
        let expected_app = if let DocumentChange::Create { app, .. } = &input.change {
            self.app(tx, user, app).await?;
            let location = input.location.clone().unwrap_or_default();
            if let Some(existing) = self.resource(tx, &input.document_id).await? {
                self.require(tx, user, &input.document_id, Role::Editor)
                    .await?;
                if existing.kind != "document"
                    || existing.app != *app
                    || existing.location != location
                    || existing.owner != user.id
                {
                    return Err(Error::Conflict);
                }
            } else {
                self.destination(tx, user, &location).await?;
                self.insert_resource(tx, user, &input.document_id, app, &location, "document")
                    .await?;
            }
            app.clone()
        } else {
            if input.location.is_some() {
                return Err(Error::Invalid);
            }
            let resource = self
                .require(tx, user, &input.document_id, Role::Editor)
                .await?;
            if resource.kind != "document" {
                return Err(Error::Denied);
            }
            self.app(tx, user, &resource.app).await?;
            resource.app
        };
        if requested_app.is_some_and(|app| app != expected_app) {
            return Err(Error::Denied);
        }
        if expected_app == "drive" && !matches!(authority, ContentAuthority::VerifiedUpload) {
            download::validate_public_change(&input.change)?;
        }
        let request = DocumentMutation {
            operation_id: input.operation_id.clone(),
            document_id: input.document_id.clone(),
            actor: user.id.clone(),
            change: input.change.clone(),
        };
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let receipt = if let Some(branch) = branch {
            self.store
                .mutate_branch_in(
                    tx,
                    &scope,
                    &aether_protocol_core::branches::BranchDocumentMutation {
                        branch: branch.to_owned(),
                        mutation: request,
                    },
                )
                .await?
        } else {
            self.store.mutate_in(tx, &scope, &request).await?
        };
        if receipt.document.app != expected_app {
            return Err(Error::Incompatible);
        }
        if expected_app == "map" {
            let saved = self
                .store
                .read_in(
                    tx,
                    &scope,
                    &input.document_id,
                    Some(receipt.document.revision),
                )
                .await?;
            self.bind_map_media(tx, user, &input.document_id, &saved.content_base64)
                .await?;
        }
        Ok(receipt)
    }
    pub async fn read(
        &self,
        token: &str,
        id: &str,
        revision: Option<u32>,
    ) -> Result<StoredDocument> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        if resource.kind != "document" {
            return Err(Error::Denied);
        }
        self.app(&tx, &user, &resource.app).await?;
        let result = self
            .store
            .read_in(
                &tx,
                &AuthorizedScope::new(self.tenant(), &user.id)?,
                id,
                revision,
            )
            .await?;
        if result.document.app != resource.app {
            return Err(Error::Incompatible);
        }
        commit(tx).await?;
        Ok(result)
    }
    pub async fn history(
        &self,
        token: &str,
        id: &str,
        after: u32,
        limit: u32,
    ) -> Result<Vec<DocumentRevision>> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        self.app(&tx, &user, &resource.app).await?;
        if resource.kind != "document" {
            return Err(Error::Denied);
        }
        let result = self
            .store
            .history_in(
                &tx,
                &AuthorizedScope::new(self.tenant(), &user.id)?,
                id,
                after,
                limit,
            )
            .await?;
        if result.iter().any(|r| r.app != resource.app) {
            return Err(Error::Incompatible);
        }
        commit(tx).await?;
        Ok(result)
    }
}
fn db(_: tokio_postgres::Error) -> Error {
    Error::Unavailable
}
async fn commit(tx: deadpool_postgres::Transaction<'_>) -> Result<()> {
    tx.commit().await.map_err(|_| Error::OutcomeUnknown)
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.:".contains(&c))
}
