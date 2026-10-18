//! Saved-show export snapshots. Product worker owns Map geometry and text;
//! Studio alone resolves current file authority and immutable media manifests.
use super::{download::Content, map_media::references, *};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;
use serde_json::json;

pub const MAX_BUNDLE: usize = 1024 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExportDescription {
    pub folder: String,
    pub svg: String,
    pub readme: String,
    pub media: Vec<String>,
}
pub struct MapExport {
    pub description: ExportDescription,
    pub document: Vec<u8>,
    pub media: Vec<(String, Content)>,
}
impl Documents {
    pub async fn map_export(&self, token: &str, id: &str, bundle: bool) -> Result<MapExport> {
        let (name, revision, content, _) = self.map_export_snapshot(token, id, None, false).await?;
        let bytes = STANDARD.decode(&content).map_err(|_| Error::Incompatible)?;
        let text = std::str::from_utf8(&bytes).map_err(|_| Error::Invalid)?;
        let result = self
            .product_service(
                token,
                "map",
                "/api/map/project-export",
                &json!({"name":name,"content":text}),
            )
            .await?;
        let description: ExportDescription =
            serde_json::from_value(result).map_err(|_| Error::Incompatible)?;
        let referenced = references(&content)?;
        if description.folder.is_empty()
            || description.folder.len() > 80
            || description.folder.starts_with([' ', '.'])
            || description.folder.ends_with([' ', '.'])
            || !description
                .folder
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b" _.-".contains(&b))
            || description.svg.len() > 8 * 1024 * 1024
            || description.readme.len() > 1024 * 1024
            || description.media.len() != referenced.len()
            || description
                .media
                .iter()
                .cloned()
                .collect::<std::collections::BTreeSet<_>>()
                != referenced
        {
            return Err(Error::Incompatible);
        }
        // Recheck permissions and revision after worker execution; gather every
        // media manifest in this same transaction. No locks survive export I/O.
        let (_, _, _, media) = self
            .map_export_snapshot(token, id, Some(revision), bundle)
            .await?;
        let size = media.iter().try_fold(
            bytes.len() * 2 + description.svg.len() + description.readme.len(),
            |total, (_, value)| total.checked_add(value.len()).ok_or(Error::TooLarge),
        )?;
        if size > MAX_BUNDLE {
            return Err(Error::TooLarge);
        }
        Ok(MapExport {
            description,
            document: bytes,
            media,
        })
    }
    async fn map_export_snapshot(
        &self,
        token: &str,
        id: &str,
        expected: Option<u32>,
        media: bool,
    ) -> Result<(String, u32, String, Vec<(String, Content)>)> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.begin(&tx, token, false).await?;
        self.app(&tx, &user, "map").await?;
        let resource = self.require(&tx, &user, id, Role::Viewer).await?;
        if resource.app != "map" || resource.kind != "document" {
            return Err(Error::Denied);
        }
        let saved = self
            .store
            .read_in(
                &tx,
                &AuthorizedScope::new(self.tenant(), &user.id)?,
                id,
                None,
            )
            .await?;
        if expected.is_some_and(|revision| revision != saved.document.revision) {
            return Err(Error::Conflict);
        }
        let mut assets = Vec::new();
        if media {
            for name in references(&saved.content_base64)? {
                // The current authorized document must retain this exact name.
                if tx.query_opt("SELECT 1 FROM aether_access.map_media_refs WHERE tenant=$1 AND document=$2 AND name=$3", &[&self.tenant(), &id, &name]).await.map_err(db)?.is_none() { return Err(Error::Incompatible); }
                let content = self.map_media_content(&tx, &user, &name).await?;
                assets.push((name, content));
            }
        }
        commit(tx).await?;
        Ok((
            saved.document.name,
            saved.document.revision,
            saved.content_base64,
            assets,
        ))
    }
}
