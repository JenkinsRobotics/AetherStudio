//! Drive details and file-open navigation use current native document authority.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use crate::attachments::Attachments;
use aether_store::hosted::AuthorizedScope;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::{Value, json};

pub enum Mode<'a> {
    Details,
    Open,
    Read(Option<&'a Attachments>),
}
const MAX_JSON_READ: u64 = 16 * 1024 * 1024;
use std::time::Duration;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub id: String,
}
impl Documents {
    pub async fn drive_item(&self, token: &str, input: &Request, mode: Mode<'_>) -> Result<Value> {
        if !valid_id(&input.id) {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(10),
            self.drive_item_inner(token, &input.id, mode),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }
    async fn drive_item_inner(&self, token: &str, id: &str, mode: Mode<'_>) -> Result<Value> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, token).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        self.app(&tx, &user, &resource.app).await?;
        let open = !matches!(mode, Mode::Details);
        if open && resource.kind != "document" {
            return Err(Error::Invalid);
        }
        let mut result = self.drive_entry(&tx, &user, id, &mut 0).await?;
        if let Mode::Read(attachments) = mode {
            let size = result["size"].as_u64().ok_or(Error::Incompatible)?;
            if size > MAX_JSON_READ {
                return Err(Error::TooLarge);
            }
            let revision = result["revision"]
                .as_u64()
                .and_then(|v| u32::try_from(v).ok())
                .filter(|v| *v > 0)
                .ok_or(Error::Incompatible)?;
            // Metadata and bytes must describe the same immutable revision even
            // if another editor publishes a new head during this request.
            let saved = self
                .store
                .read_in(
                    &tx,
                    &AuthorizedScope::new(self.tenant(), &user.id)?,
                    id,
                    Some(revision),
                )
                .await?;
            if saved.document.app != resource.app {
                return Err(Error::Incompatible);
            }
            let bytes = self
                .resolve_content(
                    &tx,
                    &user,
                    &resource.app,
                    &saved.content_base64,
                    attachments,
                )
                .await?
                .collect(MAX_JSON_READ as usize)
                .await?;
            if bytes.len() as u64 != size {
                return Err(Error::Incompatible);
            }
            result["data_base64"] = json!(STANDARD.encode(bytes));
        }
        if open {
            // Navigation telemetry only. Repeated opens refresh recency, never
            // create a document revision or change its name, content or ACL.
            tx.execute("INSERT INTO aether_access.library_recents(tenant,user_id,resource) VALUES($1,$2,$3) ON CONFLICT(tenant,user_id,resource) DO UPDATE SET opened=greatest(aether_access.library_recents.opened,clock_timestamp())", &[&self.tenant(), &user.id, &id]).await.map_err(db)?;
        }
        commit(tx).await?;
        Ok(result)
    }
}
