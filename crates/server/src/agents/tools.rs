//! The host relays only tools advertised by the originating editor. Products
//! validate arguments and own all document mutations; providers get no shell.
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub(super) const MAX_IMAGES: usize = 8;
const MAX_IMAGE_BYTES: usize = 256 * 1024;

pub(super) const MAX_CALLS: usize = 48;

pub(crate) fn catalogue(data: &Value) -> Result<Vec<Value>> {
    let Some(value) = data.get("tools") else {
        return Ok(vec![]);
    };
    let items = value
        .as_array()
        .filter(|v| v.len() <= 32)
        .ok_or(Error::Invalid)?;
    if value.to_string().len() > 65536 {
        return Err(Error::Invalid);
    }
    let mut names = HashSet::new();
    for tool in items {
        fields(tool, &["name", "description", "inputSchema"])?;
        let name = tool["name"].as_str().ok_or(Error::Invalid)?;
        if !name.starts_with("aether_")
            || name.len() > 64
            || !name
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
            || !names.insert(name)
        {
            return Err(Error::Invalid);
        }
        let description = tool["description"].as_str().ok_or(Error::Invalid)?;
        let schema = &tool["inputSchema"];
        if description.is_empty()
            || description.len() > 2000
            || schema["type"] != "object"
            || !schema["properties"].is_object()
            || schema.to_string().len() > 8192
        {
            return Err(Error::Invalid);
        }
    }
    Ok(items.clone())
}

#[derive(Clone, Serialize)]
pub(super) struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}
impl ToolCall {
    pub fn parse(event: &Value, names: &[String]) -> Result<Self> {
        let id = event["id"]
            .as_str()
            .filter(|s| {
                !s.is_empty()
                    && s.len() <= 128
                    && s.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
            })
            .ok_or(Error::Invalid)?;
        let name = event["name"]
            .as_str()
            .filter(|s| names.iter().any(|n| n == s))
            .ok_or(Error::Invalid)?;
        let arguments = &event["arguments"];
        if !arguments.is_object() || arguments.to_string().len() > 32768 {
            return Err(Error::Invalid);
        }
        Ok(Self {
            id: id.into(),
            name: name.into(),
            arguments: arguments.clone(),
        })
    }
}

pub(crate) fn result(data: &Value) -> Result<Value> {
    let result = &data["result"];
    fields(result, &["ok", "value", "error", "images"])?;
    match result["ok"].as_bool() {
        Some(true) if result.get("value").is_some() && result.get("error").is_none() => {}
        Some(false)
            if result["error"].as_str().is_some_and(|s| s.len() <= 2000)
                && result.get("value").is_none()
                && result.get("images").is_none() => {}
        _ => return Err(Error::Invalid),
    }
    let mut metadata = result.clone();
    metadata
        .as_object_mut()
        .ok_or(Error::Invalid)?
        .remove("images");
    if metadata.to_string().len() > 32768 {
        return Err(Error::Invalid);
    }
    if let Some(images) = result.get("images") {
        let images = images
            .as_array()
            .filter(|items| items.len() == 1)
            .ok_or(Error::Invalid)?;
        validate_image(&images[0])?;
    }
    Ok(result.clone())
}

fn validate_image(image: &Value) -> Result<()> {
    fields(image, &["mimeType", "data", "width", "height"])?;
    let width = image["width"]
        .as_u64()
        .filter(|n| (1..=1024).contains(n))
        .ok_or(Error::Invalid)?;
    let height = image["height"]
        .as_u64()
        .filter(|n| (1..=1024).contains(n))
        .ok_or(Error::Invalid)?;
    let data = image["data"]
        .as_str()
        .filter(|s| s.len() <= MAX_IMAGE_BYTES.div_ceil(3) * 4)
        .ok_or(Error::Invalid)?;
    if image["mimeType"] != "image/png" {
        return Err(Error::Invalid);
    }
    let bytes = STANDARD.decode(data).map_err(|_| Error::Invalid)?;
    if bytes.len() < 45
        || bytes.len() > MAX_IMAGE_BYTES
        || STANDARD.encode(&bytes) != data
        || &bytes[..8] != b"\x89PNG\r\n\x1a\n"
        || bytes[8..12] != 13u32.to_be_bytes()
        || &bytes[12..16] != b"IHDR"
        || bytes[16..20] != (width as u32).to_be_bytes()
        || bytes[20..24] != (height as u32).to_be_bytes()
        || &bytes[bytes.len() - 12..] != b"\0\0\0\0IEND\xaeB\x60\x82"
    {
        return Err(Error::Invalid);
    }
    // This boundary validates the bounded PNG envelope, not rendering semantics.
    // Providers decode pixels; no server-side image parser or external fetch runs.
    Ok(())
}

pub(super) fn receipt_hash(result: &Value) -> [u8; 32] {
    Sha256::digest(result.to_string().as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn images_are_bounded_png_envelopes_separate_from_json_metadata() {
        let image = json!({"mimeType":"image/png", "width":1, "height":1,
            "data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUioAAAAASUVORK5CYII="});
        let valid =
            json!({"result":{"ok":true,"value":{"kind":"drawing"},"images":[image.clone()]}});
        assert!(result(&valid).is_ok());
        for (key, value) in [
            ("mimeType", json!("image/svg+xml")),
            ("width", json!(2)),
            ("height", json!(1025)),
            ("data", json!("https://example.invalid/image.png")),
            ("data", json!("a".repeat(350000))),
        ] {
            let mut invalid = valid.clone();
            invalid["result"]["images"][0][key] = value;
            assert!(result(&invalid).is_err());
        }
        let mut invalid = valid.clone();
        invalid["result"]["value"] = json!("x".repeat(33000));
        assert!(result(&invalid).is_err());
        invalid = valid.clone();
        invalid["result"]["images"] = json!([image.clone(), image]);
        assert!(result(&invalid).is_err());
        invalid = valid.clone();
        invalid["result"]["images"][0]["url"] = json!("https://example.invalid");
        assert!(result(&invalid).is_err());
        let mut changed = valid.clone();
        changed["result"]["value"] = json!({"kind":"mask"});
        assert_ne!(
            receipt_hash(&valid["result"]),
            receipt_hash(&changed["result"])
        );
    }
    #[test]
    fn only_bounded_explicit_editor_tools_are_accepted() {
        let tool = json!({"name":"aether_cad_inspect","description":"Inspect the open part", "inputSchema":{"type":"object","properties":{}}});
        assert_eq!(
            catalogue(&json!({"tools":[tool.clone()]})).unwrap().len(),
            1
        );
        assert!(catalogue(&json!({"tools":[tool.clone(),tool.clone()]})).is_err());
        assert!(catalogue(&json!({"tools":[{"name":"shell","description":"run","inputSchema":{"type":"object","properties":{}}}]})).is_err());
        assert!(
            ToolCall::parse(
                &json!({"id":"call1","name":"aether_cad_inspect","arguments":{}}),
                &["aether_cad_inspect".into()]
            )
            .is_ok()
        );
        assert!(
            ToolCall::parse(
                &json!({"id":"call1","name":"aether_cad_inspect","arguments":{}}),
                &[]
            )
            .is_err()
        );
        assert!(result(&json!({"result":{"ok":true,"value":{"changed":true}}})).is_ok());
        assert!(result(&json!({"result":{"ok":false,"error":"Locked layer"}})).is_ok());
        assert!(result(&json!({"result":{"ok":true,"error":"Wrong shape"}})).is_err());
    }
}
