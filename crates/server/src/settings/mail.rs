//! Mail configuration and bounded, redacted delivery activity.
use super::*;
use crate::mail::{Change as MailChange, Configuration, Vault};
impl Settings {
    pub async fn mail_snapshot(&self) -> Result<Configuration> {
        let c = self.client().await?;
        let row = c
            .query_opt(
                "SELECT value FROM aether_settings.mail WHERE tenant=$1",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?;
        match row {
            None => Ok(Configuration::default()),
            Some(r) => serde_json::from_value(r.get(0)).map_err(|_| Error::Incompatible),
        }
    }
    pub async fn mail_read(&self, token: &str) -> Result<serde_json::Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        self.admin(&tx, token).await?;
        let row = tx
            .query_opt(
                "SELECT value FROM aether_settings.mail WHERE tenant=$1",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?;
        let config: Configuration = match row {
            Some(r) => serde_json::from_value(r.get(0)).map_err(|_| Error::Incompatible)?,
            None => Configuration::default(),
        };
        let value = config.public();
        tx.commit().await.map_err(db)?;
        Ok(value)
    }
    pub async fn mail_change(
        &self,
        token: &str,
        change: MailChange,
        vault: &Vault,
    ) -> Result<serde_json::Value> {
        change.validate()?;
        // Reject unauthorized callers before touching private credential storage.
        self.read(token).await?;
        let secret = if change.password.is_empty() {
            None
        } else {
            Some(vault.put(&change.password).await?)
        };
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let actor = self.admin(&tx, token).await?;
        self.lock(&tx).await?;
        let row = tx
            .query_opt(
                "SELECT value FROM aether_settings.mail WHERE tenant=$1",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?;
        let old: Configuration = match row {
            Some(r) => serde_json::from_value(r.get(0)).map_err(|_| Error::Incompatible)?,
            None => Configuration::default(),
        };
        // Do not silently send the previous provider's password to a new server.
        if change.password.is_empty()
            && !old.secret_id.is_empty()
            && (change.host != old.host
                || change.username != old.username
                || change.port != old.port
                || change.security != old.security)
        {
            return Err(Error::Invalid);
        }
        let mut config = change.configuration();
        config.secret_id = secret.unwrap_or(old.secret_id);
        tx.execute("INSERT INTO aether_settings.mail VALUES($1,$2) ON CONFLICT(tenant) DO UPDATE SET value=excluded.value", &[&self.tenant(),&serde_json::to_value(&config).map_err(|_|Error::Invalid)?]).await.map_err(db)?;
        tx.execute("INSERT INTO aether_settings.mail_events(tenant,actor,action) VALUES($1,$2,'mail_configured')", &[&self.tenant(),&actor]).await.map_err(db)?;
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)?;
        Ok(config.public())
    }
    pub async fn mail_event(&self, actor: &str, action: &'static str) -> Result<()> {
        if !matches!(
            action,
            "mail_test_sent"
                | "mail_test_failed"
                | "recovery_sent"
                | "recovery_failed"
                | "password_notice_sent"
                | "password_notice_failed"
        ) {
            return Err(Error::Invalid);
        }
        let c = self.client().await?;
        c.execute(
            "INSERT INTO aether_settings.mail_events(tenant,actor,action) VALUES($1,$2,$3)",
            &[&self.tenant(), &actor, &action],
        )
        .await
        .map_err(db)?;
        Ok(())
    }
    pub async fn mail_events(&self, token: &str) -> Result<serde_json::Value> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        self.admin(&tx, token).await?;
        let rows=tx.query("SELECT actor,action,EXTRACT(EPOCH FROM happened_at)::double precision FROM aether_settings.mail_events WHERE tenant=$1 ORDER BY happened_at DESC LIMIT 100", &[&self.tenant()]).await.map_err(db)?;
        let value=serde_json::json!(rows.iter().map(|r|serde_json::json!({"actor":r.get::<_,String>(0),"action":r.get::<_,String>(1),"time":r.get::<_,f64>(2)})).collect::<Vec<_>>());
        tx.commit().await.map_err(db)?;
        Ok(value)
    }
}
