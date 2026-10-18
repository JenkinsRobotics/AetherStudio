//! Resumable uploads: immutable object chunks, transactional offsets, current
//! permissions at publication and an enduring completion receipt.
use super::*;
use aether_store::hosted::UPLOAD_CHUNK_BYTES;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
pub(super) const MAX_UPLOAD: usize = 512 * 1024 * 1024;
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Begin {
    operation_id: String,
    name: String,
    size: u64,
    organization: Option<String>,
    workspace: Option<String>,
    parent: Option<String>,
    id: Option<String>,
    expected_revision: Option<u32>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    upload: String,
    offset: Option<u64>,
    data_base64: Option<String>,
    sha256: Option<String>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Chunk {
    pub digest: String,
    pub size: usize,
}
pub(super) fn chunks(value: Value, size: usize) -> Result<Vec<Chunk>> {
    let chunks: Vec<Chunk> = serde_json::from_value(value).map_err(|_| Error::Incompatible)?;
    if size > MAX_UPLOAD
        || chunks.len() > 512
        || chunks.iter().any(|c| {
            !crate::attachments::valid_digest(&c.digest)
                || c.size == 0
                || c.size > UPLOAD_CHUNK_BYTES
        })
        || chunks.iter().map(|c| c.size).sum::<usize>() != size
    {
        return Err(Error::Incompatible);
    }
    Ok(chunks)
}
fn native_app(name: &str, size: u64) -> &'static str {
    if size > super::library::MAX_FILE_BYTES as u64 {
        return "drive";
    }
    match name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "acpart" | "cadpart" | "acasm" | "acad" | "acdrw" => "cad",
        "aethermap" => "map",
        "aethersketch" => "sketch",
        "aetherio" => "io",
        "anima" => "animation",
        _ => "drive",
    }
}
impl Documents {
    pub async fn upload_begin(&self, token: &str, input: &Begin) -> Result<Value> {
        if input.size > MAX_UPLOAD as u64 {
            return Err(Error::TooLarge);
        }
        if !valid_id(&input.operation_id)
            || input.name.trim().is_empty()
            || input.name.len() > 1024
            || input.name.chars().any(char::is_control)
            || [
                &input.organization,
                &input.workspace,
                &input.parent,
                &input.id,
            ]
            .into_iter()
            .flatten()
            .any(|v| !valid_id(v))
            || input.id.is_some() != input.expected_revision.is_some()
            || input.expected_revision == Some(0)
        {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, true).await?;
        self.app(&tx, &user, "drive").await?;
        let id = format!(
            "upload-{:x}",
            Sha256::digest(
                serde_json::to_vec(&(self.tenant(), &user.id, &input.operation_id))
                    .map_err(|_| Error::Invalid)?
            )
        );
        let request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        if let Some(row)=tx.query_opt("SELECT request,received,state FROM aether_access.uploads WHERE tenant=$1 AND owner=$2 AND id=$3", &[&self.tenant(),&user.id,&id]).await.map_err(db)? {
            if row.get::<_,Value>(0)!=request || !matches!(row.get::<_,String>(2).as_str(),"active"|"complete") {return Err(Error::Conflict);}
            return Ok(json!({"id":id,"offset":row.get::<_,i64>(1),"chunk_bytes":UPLOAD_CHUNK_BYTES,"replayed":true}));
        }
        let mut location = Location {
            organization: input
                .organization
                .clone()
                .unwrap_or_else(|| "default".into()),
            workspace: input.workspace.clone(),
            parent: input.parent.clone(),
        };
        let mut name = input.name.trim().to_string();
        let mut structure = None;
        let app = if let Some(replace) = &input.id {
            let resource = self.require(&tx, &user, replace, Role::Editor).await?;
            if resource.kind != "document" || resource.app != "drive" {
                return Err(Error::Invalid);
            }
            let saved = self.resource_snapshot(&tx, &user, replace).await?;
            if saved.document_revision != input.expected_revision {
                return Err(Error::Conflict);
            }
            structure = Some(i64::from(saved.structure_revision));
            name = saved.name;
            location = resource.location;
            "drive"
        } else {
            self.destination(&tx, &user, &location).await?;
            self.drive_name_available(&tx, &id, &name, &location, &user.id)
                .await?;
            native_app(&name, input.size)
        };
        self.app(&tx, &user, app).await?;
        tx.execute("UPDATE aether_access.uploads SET state='expired',chunks='[]' WHERE tenant=$1 AND owner=$2 AND state='active' AND created<clock_timestamp()-interval '24 hours'",&[&self.tenant(),&user.id]).await.map_err(db)?;
        let count:i64=tx.query_one("SELECT count(*) FROM aether_access.uploads WHERE tenant=$1 AND owner=$2 AND state='active'",&[&self.tenant(),&user.id]).await.map_err(db)?.get(0);
        if count >= 8 {
            return Err(Error::Conflict);
        }
        tx.execute("INSERT INTO aether_access.uploads(tenant,owner,id,request,name,app,location,replacement,expected_revision,expected_structure_revision,size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",&[&self.tenant(),&user.id,&id,&request,&name,&app,&serde_json::to_value(location).map_err(|_|Error::Invalid)?,&input.id,&input.expected_revision.map(i64::from),&structure,&(input.size as i64)]).await.map_err(db)?;
        commit(tx).await?;
        Ok(json!({"id":id,"offset":0,"chunk_bytes":UPLOAD_CHUNK_BYTES,"replayed":false}))
    }
    pub async fn upload(&self, token: &str, action: &str, input: &Request) -> Result<Value> {
        if !valid_id(&input.upload)
            || (action != "upload_chunk" && (input.offset.is_some() || input.data_base64.is_some()))
            || (action != "upload_finish" && input.sha256.is_some())
            || input
                .sha256
                .as_ref()
                .is_some_and(|v| !crate::attachments::valid_digest(v))
        {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, action == "upload_finish").await?;
        self.app(&tx, &user, "drive").await?;
        let row=tx.query_opt("SELECT *,created<clock_timestamp()-interval '24 hours' AS expired FROM aether_access.uploads WHERE tenant=$1 AND owner=$2 AND id=$3 FOR UPDATE",&[&self.tenant(),&user.id,&input.upload]).await.map_err(db)?.ok_or(Error::Denied)?;
        let state: String = row.get("state");
        let received: i64 = row.get("received");
        let size: i64 = row.get("size");
        if action == "upload_cancel" {
            if state == "complete" {
                return Err(Error::Conflict);
            }
            tx.execute("UPDATE aether_access.uploads SET state='cancelled',chunks='[]' WHERE tenant=$1 AND owner=$2 AND id=$3",&[&self.tenant(),&user.id,&input.upload]).await.map_err(db)?;
            commit(tx).await?;
            return Ok(json!({"ok":true}));
        }
        let expired = state == "expired" || (state == "active" && row.get::<_, bool>("expired"));
        if action == "upload_status" {
            return Ok(
                json!({"offset":received,"size":size,"state":if expired {"expired"}else{&state},"chunks":if expired || state=="cancelled" {json!([])}else{row.get::<_,Value>("chunks")}}),
            );
        }
        if state == "cancelled" || expired {
            return Err(Error::Conflict);
        }
        if state == "complete" {
            if action != "upload_finish" {
                return Err(Error::Conflict);
            }
            if input
                .sha256
                .as_ref()
                .is_some_and(|v| Some(v) != row.get::<_, Option<String>>("digest").as_ref())
            {
                return Err(Error::Conflict);
            }
            let id: String = row.get("result_id");
            let resource = self.require(&tx, &user, &id, Role::Editor).await?;
            self.app(&tx, &user, &resource.app).await?;
            let mut result = self.drive_entry(&tx, &user, &id, &mut 0).await?;
            result["replayed"] = json!(true);
            return Ok(result);
        }
        let scope = AuthorizedScope::new(self.tenant(), &user.id)?;
        let mut parts = chunks(row.get("chunks"), received as usize)?;
        if action == "upload_chunk" {
            if input.offset != Some(received as u64) {
                return Err(Error::Conflict);
            }
            let encoded = input.data_base64.as_deref().ok_or(Error::Invalid)?;
            if encoded.len() > UPLOAD_CHUNK_BYTES.div_ceil(3) * 4 {
                return Err(Error::TooLarge);
            }
            let bytes = STANDARD.decode(encoded).map_err(|_| Error::Invalid)?;
            // Fixed full chunks and one final partial keep manifests bounded.
            if bytes.len() != ((size - received) as usize).min(UPLOAD_CHUNK_BYTES)
                || bytes.is_empty()
            {
                return Err(Error::Invalid);
            }
            let length = bytes.len();
            let digest = self.store.put_upload_chunk(&scope, bytes).await?;
            parts.push(Chunk {
                digest,
                size: length,
            });
            let next = received + length as i64;
            tx.execute("UPDATE aether_access.uploads SET received=$4,chunks=$5 WHERE tenant=$1 AND owner=$2 AND id=$3",&[&self.tenant(),&user.id,&input.upload,&next,&serde_json::to_value(parts).map_err(|_|Error::Incompatible)?]).await.map_err(db)?;
            commit(tx).await?;
            return Ok(json!({"offset":next}));
        }
        if action != "upload_finish" {
            return Err(Error::Invalid);
        }
        if received != size {
            return Err(Error::Conflict);
        }
        let app: String = row.get("app");
        self.app(&tx, &user, &app).await?;
        let replacement: Option<String> = row.get("replacement");
        let id = replacement
            .clone()
            .unwrap_or_else(|| format!("file-{}", input.upload));
        let location: Location =
            serde_json::from_value(row.get("location")).map_err(|_| Error::Incompatible)?;
        let name: String = row.get("name");
        let expected: Option<i64> = row.get("expected_revision");
        if replacement.is_some() {
            let resource = self.require(&tx, &user, &id, Role::Editor).await?;
            let saved = self.resource_snapshot(&tx, &user, &id).await?;
            if resource.app != "drive"
                || resource.location != location
                || saved.document_revision.map(i64::from) != expected
                || Some(i64::from(saved.structure_revision))
                    != row.get::<_, Option<i64>>("expected_structure_revision")
            {
                return Err(Error::Conflict);
            }
        } else {
            self.destination(&tx, &user, &location).await?;
            self.drive_name_available(&tx, &id, &name, &location, &user.id)
                .await?;
        }
        let mut hash = Sha256::new();
        let mut native = Vec::new();
        for part in &parts {
            let bytes = self
                .store
                .read_upload_chunk(&scope, &part.digest, part.size)
                .await?;
            hash.update(&bytes);
            if app != "drive" {
                native.extend(bytes);
            }
        }
        let digest = format!("{:x}", hash.finalize());
        if input.sha256.as_ref().is_some_and(|v| v != &digest) {
            return Err(Error::Conflict);
        }
        let content = if app == "drive" {
            let manifest = serde_json::to_value(&parts).map_err(|_| Error::Incompatible)?;
            tx.execute("INSERT INTO aether_access.upload_blobs(tenant,digest,size,chunks) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",&[&self.tenant(),&digest,&size,&manifest]).await.map_err(db)?;
            let prior=tx.query_one("SELECT size,chunks FROM aether_access.upload_blobs WHERE tenant=$1 AND digest=$2",&[&self.tenant(),&digest]).await.map_err(db)?;
            if prior.get::<_, i64>(0) != size || prior.get::<_, Value>(1) != manifest {
                return Err(Error::Incompatible);
            }
            serde_json::to_vec(&json!({"aether_drive_blob":digest,"size":size}))
                .map_err(|_| Error::Incompatible)?
        } else {
            native
        };
        let change = if replacement.is_some() {
            DocumentChange::Save {
                expected_revision: expected.ok_or(Error::Incompatible)? as u32,
                content_base64: STANDARD.encode(content),
            }
        } else {
            DocumentChange::Create {
                app: app.clone(),
                name,
                content_base64: STANDARD.encode(content),
            }
        };
        self.mutate_authorized_in(
            &tx,
            &user,
            &Mutation {
                operation_id: input.upload.clone(),
                document_id: id.clone(),
                location: if replacement.is_some() {
                    None
                } else {
                    Some(location)
                },
                change,
            },
            Some(&app),
            true,
        )
        .await?;
        tx.execute("UPDATE aether_access.uploads SET state='complete',result_id=$4,digest=$5 WHERE tenant=$1 AND owner=$2 AND id=$3",&[&self.tenant(),&user.id,&input.upload,&id,&digest]).await.map_err(db)?;
        let mut result = self.drive_entry(&tx, &user, &id, &mut 0).await?;
        result["replayed"] = json!(false);
        commit(tx).await?;
        Ok(result)
    }
}

