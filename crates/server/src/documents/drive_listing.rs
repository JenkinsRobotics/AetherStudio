//! Existing Drive file browser over native resources; no second metadata store.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_identity::User;
use aether_store::hosted::AuthorizedScope;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    time::Duration,
};
use tokio_postgres::Transaction;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub organization: Option<String>,
    pub view: Option<String>,
    pub workspace: Option<String>,
    pub parent: Option<String>,
    pub app: Option<String>,
    pub query: Option<String>,
    pub shared_scope: Option<String>,
}
const MAX_SCAN: usize = 2048;
const MAX_RESULTS: usize = 1000;
const MAX_DESCRIPTOR_BYTES: usize = 16 * 1024 * 1024;
impl Documents {
    pub async fn drive_list(&self, token: &str, input: &Request) -> Result<Value> {
        let organization = input.organization.as_deref().unwrap_or("default");
        let view = input.view.as_deref().unwrap_or("personal");
        if !valid_id(organization)
            || [&input.workspace, &input.parent, &input.app]
                .into_iter()
                .flatten()
                .any(|id| !valid_id(id))
            || input
                .query
                .as_ref()
                .is_some_and(|q| q.len() > 1024 || q.chars().any(char::is_control))
            || input
                .shared_scope
                .as_deref()
                .is_some_and(|s| !matches!(s, "with" | "by"))
            || !matches!(
                view,
                "personal" | "workspace" | "recent" | "search" | "favorites" | "shared" | "trash"
            )
            || (view == "workspace" && (organization == "all" || input.workspace.is_none()))
        {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(10),
            self.drive_list_inner(token, input, organization, view),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }
    async fn drive_list_inner(
        &self,
        token: &str,
        input: &Request,
        organization: &str,
        view: &str,
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
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        if organization != "all" && self.member(&tx, &user.id, organization).await?.is_none() {
            return Err(Error::Denied);
        }
        // Directly shared nested folders can be opened without revealing private
        // ancestor names. Root workspace navigation still needs workspace access.
        let mut path = Vec::new();
        if let Some(parent) = &input.parent {
            let mut next = Some(parent.clone());
            let mut seen = HashSet::new();
            while let Some(id) = next {
                if !seen.insert(id.clone()) || seen.len() > 128 {
                    return Err(Error::Incompatible);
                }
                let resource = match self
                    .require_resource(&tx, &user, &id, Role::Viewer, view == "trash")
                    .await
                {
                    Ok(r) => r,
                    Err(Error::Denied) if !path.is_empty() => break,
                    Err(e) => return Err(e),
                };
                match self.app(&tx, &user, &resource.app).await {
                    Ok(()) => (),
                    Err(Error::Denied) if !path.is_empty() => break,
                    Err(e) => return Err(e),
                }
                if resource.kind != "folder"
                    || (organization != "all" && resource.location.organization != organization)
                    || (view == "workspace" && resource.location.workspace != input.workspace)
                {
                    return Err(Error::Denied);
                }
                let name:String=tx.query_one("SELECT coalesce(folder_name,id) FROM aether_access.resources WHERE tenant=$1 AND id=$2",&[&self.tenant(),&id]).await.map_err(db)?.get(0);
                path.push(json!({"id":id,"name":name}));
                next = resource.location.parent;
            }
            path.reverse();
        } else if view == "workspace"
            && self
                .workspace_role(
                    &tx,
                    &user.id,
                    organization,
                    input.workspace.as_deref().ok_or(Error::Invalid)?,
                )
                .await?
                .is_none()
        {
            return Err(Error::Denied);
        }
        let query = input.query.as_deref().unwrap_or("").trim().to_lowercase();
        // Bound work before any file reads. Unauthorized rows cannot become names,
        // counts or pagination cursors. The legacy API promises a complete result.
        let rows=tx.query("SELECT r.id,r.kind,r.app,r.owner,r.workspace,r.parent,EXTRACT(EPOCH FROM v.opened)::double precision,coalesce(f.favorite,false) FROM aether_access.resources r JOIN aether_access.members m ON m.tenant=r.tenant AND m.organization=r.organization AND m.user_id=$2 LEFT JOIN aether_access.library_recents v ON v.tenant=r.tenant AND v.resource=r.id AND v.user_id=$2 LEFT JOIN aether_access.file_favorites f ON f.tenant=r.tenant AND f.resource=r.id AND f.user_id=$2 WHERE r.tenant=$1 AND r.trashed=$5 AND ($3='all' OR r.organization=$3) ORDER BY r.id COLLATE \"C\" LIMIT $4",&[&self.tenant(),&user.id,&organization,&((MAX_SCAN+1) as i64), &(view == "trash")]).await.map_err(db)?;
        if rows.len() > MAX_SCAN {
            return Err(Error::Unsupported);
        }
        let mut files = Vec::new();
        let mut apps = HashMap::new();
        let mut descriptor_bytes = 0usize;
        for row in rows {
            let id: String = row.get(0);
            let kind: &str = row.get(1);
            let app: String = row.get(2);
            if kind != "folder" && input.app.as_ref().is_some_and(|v| v != &app) {
                continue;
            }
            let allowed = match apps.get(&app) {
                Some(v) => *v,
                None => {
                    let value = match self.app(&tx, &user, &app).await {
                        Ok(()) => true,
                        Err(Error::Denied) => false,
                        Err(e) => return Err(e),
                    };
                    apps.insert(app.clone(), value);
                    value
                }
            };
            if !allowed {
                continue;
            }
            match self
                .require_resource(&tx, &user, &id, Role::Viewer, view == "trash")
                .await
            {
                Ok(_) => (),
                Err(Error::Denied) => continue,
                Err(e) => return Err(e),
            }
            let owner: String = row.get(3);
            let workspace: Option<String> = row.get(4);
            let parent: Option<String> = row.get(5);
            let opened: Option<f64> = row.get(6);
            if view == "favorites"
                && query.is_empty()
                && input.parent.is_none()
                && !row.get::<_, bool>(7)
            {
                continue;
            }
            if query.is_empty() {
                if let Some(wanted) = &input.parent {
                    if parent.as_ref() != Some(wanted) {
                        continue;
                    }
                } else {
                    match view {
                        "personal"
                            if workspace.is_some() || owner != user.id || parent.is_some() =>
                        {
                            continue;
                        }
                        "workspace" if workspace != input.workspace || parent.is_some() => continue,
                        "recent" if opened.is_none() => continue,
                        _ => (),
                    }
                }
            }
            if view == "trash" && query.is_empty() && input.parent.is_none() {
                let mut next = parent.clone();
                let mut inherited = false;
                while let Some(id) = next {
                    let ancestor = self.resource(&tx, &id).await?.ok_or(Error::Incompatible)?;
                    if ancestor.trashed {
                        inherited = true;
                        break;
                    }
                    next = ancestor.location.parent;
                }
                if inherited {
                    continue;
                }
            }
            let sharing = if view == "shared" {
                let Some(sharing) = self
                    .drive_shared_metadata(
                        &tx,
                        &user,
                        &id,
                        input.shared_scope.as_deref().unwrap_or("with"),
                    )
                    .await?
                else {
                    continue;
                };
                Some(sharing)
            } else {
                None
            };
            let mut entry = self
                .drive_entry_visibility(&tx, &user, &id, &mut descriptor_bytes, view == "trash")
                .await?;
            if let Some(sharing) = sharing {
                entry
                    .as_object_mut()
                    .ok_or(Error::Incompatible)?
                    .extend(sharing);
            }
            if !entry["name"]
                .as_str()
                .ok_or(Error::Incompatible)?
                .to_lowercase()
                .contains(&query)
            {
                continue;
            }
            entry["opened"] = json!(opened);
            files.push(entry);
            if files.len() > MAX_RESULTS {
                return Err(Error::Unsupported);
            }
        }
        files.sort_by(|a, b| {
            (b["kind"] == "folder")
                .cmp(&(a["kind"] == "folder"))
                .then_with(|| {
                    if view == "recent" {
                        b["opened"]
                            .as_f64()
                            .unwrap_or(0.0)
                            .total_cmp(&a["opened"].as_f64().unwrap_or(0.0))
                    } else {
                        a["name"]
                            .as_str()
                            .unwrap_or("")
                            .to_lowercase()
                            .cmp(&b["name"].as_str().unwrap_or("").to_lowercase())
                    }
                })
                .then_with(|| a["id"].as_str().cmp(&b["id"].as_str()))
        });
        let result = json!({"files":files,"path":path,"capabilities":{"favorites":true,"shared":true,"trash":true,"activity":true}});
        if serde_json::to_vec(&result)
            .map_err(|_| Error::Incompatible)?
            .len()
            > 8 * 1024 * 1024
        {
            return Err(Error::Unsupported);
        }
        commit(tx).await?;
        Ok(result)
    }
    pub(super) async fn drive_entry(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        descriptor_bytes: &mut usize,
    ) -> Result<Value> {
        self.drive_entry_visibility(tx, user, id, descriptor_bytes, false)
            .await
    }
    pub(super) async fn drive_entry_visibility(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        descriptor_bytes: &mut usize,
        include_trash: bool,
    ) -> Result<Value> {
        let resource = self
            .require_resource(tx, user, id, Role::Viewer, include_trash)
            .await?;
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let mut entry = if resource.kind == "folder" {
            self.library_folder_metadata_visibility(tx, user, id, include_trash)
                .await?
        } else if resource.kind == "document" {
            let doc = self.store.metadata_in(tx, &scope, id).await?;
            if doc.app != resource.app {
                return Err(Error::Incompatible);
            }
            let mut entry = self
                .library_metadata_visibility(tx, user, &doc, include_trash)
                .await?;
            entry["sha256"] = json!(doc.content_sha256);
            if doc.app == "drive" {
                *descriptor_bytes = descriptor_bytes
                    .checked_add(doc.size_bytes as usize)
                    .ok_or(Error::Unsupported)?;
                if *descriptor_bytes > MAX_DESCRIPTOR_BYTES {
                    return Err(Error::Unsupported);
                }
                // Read the captured revision, never a later head while composing
                // descriptor size/hash metadata. Attachment bytes are not read.
                let saved = self
                    .store
                    .read_in(tx, &scope, id, Some(doc.revision))
                    .await?;
                let bytes = STANDARD
                    .decode(saved.content_base64)
                    .map_err(|_| Error::Incompatible)?;
                if let Ok(value) = serde_json::from_slice::<Value>(&bytes)
                    && value.get("aether_drive_blob").is_some()
                {
                    let sha = value["aether_drive_blob"]
                        .as_str()
                        .filter(|v| crate::attachments::valid_digest(v))
                        .ok_or(Error::Incompatible)?;
                    let size = value["size"].as_u64().ok_or(Error::Incompatible)?;
                    entry["sha256"] = json!(sha);
                    entry["size"] = json!(size);
                }
            }
            entry
        } else {
            return Err(Error::Incompatible);
        };
        let role = match self
            .require_resource(tx, user, id, Role::Owner, include_trash)
            .await
        {
            Ok(_) => "owner",
            Err(Error::Denied) => {
                if entry["writable"] == true {
                    "editor"
                } else {
                    "viewer"
                }
            }
            Err(e) => return Err(e),
        };
        let versions:i64=tx.query_one("SELECT count(*) FROM aether_access.named_versions WHERE tenant=$1 AND document_id=$2",&[&self.tenant(),&id]).await.map_err(db)?.get(0);
        let structure: i64 = tx
            .query_one(
                "SELECT structure_revision FROM aether_access.resources WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &id],
            )
            .await
            .map_err(db)?
            .get(0);
        entry["structure_revision"] =
            json!(u32::try_from(structure).map_err(|_| Error::Incompatible)?);
        entry["owner_id"] = json!(resource.owner);
        entry["role"] = json!(role);
        entry["manageable"] = json!(role == "owner");
        entry["trashed"] = json!(resource.trashed);
        entry["versions"] = json!(versions);
        let favorite:bool=tx.query_one("SELECT coalesce((SELECT favorite FROM aether_access.file_favorites WHERE tenant=$1 AND user_id=$2 AND resource=$3),false)",&[&self.tenant(),&user.id,&id]).await.map_err(db)?.get(0);
        entry["favorite"] = json!(favorite);
        entry["mime"] = json!(drive_mime(
            entry["name"].as_str().ok_or(Error::Incompatible)?
        ));
        if include_trash {
            entry
                .as_object_mut()
                .ok_or(Error::Incompatible)?
                .extend(self.drive_recycle_metadata(tx, user, id).await?);
        }
        // Provenance/activity remains unknown until that journal is migrated.
        // Omit those optional fields instead of inventing an author/date/count.
        Ok(entry)
    }
}
fn drive_mime(name: &str) -> &'static str {
    match name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "json" => "application/json",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "csv" => "text/csv",
        _ => "application/octet-stream",
    }
}
