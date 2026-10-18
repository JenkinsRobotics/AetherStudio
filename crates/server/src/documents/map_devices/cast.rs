use super::*;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlayerSignal {
    pub session_id: String,
    pub sdp: Option<String>,
    pub state: Option<String>,
}
fn validate_sdp(value: &str) -> Result<()> {
    if !value.starts_with("v=0") || value.len() > 65536 {
        return Err(Error::Invalid);
    }
    Ok(())
}
impl Documents {
    async fn map_cast_current(
        &self,
        tx: &Transaction<'_>,
        id: &str,
        hash: &str,
    ) -> Result<Option<tokio_postgres::Row>> {
        // Reuse the row for the next lease; bounded by the device registry. A
        // credential rotation immediately invalidates a previous mirror session.
        tx.query_opt("SELECT session_id,offer,answer,state FROM aether_access.map_cast WHERE tenant=$1 AND device_id=$2 AND token_hash=$3 AND expires>clock_timestamp()", &[&self.tenant(), &id, &hash]).await.map_err(db)
    }
    pub(super) async fn map_owner_cast(
        &self,
        tx: &Transaction<'_>,
        id: &str,
        input: &Request,
    ) -> Result<Value> {
        let hash: Option<String> = tx
            .query_one(
                "SELECT token_hash FROM aether_access.map_devices WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &id],
            )
            .await
            .map_err(db)?
            .get(0);
        let hash = hash.ok_or(Error::Conflict)?;
        let current = self.map_cast_current(tx, id, &hash).await?;
        if let Request::CastStart { sdp, .. } = input {
            validate_sdp(sdp)?;
            if current.is_some() {
                return Err(Error::Conflict);
            }
            let session = credential()?.trim_start_matches("aether_dev_").to_owned();
            tx.execute("INSERT INTO aether_access.map_cast(tenant,device_id,session_id,token_hash,offer,state,expires) VALUES($1,$2,$3,$4,$5,'waiting',clock_timestamp()+interval '20 seconds') ON CONFLICT(tenant,device_id) DO UPDATE SET session_id=excluded.session_id,token_hash=excluded.token_hash,offer=excluded.offer,answer=NULL,state=excluded.state,expires=excluded.expires", &[&self.tenant(), &id, &session, &hash, &sdp]).await.map_err(db)?;
            return Ok(json!({"session_id":session,"answer":null,"state":"waiting"}));
        }
        let session = match input {
            Request::CastPoll { session_id, .. } | Request::CastStop { session_id, .. } => {
                session_id
            }
            _ => return Err(Error::Invalid),
        };
        let current = current
            .filter(|r| r.get::<_, String>(0) == *session)
            .ok_or(Error::Conflict)?;
        if matches!(input, Request::CastStop { .. }) {
            tx.execute(
                "DELETE FROM aether_access.map_cast WHERE tenant=$1 AND device_id=$2",
                &[&self.tenant(), &id],
            )
            .await
            .map_err(db)?;
            return Ok(json!({"stopped":true}));
        }
        tx.execute("UPDATE aether_access.map_cast SET expires=clock_timestamp()+interval '20 seconds' WHERE tenant=$1 AND device_id=$2", &[&self.tenant(), &id]).await.map_err(db)?;
        let answer: Option<String> = current.get(2);
        Ok(
            json!({"session_id":session,"answer":answer.map(|sdp|json!({"type":"answer","sdp":sdp})),"state":current.get::<_,String>(3)}),
        )
    }
    pub async fn map_player_cast(
        &self,
        token: &str,
        input: Option<&PlayerSignal>,
    ) -> Result<Value> {
        if let Some(input) = input {
            if input.session_id.len() > 128 || input.state.as_ref().is_some_and(|s| s.len() > 32) {
                return Err(Error::Invalid);
            }
            if let Some(sdp) = &input.sdp {
                validate_sdp(sdp)?;
            }
        }
        let hash = digest(token);
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        tx.batch_execute("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'")
            .await
            .map_err(db)?;
        let owner:String=tx.query_opt("SELECT owner FROM aether_access.map_devices WHERE tenant=$1 AND token_hash=$2 AND owner IS NOT NULL", &[&self.tenant(), &hash]).await.map_err(db)?.ok_or(aether_identity::Error::Unauthorized)?.get(0);
        let user = self
            .identity
            .authorize_service_account_in(&tx, &owner)
            .await?;
        self.map_registry(&tx).await?;
        self.app(&tx, &user, "map").await?;
        let id:String=tx.query_opt("SELECT id FROM aether_access.map_devices WHERE tenant=$1 AND token_hash=$2 AND owner=$3", &[&self.tenant(), &hash, &owner]).await.map_err(db)?.ok_or(aether_identity::Error::Unauthorized)?.get(0);
        let current = self.map_cast_current(&tx, &id, &hash).await?;
        if let Some(input) = input {
            if !current
                .as_ref()
                .is_some_and(|r| r.get::<_, String>(0) == input.session_id)
            {
                return Err(Error::Conflict);
            }
            let state = input
                .state
                .as_deref()
                .filter(|s| matches!(*s, "connecting" | "connected" | "failed" | "disconnected"));
            tx.execute("UPDATE aether_access.map_cast SET answer=coalesce($3,answer),state=coalesce($4,state) WHERE tenant=$1 AND device_id=$2", &[&self.tenant(), &id, &input.sdp, &state]).await.map_err(db)?;
        }
        // Player heartbeats do not extend the lease; only the editor keeps it live.
        let result = json!({"session":current.map(|r|json!({"id":r.get::<_,String>(0),"offer":{"type":"offer","sdp":r.get::<_,String>(1)}}))});
        commit(tx).await?;
        Ok(result)
    }
}
