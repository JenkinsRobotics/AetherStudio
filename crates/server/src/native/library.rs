use super::{
    NativeHost,
    boundary::{Failure, Result, body, token},
};
use crate::documents::{Error, library::Request};
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
};
use serde_json::{Value, json};

pub(super) async fn library(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    host.identity.authenticate(&session).await?;
    if !matches!(
        action.as_str(),
        "cad_metadata"
            | "cad_operation"
            | "project_create"
            | "project_read"
            | "project_edit"
            | "list"
            | "read"
            | "create"
            | "save"
            | "rename"
            | "history"
            | "compare"
            | "read_revision"
            | "restore"
            | "version"
            | "version_update"
            | "version_delete"
            | "version_status"
            | "collaboration"
            | "collaboration_mutate"
            | "branch_create"
            | "branch_rename"
            | "branch_delete"
            | "merge"
    ) {
        return Err(Error::Unsupported.into());
    }
    let mut value = body(input)?;
    let object = value.as_object_mut().ok_or(Error::Invalid)?;
    if object.insert("action".into(), json!(action)).is_some() {
        return Err(Error::Invalid.into());
    }
    let docs = host.documents.as_ref().ok_or_else(|| {
        Failure::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "unavailable",
            "Document service is not configured.",
        )
    })?;
    if matches!(action.as_str(), "cad_metadata" | "cad_operation") {
        if value["app"].as_str().is_some_and(|app| app != "cad") {
            return Err(Error::Unsupported.into());
        }
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(docs.cad_settings(&session, &input).await?));
    }
    if matches!(
        action.as_str(),
        "project_create" | "project_read" | "project_edit"
    ) {
        // Other products still have no project-container contract. Preserve
        // their explicit unsupported response before parsing CAD-only fields.
        if value["app"].as_str().is_some_and(|app| app != "cad") {
            return Err(Error::Unsupported.into());
        }
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(docs.cad_project(&session, &input).await?));
    }
    if matches!(
        action.as_str(),
        "version" | "version_update" | "version_delete" | "version_status"
    ) {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(docs.change_named_version(&session, &input).await?));
    }
    if matches!(action.as_str(), "collaboration" | "collaboration_mutate") {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(docs.collaboration(&session, &input).await?));
    }
    if matches!(
        action.as_str(),
        "branch_create" | "branch_rename" | "branch_delete" | "merge"
    ) {
        let input = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
        return Ok(Json(docs.library_branch(&session, &input).await?));
    }
    let input: Request = serde_json::from_value(value).map_err(|_| Error::Invalid)?;
    Ok(Json(docs.library(&session, &input).await?))
}
