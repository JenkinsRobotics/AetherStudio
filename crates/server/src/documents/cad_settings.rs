//! CAD owns the portable settings transform; Studio owns authority and commits.
use super::{
    Documents, Error, Result, Role,
    cad_projects::bytes,
    library::{self, Request as FileRequest},
};
use aether_store::hosted::AuthorizedScope;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    CadMetadata,
    CadOperation,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub action: Action,
    pub app: String,
    pub id: String,
    pub branch: Option<String>,
    pub revision: Option<u32>,
    pub expected_revision: Option<u32>,
    pub operation_id: Option<String>,
    pub operation: Option<String>,
    pub name: Option<String>,
    pub parent: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "revisionManaged")]
    pub revision_managed: Option<bool>,
    pub units: Option<Value>,
    pub item_id: Option<String>,
    pub category: Option<String>,
    pub quantities: Option<Value>,
    pub parts: Option<Vec<String>>,
    pub upgraded_documents: Option<Value>,
}
pub(super) fn validate(worker: &Value) -> Result<()> {
    if !worker["settings"].is_object()
        || !worker["items"].is_array()
        || !worker["deleted"].is_array()
        || !worker["linked_sources"].is_array()
    {
        return Err(Error::Incompatible);
    }
    Ok(())
}
impl Documents {
    pub async fn cad_settings(&self, token: &str, input: &Request) -> Result<Value> {
        if input.app != "cad" {
            return Err(Error::Unsupported);
        }
        let branch = library::branch_target(&input.branch)?;
        let read = |revision| match revision {
            Some(revision) => FileRequest::ReadRevision {
                app: input.app.clone(),
                id: input.id.clone(),
                revision,
                branch: input.branch.clone(),
            },
            None => FileRequest::Read {
                app: input.app.clone(),
                id: input.id.clone(),
                branch: input.branch.clone(),
            },
        };
        if input.action == Action::CadMetadata {
            let snapshot = self.library(token, &read(input.revision)).await?;
            let mut worker = self
                .product_service(
                    token,
                    "cad",
                    "/api/cad/settings-read",
                    &json!({"data_base64":bytes(&snapshot)?}),
                )
                .await?;
            validate(&worker)?;
            // Recheck the selected branch/history plus current file authority.
            let mut current = self.library(token, &read(input.revision)).await?;
            if current["revision"] != snapshot["revision"] {
                return Err(Error::Conflict);
            }
            let mut c = self.client().await?;
            let tx = c
                .build_transaction()
                .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
                .start()
                .await
                .map_err(super::db)?;
            let user = self.begin(&tx, token, false).await?;
            self.app(&tx, &user, "cad").await?;
            let (resource, role) = self.resource_role(&tx, &user, &input.id, false).await?;
            if resource.app != "cad" || resource.kind != "document" {
                return Err(Error::Denied);
            }
            current["writable"] = json!(input.revision.is_none() && role >= Role::Editor);
            let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
            let head = self
                .store
                .read_target_in(&tx, &scope, &input.id, branch)
                .await?;
            if input.revision.is_none() && json!(head.document.revision) != snapshot["revision"] {
                return Err(Error::Conflict);
            }
            let sources = worker["linked_sources"]
                .as_array()
                .ok_or(Error::Incompatible)?;
            if sources.len() > 256 {
                return Err(Error::TooLarge);
            }
            let mut updates = Vec::new();
            for source in sources {
                let id = source["source_id"].as_str().ok_or(Error::Incompatible)?;
                let mut update = json!({"part_id":source["part_id"],"name":source["name"],"current":source["current"],"available":false});
                match self.require(&tx, &user, id, Role::Viewer).await {
                    Ok(resource) if resource.app == "cad" && resource.kind == "document" => {
                        let latest = self.store.read_target_in(&tx, &scope, id, "Main").await?;
                        update["latest"] = json!(latest.document.revision);
                        update["available"] = json!(true);
                    }
                    Ok(_) | Err(Error::Denied) => (),
                    Err(error) => return Err(error),
                }
                updates.push(update);
            }
            super::commit(tx).await?;
            let fields = worker.as_object_mut().ok_or(Error::Incompatible)?;
            fields.remove("linked_sources");
            fields.remove("data_base64");
            let metadata = current.as_object_mut().ok_or(Error::Incompatible)?;
            metadata.remove("data_base64");
            // Worker keys are product projection only, never file authority.
            for key in [
                "settings",
                "items",
                "deleted",
                "unitCatalog",
                "featureVersion",
                "upgradeNeeded",
                "upgradeDocuments",
            ] {
                metadata.insert(key.into(), fields.remove(key).ok_or(Error::Incompatible)?);
            }
            metadata.insert("updates".into(), json!(updates));
            return Ok(current);
        }
        let operation = input.operation.as_deref().ok_or(Error::Invalid)?;
        if matches!(operation, "move" | "update") {
            return self.cad_settings_action(token, input).await;
        }
        if !matches!(
            operation,
            "details" | "units" | "rename" | "copy" | "properties" | "delete_item" | "restore_item"
        ) {
            return Err(Error::Invalid);
        }
        let operation_id = input
            .operation_id
            .as_ref()
            .filter(|v| super::valid_id(v))
            .ok_or(Error::Invalid)?;
        let expected = input
            .expected_revision
            .filter(|v| *v > 0)
            .ok_or(Error::Invalid)?;
        if input.revision.is_some() && operation != "copy" {
            return Err(Error::Denied);
        }
        if input.revision.is_some_and(|r| r != expected) {
            return Err(Error::Invalid);
        }
        let current = self.library(token, &read(None)).await?;
        if operation != "copy" && current["writable"] != true {
            return Err(Error::Denied);
        }
        let snapshot = self.library(token, &read(Some(expected))).await?;
        let mut args = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        args.as_object_mut()
            .ok_or(Error::Invalid)?
            .retain(|_, v| !v.is_null());
        args["data_base64"] = json!(bytes(&snapshot)?);
        let title = if matches!(operation, "rename" | "copy") {
            let title = library::name(input.name.as_deref().ok_or(Error::Invalid)?)?;
            args["name"] = json!(title);
            let original = snapshot["name"].as_str().ok_or(Error::Incompatible)?;
            let suffix = original
                .rsplit_once('.')
                .map_or("acad", |(_, suffix)| suffix);
            Some(library::name(&format!("{title}.{suffix}"))?)
        } else {
            None
        };
        let worker = self
            .product_service(token, "cad", "/api/cad/settings-edit", &args)
            .await?;
        validate(&worker)?;
        let payload = bytes(&worker)?;
        if operation == "copy" {
            self.library_guarded(
                token,
                &FileRequest::Create {
                    app: "cad".into(),
                    operation_id: operation_id.clone(),
                    name: title.ok_or(Error::Invalid)?,
                    kind: Some("file".into()),
                    scope: Some("personal".into()),
                    organization: None,
                    workspace: None,
                    parent: input.parent.clone(),
                    data_base64: payload,
                },
                std::slice::from_ref(&input.id),
            )
            .await
        } else {
            self.library_named_save(
                token,
                &FileRequest::Save {
                    app: "cad".into(),
                    id: input.id.clone(),
                    expected_revision: expected,
                    operation_id: operation_id.clone(),
                    branch: input.branch.clone(),
                    data_base64: payload,
                },
                &[],
                title.as_deref(),
            )
            .await
        }
    }
}
