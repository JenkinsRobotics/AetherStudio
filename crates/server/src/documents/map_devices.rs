//! Studio-owned player credentials and deployment authorization, not playback.
mod announce;
mod cast;
pub use cast::PlayerSignal;
mod playback;
use super::{Documents, Error, Result, Role, commit, db};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tokio_postgres::Transaction;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceKind {
    Player,
    LiveReceiver,
}
impl DeviceKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Player => "player",
            Self::LiveReceiver => "live_receiver",
        }
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Announcement {
    pub device_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub pairing_secret: String,
    #[serde(default)]
    pub kind: Option<DeviceKind>,
}
#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    List,
    #[serde(rename = "cast-start")]
    CastStart {
        device_id: String,
        sdp: String,
    },
    #[serde(rename = "cast-poll")]
    CastPoll {
        device_id: String,
        session_id: String,
    },
    #[serde(rename = "cast-stop")]
    CastStop {
        device_id: String,
        session_id: String,
    },
    Claim {
        code: String,
    },
    Rename {
        device_id: String,
        name: String,
    },
    Assign {
        device_id: String,
        document: Option<String>,
    },
    Forget {
        device_id: String,
    },
}
fn digest(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
fn random() -> Result<[u8; 32]> {
    let mut bytes = [0; 32];
    getrandom::fill(&mut bytes).map_err(|_| Error::Unavailable)?;
    Ok(bytes)
}
fn credential() -> Result<String> {
    Ok(format!(
        "aether_dev_{}",
        random()?
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    ))
}
fn id_valid(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
// Lock order: identity -> tenant ACL -> device registry. The registry lock makes
// pairing-code allocation, claiming, revocation and device caps atomic across hosts.
impl Documents {
    async fn map_registry(&self, tx: &Transaction<'_>) -> Result<()> {
        tx.batch_execute("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'")
            .await
            .map_err(db)?;
        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062604))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062618))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        let enabled = tx
            .query_opt(
                "SELECT 1 FROM aether_access.applications WHERE tenant=$1 AND id='map' AND enabled",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?
            .is_some();
        if !enabled {
            return Err(Error::Denied);
        }
        Ok(())
    }
    async fn map_limit(&self, tx: &Transaction<'_>, bucket: &str, limit: i32) -> Result<bool> {
        let row = tx.query_one("INSERT INTO aether_access.map_device_limits(tenant,bucket,started,attempts) VALUES($1,$2,clock_timestamp(),1) ON CONFLICT(tenant,bucket) DO UPDATE SET started=CASE WHEN map_device_limits.started<clock_timestamp()-interval '1 minute' THEN clock_timestamp() ELSE map_device_limits.started END, attempts=CASE WHEN map_device_limits.started<clock_timestamp()-interval '1 minute' THEN 1 ELSE least(map_device_limits.attempts+1,10000) END RETURNING attempts", &[&self.tenant(), &bucket]).await.map_err(db)?;
        Ok(row.get::<_, i32>(0) <= limit)
    }
    async fn map_show_resource(
        &self,
        tx: &Transaction<'_>,
        user: &aether_identity::User,
        id: &str,
    ) -> Result<()> {
        let resource = self.require(tx, user, id, Role::Viewer).await?;
        if resource.app != "map" || resource.kind != "document" {
            return Err(Error::Denied);
        }
        Ok(())
    }
    pub async fn map_device_action(&self, token: &str, input: &Request) -> Result<Value> {
        if self.delegation.is_some() {
            return Err(Error::Denied);
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
        self.map_registry(&tx).await?;
        if matches!(input, Request::List) {
            let rows = tx.query("SELECT id,name,owner,extract(epoch from seen)::float8,document,kind FROM aether_access.map_devices WHERE tenant=$1 ORDER BY name,id", &[&self.tenant()]).await.map_err(db)?;
            let devices: Vec<Value> = rows.iter().map(|r| {
                let owner: Option<String> = r.get(2);
                let mine = owner.as_deref() == Some(&user.id);
                json!({"kind":r.get::<_,String>(5),"id":r.get::<_,String>(0),"name":r.get::<_,String>(1),"mine":mine,"claimed":owner.is_some(),"seen":r.get::<_,f64>(3),"document":if mine {r.get::<_,Option<String>>(4)} else {None}})
            }).collect();
            commit(tx).await?;
            return Ok(json!({"devices":devices}));
        }
        if let Request::Claim { code } = input {
            if !self
                .map_limit(&tx, &format!("claim:{}", user.id), 12)
                .await?
            {
                commit(tx).await?;
                return Err(aether_identity::Error::Throttled.into());
            }
            let row = if code.len() == 6 && code.bytes().all(|b| b.is_ascii_digit()) {
                tx.query_opt("UPDATE aether_access.map_devices SET owner=$2,code=NULL WHERE tenant=$1 AND code=$3 AND owner IS NULL AND code_expires>clock_timestamp() RETURNING id,name", &[&self.tenant(), &user.id, &code]).await.map_err(db)?
            } else {
                None
            };
            let Some(row) = row else {
                commit(tx).await?; // Failed guesses must still consume the attempt.
                return Err(Error::Denied);
            };
            let id: String = row.get(0);
            self.audit(&tx, &user, "map_device_claim", &id).await?;
            commit(tx).await?;
            return Ok(json!({"device_id":id,"name":row.get::<_,String>(1),"claimed":true}));
        }
        let id = match input {
            Request::Rename { device_id, .. }
            | Request::Assign { device_id, .. }
            | Request::Forget { device_id }
            | Request::CastStart { device_id, .. }
            | Request::CastPoll { device_id, .. }
            | Request::CastStop { device_id, .. } => device_id,
            _ => unreachable!(),
        };
        if !id_valid(id) {
            return Err(Error::Invalid);
        }
        let owned = tx
            .query_opt(
                "SELECT kind FROM aether_access.map_devices WHERE tenant=$1 AND id=$2 AND owner=$3",
                &[&self.tenant(), &id, &user.id],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Denied)?;
        let kind: String = owned.get(0);
        if matches!(
            input,
            Request::CastStart { .. } | Request::CastPoll { .. } | Request::CastStop { .. }
        ) {
            let result = self.map_owner_cast(&tx, id, input).await?;
            if !matches!(input, Request::CastPoll { .. }) {
                self.audit(
                    &tx,
                    &user,
                    if matches!(input, Request::CastStart { .. }) {
                        "map_cast_start"
                    } else {
                        "map_cast_stop"
                    },
                    id,
                )
                .await?;
            }
            commit(tx).await?;
            return Ok(result);
        }
        let (action, result) = match input {
            Request::Rename { name, .. } => {
                let name = name.trim();
                if name.is_empty()
                    || name.chars().count() > 80
                    || name.chars().any(char::is_control)
                {
                    return Err(Error::Invalid);
                }
                tx.execute(
                    "UPDATE aether_access.map_devices SET name=$3 WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), &id, &name],
                )
                .await
                .map_err(db)?;
                ("map_device_rename", json!({"device_id":id,"name":name}))
            }
            Request::Assign { document, .. } => {
                let document = document.as_deref().filter(|id| !id.is_empty());
                if let Some(document) = document {
                    if kind != "player" {
                        return Err(Error::Invalid);
                    }
                    self.map_show_resource(&tx, &user, document).await?;
                }
                tx.execute("UPDATE aether_access.map_devices SET document=$3,deployed=clock_timestamp() WHERE tenant=$1 AND id=$2", &[&self.tenant(), &id, &document]).await.map_err(db)?;
                (
                    "map_device_assign",
                    json!({"device_id":id,"document":document}),
                )
            }
            Request::Forget { .. } => {
                tx.execute(
                    "DELETE FROM aether_access.map_devices WHERE tenant=$1 AND id=$2",
                    &[&self.tenant(), &id],
                )
                .await
                .map_err(db)?;
                (
                    "map_device_forget",
                    json!({"device_id":id,"forgotten":true}),
                )
            }
            _ => unreachable!(),
        };
        self.audit(&tx, &user, action, id).await?;
        commit(tx).await?;
        Ok(result)
    }
}
