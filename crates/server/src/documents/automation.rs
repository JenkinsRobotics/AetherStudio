//! Native command adapter. Session and delegated authorities never share tokens;
//! delegates exist only inside this module and reauthorize every canonical transaction.
use super::{Documents, Error, Result, Role, commit, db};
use aether_identity::automation::{AgentAccess, AgentConnectionInput};
use aether_protocol_core::{
    CommandDescriptor,
    studio_commands::{LibraryView, StudioInvocation, decode_invocation},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;
use zeroize::Zeroizing;

pub const APPS: &[&str] = &["cad", "map", "animation", "sketch", "io", "vector"];
#[derive(Clone)]
pub(super) struct Delegation {
    pub token: Arc<Zeroizing<String>>,
    pub app: String,
    pub document: Option<String>,
    pub access: AgentAccess,
    pub command: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Run {
    pub id: String,
    pub arguments: Value,
    pub operation_id: Option<String>,
}
fn descriptors() -> Vec<CommandDescriptor> {
    serde_json::from_str(include_str!("automation_catalog.json"))
        .expect("frozen compatibility catalog")
}
pub(super) fn random_id() -> Result<String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| Error::Unavailable)?;
    Ok(format!(
        "agent-command-{}",
        bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
    ))
}
fn validate_arguments(arguments: &Value, schema: &Value) -> Result<()> {
    let fields = arguments.as_object().ok_or(Error::Invalid)?;
    let definitions = schema["properties"]
        .as_object()
        .ok_or(Error::Incompatible)?;
    for key in schema["required"].as_array().ok_or(Error::Incompatible)? {
        if !fields.contains_key(key.as_str().ok_or(Error::Incompatible)?) {
            return Err(Error::Invalid);
        }
    }
    for (key, value) in fields {
        let def = definitions.get(key).ok_or(Error::Invalid)?;
        let valid = match def["type"].as_str() {
            Some("string") => value.as_str().is_some_and(|s| {
                s.chars().count() >= def["minLength"].as_u64().unwrap_or(0) as usize
                    && s.chars().count() <= def["maxLength"].as_u64().unwrap_or(1024) as usize
            }),
            Some("integer") => value.as_u64().is_some_and(|v| {
                v >= def["minimum"].as_u64().unwrap_or(0) && v <= u64::from(u32::MAX)
            }),
            _ => false,
        };
        if !valid
            || def["enum"]
                .as_array()
                .is_some_and(|values| !values.contains(value))
        {
            return Err(Error::Invalid);
        }
    }
    Ok(())
}
impl Documents {
    /// Consent and delegated grant creation share the ordinary permission transaction.
    pub async fn automation_authorization(
        &self,
        session: &str,
        request: &str,
        resource: &str,
        action: &str,
        input: Option<&AgentConnectionInput>,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, session, false).await?;
        let consent = self
            .identity
            .oauth_consent_in(&tx, session, request, resource)
            .await?;
        let apps = self.allowed_apps(&tx, &user, APPS).await?;
        let result = match action {
            "read" => json!({"request":consent,"apps":apps}),
            "deny" => {
                json!({"redirect":self.identity.complete_oauth_in(&tx, session, request, resource, None).await?})
            }
            "approve" => {
                let input = input.ok_or(Error::Invalid)?;
                if input.apps.iter().any(|app| !apps.contains(app)) {
                    return Err(aether_identity::Error::Forbidden.into());
                }
                let approved = AgentConnectionInput {
                    label: consent.client_name,
                    apps: input.apps.clone(),
                    can_write: input.can_write,
                    can_edit_content: input.can_edit_content,
                    lifetime_hours: input.lifetime_hours,
                };
                let (grant, _discarded_secret) = self
                    .identity
                    .create_agent_connection_in(&tx, session, &approved)
                    .await?;
                json!({"redirect":self.identity.complete_oauth_in(&tx, session, request, resource, Some(&grant.id)).await?})
            }
            _ => return Err(Error::Invalid),
        };
        commit(tx).await?;
        Ok(result)
    }
    pub async fn automation_connections(
        &self,
        session: &str,
        input: Option<&AgentConnectionInput>,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, session, false).await?;
        let apps = self.allowed_apps(&tx, &user, APPS).await?;
        let result = if let Some(input) = input {
            if input.apps.iter().any(|app| !apps.contains(app)) {
                return Err(aether_identity::Error::Forbidden.into());
            }
            let (connection, secret) = self
                .identity
                .create_agent_connection_in(&tx, session, input)
                .await?;
            json!({"connection":connection,"token":secret.expose()})
        } else {
            let connections = self.identity.agent_connections_in(&tx, session).await?;
            json!({"bridge":"aether-agent","saved_content_editing_available":self.products.as_ref().is_some_and(|p|p.commands().any(|c|c.descriptor.writes && apps.contains(&c.app))),"connections":connections,"apps":apps.iter().map(|app|json!({"id":app,"name":format!("Aether {}",match app.as_str(){"cad"=>"CAD","map"=>"Map","io"=>"IO","animation"=>"Animation","sketch"=>"Sketch",_=>"Vector"})})).collect::<Vec<_>>()})
        };
        commit(tx).await?;
        Ok(result)
    }
    pub async fn automation_catalog(&self, token: &str) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let (user, grant) = self
            .identity
            .authorize_agent_transaction(&tx, token, None, AgentAccess::Read)
            .await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        let candidates: Vec<&str> = grant
            .apps
            .iter()
            .map(String::as_str)
            .filter(|a| APPS.contains(a))
            .collect();
        let apps = self.allowed_apps(&tx, &user, &candidates).await?;
        let mut commands: Vec<_> = descriptors()
            .into_iter()
            .filter(|d| !apps.is_empty() && (!d.writes || grant.can_write))
            .collect();
        if let Some(products) = &self.products {
            commands.extend(
                products
                    .commands()
                    .filter(|p| {
                        apps.contains(&p.app)
                            && (!p.descriptor.writes || grant.can_write && grant.can_edit_content)
                    })
                    .map(|p| p.descriptor.clone()),
            );
        }
        if grant.can_write
            && grant.can_edit_content
            && apps.iter().any(|a| matches!(a.as_str(), "cad" | "map"))
        {
            commands.extend(super::live_editors::descriptors());
        }
        commit(tx).await?;
        Ok(
            json!({"schema_version":1,"capabilities":{"operation_receipts":true},"apps":apps,"commands":commands}),
        )
    }
    pub async fn automation_run(&self, token: Zeroizing<String>, input: Run) -> Result<Value> {
        if input.id.starts_with("editor.") {
            return self.live_editor_command(&token, input).await;
        }
        if let Some(product) = self.products.as_ref().and_then(|p| p.get(&input.id)) {
            return self.product_command(token, input, product).await;
        }
        let descriptor = descriptors()
            .into_iter()
            .find(|d| d.id == input.id)
            .ok_or(Error::Unsupported)?;
        validate_arguments(&input.arguments, &descriptor.input_schema)?;
        let invocation =
            decode_invocation(&input.id, &input.arguments).map_err(|_| Error::Invalid)?;
        if !invocation.validate() {
            return Err(Error::Invalid);
        }
        let app = input.arguments["app"]
            .as_str()
            .ok_or(Error::Invalid)?
            .to_owned();
        if !APPS.contains(&app.as_str()) {
            return Err(aether_identity::Error::Forbidden.into());
        }
        let operation = match input.operation_id {
            Some(id) if descriptor.writes && super::valid_id(&id) => id,
            Some(_) => return Err(Error::Invalid),
            None => random_id()?,
        };
        let mut delegated = self.clone();
        delegated.delegation = Some(Delegation {
            token: Arc::new(token),
            app: app.clone(),
            document: input.arguments["id"].as_str().map(str::to_owned),
            access: if descriptor.writes {
                AgentAccess::Write
            } else {
                AgentAccess::Read
            },
            command: input.id.clone(),
        });
        // An empty session is deliberate: only this private delegate can authorize.
        let mut result = match invocation {
            StudioInvocation::List(a) => {
                delegated
                    .library(
                        "",
                        &super::library::Request::List {
                            app: a.app,
                            view: a.view.map(|v| {
                                match v {
                                    LibraryView::Personal => "personal",
                                    LibraryView::Workspace => "workspace",
                                    LibraryView::Recent => "recent",
                                }
                                .into()
                            }),
                            parent: a.parent,
                            query: a.query,
                        },
                    )
                    .await?
            }
            StudioInvocation::Inspect(a) => {
                delegated
                    .library(
                        "",
                        &super::library::Request::Read {
                            app: a.app,
                            id: a.id,
                            branch: a.branch,
                        },
                    )
                    .await?
            }
            StudioInvocation::History(a) => {
                delegated
                    .library(
                        "",
                        &super::library::Request::History {
                            app: a.app,
                            id: a.id,
                            branch: None,
                        },
                    )
                    .await?
            }
            StudioInvocation::Rename(a) => {
                delegated
                    .library(
                        "",
                        &super::library::Request::Rename {
                            app: a.app,
                            id: a.id,
                            operation_id: operation.clone(),
                            expected_revision: a.expected_revision,
                            name: a.name,
                        },
                    )
                    .await?
            }
            StudioInvocation::Version(a) => {
                let request=serde_json::from_value(json!({"action":"version","app":a.app,"id":a.id,"operation_id":operation,"expected_revision":a.expected_revision,"name":a.name,"branch":a.branch,"message":a.message})).map_err(|_|Error::Invalid)?;
                delegated.change_named_version("", &request).await?
            }
        };
        if input.id == "document.list" {
            if let Some(files) = result["files"].as_array_mut() {
                files.retain(|file| file["app"] == app);
            }
        } else if input.id == "document.inspect" {
            let encoded = result
                .as_object_mut()
                .ok_or(Error::Incompatible)?
                .remove("data_base64")
                .ok_or(Error::Incompatible)?;
            let bytes = STANDARD
                .decode(encoded.as_str().ok_or(Error::Incompatible)?)
                .map_err(|_| Error::Incompatible)?;
            if let Ok(text) = std::str::from_utf8(&bytes)
                && !text.contains('\0')
            {
                let mut end = bytes.len().min(65536);
                while !text.is_char_boundary(end) {
                    end -= 1;
                }
                result["content_kind"] = json!("text");
                result["text"] = json!(&text[..end]);
                result["truncated"] = json!(end < bytes.len());
            } else {
                result["content_kind"] = json!("binary");
                result["text"] = Value::Null;
                result["truncated"] = json!(false);
            }
            result["saved_state_only"] = json!(true);
        }
        Ok(json!({"command":input.id,"result":result}))
    }
    pub(super) async fn authorize_delegation(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        user: &aether_identity::User,
    ) -> Result<()> {
        if let Some(delegate) = &self.delegation {
            if self
                .allowed_apps(tx, user, &[&delegate.app])
                .await?
                .is_empty()
            {
                return Err(aether_identity::Error::Forbidden.into());
            }
            if let Some(id) = &delegate.document {
                let resource = self
                    .require(
                        tx,
                        user,
                        id,
                        if matches!(delegate.access, AgentAccess::Read) {
                            Role::Viewer
                        } else {
                            Role::Editor
                        },
                    )
                    .await?;
                if resource.app != delegate.app {
                    return Err(Error::Denied);
                }
                if resource.kind != "document" {
                    return Err(Error::Invalid);
                }
            }
        }
        Ok(())
    }
}
