//! Immutable media authority and revision retention; Map owns composition.
mod upload;
use super::{download::Content, uploads::chunks, *};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::Value;
use std::collections::BTreeSet;

pub fn mime(name: &str) -> Option<&'static str> {
    let (stem, extension) = name.rsplit_once('.')?;
    if stem.is_empty()
        || stem.len() > 64
        || !stem
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    Some(match extension.to_ascii_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        _ => return None,
    })
}
// The existing Map storage contract declares attachments in media[].file.
// This binds bytes, not the rendering or timeline meaning of the document.
pub(super) fn references(content: &str) -> Result<BTreeSet<String>> {
    let bytes = STANDARD.decode(content).map_err(|_| Error::Invalid)?;
    let Ok(value) = serde_json::from_slice::<Value>(&bytes) else {
        return Ok(BTreeSet::new());
    };
    let Some(media) = value.get("media") else {
        return Ok(BTreeSet::new());
    };
    let media = media.as_array().ok_or(Error::Invalid)?;
    if media.len() > 4096 {
        return Err(Error::TooLarge);
    }
    media
        .iter()
        .map(|item| {
            let name = item
                .get("file")
                .and_then(Value::as_str)
                .filter(|s| mime(s).is_some())
                .ok_or(Error::Invalid)?;
            Ok(name.to_owned())
        })
        .collect()
}
impl Documents {
    // Always after identity and ACL locks. Publication, binding and deletion
    // serialize so an asset cannot disappear between validation and a save.
    async fn map_media_lock(&self, tx: &Transaction<'_>) -> Result<()> {
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062619))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        Ok(())
    }
    async fn map_media_access(&self, tx: &Transaction<'_>, user: &User, name: &str) -> Result<()> {
        let row = tx
            .query_opt(
                "SELECT owner,deleted FROM aether_access.map_media WHERE tenant=$1 AND name=$2",
                &[&self.tenant(), &name],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Denied)?;
        if row.get::<_, bool>(1) {
            return Err(Error::Denied);
        }
        if row.get::<_, String>(0) == user.id {
            return Ok(());
        }
        // Bounded authority work even if an asset appears in many documents.
        let rows = tx.query("SELECT document FROM aether_access.map_media_refs WHERE tenant=$1 AND name=$2 ORDER BY document LIMIT 4097", &[&self.tenant(), &name]).await.map_err(db)?;
        if rows.len() > 4096 {
            return Err(Error::Unavailable);
        }
        for row in rows {
            match self
                .require(tx, user, &row.get::<_, String>(0), Role::Viewer)
                .await
            {
                Ok(resource) if resource.app == "map" && resource.kind == "document" => {
                    return Ok(());
                }
                Ok(_) | Err(Error::Denied) => {}
                Err(error) => return Err(error),
            }
        }
        Err(Error::Denied)
    }
    pub(super) async fn bind_map_media(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        content: &str,
    ) -> Result<()> {
        let names = references(content)?;
        if names.is_empty() {
            return Ok(());
        }
        self.map_media_lock(tx).await?;
        for name in names {
            self.map_media_access(tx, user, &name).await?;
            tx.execute("INSERT INTO aether_access.map_media_refs(tenant,document,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", &[&self.tenant(), &id, &name]).await.map_err(db)?;
        }
        Ok(())
    }
    pub async fn map_media_read(&self, token: &str, name: &str) -> Result<Content> {
        if mime(name).is_none() {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, "map").await?;
        self.map_media_access(&tx, &user, name).await?;
        let content = self.map_media_content(&tx, &user, name).await?;
        commit(tx).await?;
        Ok(content)
    }
    pub(super) async fn map_media_content(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        name: &str,
    ) -> Result<Content> {
        let row = tx.query_opt("SELECT size,chunks FROM aether_access.map_media WHERE tenant=$1 AND name=$2 AND NOT deleted", &[&self.tenant(), &name]).await.map_err(db)?.ok_or(Error::Denied)?;
        let size = usize::try_from(row.get::<_, i64>(0)).map_err(|_| Error::Incompatible)?;
        Ok(Content::from_chunks(
            self.store.clone(),
            AuthorizedScope::new(self.tenant(), &user.id)?,
            chunks(row.get(1), size)?,
            size,
        ))
    }
    pub async fn map_media_delete(&self, token: &str, name: &str) -> Result<()> {
        if mime(name).is_none() {
            return Err(Error::Invalid);
        }
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, "map").await?;
        self.map_media_lock(&tx).await?;
        let row = tx
            .query_opt(
                "SELECT owner FROM aether_access.map_media WHERE tenant=$1 AND name=$2",
                &[&self.tenant(), &name],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Denied)?;
        if row.get::<_, String>(0) != user.id {
            return Err(Error::Denied);
        }
        if tx
            .query_opt(
                "SELECT 1 FROM aether_access.map_media_refs WHERE tenant=$1 AND name=$2 LIMIT 1",
                &[&self.tenant(), &name],
            )
            .await
            .map_err(db)?
            .is_some()
        {
            return Err(Error::Conflict);
        }
        let changed = tx.execute("UPDATE aether_access.map_media SET deleted=true WHERE tenant=$1 AND name=$2 AND NOT deleted", &[&self.tenant(), &name]).await.map_err(db)?;
        if changed > 0 {
            self.audit(&tx, &user, "map_media_delete", name).await?;
        }
        commit(tx).await
    }
}
