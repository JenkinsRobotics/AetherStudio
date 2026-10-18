//! Studio-only identity authority. No HTTP routes or standalone app dependency.
//! The host must choose the tenant from deployment configuration, never a request
//! body. Bootstrap is an operator-only provisioner, never an anonymous web API.
mod accounts;
pub use accounts::PreparedBootstrap;
pub mod automation;
pub mod oauth;
mod password;
mod preferences;
pub use preferences::{DisplayUser, PreferencePatch, Preferences};
mod recovery;
pub use recovery::RecoveryDelivery;
mod sessions;
mod status;
pub use status::SessionStatus;

use deadpool_postgres::Pool;
use password::{random_hex, sha256};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tokio_postgres::{GenericClient, Row, Transaction};
use zeroize::Zeroizing;

const SCHEMA: &str = include_str!("schema.sql");
const SCHEMA2: &str = include_str!("schema2.sql");
const SCHEMA3: &str = include_str!("schema3.sql");
const SCHEMA4: &str = include_str!("schema4.sql");
const SCHEMA5: &str = include_str!("schema5.sql");
fn schema_checksum() -> String {
    sha256(format!("{SCHEMA}{SCHEMA2}{SCHEMA3}{SCHEMA4}{SCHEMA5}").as_bytes())
}
const USER_COLUMNS: &str =
    "u.id,u.username,u.role,u.active,u.must_change,u.full_name,u.email,u.email_verified";
// Same work as an existing v1 credential for unknown usernames. Not a credential.
const DUMMY: &str = "scrypt-v1$17$8$1$00112233445566778899aabbccddeeff00$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum Error {
    #[error("Invalid account input.")]
    InvalidInput,
    #[error("Username or password is incorrect.")]
    InvalidCredentials,
    #[error("This operation is not permitted.")]
    Forbidden,
    #[error("Sign in again.")]
    Unauthorized,
    #[error("Account already exists or operation conflicts with current state.")]
    Conflict,
    #[error("Too many attempts. Try again in 15 minutes.")]
    Throttled,
    #[error("Identity service is busy. Try again later.")]
    Busy,
    #[error("Identity storage is unavailable.")]
    Unavailable,
    #[error("Identity schema is incompatible.")]
    Incompatible,
    #[error("This reset link has expired or already been used.")]
    InvalidRecovery,
    #[error("Commit outcome is unknown. Check current state before retrying.")]
    OutcomeUnknown,
}
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Admin,
    Member,
}
impl Role {
    fn sql(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Member => "member",
        }
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub role: Role,
    pub active: bool,
    pub must_change: bool,
    pub full_name: String,
    pub email: String,
    pub email_verified: bool,
}
#[derive(Debug, Clone)]
pub struct NewAccount {
    pub username: String,
    pub role: Role,
    pub must_change: bool,
    pub full_name: String,
    pub email: String,
}
/// Secrets deliberately do not implement Serialize, Clone or a revealing Debug.
pub struct Secret(Zeroizing<String>);
impl Secret {
    pub fn expose(&self) -> &str {
        &self.0
    }
}
impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Secret([redacted])")
    }
}
#[derive(Clone)]
pub struct Identity {
    pool: Pool,
    tenant: String,
    hashing: Arc<Semaphore>,
}
impl Identity {
    /// Reuse one instance (or clones) per process so the hash-memory limit applies.
    /// Each new hash uses ~128 MiB; 1–8 concurrent jobs, no unbounded waiting queue.
    pub fn new(pool: Pool, tenant: impl Into<String>, hash_jobs: usize) -> Result<Self> {
        let tenant = tenant.into();
        if tenant.is_empty()
            || tenant.len() > 128
            || !tenant
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_: .".contains(&b))
            || !(1..=8).contains(&hash_jobs)
        {
            return Err(Error::InvalidInput);
        }
        Ok(Self {
            pool,
            tenant,
            hashing: Arc::new(Semaphore::new(hash_jobs)),
        })
    }
    pub fn tenant(&self) -> &str {
        &self.tenant
    }

    /// Studio services use this in the SAME transaction as protected work.
    /// The shared identity lock orders that work against revocation/password/
    /// account changes. Hold the transaction through authorization and commit.
    /// Caller must use the configured identity database and READ COMMITTED.
    pub async fn authorize_transaction(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        token: &str,
    ) -> Result<User> {
        self.read_lock(tx).await?;
        let user = self.user(tx, token).await?;
        if user.must_change {
            return Err(Error::Forbidden);
        }
        Ok(user)
    }

