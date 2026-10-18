//! Resolve a canvas snapshot's media through Studio's private asset authority.
//! The product owns parsing/rendering; it receives bytes, never host paths.
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::json;
use std::collections::BTreeSet;

pub(super) async fn invoke(
    host: &NativeHost,
    runtime: &Animation,
    key: &str,
    session: &str,
    mut input: Value,
) -> std::result::Result<Value, Error> {
    let snapshot = runtime
        .invoke(
            key,
            &json!({"id":input["id"], "method":"canvas2d.get",
            "params":{"handle":input["params"]["handle"]}}),
        )
        .await?;
    if snapshot["ok"] != true {
        return Ok(snapshot);
    }
    // A concurrent edit can change the session handle while files are read.
    // Render the captured immutable DTO, rather than mixing its media with a
    // later canvas. Reserved inputs below are always replaced by the host.
    let canvas = &snapshot["result"]["canvas"];
    let surfaces = canvas["surfaces"].as_array().ok_or(Error::Incompatible)?;
    let sources = canvas["sources"].as_array().ok_or(Error::Incompatible)?;
    if surfaces.len() > 32 || sources.len() > 128 {
        return Err(Error::TooLarge);
    }
    let used: BTreeSet<_> = surfaces
        .iter()
        .filter_map(|v| v["source"].as_str())
        .collect();
    let mut assets = serde_json::Map::new();
    let mut total = 0;
    for source in sources {
        if source["kind"] == "procedural"
            || !source["id"].as_str().is_some_and(|id| used.contains(id))
        {
            continue;
        }
        let path = source["asset"].as_str().ok_or(Error::Invalid)?;
        if !crate::workspace_assets::relative(path) || path.len() > 2048 {
            return Err(Error::Invalid);
        }
        if assets.contains_key(path) {
            continue;
        }
        let asset = host
            .documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .workspace_read_limited(
                session,
                "animation",
                path,
                host.workspace_assets.as_ref(),
                2 * 1024 * 1024 - total,
            )
            .await?;
        total += asset.bytes.len();
        if total > 2 * 1024 * 1024 {
            return Err(Error::TooLarge);
        }
        assets.insert(path.to_owned(), json!(STANDARD.encode(asset.bytes)));
    }
    let params = input["params"].as_object_mut().ok_or(Error::Invalid)?;
    params.insert("studio_canvas".into(), canvas.clone());
    params.insert("studio_assets".into(), Value::Object(assets));
    runtime.invoke(key, &input).await
}
