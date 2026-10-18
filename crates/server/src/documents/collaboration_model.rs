//! Product-independent collaboration validation and item edits. No content evaluation.
use super::{Error, Result};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

pub(super) const MAX_STATE_BYTES: usize = 16 * 1024 * 1024;
#[derive(Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Collection {
    Comments,
    Tasks,
    Reminders,
    Notes,
}
impl Collection {
    pub(super) fn key(self) -> &'static str {
        match self {
            Self::Comments => "comments",
            Self::Tasks => "tasks",
            Self::Reminders => "reminders",
            Self::Notes => "notes",
        }
    }
}
#[derive(Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    Add,
    Update,
    Delete,
}
impl Operation {
    pub(super) fn key(self) -> &'static str {
        match self {
            Self::Add => "add",
            Self::Update => "update",
            Self::Delete => "delete",
        }
    }
}
pub(super) fn forbidden() -> Error {
    Error::Identity(aether_identity::Error::Forbidden)
}
fn text(value: Option<&Value>, limit: usize, required: bool) -> Result<String> {
    let value = value.and_then(Value::as_str).ok_or(Error::Invalid)?;
    if value.chars().count() > limit
        || value.contains('\0')
        || (required && value.trim().is_empty())
    {
        return Err(Error::Invalid);
    }
    Ok(value.trim().into())
}
fn due(value: &Value) -> Result<()> {
    let s = value.as_str().ok_or(Error::Invalid)?;
    if s.is_empty() {
        return Ok(());
    }
    let b = s.as_bytes();
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || b.iter()
            .enumerate()
            .any(|(i, c)| i != 4 && i != 7 && !c.is_ascii_digit())
    {
        return Err(Error::Invalid);
    }
    let y: u32 = s[..4].parse().map_err(|_| Error::Invalid)?;
    let m: usize = s[5..7].parse().map_err(|_| Error::Invalid)?;
    let d: u32 = s[8..].parse().map_err(|_| Error::Invalid)?;
    let leap = y.is_multiple_of(4) && (!y.is_multiple_of(100) || y.is_multiple_of(400));
    let days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if y == 0 || !(1..=12).contains(&m) || d == 0 || d > days[m - 1] {
        return Err(Error::Invalid);
    }
    Ok(())
}
fn images(value: &Value) -> Result<()> {
    let images = value.as_array().ok_or(Error::Invalid)?;
    if images.len() > 3 {
        return Err(Error::Invalid);
    }
    for image in images {
        let image = image.as_object().ok_or(Error::Invalid)?;
        if image.len() != 2 {
            return Err(Error::Invalid);
        }
        let name = image
            .get("name")
            .and_then(Value::as_str)
            .ok_or(Error::Invalid)?;
        let data = image
            .get("data_url")
            .and_then(Value::as_str)
            .ok_or(Error::Invalid)?;
        if name.is_empty()
            || name.chars().count() > 160
            || name.contains('\0')
            || data.len() > 1_400_000
        {
            return Err(Error::Invalid);
        }
        let (prefix, encoded) = data.split_once(',').ok_or(Error::Invalid)?;
        let bytes = STANDARD.decode(encoded).map_err(|_| Error::Invalid)?;
        if bytes.len() > 1_048_576
            || !match prefix {
                "data:image/png;base64" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
                "data:image/jpeg;base64" => bytes.starts_with(b"\xff\xd8\xff"),
                _ => false,
            }
        {
            return Err(Error::Invalid);
        }
    }
    Ok(())
}
pub(super) struct Edit<'a> {
    pub collection: Collection,
    pub operation: Operation,
    pub patch: &'a Map<String, Value>,
    pub before: Option<&'a Value>,
    pub actor: &'a str,
    pub editor: bool,
    pub id: &'a str,
    pub now: f64,
    pub parent: Option<&'a Value>,
    pub branch_name: &'a str,
    pub branch_id: Option<&'a str>,
    pub reference_name: Option<&'a str>,
    pub assignees: &'a [String],
}
/// `revision` and parent existence are checked under the same SQL transaction.
pub(super) fn edit(input: Edit<'_>) -> Result<(Value, bool)> {
    let Edit {
        collection,
        operation,
        patch,
        before,
        actor,
        editor,
        id,
        now,
        parent,
        reference_name,
        branch_name,
        branch_id,
        assignees,
    } = input;
    let allowed: &[&str] = match collection {
        Collection::Notes => &["text"],
        Collection::Comments => &[
            "text",
            "parent",
            "branch",
            "revision",
            "attachments",
            "resolved",
        ],
        _ => &["text", "status", "due", "assignee"],
    };
    if patch.keys().any(|k| !allowed.contains(&k.as_str())) {
        return Err(Error::Invalid);
    }
    if collection == Collection::Notes {
        if !editor || operation != Operation::Update {
            return Err(forbidden());
        }
        return Ok((
            json!({"text":text(patch.get("text"),50000,false)?,"author":actor,"updated":now}),
            true,
        ));
    }
    let own = before.and_then(|v| v["author"].as_str()) == Some(actor);
    let assigned = matches!(collection, Collection::Tasks | Collection::Reminders)
        && operation == Operation::Update
        && before.and_then(|v| v["assignee"].as_str()) == Some(actor)
        && patch.len() == 1
        && patch.contains_key("status");
    let editor_required = operation != Operation::Add && !own && !assigned;
    if editor_required && !editor {
        return Err(forbidden());
    }
    let mut after = if operation == Operation::Add {
        let mut after = json!({"id":id,"author":actor,"created":now,"updated":now});
        if collection == Collection::Comments {
            after["parent"] = parent.map(|v| v["id"].clone()).unwrap_or(Value::Null);
            after["revision"] = Value::Null;
            after["branch"] = json!(branch_name);
            if let Some(branch_id) = branch_id {
                after["branch_id"] = json!(branch_id);
            }
            after["resolved"] = json!(false);
        } else {
            after["status"] = json!("open");
            after["due"] = json!("");
            after["assignee"] = json!(actor);
        }
        after
    } else {
        before.cloned().ok_or(Error::Denied)?
    };
    after["updated"] = json!(now);
    if operation == Operation::Delete {
        if !patch.is_empty() {
            return Err(Error::Invalid);
        }
        after["deleted"] = json!(true);
        after["text"] = json!("");
        if collection == Collection::Comments {
            after["attachments"] = json!([])
        }
        return Ok((after, editor_required));
    }
    if operation == Operation::Add || patch.contains_key("text") {
        after["text"] = json!(text(
            patch.get("text"),
            if collection == Collection::Comments {
                10000
            } else {
                1000
            },
            true
        )?);
    }
    if collection == Collection::Comments {
        if operation != Operation::Add
            && (patch.contains_key("parent") || patch.contains_key("branch"))
        {
            return Err(Error::Invalid);
        }
        if let Some(v) = patch.get("revision") {
            after["revision"] = v.clone();
            after["reference_name"] =
                json!(reference_name.unwrap_or(if v.is_null() { "" } else { "Saved state" }));
        }
        if let Some(v) = patch.get("attachments") {
            images(v)?;
            after["attachments"] = v.clone();
        }
        if let Some(v) = patch.get("resolved") {
            if !v.is_boolean() || !after["parent"].is_null() {
                return Err(Error::Invalid);
            }
            after["resolved"] = v.clone();
        }
    } else {
        if let Some(v) = patch.get("status") {
            if !matches!(v.as_str(), Some("open" | "in_progress" | "done")) {
                return Err(Error::Invalid);
            }
            after["status"] = v.clone();
        }
        if let Some(v) = patch.get("due") {
            due(v)?;
            after["due"] = v.clone();
        }
        if let Some(v) = patch.get("assignee") {
            if !v.as_str().is_some_and(|s| assignees.iter().any(|a| a == s)) {
                return Err(Error::Invalid);
            }
            after["assignee"] = v.clone();
        }
    }
    Ok((after, editor_required))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn calendar_validation_handles_centuries_and_malformed_unicode() {
        for value in ["", "2000-02-29", "2028-02-29", "9999-12-31"] {
            assert!(due(&json!(value)).is_ok());
        }
        for value in [
            "1900-02-29",
            "2100-02-29",
            "0000-01-01",
            "2026-04-31",
            "2026-00-12",
            "2026-13-01",
            "2026-01-00",
            "2026-1-01",
            "٢٠٢٦-01-01",
            "20260101",
        ] {
            assert!(due(&json!(value)).is_err(), "{value}");
        }
        for value in [Value::Null, json!(true), json!(20260101)] {
            assert!(due(&value).is_err());
        }
    }
    #[test]
    fn text_counts_unicode_characters_and_rejects_database_nul() {
        assert_eq!(
            text(Some(&json!("  café 🪐  ")), 10, true).unwrap(),
            "café 🪐"
        );
        assert!(text(Some(&json!("界".repeat(10000))), 10000, true).is_ok());
        assert!(text(Some(&json!("界".repeat(10001))), 10000, true).is_err());
        assert!(text(Some(&json!("bad\0text")), 100, false).is_err());
        assert!(text(Some(&json!(" \n\t")), 100, true).is_err());
        assert_eq!(text(Some(&json!(" \n\t")), 100, false).unwrap(), "");
    }
    #[test]
    fn image_validation_bounds_decoded_bytes_and_accepts_only_rasters() {
        let image = |bytes: &[u8]| json!({"name":"diagram.png","data_url":format!("data:image/png;base64,{}",STANDARD.encode(bytes))});
        let mut bytes = vec![0; 1_048_576];
        bytes[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        assert!(images(&json!([image(&bytes)])).is_ok());
        bytes.push(0);
        assert!(images(&json!([image(&bytes)])).is_err());
        let small = image(b"\x89PNG\r\n\x1a\nfixture");
        assert!(images(&json!([small.clone(), small.clone(), small.clone()])).is_ok());
        assert!(
            images(&json!([
                small.clone(),
                small.clone(),
                small.clone(),
                small.clone()
            ]))
            .is_err()
        );
        assert!(images(&json!([image(b"Not a PNG")])).is_err());
        assert!(
            images(&json!([{"name":"script.svg","data_url":"data:image/svg+xml;base64,PHN2Zz4="}]))
                .is_err()
        );
        let mut unknown = small;
        unknown["script"] = json!(true);
        assert!(images(&json!([unknown])).is_err());
    }
}
