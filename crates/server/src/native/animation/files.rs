//! Translate legacy workspace file RPC to the existing private Studio store.
//! Product workers receive bytes only, never user-selected host paths.
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::json;

pub(super) async fn invoke(
    host: &NativeHost,
    runtime: &Animation,
    key: &str,
    session: &str,
    mut input: Value,
) -> std::result::Result<Value, Error> {
    let method = input["method"].as_str().ok_or(Error::Invalid)?.to_owned();
    if matches!(
        method.as_str(),
        "canvas2d.render_frame" | "canvas2d.matrix_preview"
    ) {
        return render::invoke(host, runtime, key, session, input).await;
    }
    let load = method == "load_workspace" && input["params"]["data_base64"].is_null();
    let save = method == "save_workspace" && input["params"]["return_data"] != true;
    if !load && !save {
        let mut result = runtime.invoke(key, &input).await?;
        if method == "hello" && result["ok"] == true {
            result["result"]["workspace_paths"] = json!({
                "scope":"private_user", "file_revision_guard":true,
                "max_archive_bytes":3 * 1024 * 1024 - 4096,
            });
        }
        return Ok(result);
    }
    let path = input["params"]["path"]
        .as_str()
        .ok_or(Error::Invalid)?
        .to_owned();
    if !crate::workspace_assets::relative(&path) || path.len() > 2048 {
        return Err(Error::Invalid);
    }
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    let base = host.workspace_assets.as_ref();
    if load {
        let asset = docs
            .workspace_read(session, "animation", &path, base)
            .await?;
        // Leave room for JSON/base64 framing inside the worker's 4 MiB input.
        if asset.bytes.len() > 3 * 1024 * 1024 - 4096 {
            return Err(Error::TooLarge);
        }
        input["params"]
            .as_object_mut()
            .ok_or(Error::Invalid)?
            .remove("path");
        input["params"]["data_base64"] = json!(STANDARD.encode(asset.bytes));
        let mut result = runtime.invoke(key, &input).await?;
        if result["ok"] == true {
            result["result"]["file_revision"] = json!(asset.revision);
            result["result"]["path"] = json!(path);
        }
        return Ok(result);
    }
    let expected = match &input["params"]["expected_file_revision"] {
        Value::Null => None,
        Value::String(value) if crate::attachments::valid_digest(value) => Some(value.clone()),
        _ => return Err(Error::Invalid),
    };
    let params = input["params"].as_object_mut().ok_or(Error::Invalid)?;
    params.remove("path");
    params.remove("expected_file_revision");
    params.insert("return_data".into(), json!(true));
    let mut result = runtime.invoke(key, &input).await?;
    if result["ok"] != true {
        return Ok(result);
    }
    let encoded = result["result"]["data_base64"]
        .as_str()
        .ok_or(Error::Incompatible)?;
    if encoded.len() > 4 * 1024 * 1024 {
        return Err(Error::TooLarge);
    }
    let bytes = STANDARD.decode(encoded).map_err(|_| Error::Incompatible)?;
    if bytes.len() > 3 * 1024 * 1024 - 4096 {
        return Err(Error::TooLarge);
    }
    let revision = docs
        .workspace_save_bytes(
            session,
            "animation",
            &path,
            &bytes,
            expected.as_deref(),
            base,
        )
        .await?;
    result["result"]
        .as_object_mut()
        .ok_or(Error::Incompatible)?
        .remove("data_base64");
    result["result"]["file_revision"] = json!(revision);
    result["result"]["path"] = json!(path);
    Ok(result)
}
