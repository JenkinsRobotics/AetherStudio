//! First-run browser setup requires a short-lived local operator key. All SQL
//! initialization commits together; this never reconfigures an existing tenant.
use super::{
    NativeHost,
    boundary::{Failure, Result, body},
};
use aether_identity::{Identity, NewAccount, Role};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::{HeaderMap, HeaderValue, StatusCode, header::SET_COOKIE},
    response::{IntoResponse, Response},
};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    fs::{File, OpenOptions},
    io::{Read, Write},
    path::Path,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use zeroize::Zeroizing;
const COOKIE: &str = "aether_native_setup";
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Key {
    secret: String,
    expires: u64,
}
#[derive(Clone)]
pub struct Setup {
    pool: Pool,
    digest: Arc<String>,
    expires: u64,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
impl Setup {
    /// Operator-only command. Existing files are not overwritten. The returned
    /// secret is printed only in the local setup link, never in HTTP status.
    pub fn create_key(path: &Path) -> std::result::Result<Zeroizing<String>, String> {
        if !path.is_absolute() {
            return Err("Use an absolute private setup-key path.".into());
        }
        let parent = path.parent().ok_or("Missing setup directory.")?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let meta =
                std::fs::symlink_metadata(parent).map_err(|_| "Cannot read setup directory.")?;
            if !meta.is_dir() || meta.permissions().mode() & 0o077 != 0 {
                return Err("Setup directory must be private (0700).".into());
            }
        }
        let mut bytes = [0u8; 32];
        getrandom::fill(&mut bytes).map_err(|_| "Cannot generate setup key.")?;
        let secret = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
        let key = Key {
            secret: secret.clone(),
            expires: now() + 900,
        };
        let mut file =
            tempfile::NamedTempFile::new_in(parent).map_err(|_| "Cannot stage setup key.")?;
        file.write_all(&Zeroizing::new(
            serde_json::to_vec(&key).map_err(|_| "Cannot encode setup key.")?,
        ))
        .map_err(|_| "Cannot write setup key.")?;
        file.as_file()
            .sync_all()
            .map_err(|_| "Cannot sync setup key.")?;
        file.persist_noclobber(path)
            .map_err(|_| "Setup key already exists or cannot be published.")?;
        File::open(parent)
            .and_then(|f| f.sync_all())
            .map_err(|_| "Cannot sync setup directory.")?;
        Ok(Zeroizing::new(secret))
    }
    pub fn load(path: &Path, pool: Pool) -> std::result::Result<Self, String> {
        let mut options = OpenOptions::new();
        options.read(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.custom_flags(rustix::fs::OFlags::NOFOLLOW.bits() as i32);
        }
        let file = options
            .open(path)
            .map_err(|_| "Cannot read private setup key.")?;
        let meta = file.metadata().map_err(|_| "Cannot inspect setup key.")?;
        if !meta.is_file() || meta.len() > 1024 {
            return Err("Invalid setup key.".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if meta.permissions().mode() & 0o077 != 0 {
                return Err("Setup key must be private (0600).".into());
            }
        }
        let mut bytes = Zeroizing::new(Vec::new());
        file.take(1025)
            .read_to_end(&mut bytes)
            .map_err(|_| "Cannot read setup key.")?;
        let key: Key = serde_json::from_slice(&bytes).map_err(|_| "Invalid setup key.")?;
        if key.secret.len() != 64
            || !key.secret.bytes().all(|b| b.is_ascii_hexdigit())
            || key.expires > now() + 900
        {
            return Err("Invalid setup key.".into());
        }
        Ok(Self {
            pool,
            digest: Arc::new(format!("{:x}", Sha256::digest(key.secret))),
            expires: key.expires,
        })
    }
    fn valid(&self, secret: &str) -> bool {
        if now() >= self.expires || secret.len() != 64 {
            return false;
        }
        let given = format!("{:x}", Sha256::digest(secret));
        // Compare fixed-size hashes without an early exit.
        given
            .bytes()
            .zip(self.digest.bytes())
            .fold(0u8, |a, (x, y)| a | (x ^ y))
            == 0
    }
    pub(super) fn authorized(&self, headers: &HeaderMap) -> bool {
        setup_cookie(headers).is_some_and(|s| self.valid(s))
    }
    async fn complete(
        &self,
        identity: &Identity,
        input: &Input,
        catalog: &[String],
    ) -> std::result::Result<(), crate::documents::Error> {
        use crate::documents::Error;
        let prepared = identity
            .prepare_bootstrap(
                &NewAccount {
                    username: input.username.clone(),
                    full_name: input.full_name.clone(),
                    email: input.email.clone(),
                    role: Role::Admin,
                    must_change: false,
                },
                &input.password,
            )
            .await?;
        let mut c = tokio::time::timeout(Duration::from_secs(5), self.pool.get())
            .await
            .map_err(|_| Error::Unavailable)?
            .map_err(|_| Error::Unavailable)?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(|_| Error::Unavailable)?;
        let user = identity.bootstrap_in(&tx, &prepared).await?;
        if now() >= self.expires {
            return Err(aether_identity::Error::Forbidden.into());
        }
        // Preserve the seeded theme. The only permitted first-run change is name.
        let row=tx.query_opt("SELECT revision,value FROM aether_settings.presentation WHERE tenant=$1 FOR UPDATE", &[&identity.tenant()]).await.map_err(|_|Error::Unavailable)?.ok_or(Error::Incompatible)?;
        if row.get::<_, i64>(0) != 1 {
            return Err(Error::Conflict);
        }
        let mut value: Value = row.get(1);
        value["name"] = json!(input.name.trim());
        tx.execute(
            "UPDATE aether_settings.presentation SET value=$2 WHERE tenant=$1",
            &[&identity.tenant(), &value],
        )
        .await
        .map_err(|_| Error::Unavailable)?;
        for app in catalog {
            let enabled = app == "ui" || input.apps.contains(app);
            tx.execute("INSERT INTO aether_access.applications VALUES($1,$2,$3,false) ON CONFLICT(tenant,id) DO NOTHING", &[&identity.tenant(),app,&enabled]).await.map_err(|_|Error::Unavailable)?;
        }
        tx.execute("INSERT INTO aether_access.audit(tenant,actor,action,target) VALUES($1,$2,'installation_configured','')", &[&identity.tenant(),&user.id]).await.map_err(|_|Error::Unavailable)?;
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)
    }
}
fn setup_cookie(headers: &HeaderMap) -> Option<&str> {
    let mut headers = headers.get_all("cookie").iter();
    let value = headers.next()?.to_str().ok()?;
    if headers.next().is_some() || value.len() > 8192 {
        return None;
    }
    let mut values = value
        .split(';')
        .filter_map(|s| s.trim().split_once('='))
        .filter(|(k, _)| *k == COOKIE)
        .map(|(_, v)| v);
    let value = values.next()?;
    if values.next().is_some() {
        return None;
    }
    Some(value)
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Authorize {
    token: Zeroizing<String>,
}
pub(super) async fn authorize(
    State(host): State<NativeHost>,
    input: std::result::Result<Json<Authorize>, JsonRejection>,
) -> Result<Response> {
    let input = body(input)?;
    if host.identity.session_status(None).await?.ready {
        return Err(aether_identity::Error::Conflict.into());
    }
    let setup = host
        .setup
        .as_ref()
        .ok_or(aether_identity::Error::Forbidden)?;
    if !setup.valid(&input.token) {
        return Err(aether_identity::Error::Forbidden.into());
    }
    let mut cookie = HeaderValue::from_str(&format!(
        "{COOKIE}={}; Path=/; HttpOnly; SameSite=Strict; Max-Age={}{}",
        input.token.as_str(),
        setup.expires.saturating_sub(now()),
        if host.secure { "; Secure" } else { "" }
    ))
    .map_err(|_| aether_identity::Error::Forbidden)?;
    cookie.set_sensitive(true);
    Ok(([(SET_COOKIE, cookie)], Json(json!({"ok":true}))).into_response())
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Input {
    name: String,
    username: String,
    full_name: String,
    email: String,
    password: Zeroizing<String>,
    apps: Vec<String>,
}
pub(super) async fn complete(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Input>, JsonRejection>,
) -> Result<Response> {
    let input = body(input)?;
    if host.identity.session_status(None).await?.ready {
        return Err(aether_identity::Error::Conflict.into());
    }
    let setup = host
        .setup
        .as_ref()
        .ok_or(aether_identity::Error::Forbidden)?;
    if !setup.authorized(&headers) {
        return Err(aether_identity::Error::Forbidden.into());
    }
    if host.documents.is_none() || host.settings.is_none() {
        return Err(crate::documents::Error::Unavailable.into());
    }
    if input.name.trim().is_empty()
        || input.name.trim().chars().count() > 80
        || input.name.chars().any(char::is_control)
        || input.apps.len() > 64
        || input.apps.iter().any(|id| {
            !host.catalog.iter().any(|a| a.id == *id)
                || !host.frontends.as_ref().is_some_and(|w| w.installed(id))
        })
    {
        return Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Choose a workspace name and installed applications.",
        ));
    }
    setup
        .complete(
            &host.identity,
            &input,
            &host
                .catalog
                .iter()
                .map(|a| a.id.clone())
                .collect::<Vec<_>>(),
        )
        .await?;
    Ok((
        [(
            SET_COOKIE,
            format!("{COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"),
        )],
        Json(json!({"ok":true})),
    )
        .into_response())
}
