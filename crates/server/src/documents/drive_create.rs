//! Atomic Drive creation over the canonical resource and document stores.
use super::{Documents, Error, Location, Mutation, Result, Role, commit, db, valid_id};
use aether_protocol_core::{resources::ResourceMutationReceipt, storage::DocumentChange};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::time::Duration;
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub operation_id: String,
    pub name: String,
    pub kind: Option<String>,
    pub app: Option<String>,
    pub organization: Option<String>,
    pub workspace: Option<String>,
    pub parent: Option<String>,
    pub data_base64: Option<String>,
}
#[derive(Clone, Copy)]
enum Origin<'a> {
    Drive,
    Library(Option<&'a str>),
}
impl Documents {
    pub async fn drive_create(&self, token: &str, input: &Request) -> Result<Value> {
        self.create_service(token, input, Origin::Drive).await
    }
    pub(super) async fn library_create_folder(
        &self,
        token: &str,
        input: &Request,
        scope: Option<&str>,
    ) -> Result<Value> {
        self.create_service(token, input, Origin::Library(scope))
            .await
    }
    async fn create_service(
        &self,
        token: &str,
        input: &Request,
        origin: Origin<'_>,
    ) -> Result<Value> {
        let name = input.name.trim();
        let kind = input.kind.as_deref().unwrap_or("file");
        if !valid_id(&input.operation_id)
            || name.is_empty()
            || name.len() > 1024
            || name.chars().any(char::is_control)
            || !matches!(kind, "file" | "folder")
            || [
                &input.app,
                &input.organization,
                &input.workspace,
                &input.parent,
            ]
            .into_iter()
            .flatten()
            .any(|v| !valid_id(v))
        {
            return Err(Error::Invalid);
        }
        let content = input.data_base64.as_deref().unwrap_or("");
        if kind == "folder" && !content.is_empty() {
            return Err(Error::Invalid);
        }
        let limit = super::library::MAX_FILE_BYTES;
        if content.len() > limit.div_ceil(3) * 4
            || STANDARD.decode(content).map_err(|_| Error::Invalid)?.len() > limit
        {
            return Err(Error::TooLarge);
        }
        tokio::time::timeout(
            Duration::from_secs(20),
            self.drive_create_inner(token, input, name, kind, content, origin),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn drive_create_inner(
        &self,
        token: &str,
        input: &Request,
        name: &str,
        kind: &str,
        content: &str,
        origin: Origin<'_>,
    ) -> Result<Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        if matches!(origin, Origin::Drive) {
            self.app(&tx, &user, "drive").await?;
        }
        let app = input.app.as_deref().unwrap_or("drive");
        self.app(&tx, &user, app).await?;
        let key = serde_json::to_vec(&(self.tenant(), &user.id, &input.operation_id))
            .map_err(|_| Error::Invalid)?;
        let id = format!("drive-{:x}", Sha256::digest(key));
        let scope = match origin {
            Origin::Drive => None,
            Origin::Library(scope) => Some(scope),
        };
        let request_bytes = match origin {
            Origin::Drive => serde_json::to_vec(input),
            Origin::Library(_) => serde_json::to_vec(&(input, scope)),
        }
        .map_err(|_| Error::Invalid)?;
        let request = json!({"action":if matches!(origin, Origin::Drive) { "drive_create" } else { "library_folder_create" },"format":1,"input_sha256":format!("{:x}",Sha256::digest(request_bytes))});
        if let Some(row)=tx.query_opt("SELECT request FROM aether_access.resource_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3",&[&self.tenant(),&user.id,&input.operation_id]).await.map_err(db)? {
   let resource=self.require(&tx,&user,&id,Role::Editor).await?;self.app(&tx,&user,&resource.app).await?;
   if row.get::<_,Value>(0)!=request {return Err(Error::Conflict);}
   let mut size=0;let mut result=self.drive_entry(&tx,&user,&id,&mut size).await?;
   result["operation_id"]=json!(input.operation_id);result["replayed"]=json!(true);
   commit(tx).await?;return Ok(result);
  }
        let mut location = Location {
            organization: input
                .organization
                .clone()
                .unwrap_or_else(|| "default".into()),
            workspace: input.workspace.clone(),
            parent: input.parent.clone(),
        };
        if let Origin::Library(scope) = origin {
            if let Some(parent) = &input.parent {
                let folder = self.require(&tx, &user, parent, Role::Editor).await?;
                if folder.kind != "folder"
                    || scope
                        .is_some_and(|v| (v == "workspace") != folder.location.workspace.is_some())
                    || input
                        .organization
                        .as_ref()
                        .is_some_and(|v| v != &folder.location.organization)
                    || input
                        .workspace
                        .as_ref()
                        .is_some_and(|v| Some(v) != folder.location.workspace.as_ref())
                {
                    return Err(Error::Invalid);
                }
                location.organization = folder.location.organization;
                location.workspace = folder.location.workspace;
            } else if location.workspace.is_none() && scope == Some("workspace") {
                location.workspace = Some("shared".into());
            }
        }
        self.destination(&tx, &user, &location).await?;
        if self.resource(&tx, &id).await?.is_some() {
            return Err(Error::Conflict);
        }
        self.drive_name_available(&tx, &id, name, &location, &user.id)
            .await?;
        if kind == "folder" {
            self.insert_resource(&tx, &user, &id, app, &location, "folder")
                .await?;
            tx.execute(
                "UPDATE aether_access.resources SET folder_name=$3 WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &id, &name],
            )
            .await
            .map_err(db)?;
            self.audit(&tx, &user, "create_folder", &id).await?;
        } else {
            self.mutate_in(
                &tx,
                &user,
                &Mutation {
                    operation_id: input.operation_id.clone(),
                    document_id: id.clone(),
                    location: Some(location),
                    change: DocumentChange::Create {
                        app: app.into(),
                        name: name.into(),
                        content_base64: content.into(),
                    },
                },
                Some(app),
            )
            .await?;
        }
        let receipt = ResourceMutationReceipt {
            operation_id: input.operation_id.clone(),
            resource: self.resource_snapshot(&tx, &user, &id).await?,
            replayed: false,
        };
        tx.execute("INSERT INTO aether_access.resource_receipts(tenant,actor,operation_id,request,receipt) VALUES($1,$2,$3,$4,$5)",&[&self.tenant(),&user.id,&input.operation_id,&request,&serde_json::to_value(receipt).map_err(|_|Error::Incompatible)?]).await.map_err(db)?;
        let mut size = 0;
        let mut result = self.drive_entry(&tx, &user, &id, &mut size).await?;
        result["operation_id"] = json!(input.operation_id);
        result["replayed"] = json!(false);
        commit(tx).await?;
        Ok(result)
    }
}