    /// Trusted Studio services only, after independently verifying a device credential.
    /// This checks the account, not a session or a device. The caller must also
    /// lock/revalidate that credential and restrict access to its assigned resource.
    pub async fn authorize_service_account_in(
        &self,
        tx: &Transaction<'_>,
        id: &str,
    ) -> Result<User> {
        self.read_lock(tx).await?;
        let sql = format!(
            "SELECT {USER_COLUMNS} FROM aether_identity.users u WHERE u.tenant=$1 AND u.id=$2 AND u.active"
        );
        let row = tx
            .query_opt(&sql, &[&self.tenant, &id])
            .await
            .map_err(pg)?
            .ok_or(Error::Unauthorized)?;
        let user = row_user(&row)?;
        if user.must_change {
            return Err(Error::Forbidden);
        }
        Ok(user)
    }

    async fn read_lock(&self, tx: &Transaction<'_>) -> Result<()> {
        deadlines(tx).await?;
        let isolation: String = tx
            .query_one("SHOW transaction_isolation", &[])
            .await
            .map_err(pg)?
            .get(0);
        if isolation != "read committed" {
            return Err(Error::Incompatible);
        }

        tx.execute(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,1095062603))",
            &[&self.tenant],
        )
        .await
        .map_err(pg)?;
        Ok(())
    }

    async fn client(&self) -> Result<deadpool_postgres::Object> {
        let client = tokio::time::timeout(Duration::from_secs(5), self.pool.get())
            .await
            .map_err(|_| Error::Busy)?
            .map_err(|_| Error::Busy)?;
        // Identity owns this pool. Bound reads as well as transaction statements.
        tokio::time::timeout(
            Duration::from_secs(5),
            client.batch_execute("SET default_transaction_isolation='read committed'; SET statement_timeout='5s'; SET lock_timeout='3s'"),
        )
        .await
        .map_err(|_| Error::Busy)?
        .map_err(pg)?;
        Ok(client)
    }
    pub async fn migrate(&self) -> Result<()> {
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        deadlines(&tx).await?;
        tx.execute("SELECT pg_advisory_xact_lock(1095062601)", &[])
            .await
            .map_err(pg)?;
        let exists: bool = tx
            .query_one("SELECT to_regnamespace('aether_identity') IS NOT NULL", &[])
            .await
            .map_err(pg)?
            .get(0);
        let checksum = sha256(SCHEMA.as_bytes());
        if exists {
            let marker: bool = tx
                .query_one(
                    "SELECT to_regclass('aether_identity.schema_state') IS NOT NULL",
                    &[],
                )
                .await
                .map_err(pg)?
                .get(0);
            if !marker {
                return Err(Error::Incompatible);
            }
            let rows = tx
                .query(
                    "SELECT version,checksum FROM aether_identity.schema_state",
                    &[],
                )
                .await
                .map_err(pg)?;
            if rows.len() != 1
                || !matches!(rows[0].get::<_, i32>(0), 1..=5)
                || rows[0].get::<_, String>(1)
                    != if rows[0].get::<_, i32>(0) == 1 {
                        checksum.clone()
                    } else if rows[0].get::<_, i32>(0) == 2 {
                        sha256(format!("{SCHEMA}{SCHEMA2}").as_bytes())
                    } else if rows[0].get::<_, i32>(0) == 3 {
                        sha256(format!("{SCHEMA}{SCHEMA2}{SCHEMA3}").as_bytes())
                    } else if rows[0].get::<_, i32>(0) == 4 {
                        sha256(format!("{SCHEMA}{SCHEMA2}{SCHEMA3}{SCHEMA4}").as_bytes())
                    } else {
                        schema_checksum()
                    }
            {
                return Err(Error::Incompatible);
            }
        } else {
            tx.batch_execute(SCHEMA).await.map_err(pg)?;
            tx.execute(
                "INSERT INTO aether_identity.schema_state VALUES(true,1,$1)",
                &[&checksum],
            )
            .await
            .map_err(pg)?;
        }
        let version: i32 = tx
            .query_one("SELECT version FROM aether_identity.schema_state", &[])
            .await
            .map_err(pg)?
            .get(0);
        if version == 1 {
            tx.batch_execute(SCHEMA2).await.map_err(pg)?;
            tx.execute(
                "UPDATE aether_identity.schema_state SET version=2,checksum=$1",
                &[&sha256(format!("{SCHEMA}{SCHEMA2}").as_bytes())],
            )
            .await
            .map_err(pg)?;
        }
        if version <= 2 {
            tx.batch_execute(SCHEMA3).await.map_err(pg)?;
            tx.execute(
                "UPDATE aether_identity.schema_state SET version=3,checksum=$1",
                &[&sha256(format!("{SCHEMA}{SCHEMA2}{SCHEMA3}").as_bytes())],
            )
            .await
            .map_err(pg)?;
        }
        if version <= 3 {
            tx.batch_execute(SCHEMA4).await.map_err(pg)?;
            tx.execute(
                "UPDATE aether_identity.schema_state SET version=4,checksum=$1",
                &[&sha256(
                    format!("{SCHEMA}{SCHEMA2}{SCHEMA3}{SCHEMA4}").as_bytes(),
                )],
            )
            .await
            .map_err(pg)?;
        }
        if version <= 4 {
            tx.batch_execute(SCHEMA5).await.map_err(pg)?;
            tx.execute(
                "UPDATE aether_identity.schema_state SET version=5,checksum=$1",
                &[&schema_checksum()],
            )
            .await
            .map_err(pg)?;
        }
        commit(tx).await
    }
    /// Read-only startup check; serving never implicitly creates or upgrades SQL.
    pub async fn check_schema(&self) -> Result<()> {
        let client = self.client().await?;
        let exists: bool = client
            .query_one(
                "SELECT to_regclass('aether_identity.schema_state') IS NOT NULL",
                &[],
            )
            .await
            .map_err(pg)?
            .get(0);
        if !exists {
            return Err(Error::Incompatible);
        }
        let rows = client
            .query(
                "SELECT version,checksum FROM aether_identity.schema_state",
                &[],
            )
            .await
            .map_err(pg)?;
        if rows.len() != 1
            || rows[0].get::<_, i32>(0) != 5
            || rows[0].get::<_, String>(1) != schema_checksum()
        {
            return Err(Error::Incompatible);
        }
        Ok(())
    }
    fn permit(&self) -> Result<OwnedSemaphorePermit> {
        self.hashing
            .clone()
            .try_acquire_owned()
            .map_err(|_| Error::Busy)
    }
    async fn hash(&self, value: &str) -> Result<String> {
        password::validate(value)?;
        let permit = self.permit()?;
        let value = Zeroizing::new(value.to_string());
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            password::hash(&value)
        })
        .await
        .map_err(|_| Error::Unavailable)?
    }
    async fn check(permit: OwnedSemaphorePermit, value: &str, digest: String) -> Result<bool> {
        if password::validate(value).is_err() {
            return Ok(false);
        }
        let value = Zeroizing::new(value.to_string());
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            password::matches(&value, &digest)
        })
        .await
        .map_err(|_| Error::Unavailable)
    }
    async fn replace_password(
        &self,
        tx: &Transaction<'_>,
        target: &str,
        digest: &str,
        must_change: bool,
        verified: bool,
    ) -> Result<()> {
        if tx.execute("UPDATE aether_identity.users SET password=$3,must_change=$4,email_verified=CASE WHEN $5 THEN true ELSE email_verified END WHERE tenant=$1 AND id=$2",&[&self.tenant,&target,&digest,&must_change,&verified]).await.map_err(pg)?!=1 {return Err(Error::Forbidden);}
        self.revoke(tx, target).await?;
        tx.execute(
            "DELETE FROM aether_identity.recovery WHERE tenant=$1 AND user_id=$2",
            &[&self.tenant, &target],
        )
        .await
        .map_err(pg)?;
        Ok(())
    }
    async fn revoke(&self, tx: &Transaction<'_>, target: &str) -> Result<()> {
        tx.execute("UPDATE aether_identity.agent_connections SET revoked=true WHERE tenant=$1 AND user_id=$2", &[&self.tenant,&target]).await.map_err(pg)?;
        tx.execute(
            "DELETE FROM aether_identity.sessions WHERE tenant=$1 AND user_id=$2",
            &[&self.tenant, &target],
        )
        .await
        .map_err(pg)?;
        Ok(())
    }
    async fn lock(&self, tx: &Transaction<'_>) -> Result<()> {
        deadlines(tx).await?;
        // Short identity commits only; hashing never holds a DB client/transaction.
        tx.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,1095062603))",
            &[&self.tenant],
        )
        .await
        .map_err(pg)?;
        Ok(())
    }
    async fn user<C: GenericClient + Sync>(&self, c: &C, token: &str) -> Result<User> {
        if token.is_empty() || token.len() > 256 {
            return Err(Error::Unauthorized);
        }
        let sql = format!(
            "SELECT {USER_COLUMNS} FROM aether_identity.users u JOIN aether_identity.sessions s ON s.tenant=u.tenant AND s.user_id=u.id WHERE u.tenant=$1 AND s.token_hash=$2 AND s.expires>clock_timestamp() AND u.active"
        );
        let row = c
            .query_opt(&sql, &[&self.tenant, &sha256(token.as_bytes())])
            .await
            .map_err(pg)?
            .ok_or(Error::Unauthorized)?;
        row_user(&row)
    }
    async fn admin(&self, tx: &Transaction<'_>, token: &str) -> Result<User> {
        let user = self.user(tx, token).await?;
        if user.role != Role::Admin || user.must_change {
            return Err(Error::Forbidden);
        }
        Ok(user)
    }
    async fn audit(
        &self,
        tx: &Transaction<'_>,
        actor: &str,
        action: &str,
        target: &str,
    ) -> Result<()> {
        tx.execute(
            "INSERT INTO aether_identity.audit(tenant,actor,action,target) VALUES($1,$2,$3,$4)",
            &[&self.tenant, &actor, &action, &target],
        )
        .await
        .map_err(pg)?;
        Ok(())
    }
    async fn insert(
        &self,
        tx: &Transaction<'_>,
        account: &NewAccount,
        digest: &str,
    ) -> Result<User> {
        let id = random_hex::<16>()?;
        tx.execute("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change,full_name,email) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",&[&self.tenant,&id,&account.username,&digest,&account.role.sql(),&account.must_change,&account.full_name,&account.email]).await.map_err(pg)?;
        Ok(User {
            id,
            username: account.username.clone(),
            role: account.role,
            active: true,
            must_change: account.must_change,
            full_name: account.full_name.clone(),
            email: account.email.clone(),
            email_verified: false,
        })
    }
}
fn row_user(row: &Row) -> Result<User> {
    let role = match row.get::<_, &str>(2) {
        "admin" => Role::Admin,
        "member" => Role::Member,
        _ => return Err(Error::Unavailable),
    };
    Ok(User {
        id: row.get(0),
        username: row.get(1),
        role,
        active: row.get(3),
        must_change: row.get(4),
        full_name: row.get(5),
        email: row.get(6),
        email_verified: row.get(7),
    })
}
fn normalize_account(account: &NewAccount) -> Result<NewAccount> {
    if !(2..=64).contains(&account.username.len())
        || !account
            .username
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
        || !account.username.bytes().any(|b| b.is_ascii_alphanumeric())
    {
        return Err(Error::InvalidInput);
    }
    let (full_name, email) = normalize_identity(&account.full_name, &account.email)?;
    Ok(NewAccount {
        username: account.username.to_ascii_lowercase(),
        full_name,
        email,
        ..account.clone()
    })
}
fn normalize_identity(name: &str, email: &str) -> Result<(String, String)> {
    static EMAIL: OnceLock<regex::Regex> = OnceLock::new();
    let matcher=EMAIL.get_or_init(||regex::Regex::new(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$").expect("fixed email pattern"));
    if name.len() > 480
        || name.chars().any(|c| (c as u32) < 32)
        || name.trim().chars().count() > 120
        || email.len() > 254
        || (!email.is_empty() && !matcher.is_match(email.trim()))
    {
        return Err(Error::InvalidInput);
    }
    Ok((name.trim().to_string(), email.trim().to_ascii_lowercase()))
}
fn attempt_keys(account: &str, address: &str) -> Vec<String> {
    let mut keys = vec![format!("login:user:{account}")];
    if !matches!(address, "127.0.0.1" | "::1" | "localhost") {
        keys.push(format!("login:ip:{address}"));
    }
    keys.sort();
    keys
}
async fn deadlines(tx: &Transaction<'_>) -> Result<()> {
    tx.batch_execute("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='5s'; SET LOCAL idle_in_transaction_session_timeout='10s'").await.map_err(pg)
}
async fn commit(tx: deadpool_postgres::Transaction<'_>) -> Result<()> {
    tx.commit().await.map_err(|_| Error::OutcomeUnknown)
}
fn pg(error: tokio_postgres::Error) -> Error {
    match error.code().map(|c| c.code()) {
        Some("23505") => Error::Conflict,
        Some("55P03" | "57014" | "40P01") => Error::Busy,
        _ => Error::Unavailable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn cancelled_hash_keeps_its_memory_permit_until_worker_finishes() {
        let pool = Pool::builder(deadpool_postgres::Manager::new(
            tokio_postgres::Config::new(),
            tokio_postgres::NoTls,
        ))
        .build()
        .unwrap();
        let identity = Identity::new(pool, "test", 1).unwrap();
        let worker = identity.clone();
        let task = tokio::spawn(async move { worker.hash("account-test-password-2026").await });
        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        while identity.hashing.available_permits() != 0 {
            assert!(tokio::time::Instant::now() < deadline);
            tokio::task::yield_now().await;
        }
        task.abort();
        assert!(task.await.unwrap_err().is_cancelled());
        assert_eq!(identity.permit().unwrap_err(), Error::Busy);
        // Await the actual uncancellable blocking hash, not an artificial sleep.
        let permit = tokio::time::timeout(
            Duration::from_secs(120),
            identity.hashing.clone().acquire_owned(),
        )
        .await
        .unwrap()
        .unwrap();
        drop(permit);
        assert!(identity.permit().is_ok());
    }
}
