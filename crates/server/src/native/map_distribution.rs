//! Verified product-owned player downloads. No legacy host or product source import.
use super::{
    NativeHost,
    boundary::{Result, device_token, token},
};
use crate::documents::Error;
use axum::{
    Json,
    body::{Body, Bytes},
    extract::{Path, State},
    http::{HeaderMap, Method},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::Path as FilePath,
    sync::Arc,
};
use tokio::{io::AsyncReadExt, sync::Semaphore};
const INVALID: &str = "Invalid Map download distribution.";
const ANDROID_APK: &str = "aether-map-receiver.apk";
const NAMES: [&str; 6] = [
    "install.sh",
    "aether_player.py",
    "aether_setup.py",
    "aether_receiver.py",
    "aether-projector-setup.sh",
    "app.zip",
];
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    schema: u8,
    app: String,
    files: BTreeMap<String, Entry>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Entry {
    size: u64,
    sha256: String,
}
struct Snapshot {
    directory: tempfile::TempDir,
    files: BTreeMap<String, Entry>,
    installer: String,
    streams: Arc<Semaphore>,
}
#[derive(Clone)]
pub struct Distribution(Arc<Snapshot>);
fn open(path: &FilePath) -> std::result::Result<std::fs::File, &'static str> {
    #[cfg(unix)]
    let file = {
        use rustix::fs::{Mode, OFlags, open};
        std::fs::File::from(
            open(
                path,
                OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::NONBLOCK | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(|_| INVALID)?,
        )
    };
    #[cfg(not(unix))]
    let file = {
        if std::fs::symlink_metadata(path)
            .map_err(|_| INVALID)?
            .file_type()
            .is_symlink()
        {
            return Err(INVALID);
        }
        std::fs::File::open(path).map_err(|_| INVALID)?
    };
    if !file.metadata().map_err(|_| INVALID)?.is_file() {
        return Err(INVALID);
    }
    Ok(file)
}
impl Distribution {
    pub fn load(path: &FilePath) -> std::result::Result<Self, &'static str> {
        let mut bytes = Vec::new();
        open(path)?
            .take(16385)
            .read_to_end(&mut bytes)
            .map_err(|_| INVALID)?;
        if bytes.len() > 16384 {
            return Err(INVALID);
        }
        let manifest: Manifest = serde_json::from_slice(&bytes).map_err(|_| INVALID)?;
        if !matches!(manifest.schema, 1 | 2)
            || manifest.app != "map"
            || manifest.files.len() != NAMES.len() + usize::from(manifest.schema == 2)
            || NAMES.iter().any(|n| !manifest.files.contains_key(*n))
            || (manifest.schema == 2 && !manifest.files.contains_key(ANDROID_APK))
        {
            return Err(INVALID);
        }
        let directory = tempfile::tempdir().map_err(|_| INVALID)?;
        for (name, entry) in &manifest.files {
            let max = if name == "app.zip" {
                512 * 1024 * 1024
            } else if name == ANDROID_APK {
                128 * 1024 * 1024
            } else if name == "aether-projector-setup.sh" {
                8 * 1024 * 1024
            } else {
                1024 * 1024
            };
            if entry.size == 0 || entry.size > max {
                return Err(INVALID);
            }
            let mut source = open(&path.parent().ok_or(INVALID)?.join(name))?;
            let mut out = tempfile::NamedTempFile::new_in(directory.path()).map_err(|_| INVALID)?;
            let mut sha = Sha256::new();
            let mut count = 0;
            let mut buffer = [0u8; 65536];
            loop {
                let size = source.read(&mut buffer).map_err(|_| INVALID)?;
                if size == 0 {
                    break;
                }
                count += size as u64;
                if count > entry.size {
                    return Err(INVALID);
                }
                sha.update(&buffer[..size]);
                out.write_all(&buffer[..size]).map_err(|_| INVALID)?;
            }
            if count != entry.size || format!("{:x}", sha.finalize()) != entry.sha256 {
                return Err(INVALID);
            }
            out.persist(directory.path().join(name))
                .map_err(|_| INVALID)?;
        }
        let installer =
            std::fs::read_to_string(directory.path().join("install.sh")).map_err(|_| INVALID)?;
        if !installer.contains("@@AETHER_SERVER_URL@@") {
            return Err(INVALID);
        }
        Ok(Self(Arc::new(Snapshot {
            directory,
            files: manifest.files,
            installer,
            streams: Arc::new(Semaphore::new(8)),
        })))
    }
}
pub(super) async fn ping(State(host): State<NativeHost>) -> Result<Json<serde_json::Value>> {
    let distribution = host.map_distribution.as_ref().ok_or(Error::Unavailable)?;
    Ok(Json(
        serde_json::json!({"ok":true,"app":"map","androidReceiver":distribution.0.files.contains_key(ANDROID_APK)}),
    ))
}
pub(super) async fn serve(
    State(host): State<NativeHost>,
    Path(name): Path<String>,
    method: Method,
    headers: HeaderMap,
) -> Result<Response> {
    if !NAMES.contains(&name.as_str()) && name != ANDROID_APK {
        return Err(Error::Denied.into());
    }
    if name == "app.zip" {
        let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
        if headers.contains_key("authorization") {
            let bearer =
                device_token(&headers, true)?.ok_or(aether_identity::Error::Unauthorized)?;
            docs.map_device_show(&bearer).await?;
        } else {
            let session = token(&headers)?;
            let (status, apps) = docs.application_status(Some(&session), &["map"]).await?;
            let user = status.user.ok_or(aether_identity::Error::Unauthorized)?;
            if user.must_change {
                return Err(aether_identity::Error::Forbidden.into());
            }
            if apps.is_empty() {
                return Err(Error::Denied.into());
            }
        }
    }
    let distribution = host
        .map_distribution
        .as_ref()
        .ok_or(Error::Unavailable)?
        .clone();
    let mime = if name == "app.zip" {
        "application/zip"
    } else if name == ANDROID_APK {
        "application/vnd.android.package-archive"
    } else if name.ends_with(".py") {
        "text/x-python; charset=utf-8"
    } else {
        "text/x-shellscript; charset=utf-8"
    };
    let (length, body) = if name == "install.sh" {
        // The canonical origin contains no credentials, path, query or fragment.
        // Escape shell double-quoted metacharacters even for operator input.
        let address = host
            .origin
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('$', "\\$")
            .replace('`', "\\`");
        let bytes = distribution
            .0
            .installer
            .replace("@@AETHER_SERVER_URL@@", &address);
        (
            bytes.len() as u64,
            if method == Method::HEAD {
                Body::empty()
            } else {
                Body::from(bytes)
            },
        )
    } else {
        let length = distribution
            .0
            .files
            .get(&name)
            .ok_or(Error::Unavailable)?
            .size;
        let body = if method == Method::HEAD {
            Body::empty()
        } else {
            let permit = distribution
                .0
                .streams
                .clone()
                .try_acquire_owned()
                .map_err(|_| aether_identity::Error::Throttled)?;
            let file = tokio::fs::File::open(distribution.0.directory.path().join(&name))
                .await
                .map_err(|_| Error::Unavailable)?;
            let stream = futures_util::stream::try_unfold(
                (file, distribution, permit),
                |(mut file, owner, permit)| async move {
                    let mut bytes = vec![0u8; 65536];
                    let count = file.read(&mut bytes).await?;
                    if count == 0 {
                        return Ok::<_, std::io::Error>(None);
                    }
                    bytes.truncate(count);
                    Ok(Some((Bytes::from(bytes), (file, owner, permit))))
                },
            );
            Body::from_stream(stream)
        };
        (length, body)
    };
    Ok((
        [
            ("content-type", mime.to_owned()),
            ("content-length", length.to_string()),
            (
                "content-disposition",
                format!("attachment; filename=\"{name}\""),
            ),
            ("cache-control", "no-store".into()),
            ("x-content-type-options", "nosniff".into()),
            (
                "content-security-policy",
                "sandbox; default-src 'none'".into(),
            ),
        ],
        body,
    )
        .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        let mut entries = serde_json::Map::new();
        for name in NAMES {
            let bytes = if name == "install.sh" {
                b"SERVER_URL=\"@@AETHER_SERVER_URL@@\"\n".as_slice()
            } else {
                b"verified product bytes".as_slice()
            };
            std::fs::write(root.path().join(name), bytes).unwrap();
            entries.insert(name.into(), serde_json::json!({"size":bytes.len(),"sha256":format!("{:x}",Sha256::digest(bytes))}));
        }
        std::fs::write(
            root.path().join("map-downloads.json"),
            serde_json::to_vec(&serde_json::json!({"schema":1,"app":"map","files":entries}))
                .unwrap(),
        )
        .unwrap();
        root
    }
    #[test]
    fn verifies_and_snapshots_each_installed_file() {
        let root = fixture();
        let bundle = Distribution::load(&root.path().join("map-downloads.json")).unwrap();
        std::fs::write(root.path().join("app.zip"), b"changed").unwrap();
        assert!(Distribution::load(&root.path().join("map-downloads.json")).is_err());
        assert_eq!(
            std::fs::read(bundle.0.directory.path().join("app.zip")).unwrap(),
            b"verified product bytes"
        );
    }
    #[test]
    fn rejects_manifest_paths_bounds_and_missing_files() {
        for damage in ["path", "size", "hash", "missing", "extra", "schema"] {
            let root = fixture();
            let path = root.path().join("map-downloads.json");
            let mut manifest: serde_json::Value =
                serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
            match damage {
                "path" => {
                    let v = manifest["files"]
                        .as_object_mut()
                        .unwrap()
                        .remove("app.zip")
                        .unwrap();
                    manifest["files"]["../app.zip"] = v;
                }
                "size" => manifest["files"]["app.zip"]["size"] = (512u64 * 1024 * 1024 + 1).into(),
                "hash" => manifest["files"]["app.zip"]["sha256"] = "wrong".into(),
                "missing" => {
                    std::fs::remove_file(root.path().join("aether_setup.py")).unwrap();
                }
                "extra" => manifest["unknown"] = true.into(),
                "schema" => manifest["schema"] = 2.into(),
                _ => unreachable!(),
            }
            std::fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
            assert!(Distribution::load(&path).is_err(), "{damage}");
        }
    }
    #[cfg(unix)]
    #[test]
    fn rejects_symlink_and_non_regular_members() {
        let root = fixture();
        std::fs::remove_file(root.path().join("app.zip")).unwrap();
        std::os::unix::fs::symlink(
            root.path().join("aether_player.py"),
            root.path().join("app.zip"),
        )
        .unwrap();
        assert!(Distribution::load(&root.path().join("map-downloads.json")).is_err());
        std::fs::remove_file(root.path().join("app.zip")).unwrap();
        std::fs::create_dir(root.path().join("app.zip")).unwrap();
        assert!(Distribution::load(&root.path().join("map-downloads.json")).is_err());
    }
    #[tokio::test]
    async fn pending_streams_are_bounded_and_cancellation_releases_capacity() {
        let root = fixture();
        let distribution = Distribution::load(&root.path().join("map-downloads.json")).unwrap();
        let pool = deadpool_postgres::Pool::builder(deadpool_postgres::Manager::new(
            "host=/tmp/aether-no-database".parse().unwrap(),
            tokio_postgres::NoTls,
        ))
        .max_size(1)
        .build()
        .unwrap();
        let host = NativeHost::new(
            aether_identity::Identity::new(pool, "demo", 1).unwrap(),
            "http://localhost",
            4,
            std::time::Duration::from_secs(5),
        )
        .unwrap()
        .with_map_distribution(distribution);
        let mut pending = Vec::new();
        for _ in 0..8 {
            pending.push(
                serve(
                    State(host.clone()),
                    Path("aether_setup.py".into()),
                    Method::GET,
                    HeaderMap::new(),
                )
                .await
                .ok()
                .unwrap(),
            );
        }
        let rejected = serve(
            State(host.clone()),
            Path("aether_setup.py".into()),
            Method::GET,
            HeaderMap::new(),
        )
        .await
        .err()
        .unwrap();
        assert_eq!(rejected.into_response().status(), 429);
        pending.pop();
        assert!(
            serve(
                State(host),
                Path("aether_setup.py".into()),
                Method::GET,
                HeaderMap::new()
            )
            .await
            .is_ok()
        );
    }
    #[tokio::test]
    async fn optional_android_apk_is_hashed_bounded_and_served_only_when_packaged() {
        let root = fixture();
        let path = root.path().join("map-downloads.json");
        let mut manifest: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        let apk = b"APK fixture: distribution verifies trusted product bytes, not Android signing";
        std::fs::write(root.path().join(ANDROID_APK), apk).unwrap();
        manifest["files"][ANDROID_APK] =
            serde_json::json!({"size":apk.len(),"sha256":format!("{:x}",Sha256::digest(apk))});
        std::fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
        assert!(
            Distribution::load(&path).is_err(),
            "schema1 must not silently grow"
        );
        manifest["schema"] = 2.into();
        std::fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
        let distribution = Distribution::load(&path).unwrap();
        std::fs::write(root.path().join(ANDROID_APK), b"tampered").unwrap();
        assert!(Distribution::load(&path).is_err());
        let pool = deadpool_postgres::Pool::builder(deadpool_postgres::Manager::new(
            "host=/tmp/aether-no-database".parse().unwrap(),
            tokio_postgres::NoTls,
        ))
        .max_size(1)
        .build()
        .unwrap();
        let host = NativeHost::new(
            aether_identity::Identity::new(pool, "demo", 1).unwrap(),
            "http://localhost",
            4,
            std::time::Duration::from_secs(5),
        )
        .unwrap()
        .with_map_distribution(distribution);
        assert_eq!(
            ping(State(host.clone())).await.ok().unwrap().0["androidReceiver"],
            true
        );
        let response = serve(
            State(host.clone()),
            Path(ANDROID_APK.into()),
            Method::GET,
            HeaderMap::new(),
        )
        .await
        .ok()
        .unwrap();
        assert_eq!(
            response.headers()["content-type"],
            "application/vnd.android.package-archive"
        );
        assert_eq!(response.headers()["x-content-type-options"], "nosniff");
        assert_eq!(
            response.headers()["content-disposition"],
            "attachment; filename=\"aether-map-receiver.apk\""
        );
        assert_eq!(
            axum::body::to_bytes(response.into_body(), 1024)
                .await
                .unwrap()
                .as_ref(),
            apk
        );
        let response = serve(
            State(host),
            Path(ANDROID_APK.into()),
            Method::HEAD,
            HeaderMap::new(),
        )
        .await
        .ok()
        .unwrap();
        assert_eq!(response.headers()["content-length"], apk.len().to_string());
        assert!(
            axum::body::to_bytes(response.into_body(), 1024)
                .await
                .unwrap()
                .is_empty()
        );
        manifest["files"][ANDROID_APK]["size"] = (128u64 * 1024 * 1024 + 1).into();
        std::fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
        assert!(Distribution::load(&path).is_err());
    }
    #[test]
    #[ignore = "explicit immutable product distribution path"]
    fn actual_android_product_distribution_loads_into_verified_snapshot() {
        let path = std::path::PathBuf::from(
            std::env::var("AETHER_TEST_MAP_DOWNLOADS").expect("explicit candidate manifest"),
        );
        let distribution = Distribution::load(&path).unwrap();
        assert!(distribution.0.files.contains_key(ANDROID_APK));
        let entry = &distribution.0.files[ANDROID_APK];
        let bytes = std::fs::read(distribution.0.directory.path().join(ANDROID_APK)).unwrap();
        assert_eq!(bytes.len() as u64, entry.size);
        assert_eq!(format!("{:x}", Sha256::digest(bytes)), entry.sha256);
    }
}