impl Documents {
    /// Explicit local operator integrity audit; never exposed as a client route.
    /// Stream manifests and verify one chunk at a time, including interrupted
    /// uploads, so a restored database cannot conceal missing object files.
    pub async fn verify_uploads(&self) -> Result<u64> {
        use futures_util::TryStreamExt;
        let c = self.client().await?;
        let rows=c.query_raw("SELECT chunks,size,digest FROM aether_access.upload_blobs WHERE tenant=$1 UNION ALL SELECT chunks,received,CASE WHEN state='complete' THEN digest ELSE NULL END FROM aether_access.uploads WHERE tenant=$1 AND state IN ('active','complete') UNION ALL SELECT chunks,size,digest FROM aether_access.map_media WHERE tenant=$1 UNION ALL SELECT chunks,size,digest FROM aether_access.workspace_files WHERE tenant=$1", &[&self.tenant()]).await.map_err(db)?;
        futures_util::pin_mut!(rows);
        let scope = AuthorizedScope::new(self.tenant(), "migration-audit")?;
        let mut count = 0;
        while let Some(row) = rows.try_next().await.map_err(db)? {
            let parts = chunks(
                row.get(0),
                usize::try_from(row.get::<_, i64>(1)).map_err(|_| Error::Incompatible)?,
            )?;
            let expected: Option<String> = row.get(2);
            let mut hash = Sha256::new();
            for part in parts {
                hash.update(
                    self.store
                        .read_upload_chunk(&scope, &part.digest, part.size)
                        .await?,
                );
            }
            if expected.is_some_and(|v| v != format!("{:x}", hash.finalize())) {
                return Err(Error::Incompatible);
            }
            count += 1;
        }
        Ok(count)
    }
}
