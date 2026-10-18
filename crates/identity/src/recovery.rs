use super::*;

/// Trusted delivery adapter projection, never returned by public account APIs.
pub struct RecoveryDelivery {
    pub id: String,
    pub username: String,
    pub email: String,
}
impl Identity {
    pub async fn recovery_delivery(&self, token: &str) -> Result<Option<RecoveryDelivery>> {
        if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::InvalidRecovery);
        }
        let c = self.client().await?;
        let row=c.query_opt("SELECT u.id,u.username,u.email FROM aether_identity.users u JOIN aether_identity.recovery r ON r.tenant=u.tenant AND r.user_id=u.id WHERE u.tenant=$1 AND u.active AND u.email<>'' AND r.token_hash=$2 AND r.expires>clock_timestamp()", &[&self.tenant,&sha256(token.as_bytes())]).await.map_err(pg)?;
        Ok(row.map(|r| RecoveryDelivery {
            id: r.get(0),
            username: r.get(1),
            email: r.get(2),
        }))
    }

    /// Trusted mail-delivery boundary only. Never return the Option/token from a
    /// public recovery endpoint (its response must be generic for unknown users).
    /// Host supplies actual peer address, never a caller-provided forwarded value.
    pub async fn request_recovery(&self, account: &str, address: &str) -> Result<Option<Secret>> {
        if account.len() > 1024 || address.len() > 256 {
            return Err(Error::InvalidInput);
        }
        let account: String = account.trim().to_lowercase().chars().take(254).collect();
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        self.lock(&tx).await?;
        let keys = vec![
            (format!("recovery:account:{account}"), 3),
            (format!("recovery:ip:{address}"), 20),
        ];
        for (key, limit) in &keys {
            if tx.query_opt("SELECT 1 FROM aether_identity.attempts WHERE tenant=$1 AND key=$2 AND count >= $3 AND until>clock_timestamp()",&[&self.tenant,key,limit]).await.map_err(pg)?.is_some() {return Ok(None);}
        }
        for (key, _) in &keys {
            tx.execute("INSERT INTO aether_identity.attempts VALUES($1,$2,1,clock_timestamp()+interval '15 minutes') ON CONFLICT(tenant,key) DO UPDATE SET count=CASE WHEN aether_identity.attempts.until<=clock_timestamp() THEN 1 ELSE aether_identity.attempts.count+1 END,until=CASE WHEN aether_identity.attempts.until<=clock_timestamp() THEN excluded.until ELSE aether_identity.attempts.until END",&[&self.tenant,key]).await.map_err(pg)?;
        }
        let row=tx.query_opt("SELECT id FROM aether_identity.users WHERE tenant=$1 AND active AND email<>'' AND (username=$2 OR email=$2)",&[&self.tenant,&account]).await.map_err(pg)?;
        let token = if let Some(row) = row {
            let uid: String = row.get(0);
            let token = random_hex::<32>()?;
            tx.execute("INSERT INTO aether_identity.recovery VALUES($1,$2,$3,clock_timestamp()+interval '30 minutes') ON CONFLICT(tenant,user_id) DO UPDATE SET token_hash=excluded.token_hash,expires=excluded.expires",&[&self.tenant,&sha256(token.as_bytes()),&uid]).await.map_err(pg)?;
            self.audit(&tx, &uid, "recovery_requested", "").await?;
            Some(Secret(Zeroizing::new(token)))
        } else {
            None
        };
        commit(tx).await?;
        Ok(token)
    }
    pub async fn recover_password(&self, token: &str, value: &str) -> Result<()> {
        if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::InvalidRecovery);
        }
        // Refuse invalid reset tokens before allocating password hash work.
        let digest = sha256(token.as_bytes());
        {
            let client = self.client().await?;
            if self.recovery_user(&**client, &digest).await?.is_none() {
                return Err(Error::InvalidRecovery);
            }
        }
        let password = self.hash(value).await?;
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        self.lock(&tx).await?;
        let uid = self
            .recovery_user(&*tx, &digest)
            .await?
            .ok_or(Error::InvalidRecovery)?;
        self.replace_password(&tx, &uid, &password, false, true)
            .await?;
        self.audit(&tx, &uid, "password_recovered", &uid).await?;
        commit(tx).await
    }
    async fn recovery_user<C: GenericClient + Sync>(
        &self,
        c: &C,
        digest: &str,
    ) -> Result<Option<String>> {
        Ok(c.query_opt("SELECT u.id FROM aether_identity.users u JOIN aether_identity.recovery r ON r.tenant=u.tenant AND r.user_id=u.id WHERE u.tenant=$1 AND u.active AND r.token_hash=$2 AND r.expires>clock_timestamp()",&[&self.tenant,&digest]).await.map_err(pg)?.map(|r|r.get(0)))
    }
}
