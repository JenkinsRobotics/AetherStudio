//! Studio-owned display settings. Network listeners and TLS remain operator-owned.
//! Every write holds current identity authority through its audited commit.
pub mod backups;
pub mod mail;
pub mod network;
mod schema;
use crate::native::presentation::{Presentation, Theme};
use aether_identity::{Identity, Role};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio_postgres::Transaction;

#[derive(Debug)]
pub enum Error {
    Identity(aether_identity::Error),
    Invalid,
    Conflict,
    Unavailable,
    Incompatible,
    OutcomeUnknown,
}
impl From<aether_identity::Error> for Error {
    fn from(value: aether_identity::Error) -> Self {
        Self::Identity(value)
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Server settings operation failed.")
    }
}
impl std::error::Error for Error {}
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone)]
pub struct Settings {
    pool: Pool,
    identity: Identity,
}
#[derive(Debug, Serialize)]
pub struct Snapshot {
    pub revision: i64,
    pub presentation: Presentation,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Change {
    pub expected_revision: i64,
    pub presentation: Presentation,
}
impl Settings {
    /// Both arguments must refer to the same Studio database.
    pub fn new(pool: Pool, identity: Identity) -> Self {
        Self { pool, identity }
    }
    fn tenant(&self) -> &str {
        self.identity.tenant()
    }
    async fn client(&self) -> Result<deadpool_postgres::Object> {
        tokio::time::timeout(Duration::from_secs(5), self.pool.get())
            .await
            .map_err(|_| Error::Unavailable)?
            .map_err(|_| Error::Unavailable)
    }
    async fn lock(&self, tx: &Transaction<'_>) -> Result<()> {
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062605))",
            &[&self.tenant()],
        )
        .await
        .map_err(db)?;
        Ok(())
    }
    async fn read_in(&self, tx: &Transaction<'_>) -> Result<Snapshot> {
        let row = tx
            .query_opt(
                "SELECT revision,value FROM aether_settings.presentation WHERE tenant=$1",
                &[&self.tenant()],
            )
            .await
            .map_err(db)?
            .ok_or(Error::Incompatible)?;
        let value: serde_json::Value = row.get(1);
        let presentation =
            Presentation::parse(&serde_json::to_vec(&value).map_err(|_| Error::Incompatible)?)
                .map_err(|_| Error::Incompatible)?;
        let revision = row.get(0);
        if revision < 1 {
            return Err(Error::Incompatible);
        }
        Ok(Snapshot {
            revision,
            presentation,
        })
    }
    /// Only nonsecret name/theme metadata is exposed publicly through status.
    pub async fn snapshot(&self) -> Result<Snapshot> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        deadlines(&tx).await?;
        let value = self.read_in(&tx).await?;
        tx.commit().await.map_err(db)?;
        Ok(value)
    }
    pub async fn read(&self, token: &str) -> Result<Snapshot> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        self.admin(&tx, token).await?;
        let value = self.read_in(&tx).await?;
        tx.commit().await.map_err(db)?;
        Ok(value)
    }
    async fn admin(&self, tx: &Transaction<'_>, token: &str) -> Result<String> {
        let user = self.identity.authorize_transaction(tx, token).await?;
        if user.role != Role::Admin {
            return Err(aether_identity::Error::Forbidden.into());
        }
        Ok(user.id)
    }
    pub async fn change(&self, token: &str, change: &Change) -> Result<Snapshot> {
        self.write(token, Some(change), None).await
    }
    /// Legacy theme writes serialize with guarded saves, preserving the name.
    pub async fn theme(&self, token: &str, theme: &Theme) -> Result<Snapshot> {
        let theme = theme.normalized().map_err(|_| Error::Invalid)?;
        self.write(token, None, Some(&theme)).await
    }
    async fn write(
        &self,
        token: &str,
        change: Option<&Change>,
        theme: Option<&Theme>,
    ) -> Result<Snapshot> {
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        let actor = self.admin(&tx, token).await?;
        self.lock(&tx).await?;
        let current = self.read_in(&tx).await?;
        let mut next = current.presentation;
        let action = if let Some(change) = change {
            if change.expected_revision != current.revision {
                return Err(Error::Conflict);
            }
            next = change.presentation.clone();
            "presentation_updated"
        } else {
            next.theme = theme.ok_or(Error::Invalid)?.clone();
            "theme_updated"
        };
        let raw = serde_json::to_vec(&next).map_err(|_| Error::Invalid)?;
        let next = Presentation::parse(&raw).map_err(|_| Error::Invalid)?;
        let revision = current.revision.checked_add(1).ok_or(Error::Conflict)?;
        let value = serde_json::to_value(&next).map_err(|_| Error::Invalid)?;
        tx.execute(
            "UPDATE aether_settings.presentation SET revision=$2,value=$3 WHERE tenant=$1",
            &[&self.tenant(), &revision, &value],
        )
        .await
        .map_err(db)?;
        tx.execute(
            "INSERT INTO aether_settings.audit(tenant,revision,actor,action) VALUES($1,$2,$3,$4)",
            &[&self.tenant(), &revision, &actor, &action],
        )
        .await
        .map_err(db)?;
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)?;
        Ok(Snapshot {
            revision,
            presentation: next,
        })
    }
}
fn db(_: tokio_postgres::Error) -> Error {
    Error::Unavailable
}
async fn deadlines(tx: &Transaction<'_>) -> Result<()> {
    tx.batch_execute("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'")
        .await
        .map_err(db)
}
