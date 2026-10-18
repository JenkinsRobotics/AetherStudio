use super::{
    NativeHost,
    boundary::{Failure, Result, body, token},
};
use crate::documents::{Documents, Error, Location, Mutation, Role};
use aether_protocol_core::browsing::{BrowsePage, BrowseRequest};
use aether_protocol_core::directory::{
    DirectoryChange, OrganizationListRequest, OrganizationPage, WorkspaceListRequest, WorkspacePage,
};
use aether_protocol_core::resources::{
    RecycleListRequest, RecyclePage, ResourceMutation, ResourceMutationReceipt, ResourceState,
    ResourceStateRequest,
};
use aether_protocol_core::storage::{
    DocumentListPage, DocumentListRequest, DocumentRevision, MutationReceipt, StoreErrorCode,
    StoredDocument,
};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
type Input<T> = std::result::Result<Json<T>, JsonRejection>;
fn documents(host: &NativeHost) -> Result<&Documents> {
    host.documents.as_ref().ok_or_else(|| {
        Failure::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "unavailable",
            "Document service is not configured.",
        )
    })
}
impl From<Error> for Failure {
    fn from(error: Error) -> Self {
        let (status, code, message) = match error {
            Error::Identity(e) => return e.into(),
            Error::Denied => (
                StatusCode::NOT_FOUND,
                "not_found",
                "Document or access is unavailable.",
            ),
            Error::TooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "too_large",
                "Use the download endpoint for large files.",
            ),
            Error::Unsupported => (
                StatusCode::NOT_IMPLEMENTED,
                "unsupported_feature",
                "This library operation is not available on this server yet.",
            ),
            Error::Invalid => (
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Invalid document request.",
            ),
            Error::MergeConflict { source_head, target_head } => return Self::new(StatusCode::CONFLICT, "merge_conflict", "Both branches changed. Choose the complete file to keep.").with_detail(serde_json::json!({"conflict":true,"source_head":source_head,"target_head":target_head})),
            Error::Conflict => (
                StatusCode::CONFLICT,
                "conflict",
                "The requested change conflicts with current state.",
            ),
            Error::OutcomeUnknown => return aether_identity::Error::OutcomeUnknown.into(),
            Error::Incompatible | Error::Unavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "unavailable",
                "Document service is unavailable.",
            ),
            Error::Storage(e) => match e.code {
                StoreErrorCode::InvalidRequest => (
                    StatusCode::BAD_REQUEST,
                    "invalid_input",
                    "Invalid document request.",
                ),
                StoreErrorCode::NotFound => (
                    StatusCode::NOT_FOUND,
                    "not_found",
                    "Document or access is unavailable.",
                ),
                StoreErrorCode::RevisionConflict => (
                    StatusCode::CONFLICT,
                    "revision_conflict",
                    "The document has changed. Load its current revision before saving.",
                ),
                StoreErrorCode::OperationConflict => (
                    StatusCode::CONFLICT,
                    "operation_conflict",
                    "Operation ID was already used for a different request.",
                ),
                StoreErrorCode::Busy => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "busy",
                    "Document service is busy.",
                ),
                _ => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "unavailable",
                    "Document service is unavailable.",
                ),
            },
        };
        Self::new(status, code, message)
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Read {
    id: String,
    revision: Option<u32>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct History {
    id: String,
    after: u32,
    limit: u32,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Grant {
    id: String,
    user: String,
    #[serde(deserialize_with = "required_nullable")]
    role: Option<Role>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Folder {
    id: String,
    name: Option<String>,
    location: Location,
}
#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum Administration {
    App {
        app: String,
        enabled: bool,
        restricted: bool,
    },
    Team {
        team: String,
        members: Vec<String>,
        apps: Vec<String>,
    },
    OrganizationMember {
        organization: String,
        user: String,
        #[serde(deserialize_with = "required_nullable")]
        role: Option<String>,
    },
}
pub(super) async fn mutate(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Mutation>,
) -> Result<Json<MutationReceipt>> {
    Ok(Json(
        documents(&host)?
            .mutate(&token(&headers)?, &body(input)?)
            .await?,
    ))
}
pub(super) async fn read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Read>,
) -> Result<Json<StoredDocument>> {
    let input = body(input)?;
    Ok(Json(
        documents(&host)?
            .read(&token(&headers)?, &input.id, input.revision)
            .await?,
    ))
}
pub(super) async fn list(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<DocumentListRequest>,
) -> Result<Json<DocumentListPage>> {
    Ok(Json(
        documents(&host)?
            .list(&token(&headers)?, &body(input)?)
            .await?,
    ))
}
pub(super) async fn history(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<History>,
) -> Result<Json<Vec<DocumentRevision>>> {
    let input = body(input)?;
    Ok(Json(
        documents(&host)?
            .history(&token(&headers)?, &input.id, input.after, input.limit)
            .await?,
    ))
}
pub(super) async fn grant(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Grant>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    documents(&host)?
        .grant(&token(&headers)?, &input.id, &input.user, input.role)
        .await?;
    Ok(Json(json!({"ok":true})))
}
pub(super) async fn folder(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Folder>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    documents(&host)?
        .create_named_folder(
            &token(&headers)?,
            &input.id,
            &input.location,
            input.name.as_deref().unwrap_or(&input.id),
        )
        .await?;
    Ok(Json(json!({"ok":true})))
}
pub(super) async fn administration(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Administration>,
) -> Result<Json<Value>> {
    let docs = documents(&host)?;
    let token = token(&headers)?;
    match body(input)? {
        Administration::App {
            app,
            enabled,
            restricted,
        } => {
            docs.configure_app(&token, &app, enabled, restricted)
                .await?
        }
        Administration::Team {
            team,
            members,
            apps,
        } => docs.configure_team(&token, &team, &members, &apps).await?,
        Administration::OrganizationMember {
            organization,
            user,
            role,
        } => {
            docs.set_organization_member(&token, &organization, &user, role.as_deref())
                .await?
        }
    }
    Ok(Json(json!({"ok":true})))
}

// Null explicitly revokes; an omitted field must not accidentally remove access.
fn required_nullable<'de, D, T>(deserializer: D) -> std::result::Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}

pub(super) async fn directory(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<DirectoryChange>,
) -> Result<Json<Value>> {
    documents(&host)?
        .manage_directory(&token(&headers)?, &body(input)?)
        .await?;
    Ok(Json(json!({"ok":true})))
}
pub(super) async fn organizations(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<OrganizationListRequest>,
) -> Result<Json<OrganizationPage>> {
    Ok(Json(
        documents(&host)?
            .list_organizations(&token(&headers)?, &body(input)?)
            .await?,
    ))
}
pub(super) async fn workspaces(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<WorkspaceListRequest>,
) -> Result<Json<WorkspacePage>> {
    Ok(Json(
        documents(&host)?
            .list_workspaces(&token(&headers)?, &body(input)?)
            .await?,
    ))
}

pub(super) async fn browse(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<BrowseRequest>,
) -> Result<Json<BrowsePage>> {
    Ok(Json(
        documents(&host)?
            .browse(&token(&headers)?, &body(input)?)
            .await?,
    ))
}

pub(super) async fn resource_state(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<ResourceStateRequest>,
) -> Result<Json<ResourceState>> {
    Ok(Json(
        documents(&host)?
            .resource_state(&token(&headers)?, &body(input)?.id)
            .await?,
    ))
}
pub(super) async fn resource_change(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<ResourceMutation>,
) -> Result<Json<ResourceMutationReceipt>> {
    Ok(Json(
        documents(&host)?
            .change_resource(&token(&headers)?, &body(input)?)
            .await?,
    ))
}

pub(super) async fn recycle(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<RecycleListRequest>,
) -> Result<Json<RecyclePage>> {
    Ok(Json(
        documents(&host)?
            .recycle_bin(&token(&headers)?, &body(input)?)
            .await?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn removing_permissions_requires_explicit_null() {
        assert!(serde_json::from_value::<Grant>(json!({"id":"file","user":"member"})).is_err());
        assert!(
            serde_json::from_value::<Grant>(json!({"id":"file","user":"member","role":null}))
                .is_ok()
        );
        assert!(
            serde_json::from_value::<Administration>(
                json!({"action":"organization_member","organization":"default","user":"member"})
            )
            .is_err()
        );
    }
}
