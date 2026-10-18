//! Recycle presentation projects structural events without rewriting file history.
use super::{Documents, Error, Result, Role, db};
use aether_identity::User;
use serde_json::{Map, Value, json};
use tokio_postgres::Transaction;
impl Documents {
    pub(super) async fn drive_recycle_metadata(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
    ) -> Result<Map<String, Value>> {
        let resource = self
            .require_resource(tx, user, id, Role::Viewer, true)
            .await?;
        let deleted=tx.query_opt("SELECT EXTRACT(EPOCH FROM e.happened_at)::double precision,coalesce(nullif(u.full_name,''),u.username) FROM aether_access.resource_events e JOIN aether_identity.users u ON u.tenant=e.tenant AND u.id=e.actor WHERE e.tenant=$1 AND e.resource=$2 AND e.before_state->>'trashed'='false' AND e.after_state->>'trashed'='true' ORDER BY revision DESC LIMIT 1",&[&self.tenant(),&id]).await.map_err(db)?;
        let deleted = if deleted.is_some() {
            deleted
        } else {
            tx.query_opt("SELECT e.created,coalesce(nullif(u.full_name,''),u.username) FROM aether_access.legacy_drive_events e JOIN aether_identity.users u ON u.tenant=e.tenant AND u.id=e.actor WHERE e.tenant=$1 AND e.file_id=$2 AND e.organization=$3 AND e.action='trash' ORDER BY e.id DESC LIMIT 1", &[&self.tenant(), &id, &resource.location.organization]).await.map_err(db)?
        };
        let mut root = if resource.owner == user.id {
            "My files".to_owned()
        } else {
            "Shared files".to_owned()
        };
        if let Some(workspace) = &resource.location.workspace
            && self
                .workspace_role(tx, &user.id, &resource.location.organization, workspace)
                .await?
                .is_some()
        {
            root = tx
                .query_one(
                    "SELECT name FROM aether_access.workspaces WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), workspace],
                )
                .await
                .map_err(db)?
                .get(0);
        }
        let mut parts = Vec::new();
        let mut next = resource.location.parent;
        // require_resource already validates complete acyclic ancestry.
        while let Some(parent) = next {
            let ancestor = match self
                .require_resource(tx, user, &parent, Role::Viewer, true)
                .await
            {
                Ok(v) => v,
                Err(Error::Denied) => {
                    root = "Shared files".into();
                    break;
                }
                Err(e) => return Err(e),
            };
            match self.app(tx, user, &ancestor.app).await {
                Ok(()) => (),
                Err(Error::Denied) => {
                    root = "Shared files".into();
                    break;
                }
                Err(error) => return Err(error),
            }
            let name:String=tx.query_one("SELECT coalesce(folder_name,id) FROM aether_access.resources WHERE tenant=$1 AND id=$2",&[&self.tenant(),&parent]).await.map_err(db)?.get(0);
            parts.push(name);
            next = ancestor.location.parent;
        }
        parts.reverse();
        parts.insert(0, root);
        let mut result = Map::new();
        result.insert("original_location".into(), json!(parts.join(" > ")));
        result.insert(
            "deleted_at".into(),
            json!(deleted.as_ref().map(|r| r.get::<_, f64>(0))),
        );
        result.insert(
            "deleted_by".into(),
            json!(deleted.as_ref().map(|r| r.get::<_, String>(1))),
        );
        // Unknown facts remain null; no time/author inferred from modified/owner.
        Ok(result)
    }
}
