//! Opt-in, immutable snapshots of trusted frontend build outputs. No user data.
mod serving;
mod snapshot;
#[cfg(test)]
mod tests;
use axum::body::Bytes;
use serde::Deserialize;
pub(super) use serving::decoded;
pub(super) use serving::serve;
use std::{
    collections::BTreeMap,
    io::Read,
    path::{Path, PathBuf},
    sync::Arc,
};

pub(super) const MAX_FILE: usize = 128 * 1024 * 1024;
pub(super) const MAX_TOTAL: usize = 512 * 1024 * 1024;
pub(super) const MAX_ENTRIES: usize = 100_000;
const INVALID: &str = "Invalid frontend configuration or build snapshot.";
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    schema: u8,
    studio: PathBuf,
    session: PathBuf,
    icons: PathBuf,
    branding: PathBuf,
    apps: BTreeMap<String, PathBuf>,
}
#[derive(Clone)]
struct Asset {
    bytes: Bytes,
    mime: &'static str,
}
#[derive(Default)]
struct Snapshot {
    files: BTreeMap<String, Asset>,
    apps: Vec<String>,
    total: usize,
    entries: usize,
}
#[derive(Clone)]
pub struct Frontends(Arc<Snapshot>);
impl Frontends {
    /// Call before listening, on operator-selected public builds. No request
    /// supplies a path. Startup failure is generic and never discloses contents.
    pub fn load(path: &Path) -> Result<Self, &'static str> {
        let mut bytes = Vec::new();
        std::fs::File::open(path)
            .map_err(|_| INVALID)?
            .take(16 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| INVALID)?;
        if bytes.len() > 16 * 1024 {
            return Err(INVALID);
        }
        let config: Config = serde_json::from_slice(&bytes).map_err(|_| INVALID)?;
        let catalog = super::status::catalog();
        if config.schema != 1
            || config
                .apps
                .keys()
                .any(|id| !catalog.iter().any(|a| a.id == *id))
        {
            return Err(INVALID);
        }
        let base = path.parent().ok_or(INVALID)?;
        let resolve = |p: &Path| {
            if p.is_absolute() {
                p.to_owned()
            } else {
                base.join(p)
            }
        };
        let mut snapshot = Snapshot::default();
        snapshot.tree(&resolve(&config.studio), "", None)?;
        if !snapshot.files.contains_key("/index.html") {
            return Err(INVALID);
        }
        snapshot.session(&resolve(&config.session))?;
        snapshot.tree(&resolve(&config.branding), "/icons", None)?;
        snapshot.tree(&resolve(&config.icons), "/suite/icons", Some("svg"))?;
        for (id, root) in config.apps {
            snapshot.tree(&resolve(&root), &format!("/{id}"), None)?;
            if !snapshot.files.contains_key(&format!("/{id}/index.html")) {
                return Err(INVALID);
            }
            snapshot.apps.push(id);
        }
        // Inline only platform-owned metadata/bootstrap tags, never operator text.
        let html: Vec<String> = snapshot
            .files
            .iter()
            .filter(|(_, a)| a.mime == "text/html; charset=utf-8")
            .map(|(p, _)| p.clone())
            .collect();
        for path in html {
            let app = path
                .trim_start_matches('/')
                .split('/')
                .next()
                .filter(|id| snapshot.apps.iter().any(|a| a == id))
                .unwrap_or("studio");
            let asset = snapshot.files.get(&path).ok_or(INVALID)?;
            let source = std::str::from_utf8(&asset.bytes).map_err(|_| INVALID)?;
            let inject = format!(
                "<meta name=\"aether-app\" content=\"{app}\"><link rel=\"stylesheet\" href=\"/suite/account.css\"><script type=\"module\" src=\"/suite/account.js\"></script></head>"
            );
            // Vite also emits valid fragment documents (the CAD gallery) with
            // an implicit head. Supply one before those fragments.
            let bytes = Bytes::from(if source.contains("</head>") {
                source.replacen("</head>", &inject, 1)
            } else {
                format!("<head>{inject}{source}")
            });
            snapshot.total = snapshot.total - asset.bytes.len() + bytes.len();
            if snapshot.total > MAX_TOTAL || bytes.len() > MAX_FILE {
                return Err(INVALID);
            }
            snapshot.files.insert(
                path,
                Asset {
                    bytes,
                    mime: "text/html; charset=utf-8",
                },
            );
        }
        Ok(Self(Arc::new(snapshot)))
    }
    pub(super) fn installed(&self, app: &str) -> bool {
        self.0.apps.iter().any(|a| a == app)
    }
    pub(super) fn accepts_path(&self, path: &str) -> bool {
        let Some(path) = serving::decoded(path) else {
            return false;
        };
        if path == "/api" || path.starts_with("/api/") {
            return false;
        }
        path == "/"
            || self.0.files.contains_key(&path)
            || self
                .0
                .apps
                .iter()
                .any(|a| path == format!("/{a}") || path == format!("/{a}/"))
    }
}
