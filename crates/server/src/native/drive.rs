//! Browser Drive navigation. Unmigrated actions fail explicitly.
use super::{
    NativeHost,
    boundary::{Failure, Result, body, token},
    status::applications,
};
use crate::documents::Error;
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ContextRequest {}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RecycleRequest {
    id: String,
    operation_id: String,
    expected_structure_revision: u32,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MoveRequest {
    id: String,
    operation_id: String,
    expected_structure_revision: u32,
    destination: aether_protocol_core::resources::ResourceLocation,
}
pub(super) async fn drive(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    host.identity.authenticate(&session).await?;
    if !matches!(
        action.as_str(),
        "context"
            | "upload_begin"
            | "upload_status"
            | "upload_chunk"
            | "upload_finish"
            | "upload_cancel"
            | "administration"
            | "organization_create"
            | "workspace_create"
            | "trash"
            | "restore"
            | "rename"
            | "create"
            | "copy"
            | "grant"
            | "link_create"
            | "link_revoke"
            | "redeem"
            | "move"
            | "list"
            | "details"
            | "open"
            | "read"
            | "sharing"
            | "members"
            | "member_update"
            | "activity"
            | "favorite"
            | "workspace_open"
            | "workspace_favorite"
    ) {
        return Err(Error::Unsupported.into());
    }
    let value = body(input)?;
    if !value.is_object() {
        return Err(Error::Invalid.into());
    }

    let documents = host.documents.as_ref().ok_or_else(|| {
        Failure::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "unavailable",
            "Document service is not configured.",
        )
    })?;
    if action == "upload_begin" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.upload_begin(&session, &input).await?));
    }
    if matches!(
        action.as_str(),
        "upload_status" | "upload_chunk" | "upload_finish" | "upload_cancel"
    ) {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.upload(&session, &action, &input).await?));
    }
    if action == "administration" {
        let _: ContextRequest = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_administration(&session).await?));
    }
    if matches!(action.as_str(), "organization_create" | "workspace_create") {
        let mut value = value;
        if value
            .as_object_mut()
            .ok_or(Error::Invalid)?
            .insert("action".into(), json!(action))
            .is_some()
        {
            return Err(Error::Invalid.into());
        }
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_provision(&session, &input).await?));
    }
    if action == "copy" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(
            documents
                .drive_copy(&session, &input, host.attachments.as_ref())
                .await?,
        ));
    }
    if matches!(action.as_str(), "link_create" | "link_revoke" | "redeem") {
        let mut value = value;
        if value
            .as_object_mut()
            .ok_or(Error::Invalid)?
            .insert("action".into(), json!(action))
            .is_some()
        {
            return Err(Error::Invalid.into());
        }
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_link(&session, &input).await?));
    }
    if action == "grant" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_grant(&session, &input).await?));
    }
    if action == "create" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_create(&session, &input).await?));
    }
    if action == "rename" {
        let input: crate::documents::drive_edits::RenameRequest =
            serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        if input.kind == "file" {
            return Ok(Json(documents.drive_rename_file(&session, &input).await?));
        }
        if input.kind != "folder" {
            return Err(Error::Invalid.into());
        }
        use aether_protocol_core::resources::{ResourceChange, ResourceMutation};
        let receipt = documents
            .change_drive_resource(
                &session,
                &ResourceMutation {
                    id: input.id,
                    operation_id: input.operation_id,
                    expected_structure_revision: input.expected_revision,
                    change: ResourceChange::RenameFolder { name: input.name },
                },
            )
            .await?;
        return Ok(Json(
            json!({"ok":true,"operation_id":receipt.operation_id,"resource":receipt.resource,"replayed":receipt.replayed}),
        ));
    }
    if action == "move" {
        let input: MoveRequest = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        use aether_protocol_core::resources::{ResourceChange, ResourceMutation};
        let receipt = documents
            .change_drive_resource(
                &session,
                &ResourceMutation {
                    id: input.id,
                    operation_id: input.operation_id,
                    expected_structure_revision: input.expected_structure_revision,
                    change: ResourceChange::Move {
                        destination: input.destination,
                    },
                },
            )
            .await?;
        return Ok(Json(
            json!({"ok":true,"operation_id":receipt.operation_id,"resource":receipt.resource,"replayed":receipt.replayed}),
        ));
    }
    if matches!(action.as_str(), "trash" | "restore") {
        let input: RecycleRequest = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        use aether_protocol_core::resources::{ResourceChange, ResourceMutation};
        let receipt = documents
            .change_drive_resource(
                &session,
                &ResourceMutation {
                    id: input.id,
                    operation_id: input.operation_id,
                    expected_structure_revision: input.expected_structure_revision,
                    change: if action == "trash" {
                        ResourceChange::Trash {}
                    } else {
                        ResourceChange::Restore {}
                    },
                },
            )
            .await?;
        return Ok(Json(
            json!({"ok":true,"operation_id":receipt.operation_id,"resource":receipt.resource,"replayed":receipt.replayed}),
        ));
    }
    if matches!(action.as_str(), "details" | "open" | "read") {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        use crate::documents::drive_items::Mode;
        let mode = match action.as_str() {
            "read" => Mode::Read(host.attachments.as_ref()),
            "open" => Mode::Open,
            _ => Mode::Details,
        };
        return Ok(Json(documents.drive_item(&session, &input, mode).await?));
    }
    if action == "activity" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_activity(&session, &input).await?));
    }
    if action == "member_update" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_member_update(&session, &input).await?));
    }
    if action == "members" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_members(&session, &input).await?));
    }
    if action == "sharing" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_sharing(&session, &input).await?));
    }
    if action == "favorite" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(
            documents.change_file_favorite(&session, &input).await?,
        ));
    }
    if action == "list" {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(documents.drive_list(&session, &input).await?));
    }
    if action != "context" {
        let mut value = value;
        if value
            .as_object_mut()
            .ok_or(Error::Invalid)?
            .insert("action".into(), json!(action))
            .is_some()
        {
            return Err(Error::Invalid.into());
        }
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(
            documents
                .change_workspace_preference(&session, &input)
                .await?,
        ));
    }
    let _: ContextRequest = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
    let candidates: Vec<&str> = host.catalog.iter().map(|app| app.id.as_str()).collect();
    let (user, mut value, allowed) = documents.drive_context(&session, &candidates).await?;
    value["user"] = json!({"id":user.id,"username":user.username,"name":if user.full_name.is_empty(){&user.username}else{&user.full_name},"admin":user.role==aether_identity::Role::Admin});
    value["apps"] = json!(applications(&host, &allowed, Some(&user)));
    Ok(Json(value))
}
