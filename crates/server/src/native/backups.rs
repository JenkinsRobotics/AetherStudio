//! Browser backup management. All filesystem paths and executable configuration
//! belong to the operator. A browser can request a snapshot, never choose a path.
use super::{
    NativeHost,
    boundary::{Result, body, token},
};
use crate::{backup, documents::Error};
use axum::{
    Json,
    body::Body,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use deadpool_postgres::Pool;
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::File,
    io::{Read, Write},
    path::{Path as FsPath, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::{io::AsyncReadExt, sync::Semaphore};

#[derive(Clone)]
pub struct Backups(Arc<Inner>);
struct Inner {
    pool: Pool,
    tenant: String,
    dsn: zeroize::Zeroizing<String>,
    root: PathBuf,
    objects: PathBuf,
    pg_dump: PathBuf,
    extras: BTreeMap<String, Vec<u8>>,
    jobs: Arc<Semaphore>,
    downloads: Arc<Semaphore>,
    status: Mutex<Job>,
}
#[derive(Default)]
struct Job {
    running: bool,
    error: String,
}
fn unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn private_directory(path: &FsPath) -> std::io::Result<()> {
    let info = std::fs::symlink_metadata(path)?;
    if !path.is_absolute() || !info.is_dir() || info.file_type().is_symlink() {
        return Err(std::io::ErrorKind::InvalidInput.into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if info.permissions().mode() & 0o077 != 0 {
            return Err(std::io::ErrorKind::PermissionDenied.into());
        }
    }
    Ok(())
}
fn name_valid(name: &str) -> bool {
    name.strip_prefix("studio-")
        .and_then(|v| v.strip_suffix(".zip"))
        .is_some_and(|v| {
            v.len() == 32
                && v.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
}
impl Backups {
    pub fn new(
        pool: Pool,
        tenant: &str,
        dsn: zeroize::Zeroizing<String>,
        root: &FsPath,
        objects: &FsPath,
        pg_dump: &FsPath,
        extras: BTreeMap<String, Vec<u8>>,
    ) -> std::io::Result<Self> {
        private_directory(root)?;
        if tenant.is_empty()
            || !objects.is_absolute()
            || !objects.is_dir()
            || !pg_dump.is_absolute()
            || !pg_dump.is_file()
        {
            return Err(std::io::ErrorKind::InvalidInput.into());
        }
        let root = root.join(format!("{:x}", Sha256::digest(tenant.as_bytes())));
        let mut builder = std::fs::DirBuilder::new();
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        match builder.create(&root) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(e),
        }
        private_directory(&root)?;
        Ok(Self(Arc::new(Inner {
            pool,
            tenant: tenant.into(),
            dsn,
            root,
            objects: objects.into(),
            pg_dump: pg_dump.into(),
            extras,
            jobs: Arc::new(Semaphore::new(1)),
            downloads: Arc::new(Semaphore::new(2)),
            status: Mutex::new(Job::default()),
        })))
    }
    pub(super) async fn state(&self) -> std::result::Result<(Value, Value), Error> {
        let this = self.clone();
        let (mut storage, archives) = tokio::task::spawn_blocking(move || this.state_sync())
            .await
            .map_err(|_| Error::Unavailable)??;
        let client = self.0.pool.get().await.map_err(|_| Error::Unavailable)?;
        let row = client
            .query_opt(
                "SELECT interval_hours,last_attempt FROM aether_settings.backups WHERE tenant=$1",
                &[&self.0.tenant],
            )
            .await
            .map_err(|_| Error::Unavailable)?;
        let (hours, last) = row
            .map(|r| (r.get::<_, i32>(0), r.get::<_, i64>(1)))
            .unwrap_or((0, 0));
        storage["interval_hours"] = json!(hours);
        storage["next_backup"] = if hours > 0 {
            json!(last.saturating_add(i64::from(hours) * 3600))
        } else {
            Value::Null
        };
        storage["managed_destination"] = json!(true);
        Ok((storage, archives))
    }
    fn state_sync(&self) -> std::result::Result<(Value, Value), Error> {
        private_directory(&self.0.root).map_err(|_| Error::Unavailable)?;
        let mut entries = Vec::new();
        for entry in std::fs::read_dir(&self.0.root).map_err(|_| Error::Unavailable)? {
            let entry = entry.map_err(|_| Error::Unavailable)?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if !name_valid(&name) {
                continue;
            }
            let info = std::fs::symlink_metadata(entry.path()).map_err(|_| Error::Unavailable)?;
            if !info.is_file() || info.file_type().is_symlink() {
                continue;
            }
            let created = info
                .modified()
                .ok()
                .and_then(|v| v.duration_since(UNIX_EPOCH).ok())
                .map(|v| v.as_secs())
                .unwrap_or(0);
            entries.push(json!({"name":name,"created":created,"size":info.len()}));
            if entries.len() > 10_000 {
                return Err(Error::Unavailable);
            }
        }
        entries.sort_by_key(|v| std::cmp::Reverse(v["created"].as_u64().unwrap_or(0)));
        #[cfg(unix)]
        let free = rustix::fs::statvfs(&self.0.objects)
            .ok()
            .and_then(|s| s.f_bavail.checked_mul(s.f_frsize));
        #[cfg(unix)]
        let backup_free = rustix::fs::statvfs(&self.0.root)
            .ok()
            .and_then(|s| s.f_bavail.checked_mul(s.f_frsize));
        #[cfg(not(unix))]
        let free: Option<u64> = None;
        #[cfg(not(unix))]
        let backup_free: Option<u64> = None;
        let status = self.0.status.lock().map_err(|_| Error::Unavailable)?;
        let storage = json!({"data_directory":self.0.objects,"backup_directory":self.0.root,"free_bytes":free,"interval_hours":0,"export_directory":"","last_backup":entries.first().map(|v|v["name"].clone()).unwrap_or(json!("")),"last_success":entries.first().map(|v|v["created"].clone()).unwrap_or(json!(0)),"last_export":"","error":status.error,"next_backup":null,"in_progress":status.running});
        let mut storage = storage;
        storage["backup_free_bytes"] = json!(backup_free);
        Ok((storage, json!(entries)))
    }
    async fn start(
        &self,
        request: Option<(&crate::documents::Documents, &str)>,
    ) -> std::result::Result<(), Error> {
        let permit = self
            .0
            .jobs
            .clone()
            .try_acquire_owned()
            .map_err(|_| Error::Conflict)?;
        // The session advisory lock also bounds concurrent jobs from another host
        // process against this database. Its connection stays held until completion.
        let mut client = deadpool_postgres::Object::take(
            self.0.pool.get().await.map_err(|_| Error::Unavailable)?,
        );
        let locked: bool = client
            .query_one(
                "SELECT pg_try_advisory_lock(hashtextextended($1,1095062620))",
                &[&self.0.tenant],
            )
            .await
            .map_err(|_| Error::Unavailable)?
            .get(0);
        if !locked {
            return Err(Error::Conflict);
        }
        if let Some((documents, session)) = request {
            documents.record_backup_request(session).await?;
        }
        let now = unix_time() as i64;
        let tx = client.transaction().await.map_err(|_| Error::Unavailable)?;
        tx.batch_execute("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'")
            .await
            .map_err(|_| Error::Unavailable)?;
        if request.is_none() {
            let due=tx.execute("UPDATE aether_settings.backups SET last_attempt=$2 WHERE tenant=$1 AND interval_hours>0 AND last_attempt<=($2-interval_hours::bigint*3600)",&[&self.0.tenant,&now]).await.map_err(|_|Error::Unavailable)?;
            if due == 0 {
                return Ok(());
            }
            tx.execute("INSERT INTO aether_identity.audit(tenant,actor,action,target) VALUES($1,'system','scheduled_backup_requested','')",&[&self.0.tenant]).await.map_err(|_|Error::Unavailable)?;
        } else {
            tx.execute("INSERT INTO aether_settings.backups(tenant,last_attempt) VALUES($1,$2) ON CONFLICT(tenant) DO UPDATE SET last_attempt=EXCLUDED.last_attempt",&[&self.0.tenant,&now]).await.map_err(|_|Error::Unavailable)?;
        }
        tx.commit().await.map_err(|_| Error::OutcomeUnknown)?;
        {
            let mut status = self.0.status.lock().map_err(|_| Error::Unavailable)?;
            status.running = true;
            status.error.clear();
        }
        let this = self.clone();
        tokio::spawn(async move {
            let result = this.run().await;
            // Remove the locked connection rather than returning a session lock to
            // the pool, including during task unwinding.
            drop(client);
            if let Ok(mut status) = this.0.status.lock() {
                status.running = false;
                status.error = result
                    .err()
                    .map(|reason| format!("Backup failed: {reason}"))
                    .unwrap_or_default();
            }
            drop(permit);
        });
        Ok(())
    }
    /// Operator-installed scheduler. Policy and last attempt survive host restarts;
    /// one PostgreSQL lock coordinates manual and scheduled jobs across processes.
    pub async fn run_scheduled(&self) -> std::result::Result<(), Error> {
        self.start(None).await
    }
    pub fn scheduler(&self) -> tokio::task::JoinHandle<()> {
        let weak = Arc::downgrade(&self.0);
        tokio::spawn(async move {
            loop {
                let Some(inner) = weak.upgrade() else {
                    break;
                };
                let backups = Backups(inner);
                if let Err(error) = backups.run_scheduled().await
                    && !matches!(error, Error::Conflict)
                    && let Ok(mut status) = backups.0.status.lock()
                {
                    status.error =
                        "Backup schedule could not run; it will retry while the server is running."
                            .into();
                }
                drop(backups);
                tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            }
        })
    }
    async fn run(&self) -> std::result::Result<(), &'static str> {
        let temporary = tempfile::tempdir_in(&self.0.root).map_err(|_| "backup directory")?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(temporary.path(), std::fs::Permissions::from_mode(0o700))
                .map_err(|_| "backup directory")?;
        }
        let snapshot = temporary.path().join("snapshot");
        let manifest = backup::create(
            self.0.pool.clone(),
            self.0.tenant.clone(),
            self.0.dsn.clone(),
            backup::Configuration {
                pg_dump: self.0.pg_dump.clone(),
                objects: self.0.objects.clone(),
                destination: snapshot.clone(),
            },
            self.0.extras.clone(),
        )
        .await?;
        let root = self.0.root.clone();
        tokio::task::spawn_blocking(move || {
            // Ownership of staging persists through blocking IO even if a caller
            // disconnects. Nothing becomes downloadable until ZIP completion/fsync.
            let _temporary = temporary;
            let archive = tempfile::NamedTempFile::new_in(&root).map_err(|_| "archive")?;
            let mut zip = zip::ZipWriter::new(archive.reopen().map_err(|_| "archive")?);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored)
                .large_file(true)
                .unix_permissions(0o600);
            for (name, entry) in manifest["files"].as_object().ok_or("manifest")? {
                if name.starts_with('/')
                    || name
                        .split('/')
                        .any(|p| p.is_empty() || p == "." || p == "..")
                {
                    return Err("manifest");
                }
                let mut file = File::open(snapshot.join(name)).map_err(|_| "snapshot")?;
                zip.start_file(name, options).map_err(|_| "archive")?;
                let mut digest = Sha256::new();
                let mut length = 0u64;
                let mut buffer = [0u8; 65536];
                loop {
                    let n = file.read(&mut buffer).map_err(|_| "snapshot")?;
                    if n == 0 {
                        break;
                    }
                    digest.update(&buffer[..n]);
                    length += n as u64;
                    zip.write_all(&buffer[..n]).map_err(|_| "archive")?;
                }
                if entry["size"].as_u64() != Some(length)
                    || entry["sha256"].as_str() != Some(format!("{:x}", digest.finalize()).as_str())
                {
                    return Err("snapshot");
                }
            }
            zip.start_file("manifest.json", options)
                .map_err(|_| "archive")?;
            zip.write_all(&serde_json::to_vec(&manifest).map_err(|_| "manifest")?)
                .map_err(|_| "archive")?;
            zip.finish()
                .map_err(|_| "archive")?
                .sync_all()
                .map_err(|_| "archive")?;
            let mut random = [0u8; 16];
            getrandom::fill(&mut random).map_err(|_| "archive")?;
            let suffix = random
                .iter()
                .map(|v| format!("{v:02x}"))
                .collect::<String>();
            archive
                .persist_noclobber(root.join(format!("studio-{suffix}.zip")))
                .map_err(|_| "archive")?;
            File::open(root)
                .and_then(|f| f.sync_all())
                .map_err(|_| "archive")?;
            Ok(())
        })
        .await
        .map_err(|_| "archive task")?
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Empty {}
pub(super) async fn create(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Empty>, JsonRejection>,
) -> Result<Response> {
    let session = token(&headers)?;
    host.settings
        .as_ref()
        .ok_or(Error::Unavailable)?
        .read(&session)
        .await?;
    body(input)?;
    host.backups
        .as_ref()
        .ok_or(Error::Unavailable)?
        .start(Some((
            host.documents.as_ref().ok_or(Error::Unavailable)?,
            &session,
        )))
        .await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(json!({"ok":true,"in_progress":true,"requested_at":unix_time()})),
    )
        .into_response())
}
pub(super) async fn configure(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<crate::settings::backups::BackupChange>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    let settings = host.settings.as_ref().ok_or(Error::Unavailable)?;
    settings.read(&session).await?;
    if host.backups.is_none() {
        return Err(Error::Unavailable.into());
    }
    settings.backup_change(&session, &body(input)?).await?;
    Ok(Json(json!({"ok":true})))
}
pub(super) async fn download(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<Response> {
    let session = token(&headers)?;
    host.settings
        .as_ref()
        .ok_or(Error::Unavailable)?
        .read(&session)
        .await?;
    let backups = host.backups.as_ref().ok_or(Error::Unavailable)?;
    if !name_valid(&name) {
        return Err(Error::Invalid.into());
    }
    let permit = backups
        .0
        .downloads
        .clone()
        .try_acquire_owned()
        .map_err(|_| Error::Unavailable)?;
    let path = backups.0.root.join(&name);
    let file = tokio::task::spawn_blocking(move || {
        #[cfg(unix)]
        {
            use rustix::fs::{Mode, OFlags, open};
            let fd = open(
                &path,
                OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC | OFlags::NONBLOCK,
                Mode::empty(),
            )
            .map_err(|_| Error::Denied)?;
            let file = File::from(fd);
            if !file.metadata().map_err(|_| Error::Denied)?.is_file() {
                return Err(Error::Denied);
            }
            Ok(file)
        }
        #[cfg(not(unix))]
        {
            let _ = path;
            Err::<File, _>(Error::Unavailable)
        }
    })
    .await
    .map_err(|_| Error::Unavailable)??;
    let length = file.metadata().map_err(|_| Error::Unavailable)?.len();
    let stream = futures_util::stream::try_unfold(
        (tokio::fs::File::from_std(file), permit),
        |(mut file, permit)| async move {
            let mut bytes = vec![0u8; 65536];
            let n = file.read(&mut bytes).await?;
            if n == 0 {
                Ok::<_, std::io::Error>(None)
            } else {
                bytes.truncate(n);
                Ok(Some((bytes, (file, permit))))
            }
        },
    );
    Ok(Response::builder()
        .header("content-type", "application/zip")
        .header("content-length", length)
        .header(
            "content-disposition",
            format!("attachment; filename=\"{name}\""),
        )
        .header("cache-control", "no-store")
        .body(Body::from_stream(stream))
        .map_err(|_| Error::Unavailable)?)
}
