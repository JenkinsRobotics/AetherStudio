//! Read-only journal projection. Historical events never replace current access.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{collections::HashMap, time::Duration};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub organization: Option<String>,
    pub file: Option<String>,
}
impl Documents {
    pub async fn drive_activity(&self, token: &str, input: &Request) -> Result<Value> {
        let org = input.organization.as_deref().unwrap_or("default");
        if !valid_id(org) || input.file.as_ref().is_some_and(|f| !valid_id(f)) {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(10),
            self.drive_activity_inner(token, input, org),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }
    async fn drive_activity_inner(&self, token: &str, input: &Request, org: &str) -> Result<Value> {
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
        if org != "all" && self.member(&tx, &user.id, org).await?.is_none() {
            return Err(Error::Denied);
        }
        if let Some(id) = &input.file {
            let r = self
                .require_resource(&tx, &user, id, Role::Viewer, true)
                .await?;
            self.app(&tx, &user, &r.app).await?;
            if org != "all" && r.location.organization != org {
                return Err(Error::Denied);
            }
        }
        // Import journal and native audit remain canonical, distinct sources.
        // Imported document revisions already have their own history and are not
        // fabricated into duplicate Drive events. Native folder import markers
        // are likewise excluded from the user-facing journal.
        let rows=tx.query(r#"
WITH events AS (
 SELECT 'legacy:'||e.id::text AS id,e.organization,e.file_id,e.actor,e.action,e.created,e.detail
 FROM aether_access.legacy_drive_events e WHERE e.tenant=$1
 UNION ALL
 SELECT 'access:'||a.id::text,r.organization,r.id,a.actor,a.action,EXTRACT(EPOCH FROM a.happened_at)::double precision,''
 FROM aether_access.audit a JOIN aether_access.resources r ON r.tenant=a.tenant AND r.id=a.target
 WHERE a.tenant=$1 AND a.action IN ('link_create','link_revoke','copy','create_folder','grant','rename_folder','move','trash','restore','version_created','version_updated','version_deleted','version_candidate','version_released','version_obsolete','version_version')
 AND NOT (a.action='create_folder' AND EXISTS(SELECT 1 FROM aether_access.legacy_drive_imported_folders l WHERE l.tenant=a.tenant AND l.resource=a.target))
 UNION ALL
 SELECT 'document:'||a.operation_id,r.organization,r.id,a.actor,a.event,a.saved_unix_ms::double precision/1000.0,''
 FROM aether_store.audit a JOIN aether_access.resources r ON r.tenant=a.tenant AND r.id=a.document_id
 WHERE a.tenant=$1 AND NOT EXISTS(SELECT 1 FROM aether_access.legacy_history_annotations h WHERE h.tenant=a.tenant AND h.document_id=a.document_id AND h.revision=a.revision)
)
SELECT e.*,coalesce(nullif(u.full_name,''),u.username) FROM events e
JOIN aether_access.members m ON m.tenant=$1 AND m.organization=e.organization AND m.user_id=$2
JOIN aether_identity.users u ON u.tenant=$1 AND u.id=e.actor
WHERE ($3='all' OR e.organization=$3) AND ($4::text IS NULL OR e.file_id=$4)
ORDER BY e.created DESC,e.id COLLATE "C" DESC LIMIT 4097
"#,&[&self.tenant(),&user.id,&org,&input.file]).await.map_err(db)?;
        if rows.len() > 4096 {
            return Err(Error::Unsupported);
        }
        let limit = if input.file.is_some() { 20 } else { 500 };
        let mut events = Vec::new();
        let mut allowed: HashMap<(String, Option<String>), bool> = HashMap::new();
        for row in rows {
            let organization: String = row.get(1);
            let file: Option<String> = row.get(2);
            let key = (organization.clone(), file.clone());
            let visible = if let Some(v) = allowed.get(&key) {
                *v
            } else {
                let v = if let Some(id) = &file {
                    match self
                        .require_resource(&tx, &user, id, Role::Viewer, true)
                        .await
                    {
                        Ok(r) => {
                            r.location.organization == organization
                                && match self.app(&tx, &user, &r.app).await {
                                    Ok(()) => true,
                                    Err(Error::Denied) => false,
                                    Err(e) => return Err(e),
                                }
                        }
                        Err(Error::Denied) => false,
                        Err(e) => return Err(e),
                    }
                } else {
                    self.member(&tx, &user.id, &organization).await?.as_deref() == Some("owner")
                };
                allowed.insert(key, v);
                v
            };
            if !visible {
                continue;
            }
            events.push(json!({"id":row.get::<_,String>(0),"organization":organization,"file_id":file,"actor":row.get::<_,String>(3),"action":row.get::<_,String>(4),"created":row.get::<_,f64>(5),"detail":row.get::<_,String>(6),"author":row.get::<_,String>(7)}));
            if events.len() == limit {
                break;
            }
        }
        let result = json!({"events":events});
        if serde_json::to_vec(&result)
            .map_err(|_| Error::Incompatible)?
            .len()
            > 4 * 1024 * 1024
        {
            return Err(Error::Unsupported);
        }
        commit(tx).await?;
        Ok(result)
    }
}
