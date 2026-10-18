use super::{
    NativeHost,
    boundary::{Result, body, token},
    frontends::decoded,
    routes,
};
use crate::{documents::Error, workspace_assets::relative};
use axum::{
    Json,
    body::Body,
    extract::{Path, Request, State, rejection::JsonRejection},
    http::{Method, StatusCode},
    response::Response,
};

pub(super) fn path(raw: &str) -> Option<(String, String)> {
    let path = decoded(raw)?;
    let (app, rest) = path.strip_prefix('/')?.split_once("/workspace/")?;
    if !super::status::catalog().iter().any(|a| a.id == app) || !relative(rest) {
        return None;
    }
    Some((app.to_owned(), rest.to_owned()))
}
pub(super) async fn serve(State(host): State<NativeHost>, request: Request) -> Result<Response> {
    if !matches!(*request.method(), Method::GET | Method::HEAD) {
        return Ok(routes::method_not_allowed().await);
    }
    let session = token(request.headers())?;
    let (app, path) = path(request.uri().path()).ok_or(Error::Denied)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    let asset = docs
        .workspace_read(&session, &app, &path, host.workspace_assets.as_ref())
        .await?;
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/octet-stream")
        .header("content-disposition", "attachment")
        .header("content-length", asset.bytes.len())
        .header("x-aether-revision", asset.revision)
        .header("cache-control", "private, no-store")
        .header("content-security-policy", "sandbox; default-src 'none'")
        .header("x-content-type-options", "nosniff")
        .body(if request.method() == Method::HEAD {
            Body::empty()
        } else {
            Body::from(asset.bytes)
        })
        .map_err(|_| Error::Incompatible.into())
}

pub(super) async fn save(
    State(host): State<NativeHost>,
    Path(app): Path<String>,
    headers: axum::http::HeaderMap,
    input: std::result::Result<Json<crate::documents::workspace_files::Save>, JsonRejection>,
) -> Result<Json<serde_json::Value>> {
    let session = token(&headers)?;
    if !super::status::catalog().iter().any(|a| a.id == app) {
        return Err(Error::Denied.into());
    }
    let input = body(input)?;
    let revision = host
        .documents
        .as_ref()
        .ok_or(Error::Unavailable)?
        .workspace_save(&session, &app, &input, host.workspace_assets.as_ref())
        .await?;
    Ok(Json(serde_json::json!({"ok":true,"revision":revision})))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn route_decodes_once_without_traversal_or_user_selection() {
        assert_eq!(
            path("/map/workspace/models/%CF%80%20mesh.stl"),
            Some(("map".into(), "models/π mesh.stl".into()))
        );
        for value in [
            "/api/workspace/a",
            "/unknown/workspace/a",
            "/map/workspace/",
            "/map/workspace/../a",
            "/map/workspace/%2e%2e/a",
            "/map/workspace/%252e%252e/a",
            "/map/workspace/%00",
            "/map/workspace/%5cfile",
            "/map/workspace/%ff",
            "/map/workspace/%2fetc/passwd",
        ] {
            assert!(path(value).is_none(), "{value}");
        }
    }
}
