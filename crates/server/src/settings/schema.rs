use super::*;
use sha2::{Digest, Sha256};
const SCHEMA: &str = include_str!("schema.sql");
const MAIL: &str = include_str!("002-mail.sql");
const BACKUPS: &str = include_str!("003-backups.sql");
const NETWORK: &str = include_str!("004-network.sql");
fn checksum(version: i32) -> String {
    let mut hash = Sha256::new();
    hash.update(SCHEMA);
    if version >= 2 {
        hash.update(MAIL);
    }
    if version >= 3 {
        hash.update(BACKUPS);
    }
    if version >= 4 {
        hash.update(NETWORK);
    }
    format!("{:x}", hash.finalize())
}
async fn check(tx: &Transaction<'_>) -> Result<i32> {
    let exists: bool = tx
        .query_one(
            "SELECT to_regclass('aether_settings.schema_state') IS NOT NULL",
            &[],
        )
        .await
        .map_err(db)?
        .get(0);
    if !exists {
        return Err(Error::Incompatible);
    }
    let rows = tx
        .query(
            "SELECT version,checksum FROM aether_settings.schema_state",
            &[],
        )
        .await
        .map_err(db)?;
    if rows.len() != 1
        || !matches!(rows[0].get::<_, i32>(0), 1..=4)
        || rows[0].get::<_, String>(1) != checksum(rows[0].get(0))
    {
        return Err(Error::Incompatible);
    }
    Ok(rows[0].get(0))
}
impl Settings {
    /// Explicit operator migration. Seeds a tenant once; never overwrites saved data.
    pub async fn migrate(&self, seed: &Presentation) -> Result<()> {
        self.identity.check_schema().await?;
        let seed = Presentation::parse(&serde_json::to_vec(seed).map_err(|_| Error::Invalid)?)
            .map_err(|_| Error::Invalid)?;
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        deadlines(&tx).await?;
        tx.execute("SELECT pg_advisory_xact_lock(1095062605)", &[])
            .await
            .map_err(db)?;
        let exists: bool = tx
            .query_one("SELECT to_regnamespace('aether_settings') IS NOT NULL", &[])
            .await
            .map_err(db)?
            .get(0);
        let version = if exists {
            check(&tx).await?
        } else {
            tx.batch_execute(SCHEMA).await.map_err(db)?;
            tx.execute(
                "INSERT INTO aether_settings.schema_state VALUES(true,1,$1)",
                &[&checksum(1)],
            )
            .await
            .map_err(db)?;
            1
        };
        if version < 2 {
            tx.batch_execute(MAIL).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_settings.schema_state SET version=2,checksum=$1",
                &[&checksum(2)],
            )
            .await
            .map_err(db)?;
        }
        if version < 3 {
            tx.batch_execute(BACKUPS).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_settings.schema_state SET version=3,checksum=$1",
                &[&checksum(3)],
            )
            .await
            .map_err(db)?;
        }
        if version < 4 {
            tx.batch_execute(NETWORK).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_settings.schema_state SET version=4,checksum=$1",
                &[&checksum(4)],
            )
            .await
            .map_err(db)?;
        }
        tx.execute("INSERT INTO aether_settings.presentation(tenant,revision,value) VALUES($1,1,$2) ON CONFLICT DO NOTHING", &[&self.tenant(),&serde_json::to_value(seed).map_err(|_| Error::Invalid)?]).await.map_err(db)?;
        self.read_in(&tx).await?;
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)
    }
    /// Startup is read-only and refuses unknown schemas or malformed saved data.
    pub async fn check_schema(&self) -> Result<()> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        deadlines(&tx).await?;
        if check(&tx).await? != 4 {
            return Err(Error::Incompatible);
        }
        self.read_in(&tx).await?;
        tx.commit().await.map_err(db)
    }
}
