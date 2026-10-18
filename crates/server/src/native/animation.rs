//! Host-owned, bounded Animation sessions. Installed product archive owns all
//! engine meaning; session cookies never enter the worker or process arguments.
mod files;
pub(super) mod cad;
mod render;
use super::{
    NativeHost,
    boundary::{Result, agent_token, body, token},
};
use crate::documents::Error;
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::HeaderMap,
};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::Read,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout},
    sync::{Mutex, Semaphore},
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Configuration {
    schema: u32,
    python: PathBuf,
    archive: PathBuf,
    sha256: String,
    max_sessions: usize,
}
struct Worker {
    _child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
    _work: tempfile::TempDir,
}
impl Drop for Worker {
    fn drop(&mut self) {
        // A timed-out/cancelled media request must also stop its decoder child.
        #[cfg(unix)]
        if let Some(pid) = self
            ._child
            .id()
            .and_then(|id| rustix::process::Pid::from_raw(id as i32))
        {
            let _ = rustix::process::kill_process_group(pid, rustix::process::Signal::KILL);
        }
    }
}
type Session = Arc<Mutex<Option<Worker>>>;
struct Inner {
    python: PathBuf,
    archive: PathBuf,
    _bundle: tempfile::TempDir,
    max_sessions: usize,
    sessions: Mutex<BTreeMap<String, (Instant, Session)>>,
    slots: Semaphore,
}
#[derive(Clone)]
pub struct Animation(Arc<Inner>);
impl Animation {
    pub fn load(path: &Path) -> std::result::Result<Self, String> {
        let mut bytes = Vec::new();
        std::fs::File::open(path)
            .map_err(|_| "Cannot read Animation configuration")?
            .take(16385)
            .read_to_end(&mut bytes)
            .map_err(|_| "Cannot read Animation configuration")?;
        if bytes.len() > 16384 {
            return Err("Animation configuration exceeds limit".into());
        }
        let config: Configuration =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid Animation configuration")?;
        if config.schema != 1
            || !config.python.is_absolute()
            || !config.python.is_file()
            || !config.archive.is_absolute()
            || !(1..=64).contains(&config.max_sessions)
        {
            return Err("Invalid Animation installation".into());
        }
        let mut bytes = Vec::new();
        std::fs::File::open(&config.archive)
            .map_err(|_| "Missing Animation archive")?
            .take(16 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Cannot read Animation archive")?;
        if bytes.len() > 16 * 1024 * 1024
            || format!("{:x}", Sha256::digest(&bytes)) != config.sha256
        {
            return Err("Animation archive checksum mismatch".into());
        }
        let bundle = tempfile::tempdir().map_err(|_| "Cannot stage Animation archive")?;
        let archive = bundle.path().join("animation.pyz");
        std::fs::write(&archive, bytes).map_err(|_| "Cannot stage Animation archive")?;
        Ok(Self(Arc::new(Inner {
            python: config.python,
            archive,
            _bundle: bundle,
            max_sessions: config.max_sessions,
            sessions: Mutex::new(BTreeMap::new()),
            slots: Semaphore::new(2),
        })))
    }
    async fn worker(&self) -> std::result::Result<Worker, Error> {
        let work = tempfile::tempdir().map_err(|_| Error::Unavailable)?;
        let mut command = tokio::process::Command::new(&self.0.python);
        #[cfg(unix)]
        command.process_group(0);
        command
            .arg("-I")
            .arg(&self.0.archive)
            .env_clear()
            .env("HOME", work.path())
            .env("TMPDIR", work.path())
            .current_dir(work.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        let mut child = command.spawn().map_err(|_| Error::Unavailable)?;
        let input = child.stdin.take().ok_or(Error::Unavailable)?;
        let output = BufReader::new(child.stdout.take().ok_or(Error::Unavailable)?);
        Ok(Worker {
            _child: child,
            input,
            output,
            _work: work,
        })
    }
    async fn forget(&self, key: &str) {
        self.0.sessions.lock().await.remove(key);
    }
    async fn invoke(&self, key: &str, request: &Value) -> std::result::Result<Value, Error> {
        let mut bytes = serde_json::to_vec(request).map_err(|_| Error::Invalid)?;
        bytes.push(b'\n');
        if bytes.len() > 4 * 1024 * 1024 {
            return Err(Error::TooLarge);
        }
        let _permit = self.0.slots.try_acquire().map_err(|_| Error::Unavailable)?;
        let session = {
            let mut sessions = self.0.sessions.lock().await;
            sessions.retain(|_, (last, session)| {
                last.elapsed() < Duration::from_secs(900) || Arc::strong_count(session) > 1
            });
            if !sessions.contains_key(key) {
                if sessions.len() >= self.0.max_sessions {
                    return Err(Error::Unavailable);
                }
                sessions.insert(key.into(), (Instant::now(), Arc::new(Mutex::new(None))));
            }
            let (last, session) = sessions.get_mut(key).ok_or(Error::Unavailable)?;
            *last = Instant::now();
            session.clone()
        };
        let mut locked = tokio::time::timeout(Duration::from_secs(1), session.lock())
            .await
            .map_err(|_| Error::Unavailable)?;
        // Taking ownership makes cancellation drop/kill the process, avoiding a stale
        // response being mistaken for a later request after a timeout/disconnection.
        let mut worker = match locked.take() {
            Some(worker) => worker,
            None => self.worker().await?,
        };
        let result = tokio::time::timeout(Duration::from_secs(20), async {
            worker
                .input
                .write_all(&bytes)
                .await
                .map_err(|_| Error::Unavailable)?;
            worker.input.flush().await.map_err(|_| Error::Unavailable)?;
            let mut output = Vec::new();
            (&mut worker.output)
                .take(16 * 1024 * 1024 + 1)
                .read_until(b'\n', &mut output)
                .await
                .map_err(|_| Error::Unavailable)?;
            if output.len() > 16 * 1024 * 1024 {
                return Err(Error::TooLarge);
            }
            if output.last() != Some(&b'\n') {
                return Err(Error::Unavailable);
            }
            let value: Value = serde_json::from_slice(&output).map_err(|_| Error::Incompatible)?;
            if !value.is_object() || !value["ok"].is_boolean() || value["id"] != request["id"] {
                return Err(Error::Incompatible);
            }
            Ok(value)
        })
        .await
        .map_err(|_| Error::Unavailable)?;
        if result.is_ok() {
            *locked = Some(worker);
        }
        result
    }
}
async fn authorize(host: &NativeHost, session: &str) -> Result<()> {
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    if session.starts_with("aether_sa_") || session.starts_with("aether_agent_") {
        return Ok(docs
            .service_application_access(session, "animation")
            .await?);
    }
    let (status, apps) = docs
        .application_status(Some(session), &["animation"])
        .await?;
    if status.user.is_none() {
        return Err(aether_identity::Error::Unauthorized.into());
    }
    if !apps.iter().any(|app| app == "animation") {
        return Err(aether_identity::Error::Forbidden.into());
    }
    Ok(())
}
pub(super) async fn rpc(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = if headers.contains_key("authorization") {
        agent_token(&headers)?
    } else {
        token(&headers)?
    };
    if !headers.contains_key("authorization")
        && (session.starts_with("aether_sa_") || session.starts_with("aether_agent_"))
    {
        return Err(aether_identity::Error::Unauthorized.into());
    }
    let key = format!("{:x}", Sha256::digest(session.as_bytes()));
    let runtime = host.animation.as_ref().ok_or(Error::Unavailable)?;
    if let Err(error) = authorize(&host, &session).await {
        runtime.forget(&key).await;
        return Err(error);
    }
    let input = body(input)?;
    if !input.is_object() || !input["method"].is_string() || input["method"] == "shutdown" {
        return Err(Error::Invalid.into());
    }
    let result = files::invoke(&host, runtime, &key, &session, input).await;
    if let Err(error) = authorize(&host, &session).await {
        runtime.forget(&key).await;
        return Err(error);
    }
    Ok(Json(result?))
}
