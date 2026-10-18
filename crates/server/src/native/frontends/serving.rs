use super::super::{
    NativeHost,
    boundary::{Failure, Result, optional_token},
    routes,
};
use super::*;
use axum::{
    body::Body,
    extract::{Request, State},
    http::{HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
};

pub(crate) fn decoded(path: &str) -> Option<String> {
    if path.len() > 4096 || !path.starts_with('/') {
        return None;
    }
    let mut output = Vec::new();
    let bytes = path.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            output.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            output.push(bytes[i]);
            i += 1;
        }
    }
    let path = String::from_utf8(output).ok()?;
    if path.contains(['\\', '\0'])
        || path.chars().any(char::is_control)
        || path.contains("//")
        || path.split('/').any(|p| matches!(p, "." | ".."))
    {
        return None;
    }
    Some(path)
}
fn redirect(destination: &str) -> Result<Response> {
    let mut response = StatusCode::FOUND.into_response();
    response.headers_mut().insert(
        "location",
        HeaderValue::from_str(destination).map_err(|_| {
            Failure::new(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Invalid destination.",
            )
        })?,
    );
    Ok(response)
}
fn sign_in(path: &str) -> Result<Response> {
    let mut url = reqwest::Url::parse("http://local.invalid/").expect("constant URL");
    url.query_pairs_mut().append_pair("next", path);
    redirect(&format!("/?{}", url.query().expect("next query")))
}
pub(crate) async fn serve(State(host): State<NativeHost>, request: Request) -> Response {
    match respond(host, request).await {
        Ok(response) => response,
        Err(error) => error.into_response(),
    }
}
async fn respond(host: NativeHost, request: Request) -> Result<Response> {
    let Some(web) = &host.frontends else {
        return Ok(routes::not_found().await);
    };
    let Some(path) = decoded(request.uri().path()) else {
        return Ok(routes::not_found().await);
    };
    // Unknown API paths never become HTML, including percent-encoded spellings.
    if path == "/api" || path.starts_with("/api/") || !web.accepts_path(&path) {
        return Ok(routes::not_found().await);
    }
    if !matches!(*request.method(), Method::GET | Method::HEAD) {
        return Ok(routes::method_not_allowed().await);
    }
    let app = path
        .trim_start_matches('/')
        .split('/')
        .next()
        .filter(|id| web.installed(id));
    let html = path == "/"
        || path.ends_with(".html")
        || app.is_some_and(|id| path == format!("/{id}") || path == format!("/{id}/"));
    if let Some(app) = app {
        let token = optional_token(request.headers())?;
        let documents = host.documents.as_ref().ok_or_else(|| {
            Failure::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "unavailable",
                "Application authority is not configured.",
            )
        })?;
        let (session, allowed) = documents
            .application_status(token.as_ref().map(|t| t.as_str()), &[app])
            .await?;
        if session.user.as_ref().is_none_or(|u| u.must_change) {
            return if html {
                sign_in(&request.uri().to_string())
            } else {
                Err(aether_identity::Error::Unauthorized.into())
            };
        }
        if !allowed.iter().any(|id| id == app)
            || (app == "ui"
                && session
                    .user
                    .as_ref()
                    .is_none_or(|u| u.role != aether_identity::Role::Admin))
        {
            return Ok(routes::not_found().await);
        }
        if path == format!("/{app}") {
            return redirect(&format!(
                "/{app}/{}",
                request
                    .uri()
                    .query()
                    .map(|q| format!("?{q}"))
                    .unwrap_or_default()
            ));
        }
    }
    if app.is_none()
        && html
        && host.setup.is_none()
        && !host.identity.session_status(None).await?.ready
    {
        return Err(Failure::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "setup_required",
            "Initialize this development server before opening its web interface.",
        ));
    }
    let library_home = app
        .is_some_and(|id| ["cad", "map", "animation"].contains(&id) && path == format!("/{id}/"));
    let file = if path == "/" || library_home {
        "/index.html".to_owned()
    } else if path.ends_with('/') {
        format!("{path}index.html")
    } else {
        path.clone()
    };
    let Some(asset) = web.0.files.get(&file) else {
        return Ok(routes::not_found().await);
    };
    let bytes = if library_home {
        // One shared Studio library view, retaining the selected application's
        // theme scope; its scripts use absolute /assets URLs.
        Bytes::from(
            std::str::from_utf8(&asset.bytes)
                .expect("validated HTML")
                .replacen(
                    "content=\"studio\"",
                    &format!("content=\"{}\"", app.expect("library app")),
                    1,
                ),
        )
    } else {
        asset.bytes.clone()
    };
    let length = bytes.len();
    let body = if request.method() == Method::HEAD {
        Body::empty()
    } else {
        Body::from(bytes)
    };
    let mut response = Response::new(body);
    let headers = response.headers_mut();
    headers.insert("content-type", HeaderValue::from_static(asset.mime));
    headers.insert(
        "content-length",
        HeaderValue::from_str(&length.to_string()).expect("length"),
    );
    headers.insert(
        "x-aether-applications-ready",
        HeaderValue::from_static("false"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("SAMEORIGIN"));
    Ok(response)
}
