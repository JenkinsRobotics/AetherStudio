use super::{
    NativeHost,
    boundary::{Failure, Result, token},
};
use crate::documents::Error;
use axum::{
    extract::{Query, State, rejection::QueryRejection},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Request {
    id: String,
    revision: Option<u32>,
    preview: Option<String>,
}
fn range(headers: &HeaderMap, length: usize) -> std::result::Result<Option<(usize, usize)>, ()> {
    let mut values = headers.get_all("range").iter();
    let Some(value) = values.next() else {
        return Ok(None);
    };
    if values.next().is_some() {
        return Err(());
    }
    let value = value
        .to_str()
        .map_err(|_| ())?
        .strip_prefix("bytes=")
        .ok_or(())?;
    let (start, end) = value.split_once('-').ok_or(())?;
    if start.is_empty()
        || !start.bytes().all(|b| b.is_ascii_digit())
        || !end.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(());
    }
    let start = start.parse::<usize>().map_err(|_| ())?;
    let end = if end.is_empty() {
        length.saturating_sub(1)
    } else {
        end.parse::<usize>()
            .map_err(|_| ())?
            .min(length.saturating_sub(1))
    };
    if start >= length || end < start {
        return Err(());
    }
    Ok(Some((start, end)))
}
fn safe_mime(name: &str) -> Option<&'static str> {
    Some(
        match name.rsplit('.').next()?.to_ascii_lowercase().as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "pdf" => "application/pdf",
            "mp4" => "video/mp4",
            "webm" => "video/webm",
            "mp3" => "audio/mpeg",
            "wav" => "audio/wav",
            _ => return None,
        },
    )
}
fn filename(name: &str) -> String {
    let mut result = String::new();
    for b in name.bytes() {
        if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
            result.push(b as char);
        } else {
            use std::fmt::Write;
            write!(&mut result, "%{b:02X}").expect("String write");
        }
    }
    result
}
pub(super) async fn download(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Query<Request>, QueryRejection>,
) -> Result<Response> {
    let session = token(&headers)?;
    host.identity.authenticate(&session).await?;
    let Query(input) = input.map_err(|_| Error::Invalid)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    let file = docs
        .download(
            &session,
            &input.id,
            input.revision,
            host.attachments.as_ref(),
        )
        .await?;
    let length = file.content.len();
    let (status, start, end, content_range) = match range(&headers, length) {
        Ok(None) => (StatusCode::OK, 0, length, None),
        Ok(Some((start, end))) => (
            StatusCode::PARTIAL_CONTENT,
            start,
            end + 1,
            Some(format!("bytes {start}-{end}/{length}")),
        ),
        Err(()) => {
            let mut response = Failure::new(
                StatusCode::RANGE_NOT_SATISFIABLE,
                "invalid_range",
                "Unsupported or out-of-bounds byte range.",
            )
            .into_response();
            response.headers_mut().insert(
                "content-range",
                format!("bytes */{length}").parse().unwrap(),
            );
            return Ok(response);
        }
    };
    let mime = safe_mime(&file.name);
    let disposition = if mime.is_some() && input.preview.is_some_and(|v| !v.is_empty()) {
        "inline"
    } else {
        "attachment"
    };
    let mut builder = Response::builder()
        .status(status)
        .header("content-type", mime.unwrap_or("application/octet-stream"))
        .header(
            "content-disposition",
            format!("{disposition}; filename*=UTF-8''{}", filename(&file.name)),
        )
        .header("content-length", end - start)
        .header("accept-ranges", "bytes")
        .header("cache-control", "private, no-store")
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "sandbox; default-src 'none'");
    if let Some(value) = content_range {
        builder = builder.header("content-range", value);
    }
    builder
        .body(file.content.body(start, end))
        .map_err(|_| Error::Incompatible.into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ranges_are_bounded_and_reject_unsupported_forms() {
        for (value, expected) in [
            ("bytes=2-4", Ok(Some((2, 4)))),
            ("bytes=2-", Ok(Some((2, 7)))),
            ("bytes=0-999", Ok(Some((0, 7)))),
            ("bytes=-2", Err(())),
            ("bytes=8-", Err(())),
            ("bytes=2-1", Err(())),
            ("bytes=0-1,3-4", Err(())),
            ("bytes=+1-2", Err(())),
            ("bytes=99999999999999999999999-", Err(())),
        ] {
            let mut h = HeaderMap::new();
            h.insert("range", value.parse().unwrap());
            assert_eq!(range(&h, 8), expected);
        }
        let mut h = HeaderMap::new();
        h.append("range", "bytes=0-0".parse().unwrap());
        assert!(range(&h, 0).is_err());
        h.append("range", "bytes=1-2".parse().unwrap());
        assert!(range(&h, 8).is_err());
        assert_eq!(range(&HeaderMap::new(), 0), Ok(None));
    }
    #[test]
    fn active_formats_never_preview_and_names_cannot_inject_headers() {
        assert_eq!(safe_mime("image.PNG"), Some("image/png"));
        for name in ["page.html", "script.svg", "script.js"] {
            assert!(safe_mime(name).is_none());
        }
        assert_eq!(filename("é\r\nx: \""), "%C3%A9%0D%0Ax%3A%20%22");
    }
}
