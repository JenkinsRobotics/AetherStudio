//! Organization links confer a revocable, expiring visit, never a direct grant.
use super::{Documents, Error, Result, Role, commit, db, valid_id};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::time::Duration;

#[derive(Deserialize, Serialize)]
#[serde(tag = "action", deny_unknown_fields)]
pub enum Request {
    #[serde(rename = "link_create")]
    Create {
        id: String,
        role: String,
        days: u16,
        token: String,
        operation_id: String,
    },
    #[serde(rename = "link_revoke")]
    Revoke {
        id: String,
        link: String,
        operation_id: String,
    },
    #[serde(rename = "redeem")]
    Redeem { token: String },
}
fn token_hash(token: &str) -> Result<String> {
    let bytes = URL_SAFE_NO_PAD.decode(token).map_err(|_| Error::Invalid)?;
    if bytes.len() != 32 || URL_SAFE_NO_PAD.encode(&bytes) != token {
        return Err(Error::Invalid);
    }
    Ok(format!("{:x}", Sha256::digest(token.as_bytes())))
}
impl Documents {
    pub async fn drive_link(&self, session: &str, input: &Request) -> Result<Value> {
        match input {
            Request::Create {
                id,
                role,
                days,
                token,
                operation_id,
            } => {
                if !valid_id(id)
                    || !valid_id(operation_id)
                    || !matches!(role.as_str(), "viewer" | "editor")
                    || !(1..=365).contains(days)
                {
                    return Err(Error::Invalid);
                }
                token_hash(token)?;
            }
            Request::Revoke {
                id,
                link,
                operation_id,
            } => {
                if !valid_id(id) || !valid_id(link) || !valid_id(operation_id) {
                    return Err(Error::Invalid);
                }
            }
            Request::Redeem { token } => {
                token_hash(token)?;
            }
        }
        tokio::time::timeout(
            Duration::from_secs(20),
            self.drive_link_inner(session, input),
        )
        .await
        .map_err(|_| Error::OutcomeUnknown)?
    }
    async fn drive_link_inner(&self, session: &str, input: &Request) -> Result<Value> {
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let user = self.identity.authorize_transaction(&tx, session).await?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        self.app(&tx, &user, "drive").await?;
        if let Request::Redeem { token } = input {
            let hash = token_hash(token)?;
            let row=tx.query_opt("SELECT l.id,l.resource FROM aether_access.links l JOIN aether_access.link_credentials c ON c.tenant=l.tenant AND c.link=l.id WHERE l.tenant=$1 AND c.token_hash=$2 AND NOT l.revoked AND l.expires>clock_timestamp()",&[&self.tenant(),&hash]).await.map_err(db)?.ok_or(Error::Denied)?;
            let link: String = row.get(0);
            let id: String = row.get(1);
            let resource = self.resource(&tx, &id).await?.ok_or(Error::Denied)?;
            if self
                .member(&tx, &user.id, &resource.location.organization)
                .await?
                .is_none()
            {
                return Err(Error::Denied);
            }
            self.app(&tx, &user, &resource.app).await?;
            tx.execute("INSERT INTO aether_access.link_visits(tenant,link,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",&[&self.tenant(),&link,&user.id]).await.map_err(db)?;
            // Same transaction: hidden/trashed ancestors or an expired link roll
            // the visit back. This projection does not enroll organization members.
            let result = self.drive_entry(&tx, &user, &id, &mut 0).await?;
            commit(tx).await?;
            return Ok(result);
        }
        let (id, operation) = match input {
            Request::Create {
                id, operation_id, ..
            }
            | Request::Revoke {
                id, operation_id, ..
            } => (id, operation_id),
            _ => unreachable!(),
        };
        let resource = self.require(&tx, &user, id, Role::Owner).await?;
        self.app(&tx, &user, &resource.app).await?;
        let mut request = serde_json::to_value(input).map_err(|_| Error::Invalid)?;
        if let Request::Create { token, .. } = input {
            request.as_object_mut().unwrap().remove("token");
            request["token_hash"] = json!(token_hash(token)?);
        }
        let prior=tx.query_opt("SELECT request,receipt FROM aether_access.resource_receipts WHERE tenant=$1 AND actor=$2 AND operation_id=$3",&[&self.tenant(),&user.id,operation]).await.map_err(db)?;
        let replay = prior.is_some();
        let mut result = if let Some(row) = prior {
            if row.get::<_, Value>(0) != request {
                return Err(Error::Conflict);
            }
            row.get::<_, Value>(1)
        } else {
            let result = match input {
                Request::Create {
                    role, days, token, ..
                } => {
                    let count:i64=tx.query_one("SELECT (SELECT count(*) FROM aether_access.grants WHERE tenant=$1 AND resource=$2)+(SELECT count(*) FROM aether_access.links WHERE tenant=$1 AND resource=$2)",&[&self.tenant(),id]).await.map_err(db)?.get(0);
                    if count >= 1000 {
                        return Err(Error::Unsupported);
                    }
                    // Identity is deterministic for this actor's command, while
                    // the independent 256-bit capability is never stored in clear.
                    let link = format!(
                        "link-{:x}",
                        Sha256::digest(
                            serde_json::to_vec(&(self.tenant(), &user.id, operation))
                                .map_err(|_| Error::Invalid)?
                        )
                    );
                    let hash = token_hash(token)?;
                    let now: f64 = tx
                        .query_one(
                            "SELECT EXTRACT(EPOCH FROM clock_timestamp())::double precision",
                            &[],
                        )
                        .await
                        .map_err(db)?
                        .get(0);
                    let expires = now + f64::from(*days) * 86400.;
                    tx.execute("INSERT INTO aether_access.links(tenant,id,resource,role,expires) VALUES($1,$2,$3,$4,to_timestamp($5))",&[&self.tenant(),&link,id,role,&expires]).await.map_err(db)?;
                    tx.execute("INSERT INTO aether_access.link_credentials(tenant,link,token_hash,shared_by,created) VALUES($1,$2,$3,$4,$5)",&[&self.tenant(),&link,&hash,&user.id,&now]).await.map_err(|e|if e.code()==Some(&tokio_postgres::error::SqlState::UNIQUE_VIOLATION){Error::Conflict}else{db(e)})?;
                    self.audit(&tx, &user, "link_create", id).await?;
                    json!({"id":link,"operation_id":operation})
                }
                Request::Revoke { link, .. } => {
                    let changed=tx.execute("UPDATE aether_access.links SET revoked=true WHERE tenant=$1 AND resource=$2 AND id=$3 AND NOT revoked",&[&self.tenant(),id,link]).await.map_err(db)?;
                    if changed==0 && tx.query_opt("SELECT 1 FROM aether_access.links WHERE tenant=$1 AND resource=$2 AND id=$3",&[&self.tenant(),id,link]).await.map_err(db)?.is_none(){return Err(Error::Denied);}
                    if changed > 0 {
                        self.audit(&tx, &user, "link_revoke", id).await?;
                    }
                    json!({"ok":true,"id":id,"link":link,"operation_id":operation})
                }
                _ => unreachable!(),
            };
            tx.execute("INSERT INTO aether_access.resource_receipts(tenant,actor,operation_id,request,receipt) VALUES($1,$2,$3,$4,$5)",&[&self.tenant(),&user.id,operation,&request,&result]).await.map_err(db)?;
            result
        };
        if let Request::Create { token, .. } = input {
            let link = result["id"].as_str().ok_or(Error::Incompatible)?;
            let row=tx.query_opt("SELECT role,EXTRACT(EPOCH FROM expires)::double precision,revoked,expires>clock_timestamp() AND NOT revoked FROM aether_access.links WHERE tenant=$1 AND resource=$2 AND id=$3",&[&self.tenant(),id,&link]).await.map_err(db)?.ok_or(Error::Denied)?;
            result["role"] = json!(row.get::<_, String>(0));
            result["expires"] = json!(row.get::<_, f64>(1));
            result["revoked"] = json!(row.get::<_, bool>(2));
            result["active"] = json!(row.get::<_, bool>(3));
            // Replays never extend expiry, restore a revoked capability or reveal
            // another owner's plaintext. The caller supplies the same secret.
            result["url"] = json!(format!("/drive/?share={token}"));
        }
        result["replayed"] = json!(replay);
        commit(tx).await?;
        Ok(result)
    }
}
