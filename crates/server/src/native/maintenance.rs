//! Read-only diagnostics of the running host. Paths come only from the operator;
//! no HTTP argument chooses a filesystem location or executable.
use super::{
    NativeHost,
    boundary::{Result, token},
};
use crate::documents::Error;
use axum::{Json, extract::State, http::HeaderMap};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

#[derive(Clone)]
pub struct Diagnostics {
    objects: PathBuf,
}
impl Diagnostics {
    pub fn new(objects: &Path) -> std::io::Result<Self> {
        if !objects.is_absolute() || !objects.is_dir() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Use the absolute object storage directory.",
            ));
        }
        Ok(Self {
            objects: objects.canonicalize()?,
        })
    }
    fn storage(&self) -> Value {
        #[cfg(unix)]
        let free = rustix::fs::statvfs(&self.objects)
            .ok()
            .and_then(|s| s.f_bavail.checked_mul(s.f_frsize));
        #[cfg(not(unix))]
        let free: Option<u64> = None;
        json!({"data_directory":self.objects,"free_bytes":free})
    }
}
pub(super) async fn read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    let counts = docs.maintenance_counts(&session).await?;
    let settings = host.settings.as_ref().ok_or(Error::Unavailable)?;
    let presentation = settings.read(&session).await?.presentation;
    let storage = if let Some(backups) = &host.backups {
        backups.state().await?.0
    } else {
        match host.diagnostics.clone() {
            Some(value) => tokio::task::spawn_blocking(move || value.storage())
                .await
                .map_err(|_| Error::Unavailable)?,
            None => Value::Null,
        }
    };
    let restart_required = if let Some(network) = &host.network {
        network.state().await?.2
    } else {
        false
    };
    Ok(Json(json!({
        "installation": {"platform":std::env::consts::OS,"runtime":"Rust", "runtime_version":env!("CARGO_PKG_VERSION"),
            "service":"Aether Studio native host", "managed_lifecycle":false, "commands":{},
            "data_directory":storage.get("data_directory").cloned().unwrap_or(Value::Null)},
        "network":{"name":presentation.name,"public_url":host.origin,
            "bind_address":host.listen_address.map(|a|a.ip().to_string()),"port":host.listen_address.map(|a|a.port())},
        "https":host.secure,"restart_required":restart_required,"storage":storage,"counts":counts,
        "uptime_s":host.started.elapsed().as_secs(),
        "capabilities":{"backups":host.backups.is_some(),"network_settings":host.network.is_some(),"mail":host.mail.is_some()},
        "applications":host.catalog.iter().map(|app|json!({"id":app.id,"installed":host.frontends.as_ref().is_some_and(|web|web.installed(&app.id))})).collect::<Vec<_>>()
    })))
}
