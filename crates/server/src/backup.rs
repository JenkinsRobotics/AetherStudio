//! Operator-owned portable recovery snapshots. The exported PostgreSQL snapshot
//! and immutable object manifests agree even while ordinary saves continue.
//! No browser may supply a DSN, executable or filesystem path to this adapter.
use deadpool_postgres::Pool;
use futures_util::TryStreamExt;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const ERROR: &str = "Native backup could not be verified; no recovery snapshot was published.";
type Result<T> = std::result::Result<T, &'static str>;
const MAX_FILES: usize = 1_000_000;
const MAX_BYTES: u64 = 256 * 1024 * 1024 * 1024;
#[derive(Clone)]
pub struct Configuration {
    pub pg_dump: PathBuf,
    pub objects: PathBuf,
    pub destination: PathBuf,
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn valid_digest(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn identifier(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_lowercase() || b == b'_')
}
fn private_parent(path: &Path) -> Result<()> {
    if !path.is_absolute() || path.exists() {
        return Err(ERROR);
    }
    let parent = path.parent().ok_or(ERROR)?;
    let metadata = std::fs::symlink_metadata(parent).map_err(|_| ERROR)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(ERROR);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o077 != 0 {
            return Err(ERROR);
        }
    }
    Ok(())
}
/// Extra immutable bytes are the already-validated attachment/workspace snapshots
/// loaded by this host. Credential vaults and executable configurations do not belong here.
pub fn extras(
    attachments: Option<&crate::attachments::Attachments>,
    workspaces: Option<&crate::workspace_assets::WorkspaceAssets>,
) -> BTreeMap<String, Vec<u8>> {
    attachments
        .into_iter()
        .flat_map(|v| v.backup_entries())
        .chain(workspaces.into_iter().flat_map(|v| v.backup_entries()))
        .collect()
}
pub async fn create(
    pool: Pool,
    tenant: String,
    dsn: zeroize::Zeroizing<String>,
    config: Configuration,
    extras: BTreeMap<String, Vec<u8>>,
) -> Result<Value> {
    tokio::time::timeout(
        Duration::from_secs(300),
        create_inner(pool, tenant, dsn, config, extras),
    )
    .await
    .map_err(|_| ERROR)?
}
async fn create_inner(
    pool: Pool,
    tenant: String,
    dsn: zeroize::Zeroizing<String>,
    config: Configuration,
    extras: BTreeMap<String, Vec<u8>>,
) -> Result<Value> {
    private_parent(&config.destination)?;
    if !config.pg_dump.is_absolute()
        || !config.pg_dump.is_file()
        || !config.objects.is_absolute()
        || !config.objects.is_dir()
    {
        return Err(ERROR);
    }
    let stage =
        tempfile::tempdir_in(config.destination.parent().ok_or(ERROR)?).map_err(|_| ERROR)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(stage.path(), std::fs::Permissions::from_mode(0o700))
            .map_err(|_| ERROR)?;
    }
    let mut client = pool.get().await.map_err(|_| ERROR)?;
    let tx = client
        .build_transaction()
        .isolation_level(tokio_postgres::IsolationLevel::RepeatableRead)
        .read_only(true)
        .start()
        .await
        .map_err(|_| ERROR)?;
    tx.batch_execute(
        "SET LOCAL statement_timeout='30s'; SET LOCAL idle_in_transaction_session_timeout='300s'",
    )
    .await
    .map_err(|_| ERROR)?;
    // pg_dump is database-wide within these fixed schemas. Refuse mixed-tenant
    // databases rather than leak another company's data to a tenant administrator.
    let tables=tx.query("SELECT table_schema,table_name FROM information_schema.columns WHERE column_name='tenant' AND table_schema IN ('aether_identity','aether_access','aether_store','aether_settings')",&[]).await.map_err(|_|ERROR)?;
    if tables.is_empty() {
        return Err(ERROR);
    }
    for row in tables {
        let schema: String = row.get(0);
        let table: String = row.get(1);
        if !identifier(&schema) || !identifier(&table) {
            return Err(ERROR);
        }
        if tx
            .query_one(
                &format!("SELECT EXISTS(SELECT 1 FROM {schema}.{table} WHERE tenant<>$1)"),
                &[&tenant],
            )
            .await
            .map_err(|_| ERROR)?
            .get::<_, bool>(0)
        {
            return Err(ERROR);
        }
    }
    let snapshot: String = tx
        .query_one("SELECT pg_export_snapshot()", &[])
        .await
        .map_err(|_| ERROR)?
        .get(0);
    let namespace = digest(tenant.as_bytes());
    let mut files = BTreeMap::<String, u64>::new();
    let revisions=tx.query_raw("SELECT DISTINCT metadata->>'content_sha256', (metadata->>'size_bytes')::bigint FROM aether_store.revisions WHERE tenant=$1",&[&tenant]).await.map_err(|_|ERROR)?;
    futures_util::pin_mut!(revisions);
    while let Some(row) = revisions.try_next().await.map_err(|_| ERROR)? {
        let hash: String = row.try_get(0).map_err(|_| ERROR)?;
        let size: i64 = row.try_get(1).map_err(|_| ERROR)?;
        if !valid_digest(&hash) || size < 0 {
            return Err(ERROR);
        }
        let key = format!("v1/{namespace}/{hash}");
        if files
            .insert(key, size as u64)
            .is_some_and(|old| old != size as u64)
            || files.len() > MAX_FILES
        {
            return Err(ERROR);
        }
    }
    let manifests=tx.query_raw("SELECT chunks FROM aether_access.upload_blobs WHERE tenant=$1 UNION ALL SELECT chunks FROM aether_access.uploads WHERE tenant=$1 AND state IN ('active','complete') UNION ALL SELECT chunks FROM aether_access.map_media WHERE tenant=$1 UNION ALL SELECT chunks FROM aether_access.workspace_files WHERE tenant=$1",&[&tenant]).await.map_err(|_|ERROR)?;
    futures_util::pin_mut!(manifests);
    while let Some(row) = manifests.try_next().await.map_err(|_| ERROR)? {
        let chunks: Value = row.get(0);
        for chunk in chunks.as_array().ok_or(ERROR)? {
            let hash = chunk["digest"].as_str().ok_or(ERROR)?;
            let size = chunk["size"].as_u64().ok_or(ERROR)?;
            if !valid_digest(hash) || size > 1024 * 1024 {
                return Err(ERROR);
            }
            let key = format!("uploads-v1/{namespace}/{hash}");
            if files.insert(key, size).is_some_and(|old| old != size) || files.len() > MAX_FILES {
                return Err(ERROR);
            }
        }
    }
    if files.len() + extras.len() > MAX_FILES
        || files
            .values()
            .try_fold(0u64, |sum, size| sum.checked_add(*size))
            .ok_or(ERROR)?
            > MAX_BYTES
    {
        return Err(ERROR);
    }
    let sql = stage.path().join("native.sql");
    let file = File::create(&sql).map_err(|_| ERROR)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))
            .map_err(|_| ERROR)?;
    }
    let mut output = tokio::fs::File::from_std(file);
    let connection: tokio_postgres::Config = dsn.parse().map_err(|_| ERROR)?;
    let socket: String = match connection.get_hosts() {
        #[cfg(unix)]
        [tokio_postgres::config::Host::Unix(socket)] => socket.to_str().ok_or(ERROR)?.to_owned(),
        _ => return Err(ERROR),
    };
    let user = connection.get_user().ok_or(ERROR)?;
    let database = connection.get_dbname().ok_or(ERROR)?;
    let password =
        std::str::from_utf8(connection.get_password().unwrap_or_default()).map_err(|_| ERROR)?;
    let mut child = tokio::process::Command::new(&config.pg_dump)
        .env_clear()
        .env("PGHOST", socket)
        .env(
            "PGPORT",
            connection
                .get_ports()
                .first()
                .copied()
                .unwrap_or(5432)
                .to_string(),
        )
        .env("PGUSER", user)
        .env("PGDATABASE", database)
        .env("PGPASSWORD", password)
        .args([
            "--no-owner",
            "--no-privileges",
            "--schema=aether_identity",
            "--schema=aether_access",
            "--schema=aether_store",
            "--schema=aether_settings",
            "--exclude-table-data=aether_identity.sessions",
            "--exclude-table-data=aether_identity.recovery",
            "--exclude-table-data=aether_identity.agent_connections",
            "--exclude-table-data=aether_access.live_editor_calls",
            "--exclude-table-data=aether_access.live_editors",
            "--exclude-table-data=aether_identity.oauth_requests",
            "--exclude-table-data=aether_identity.oauth_grants",
            "--exclude-table-data=aether_access.map_cast",
        ])
        .arg(format!("--snapshot={snapshot}"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| ERROR)?;
    let mut stream = child.stdout.take().ok_or(ERROR)?;
    let mut buffer = vec![0u8; 65536];
    let mut written = 0u64;
    let mut hash = Sha256::new();
    loop {
        let n = stream.read(&mut buffer).await.map_err(|_| ERROR)?;
        if n == 0 {
            break;
        }
        written = written.checked_add(n as u64).ok_or(ERROR)?;
        if written > MAX_BYTES {
            return Err(ERROR);
        }
        hash.update(&buffer[..n]);
        output.write_all(&buffer[..n]).await.map_err(|_| ERROR)?;
    }
    if !child.wait().await.map_err(|_| ERROR)?.success() {
        return Err("PostgreSQL recovery dump failed.");
    }
    output.sync_all().await.map_err(|_| ERROR)?;
    tx.commit()
        .await
        .map_err(|_| "Backup database snapshot ended unexpectedly.")?;
    let objects = config.objects.clone();
    let sql_entry = json!({"size":written,"sha256":format!("{:x}",hash.finalize())});
    let (stage, manifest) = tokio::task::spawn_blocking(move || {
        let manifest = build_files(stage.path(), &objects, &files, extras, tenant, sql_entry)?;
        Ok::<_, &'static str>((stage, manifest))
    })
    .await
    .map_err(|_| ERROR)??;
    // Atomic no-clobber publication: persist a private directory under a name
    // chosen by the operator. rename is only used after an exclusive name claim.
    let mut builder = std::fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(&config.destination).map_err(|_| ERROR)?;
    if std::fs::rename(stage.path(), &config.destination).is_err() {
        let _ = std::fs::remove_dir(&config.destination);
        return Err("Cannot publish verified backup directory.");
    }
    File::open(config.destination.parent().ok_or(ERROR)?)
        .and_then(|f| f.sync_all())
        .map_err(|_| ERROR)?;
    Ok(manifest)
}
#[cfg(unix)]
fn source(root: &Path, key: &str) -> Result<File> {
    use rustix::fs::{Mode, OFlags, open, openat};
    let mut fd = open(
        root,
        OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
        Mode::empty(),
    )
    .map_err(|_| ERROR)?;
    let segments: Vec<_> = key.split('/').collect();
    for (i, part) in segments.iter().enumerate() {
        let flags = OFlags::RDONLY
            | OFlags::NOFOLLOW
            | OFlags::CLOEXEC
            | OFlags::NONBLOCK
            | if i + 1 < segments.len() {
                OFlags::DIRECTORY
            } else {
                OFlags::empty()
            };
        fd = openat(&fd, *part, flags, Mode::empty()).map_err(|_| ERROR)?;
    }
    Ok(File::from(fd))
}
#[cfg(not(unix))]
fn source(_: &Path, _: &str) -> Result<File> {
    Err(ERROR)
}
fn build_files(
    stage: &Path,
    objects: &Path,
    files: &BTreeMap<String, u64>,
    extras: BTreeMap<String, Vec<u8>>,
    tenant: String,
    sql: Value,
) -> Result<Value> {
    let mut entries = BTreeMap::new();
    entries.insert("native.sql".to_string(), sql);
    for (key, size) in files {
        let mut input = source(objects, key)
            .map_err(|_| "A required backup content object cannot be opened.")?;
        if !input.metadata().map_err(|_| ERROR)?.is_file()
            || input.metadata().map_err(|_| ERROR)?.len() != *size
        {
            return Err(ERROR);
        }
        let name = format!("objects/{key}");
        let path = stage.join(&name);
        std::fs::create_dir_all(path.parent().ok_or(ERROR)?).map_err(|_| ERROR)?;
        let mut output = File::create(path).map_err(|_| ERROR)?;
        let mut hash = Sha256::new();
        let mut copied = 0;
        let mut buffer = [0u8; 65536];
        loop {
            let n = input.read(&mut buffer).map_err(|_| ERROR)?;
            if n == 0 {
                break;
            }
            copied += n as u64;
            if copied > *size {
                return Err(ERROR);
            }
            hash.update(&buffer[..n]);
            output.write_all(&buffer[..n]).map_err(|_| ERROR)?;
        }
        let sha = format!("{:x}", hash.finalize());
        if copied != *size || key.rsplit('/').next() != Some(sha.as_str()) {
            return Err("A required backup content object failed checksum verification.");
        }
        output.sync_all().map_err(|_| ERROR)?;
        entries.insert(name, json!({"size":size,"sha256":sha}));
    }
    let mut extra_size = 0u64;
    for (name, bytes) in extras {
        if !(name.starts_with("attachments/") || name.starts_with("workspaces/"))
            || name
                .split('/')
                .any(|s| s.is_empty() || matches!(s, "." | "..") || s.contains(['\\', '\0']))
        {
            return Err(ERROR);
        }
        extra_size = extra_size.checked_add(bytes.len() as u64).ok_or(ERROR)?;
        if extra_size > 256 * 1024 * 1024 {
            return Err(ERROR);
        }
        let path = stage.join(&name);
        std::fs::create_dir_all(path.parent().ok_or(ERROR)?).map_err(|_| ERROR)?;
        let mut file = File::create(path).map_err(|_| ERROR)?;
        file.write_all(&bytes).map_err(|_| ERROR)?;
        file.sync_all().map_err(|_| ERROR)?;
        entries.insert(name, json!({"size":bytes.len(),"sha256":digest(&bytes)}));
    }
    let manifest = json!({"schema":1,"tenant":tenant,"files":entries,"sessions_restored":false,"delegated_credentials_restored":false});
    let mut file = File::create(stage.join("manifest.json")).map_err(|_| ERROR)?;
    file.write_all(&serde_json::to_vec_pretty(&manifest).map_err(|_| ERROR)?)
        .map_err(|_| ERROR)?;
    file.sync_all().map_err(|_| ERROR)?;
    sync_directories(stage)?;
    Ok(manifest)
}
fn sync_directories(root: &Path) -> Result<()> {
    for entry in std::fs::read_dir(root).map_err(|_| ERROR)? {
        let entry = entry.map_err(|_| ERROR)?;
        if entry.file_type().map_err(|_| ERROR)?.is_dir() {
            sync_directories(&entry.path())?;
        }
    }
    File::open(root)
        .and_then(|f| f.sync_all())
        .map_err(|_| ERROR)
}
