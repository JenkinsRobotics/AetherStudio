//! Shared-file projection of the existing authority; never grants access.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use aether_identity::User;
use serde_json::{Map, Value, json};
use std::{collections::HashSet, time::Duration};
use tokio_postgres::Transaction;

impl Documents {
    pub async fn drive_sharing(
        &self,
        token: &str,
        input: &super::drive_items::Request,
    ) -> Result<Value> {
        if !valid_id(&input.id) {
            return Err(Error::Invalid);
        }
        tokio::time::timeout(
            Duration::from_secs(10),
            self.drive_sharing_inner(token, &input.id),
        )
        .await
        .map_err(|_| Error::Unavailable)?
    }
    async fn drive_sharing_inner(&self, token: &str, id: &str) -> Result<Value> {
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
        let resource = self.require(&tx, &user, id, Role::Owner).await?;
        self.app(&tx, &user, &resource.app).await?;
        let rows=tx.query("SELECT g.user_id,g.role,coalesce(nullif(u.full_name,''),u.username) FROM aether_access.grants g JOIN aether_identity.users u ON u.tenant=g.tenant AND u.id=g.user_id WHERE g.tenant=$1 AND g.resource=$2 ORDER BY g.user_id COLLATE \"C\" LIMIT 1001",&[&self.tenant(),&id]).await.map_err(db)?;
        let links=tx.query("SELECT id,role,EXTRACT(EPOCH FROM expires)::double precision,revoked FROM aether_access.links WHERE tenant=$1 AND resource=$2 ORDER BY id COLLATE \"C\" LIMIT 1001",&[&self.tenant(),&id]).await.map_err(db)?;
        if rows.len() + links.len() > 1000 {
            return Err(Error::Unsupported);
        }
        let grants:Vec<Value>=rows.into_iter().map(|row|json!({"user_id":row.get::<_,String>(0),"role":row.get::<_,String>(1),"name":row.get::<_,String>(2)})).collect();
        let links:Vec<Value>=links.into_iter().map(|row|json!({"id":row.get::<_,String>(0),"role":row.get::<_,String>(1),"expires":row.get::<_,f64>(2),"revoked":row.get::<_,bool>(3),"audience":"organization"})).collect();
        let result = json!({"grants":grants,"links":links});
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

    /// Called after the ordinary current ACL/app checks. Inherited grant facts
    /// may be shown, but private ancestor names and recipient lists never leave.
    pub(super) async fn drive_shared_metadata(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        id: &str,
        direction: &str,
    ) -> Result<Option<Map<String, Value>>> {
        let root = self.resource(tx, id).await?.ok_or(Error::Denied)?;
        let mut authored = root.owner == user.id && root.location.workspace.is_some();
        let mut next = Some(id.to_owned());
        let mut seen = HashSet::new();
        let mut scanned = 0usize;
        let mut candidates: Vec<(Option<f64>, Option<String>)> = Vec::new();
        while let Some(id) = next {
            if !seen.insert(id.clone()) || seen.len() > 128 {
                return Err(Error::Incompatible);
            }
            let resource = self.resource(tx, &id).await?.ok_or(Error::Incompatible)?;
            if resource.location.organization != root.location.organization {
                return Err(Error::Incompatible);
            }
            let grants=tx.query("SELECT g.user_id,p.shared_by,p.shared_at FROM aether_access.grants g JOIN aether_identity.users u ON u.tenant=g.tenant AND u.id=g.user_id AND u.active JOIN aether_access.members m ON m.tenant=g.tenant AND m.user_id=g.user_id AND m.organization=$3 LEFT JOIN aether_access.grant_provenance p ON p.tenant=g.tenant AND p.resource=g.resource AND p.user_id=g.user_id WHERE g.tenant=$1 AND g.resource=$2 AND g.user_id<>$4 ORDER BY g.user_id COLLATE \"C\" LIMIT 4097", &[&self.tenant(),&id,&root.location.organization,&resource.owner]).await.map_err(db)?;
            scanned += grants.len();
            if scanned > 4096 {
                return Err(Error::Unsupported);
            }
            for grant in grants {
                let recipient: String = grant.get(0);
                let by: Option<String> = grant.get(1);
                let at: Option<f64> = grant.get(2);
                let by_me = by
                    .as_ref()
                    .map_or(resource.owner == user.id, |v| v == &user.id);
                authored |= by_me;
                if (direction == "by" && by_me) || (direction == "with" && recipient == user.id) {
                    candidates.push((at, by));
                }
            }
            let links=tx.query("SELECT c.shared_by,c.created,EXISTS(SELECT 1 FROM aether_access.link_visits v WHERE v.tenant=l.tenant AND v.link=l.id AND v.user_id=$3) FROM aether_access.links l LEFT JOIN aether_access.link_credentials c ON c.tenant=l.tenant AND c.link=l.id WHERE l.tenant=$1 AND l.resource=$2 AND NOT l.revoked AND l.expires>clock_timestamp() LIMIT 4097", &[&self.tenant(),&id,&user.id]).await.map_err(db)?;
            scanned += links.len();
            if scanned > 4096 {
                return Err(Error::Unsupported);
            }
            for link in links {
                let by: Option<String> = link.get(0);
                let at: Option<f64> = link.get(1);
                let by_me = by
                    .as_ref()
                    .map_or(resource.owner == user.id, |v| v == &user.id);
                authored |= by_me;
                if (direction == "by" && by_me) || (direction == "with" && link.get::<_, bool>(2)) {
                    candidates.push((at, by));
                }
            }
            next = resource.location.parent;
        }
        let included = if direction == "by" {
            authored
        } else {
            root.owner != user.id
        };
        if !included {
            return Ok(None);
        }
        candidates.sort_by(|a, b| a.0.unwrap_or(0.0).total_cmp(&b.0.unwrap_or(0.0)));
        let (at, by) = candidates.pop().unwrap_or((None, None));
        let name = if let Some(by) = by {
            tx.query_opt("SELECT coalesce(nullif(full_name,''),username) FROM aether_identity.users WHERE tenant=$1 AND id=$2", &[&self.tenant(),&by]).await.map_err(db)?.map(|row| row.get::<_,String>(0))
        } else {
            None
        };
        let mut result = Map::new();
        result.insert("shared_at".into(), json!(at));
        result.insert("shared_by".into(), json!(name));
        Ok(Some(result))
    }
}
