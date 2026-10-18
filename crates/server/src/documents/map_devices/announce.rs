use super::*;
impl Documents {
    pub async fn map_announce(&self, input: &Announcement, token: Option<&str>) -> Result<Value> {
        if !id_valid(&input.device_id)
            || input.name.chars().count() > 80
            || input.name.chars().any(char::is_control)
            || (token.is_none() && !(32..=256).contains(&input.pairing_secret.len()))
            || input.pairing_secret.len() > 256
        {
            return Err(Error::Invalid);
        }
        let name = if input.name.trim().is_empty() {
            &input.device_id
        } else {
            input.name.trim()
        };
        let proof = digest(&input.pairing_secret);
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
        // Snapshot only selects which account to lock. Recheck it under the registry
        // lock before changing anything; a concurrent claim/forget cannot authorize us.
        let owner: Option<String> = tx
            .query_opt(
                "SELECT owner FROM aether_access.map_devices WHERE tenant=$1 AND id=$2",
                &[&self.tenant(), &input.device_id],
            )
            .await
            .map_err(db)?
            .and_then(|r| r.get(0));
        let user = if let Some(owner) = &owner {
            Some(
                self.identity
                    .authorize_service_account_in(&tx, owner)
                    .await?,
            )
        } else {
            None
        };
        self.map_registry(&tx).await?;
        if let Some(user) = &user {
            self.app(&tx, user, "map").await?;
        }
        if !self.map_limit(&tx, "announcements", 1024).await? {
            commit(tx).await?;
            return Err(aether_identity::Error::Throttled.into());
        }
        let row = tx.query_opt("SELECT owner,pairing_hash,token_hash,code,code_expires>clock_timestamp(),kind FROM aether_access.map_devices WHERE tenant=$1 AND id=$2", &[&self.tenant(), &input.device_id]).await.map_err(db)?;
        if let Some(row) = &row {
            if row.get::<_, Option<String>>(0) != owner {
                return Err(Error::Conflict);
            }
            let known: Option<String> = row.get(2);
            let token_matches = token
                .zip(known.as_deref())
                .is_some_and(|(t, h)| digest(t) == h);
            if row.get::<_, String>(1) != proof && !token_matches {
                commit(tx).await?;
                return Err(aether_identity::Error::Unauthorized.into());
            }
            if input
                .kind
                .is_some_and(|kind| kind.as_str() != row.get::<_, String>(5))
            {
                return Err(Error::Conflict);
            }
            if let Some(user) = &user {
                // Never store a plaintext bearer. A proof-only recovery rotates it;
                // normal heartbeat with the existing bearer keeps that credential.
                let next = if token_matches {
                    token.unwrap().to_owned()
                } else {
                    credential()?
                };
                tx.execute("UPDATE aether_access.map_devices SET name=$3,seen=clock_timestamp(),token_hash=$4 WHERE tenant=$1 AND id=$2", &[&self.tenant(), &input.device_id, &name, &digest(&next)]).await.map_err(db)?;
                commit(tx).await?;
                return Ok(
                    json!({"device_id":input.device_id,"kind":row.get::<_,String>(5),"claimed":true,"owner":user.username,"token":next}),
                );
            }
        } else {
            if !(32..=256).contains(&input.pairing_secret.len()) {
                return Err(Error::Invalid);
            }
            let count: i64 = tx
                .query_one(
                    "SELECT count(*) FROM aether_access.map_devices WHERE tenant=$1",
                    &[&self.tenant()],
                )
                .await
                .map_err(db)?
                .get(0);
            if count >= 64 {
                commit(tx).await?;
                return Err(Error::Conflict);
            }
        }
        let valid_code: Option<String> = row
            .as_ref()
            .filter(|r| r.get::<_, bool>(4))
            .and_then(|r| r.get(3));
        let code = if let Some(code) = valid_code {
            code
        } else {
            self.map_pairing_code(&tx).await?
        };
        let kind = input.kind.unwrap_or(DeviceKind::Player).as_str();
        tx.execute("INSERT INTO aether_access.map_devices(tenant,id,name,pairing_hash,code,code_expires,kind) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '10 minutes',$6) ON CONFLICT(tenant,id) DO UPDATE SET name=excluded.name,seen=clock_timestamp(),code=excluded.code,code_expires=CASE WHEN map_devices.code=excluded.code THEN map_devices.code_expires ELSE excluded.code_expires END", &[&self.tenant(), &input.device_id, &name, &proof, &code, &kind]).await.map_err(db)?;
        commit(tx).await?;
        Ok(
            json!({"device_id":input.device_id,"kind":row.as_ref().map(|r|r.get::<_,String>(5)).unwrap_or_else(||kind.to_owned()),"claimed":false,"code":code}),
        )
    }
    async fn map_pairing_code(&self, tx: &Transaction<'_>) -> Result<String> {
        for _ in 0..16 {
            let bytes = random()?;
            let n = u32::from_le_bytes(bytes[..4].try_into().expect("four bytes"));
            // Rejection sampling avoids modulo bias in a short human-entered code.
            if n >= u32::MAX - u32::MAX % 1_000_000 {
                continue;
            }
            let code = format!("{:06}", n % 1_000_000);
            if tx
                .query_opt(
                    "SELECT 1 FROM aether_access.map_devices WHERE tenant=$1 AND code=$2",
                    &[&self.tenant(), &code],
                )
                .await
                .map_err(db)?
                .is_none()
            {
                return Ok(code);
            }
        }
        Err(Error::Unavailable)
    }
}
