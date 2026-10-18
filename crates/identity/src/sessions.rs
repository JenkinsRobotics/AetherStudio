use super::*;

impl Identity {
    pub async fn sign_in(&self, account: &str, value: &str, address: &str) -> Result<Secret> {
        if account.len() > 1024 || value.len() > 1024 || address.len() > 256 {
            return Err(Error::InvalidInput);
        }
        let permit = self.permit()?;
        let account: String = account.trim().to_lowercase().chars().take(254).collect();
        let keys = attempt_keys(&account, address);
        let snapshot = {
            let mut client = self.client().await?;
            let tx = client.transaction().await.map_err(pg)?;
            deadlines(&tx).await?;
            // Reservations count failures, abandoned requests and in-flight attempts.
            // Locks have a stable order across hosts. Expired counts restart atomically.
            for key in &keys {
                tx.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062602))",
                    &[&format!("{}:{key}", self.tenant)],
                )
                .await
                .map_err(pg)?;
                let row=tx.query_opt("SELECT count FROM aether_identity.attempts WHERE tenant=$1 AND key=$2 AND until>clock_timestamp()",&[&self.tenant,key]).await.map_err(pg)?;
                if row.is_some_and(|r| r.get::<_, i32>(0) >= 10) {
                    return Err(Error::Throttled);
                }
            }
            for key in &keys {
                tx.execute("INSERT INTO aether_identity.attempts VALUES($1,$2,1,clock_timestamp()+interval '15 minutes') ON CONFLICT(tenant,key) DO UPDATE SET count=CASE WHEN aether_identity.attempts.until<=clock_timestamp() THEN 1 ELSE aether_identity.attempts.count+1 END,until=clock_timestamp()+interval '15 minutes'",&[&self.tenant,key]).await.map_err(pg)?;
            }
            let row=tx.query_opt("SELECT id,password FROM aether_identity.users WHERE tenant=$1 AND (username=$2 OR (email<>'' AND email=$2))",&[&self.tenant,&account]).await.map_err(pg)?;
            let snapshot = row.map(|r| (r.get::<_, String>(0), r.get::<_, String>(1)));
            commit(tx).await?;
            snapshot
        };
        let encoded = snapshot
            .as_ref()
            .map(|(_, digest)| digest.as_str())
            .unwrap_or(DUMMY);
        let valid = Self::check(permit, value, encoded.to_string()).await?;
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let accepted = if let Some((uid, digest)) = &snapshot {
            valid && tx.query_opt("SELECT 1 FROM aether_identity.users WHERE tenant=$1 AND id=$2 AND password=$3 AND active",&[&self.tenant,uid,digest]).await.map_err(pg)?.is_some()
        } else {
            false
        };
        if !accepted {
            self.audit(&tx, &account, "sign_in_failed", "").await?;
            commit(tx).await?;
            return Err(Error::InvalidCredentials);
        }
        let (uid, _) = snapshot.expect("accepted existing user");
        // Do not clear reservations belonging to other in-flight requests. A
        // success cancels only its own reservation, preserving brute-force counts.
        for key in &keys {
            tx.execute("UPDATE aether_identity.attempts SET count=GREATEST(count-1,0) WHERE tenant=$1 AND key=$2",&[&self.tenant,key]).await.map_err(pg)?;
        }
        tx.execute(
            "DELETE FROM aether_identity.sessions WHERE tenant=$1 AND expires<=clock_timestamp()",
            &[&self.tenant],
        )
        .await
        .map_err(pg)?;
        let token = random_hex::<32>()?;
        tx.execute("INSERT INTO aether_identity.sessions(tenant,token_hash,user_id,expires) VALUES($1,$2,$3,clock_timestamp()+interval '12 hours')",&[&self.tenant,&sha256(token.as_bytes()),&uid]).await.map_err(pg)?;
        self.audit(&tx, &uid, "sign_in", "").await?;
        commit(tx).await?;
        Ok(Secret(Zeroizing::new(token)))
    }
    pub async fn authenticate(&self, token: &str) -> Result<User> {
        let client = self.client().await?;
        self.user(&**client, token).await
    }
    pub async fn sign_out(&self, token: &str) -> Result<()> {
        if token.len() > 256 {
            return Err(Error::InvalidInput);
        }
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        tx.execute(
            "DELETE FROM aether_identity.sessions WHERE tenant=$1 AND token_hash=$2",
            &[&self.tenant, &sha256(token.as_bytes())],
        )
        .await
        .map_err(pg)?;
        commit(tx).await
    }
}
