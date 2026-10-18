use super::*;

pub struct PreparedBootstrap {
    account: NewAccount,
    digest: String,
}

impl Identity {
    /// Explicit local-operator action. Atomically refuses a second initialization.
    pub async fn bootstrap(&self, account: &NewAccount, value: &str) -> Result<User> {
        let prepared = self.prepare_bootstrap(account, value).await?;
        let mut client = self.client().await?;
        let tx = client
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(pg)?;
        let user = self.bootstrap_in(&tx, &prepared).await?;
        commit(tx).await?;
        Ok(user)
    }
    /// Trusted local setup adapter: hash outside the SQL transaction. This is not
    /// authorization; the host must prove possession of its private setup key.
    pub async fn prepare_bootstrap(
        &self,
        account: &NewAccount,
        value: &str,
    ) -> Result<PreparedBootstrap> {
        if account.role != Role::Admin || account.must_change {
            return Err(Error::InvalidInput);
        }
        let account = normalize_account(account)?;
        let digest = self.hash(value).await?;
        Ok(PreparedBootstrap { account, digest })
    }
    /// Caller holds READ COMMITTED on this identity database. Initialization of
    /// the administrator, presentation and app policy can then commit atomically.
    pub async fn bootstrap_in(
        &self,
        tx: &Transaction<'_>,
        prepared: &PreparedBootstrap,
    ) -> Result<User> {
        let isolation: String = tx
            .query_one("SHOW transaction_isolation", &[])
            .await
            .map_err(pg)?
            .get(0);
        if isolation != "read committed" {
            return Err(Error::InvalidInput);
        }
        self.lock(tx).await?;
        if tx
            .query_opt(
                "SELECT 1 FROM aether_identity.users WHERE tenant=$1 LIMIT 1",
                &[&self.tenant],
            )
            .await
            .map_err(pg)?
            .is_some()
        {
            return Err(Error::Conflict);
        }
        let user = self.insert(tx, &prepared.account, &prepared.digest).await?;
        self.audit(tx, &user.id, "bootstrap", &user.id).await?;
        Ok(user)
    }
    pub async fn create_user(
        &self,
        admin_token: &str,
        account: &NewAccount,
        value: &str,
    ) -> Result<User> {
        // Reject invalid authority before expensive work, then reauthorize at commit.
        let admin = self.authenticate(admin_token).await?;
        if admin.role != Role::Admin || admin.must_change {
            return Err(Error::Forbidden);
        }
        let account = normalize_account(account)?;
        let digest = self.hash(value).await?;
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let admin = self.admin(&tx, admin_token).await?;
        let user = self.insert(&tx, &account, &digest).await?;
        self.audit(&tx, &admin.id, "user_created", &user.id).await?;
        commit(tx).await?;
        Ok(user)
    }
    pub async fn revoke_sessions(&self, admin_token: &str, target: &str) -> Result<()> {
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let admin = self.admin(&tx, admin_token).await?;
        self.revoke(&tx, target).await?;
        self.audit(&tx, &admin.id, "revoke_sessions", target)
            .await?;
        commit(tx).await
    }
    pub async fn set_account_state(
        &self,
        admin_token: &str,
        target: &str,
        role: Role,
        active: bool,
    ) -> Result<()> {
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let admin = self.admin(&tx, admin_token).await?;
        if admin.id == target && (role != Role::Admin || !active) {
            return Err(Error::Conflict);
        }
        let changed = tx
            .execute(
                "UPDATE aether_identity.users SET role=$3,active=$4 WHERE tenant=$1 AND id=$2",
                &[&self.tenant, &target, &role.sql(), &active],
            )
            .await
            .map_err(pg)?;
        if changed != 1 {
            return Err(Error::Forbidden);
        }
        self.revoke(&tx, target).await?;
        tx.execute(
            "DELETE FROM aether_identity.recovery WHERE tenant=$1 AND user_id=$2",
            &[&self.tenant, &target],
        )
        .await
        .map_err(pg)?;
        self.audit(&tx, &admin.id, "account_state", target).await?;
        commit(tx).await
    }
    pub async fn reset_password(&self, admin_token: &str, target: &str, value: &str) -> Result<()> {
        let admin = self.authenticate(admin_token).await?;
        if admin.role != Role::Admin || admin.must_change || admin.id == target {
            return Err(Error::Forbidden);
        }
        let digest = self.hash(value).await?;
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let admin = self.admin(&tx, admin_token).await?;
        if admin.id == target {
            return Err(Error::Forbidden);
        }
        self.replace_password(&tx, target, &digest, true, false)
            .await?;
        self.audit(&tx, &admin.id, "reset_password", target).await?;
        commit(tx).await
    }
    /// Own-account password change requires the current password, including for
    /// sessions flagged must_change. All sessions (this one included) are revoked.
    pub async fn change_password(&self, token: &str, old: &str, new: &str) -> Result<()> {
        let user = self.authenticate(token).await?;
        let digest = {
            let client = self.client().await?;
            client
                .query_one(
                    "SELECT password FROM aether_identity.users WHERE tenant=$1 AND id=$2",
                    &[&self.tenant, &user.id],
                )
                .await
                .map_err(pg)?
                .get::<_, String>(0)
        };
        if !Self::check(self.permit()?, old, digest.clone()).await? {
            return Err(Error::InvalidCredentials);
        }
        let replacement = self.hash(new).await?;
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let current = self.user(&*tx, token).await?;
        if current.id != user.id
            || tx
                .query_opt(
                    "SELECT 1 FROM aether_identity.users WHERE tenant=$1 AND id=$2 AND password=$3",
                    &[&self.tenant, &user.id, &digest],
                )
                .await
                .map_err(pg)?
                .is_none()
        {
            return Err(Error::Unauthorized);
        }
        self.replace_password(&tx, &user.id, &replacement, false, false)
            .await?;
        self.audit(&tx, &user.id, "password_changed", &user.id)
            .await?;
        commit(tx).await
    }
    pub async fn update_identity(&self, token: &str, full_name: &str, email: &str) -> Result<User> {
        let (name, email) = normalize_identity(full_name, email)?;
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let user = self.user(&*tx, token).await?;
        if user.must_change {
            return Err(Error::Forbidden);
        }
        let updated = self
            .write_identity(&tx, &user, &name, &email, token)
            .await?;
        commit(tx).await?;
        Ok(updated)
    }
    /// Browser profile changes require password confirmation and recheck that
    /// credential under the same commit lock as account/password changes.
    pub async fn update_profile(
        &self,
        token: &str,
        current_password: &str,
        full_name: &str,
        email: &str,
    ) -> Result<User> {
        let (name, email) = normalize_identity(full_name, email)?;
        let user = self.authenticate(token).await?;
        if user.must_change {
            return Err(Error::Forbidden);
        }
        let digest = {
            let client = self.client().await?;
            client
                .query_one(
                    "SELECT password FROM aether_identity.users WHERE tenant=$1 AND id=$2",
                    &[&self.tenant, &user.id],
                )
                .await
                .map_err(pg)?
                .get::<_, String>(0)
        };
        if !Self::check(self.permit()?, current_password, digest.clone()).await? {
            return Err(Error::InvalidCredentials);
        }
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let current = self.user(&*tx, token).await?;
        if current.must_change
            || current.id != user.id
            || tx
                .query_opt(
                    "SELECT 1 FROM aether_identity.users WHERE tenant=$1 AND id=$2 AND password=$3",
                    &[&self.tenant, &user.id, &digest],
                )
                .await
                .map_err(pg)?
                .is_none()
        {
            return Err(Error::Unauthorized);
        }
        let updated = self
            .write_identity(&tx, &current, &name, &email, token)
            .await?;
        commit(tx).await?;
        Ok(updated)
    }

    async fn write_identity(
        &self,
        tx: &Transaction<'_>,
        user: &User,
        name: &str,
        email: &str,
        token: &str,
    ) -> Result<User> {
        tx.execute("UPDATE aether_identity.users SET full_name=$3,email=$4,email_verified=CASE WHEN email=$4 THEN email_verified ELSE false END WHERE tenant=$1 AND id=$2",&[&self.tenant,&user.id,&name,&email]).await.map_err(pg)?;
        if user.email != email {
            tx.execute(
                "DELETE FROM aether_identity.recovery WHERE tenant=$1 AND user_id=$2",
                &[&self.tenant, &user.id],
            )
            .await
            .map_err(pg)?;
        }
        self.audit(tx, &user.id, "identity_changed", &user.id)
            .await?;
        let updated = self.user(tx, token).await?;
        Ok(updated)
    }
}
