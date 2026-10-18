//! Legacy CAD container endpoints over the installed product codec and canonical
//! native storage. Product workers never receive a database or a session token.
use super::{
    Documents, Error, Result,
    library::{self, Request as FileRequest},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

#[derive(Deserialize, Serialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    ProjectCreate {
        app: String,
        name: String,
        operation_id: String,
        packaging: Option<String>,
        scope: Option<String>,
        organization: Option<String>,
        workspace: Option<String>,
        parent: Option<String>,
    },
    ProjectRead {
        app: String,
        id: String,
        revision: Option<u32>,
        branch: Option<String>,
    },
    ProjectEdit {
        app: String,
        id: String,
        expected_revision: u32,
        operation_id: String,
        branch: Option<String>,
        operation: String,
        name: Option<String>,
        part_id: Option<String>,
        assembly_id: Option<String>,
        document: Option<Value>,
        source_id: Option<String>,
        source_revision: Option<u32>,
    },
}
pub(super) fn bytes(value: &Value) -> Result<String> {
    let encoded = value["data_base64"].as_str().ok_or(Error::Incompatible)?;
    if encoded.len() > library::MAX_FILE_BYTES * 4 / 3 {
        return Err(Error::TooLarge);
    }
    let decoded = STANDARD.decode(encoded).map_err(|_| Error::Incompatible)?;
    if decoded.len() > library::MAX_FILE_BYTES {
        return Err(Error::TooLarge);
    }
    Ok(encoded.to_owned())
}
fn projection(mut metadata: Value, worker: Value) -> Result<Value> {
    let project = &worker["project"];
    if !project["parts"].is_array() || !project["assemblies"].is_array() {
        return Err(Error::Incompatible);
    }
    metadata
        .as_object_mut()
        .ok_or(Error::Incompatible)?
        .remove("data_base64");
    metadata["project"] = project.clone();
    if metadata.get("branch").is_none() {
        metadata["branch"] = json!("Main");
    }
    Ok(metadata)
}
impl Documents {
    pub async fn cad_project(&self, token: &str, input: &Request) -> Result<Value> {
        let app = match input {
            Request::ProjectCreate { app, .. }
            | Request::ProjectRead { app, .. }
            | Request::ProjectEdit { app, .. } => app,
        };
        if app != "cad" {
            return Err(Error::Unsupported);
        }
        match input {
            Request::ProjectCreate {
                name,
                operation_id,
                packaging,
                scope,
                organization,
                workspace,
                parent,
                ..
            } => {
                if !super::valid_id(operation_id) {
                    return Err(Error::Invalid);
                }
                let name = library::name(name)?;
                let packaging = packaging.as_deref().unwrap_or("project");
                let extension = match packaging {
                    "project" => "acad",
                    "assembly" => "acasm",
                    _ => return Err(Error::Invalid),
                };
                let filename = library::name(&format!("{name}.{extension}"))?;
                let (status, _) = self.application_status(Some(token), &[app]).await?;
                let actor = status.user.ok_or(aether_identity::Error::Unauthorized)?;
                let seed = format!(
                    "{:x}",
                    Sha256::digest(
                        serde_json::to_vec(&(self.tenant(), &actor.id, operation_id))
                            .map_err(|_| Error::Invalid)?
                    )
                );
                let worker = self
                    .product_service(
                        token,
                        app,
                        "/api/cad/project-create",
                        &json!({"name":name,"operation_id":seed,"packaging":packaging}),
                    )
                    .await?;
                // Validate the projection before committing any content.
                projection(json!({}), worker.clone())?;
                let saved = self
                    .library(
                        token,
                        &FileRequest::Create {
                            app: app.clone(),
                            operation_id: operation_id.clone(),
                            name: filename,
                            kind: Some("file".into()),
                            scope: scope.clone(),
                            organization: organization.clone(),
                            workspace: workspace.clone(),
                            parent: parent.clone(),
                            data_base64: bytes(&worker)?,
                        },
                    )
                    .await?;
                projection(saved, worker)
            }
            Request::ProjectRead {
                id,
                revision,
                branch,
                ..
            } => {
                library::branch_target(branch)?;
                let read = match revision {
                    Some(revision) => FileRequest::ReadRevision {
                        app: app.clone(),
                        id: id.clone(),
                        revision: *revision,
                        branch: branch.clone(),
                    },
                    None => FileRequest::Read {
                        app: app.clone(),
                        id: id.clone(),
                        branch: branch.clone(),
                    },
                };
                let snapshot = self.library(token, &read).await?;
                let worker = self
                    .product_service(
                        token,
                        app,
                        "/api/cad/project-read",
                        &json!({"data_base64":bytes(&snapshot)?}),
                    )
                    .await?;
                // Fresh file, branch and session authority after the worker. Do not
                // combine an older graph with a newly advanced head's metadata.
                let mut current = self.library(token, &read).await?;
                if current["revision"] != snapshot["revision"] {
                    return Err(Error::Conflict);
                }
                if let Some(branch) = branch {
                    current["branch"] = json!(branch);
                }
                projection(current, worker)
            }
            Request::ProjectEdit {
                id,
                expected_revision,
                operation_id,
                branch,
                operation,
                name,
                source_id,
                source_revision,
                ..
            } => {
                if !super::valid_id(operation_id) || *expected_revision == 0 {
                    return Err(Error::Invalid);
                }
                library::branch_target(branch)?;
                if !matches!(
                    operation.as_str(),
                    "add_part"
                        | "add_assembly"
                        | "insert_part"
                        | "save_part"
                        | "link_part"
                        | "update_link"
                ) {
                    return Err(Error::Invalid);
                }
                let current = self
                    .library(
                        token,
                        &FileRequest::Read {
                            app: app.clone(),
                            id: id.clone(),
                            branch: branch.clone(),
                        },
                    )
                    .await?;
                if current["writable"] != true {
                    return Err(Error::Denied);
                }
                // Always transform the immutable expected base. An exact retry
                // recreates the same bytes even after its first save succeeded.
                let snapshot = self
                    .library(
                        token,
                        &FileRequest::ReadRevision {
                            app: app.clone(),
                            id: id.clone(),
                            revision: *expected_revision,
                            branch: branch.clone(),
                        },
                    )
                    .await?;
                let mut arguments = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
                arguments["name"] = json!(name.as_deref().unwrap_or("Untitled Part"));
                arguments["data_base64"] = json!(bytes(&snapshot)?);
                let mut sources = Vec::new();
                if matches!(operation.as_str(), "link_part" | "update_link") {
                    let source = source_id
                        .as_ref()
                        .filter(|s| super::valid_id(s))
                        .ok_or(Error::Invalid)?;
                    let revision = source_revision.filter(|r| *r > 0).ok_or(Error::Invalid)?;
                    let saved = self
                        .library(
                            token,
                            &FileRequest::ReadRevision {
                                app: app.clone(),
                                id: source.clone(),
                                revision,
                                branch: None,
                            },
                        )
                        .await?;
                    let raw = STANDARD
                        .decode(bytes(&saved)?)
                        .map_err(|_| Error::Incompatible)?;
                    let document: Value =
                        serde_json::from_slice(&raw).map_err(|_| Error::Invalid)?;
                    if document["format"] != "aether-part" {
                        return Err(Error::Invalid);
                    }
                    arguments["document"] = document;
                    arguments["source_label"] = saved["name"].clone();
                    arguments["source_ref"] = json!(format!("library:{source}@{revision}"));
                    sources.push(source.clone());
                } else if source_id.is_some() || source_revision.is_some() {
                    return Err(Error::Invalid);
                }
                let worker = self
                    .product_service(token, app, "/api/cad/project-edit", &arguments)
                    .await?;
                projection(json!({}), worker.clone())?;
                let saved = self
                    .library_guarded(
                        token,
                        &FileRequest::Save {
                            app: app.clone(),
                            id: id.clone(),
                            expected_revision: *expected_revision,
                            operation_id: operation_id.clone(),
                            branch: branch.clone(),
                            data_base64: bytes(&worker)?,
                        },
                        &sources,
                    )
                    .await?;
                projection(saved, worker)
            }
        }
    }
}
