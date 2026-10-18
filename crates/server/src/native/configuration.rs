//! Local qualification configuration. Remote PostgreSQL/TLS deployment belongs to
//! a later operator configuration; never silently downgrade a remote connection.
use aether_identity::Identity;
use deadpool_postgres::{Manager, Pool, Runtime};
use std::time::Duration;
use tokio_postgres::{Config, NoTls, config::Host};

pub fn local_identity(dsn: &str, tenant: &str) -> Result<Identity, String> {
    Identity::new(local_pool(dsn)?, tenant, 2).map_err(|e| e.to_string())
}
pub fn local_pool(dsn: &str) -> Result<Pool, String> {
    let config = local_config(dsn)?;
    let pool = Pool::builder(Manager::new(config, NoTls))
        .max_size(8)
        .runtime(Runtime::Tokio1)
        .wait_timeout(Some(Duration::from_secs(5)))
        .create_timeout(Some(Duration::from_secs(5)))
        .recycle_timeout(Some(Duration::from_secs(5)))
        .build()
        .map_err(|_| "Could not configure identity pool.")?;
    Ok(pool)
}

pub fn local_config(dsn: &str) -> Result<Config, String> {
    let config = dsn
        .parse()
        .map_err(|_| "Invalid PostgreSQL configuration.")?;
    validate_local(&config)?;
    Ok(config)
}

pub(super) fn validate_local(config: &Config) -> Result<(), String> {
    // NoTls is safe here only because this helper accepts an explicit local
    // Unix socket. The general Identity library accepts a TLS-configured pool.
    if config.get_hosts().len() != 1 || !config.get_hostaddrs().is_empty() {
        return Err("Native development requires one explicit PostgreSQL Unix socket.".into());
    }
    #[cfg(unix)]
    let local = matches!(&config.get_hosts()[0], Host::Unix(path) if path.is_absolute());
    #[cfg(not(unix))]
    let local = false;
    if !local {
        return Err("Native development requires an absolute PostgreSQL Unix socket path.".into());
    }
    Ok(())
}
