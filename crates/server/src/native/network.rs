//! Authenticated listener management. Save validates a candidate without stopping
//! the current listener; restart reserves its socket/TLS before draining traffic.
use super::{
    NativeHost,
    boundary::{Result, body, token},
    listener::Listener,
};
use crate::{documents::Error, settings::Settings};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::HeaderMap,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    net::{IpAddr, SocketAddr, TcpListener},
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::sync::{Mutex, mpsc, oneshot};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Configuration {
    pub name: String,
    pub bind_address: String,
    pub port: u16,
    pub public_url: String,
    pub tls_cert: String,
    pub tls_key: String,
}
impl Configuration {
    pub fn listener(&self) -> std::result::Result<super::listener::Configuration, String> {
        let address: IpAddr = self
            .bind_address
            .parse()
            .map_err(|_| "Invalid bind address.")?;
        if !(1024..=65535).contains(&self.port)
            || self.name.trim().is_empty()
            || self.name.len() > 80
        {
            return Err("Use a server name and an unprivileged listener port.".into());
        }
        Ok(super::listener::Configuration {
            address: SocketAddr::new(address, self.port),
            public_origin: Some(self.public_url.clone()),
            certificate: (!self.tls_cert.is_empty()).then(|| self.tls_cert.clone().into()),
            private_key: (!self.tls_key.is_empty()).then(|| self.tls_key.clone().into()),
        })
    }
    pub fn authorized_tls(
        &self,
        root: Option<&Path>,
        operator_cert: Option<&Path>,
        operator_key: Option<&Path>,
    ) -> std::result::Result<(), String> {
        for (value, existing) in [
            (&self.tls_cert, operator_cert),
            (&self.tls_key, operator_key),
        ] {
            if value.is_empty() {
                continue;
            }
            let path = Path::new(value);
            if existing == Some(path) {
                continue;
            }
            let root = root
                .ok_or("TLS paths must be selected by the server operator.")?
                .canonicalize()
                .map_err(|_| "TLS directory is unavailable.")?;
            let resolved = path
                .canonicalize()
                .map_err(|_| "TLS material is unavailable.")?;
            if !path.is_absolute() || !resolved.starts_with(&root) {
                return Err(
                    "TLS files must be inside the operator's certificate directory.".into(),
                );
            }
        }
        Ok(())
    }
}
struct Running {
    configuration: Configuration,
    socket: TcpListener,
    restarting: bool,
}
struct Inner {
    settings: Settings,
    instance: String,
    tls_root: Option<PathBuf>,
    operator_cert: Option<PathBuf>,
    operator_key: Option<PathBuf>,
    running: Mutex<Running>,
    queue: mpsc::Sender<Restart>,
}
#[derive(Clone)]
pub struct Network(Arc<Inner>);
pub struct Restart {
    configuration: Configuration,
    listener: Listener,
}
impl Network {
    pub fn new(
        settings: Settings,
        instance: &str,
        tls_root: Option<PathBuf>,
        configuration: Configuration,
        listener: &Listener,
    ) -> std::result::Result<(Self, mpsc::Receiver<Restart>), String> {
        if instance.is_empty()
            || instance.len() > 80
            || !instance
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_".contains(&b))
        {
            return Err("Use a stable installation identifier.".into());
        }
        if let Some(root) = &tls_root
            && (!root.is_absolute() || !root.is_dir())
        {
            return Err("Use an existing absolute TLS directory.".into());
        }
        let (queue, receiver) = mpsc::channel(1);
        let socket = listener
            .socket_clone()
            .map_err(|_| "Cannot retain listener lease.")?;
        Ok((
            Self(Arc::new(Inner {
                settings,
                instance: instance.into(),
                tls_root,
                operator_cert: (!configuration.tls_cert.is_empty())
                    .then(|| configuration.tls_cert.clone().into()),
                operator_key: (!configuration.tls_key.is_empty())
                    .then(|| configuration.tls_key.clone().into()),
                running: Mutex::new(Running {
                    configuration,
                    socket,
                    restarting: false,
                }),
                queue,
            })),
            receiver,
        ))
    }
    pub(super) async fn state(
        &self,
    ) -> std::result::Result<(Configuration, Configuration, bool), Error> {
        let running = self.0.running.lock().await;
        let mut pending = self
            .0
            .settings
            .network_snapshot(&self.0.instance)
            .await
            .map_err(|_| Error::Unavailable)?
            .unwrap_or_else(|| running.configuration.clone());
        pending.name = self
            .0
            .settings
            .snapshot()
            .await
            .map_err(|_| Error::Unavailable)?
            .presentation
            .name()
            .to_owned();
        let changed = pending != running.configuration || running.restarting;
        Ok((pending, running.configuration.clone(), changed))
    }
    async fn prepare(
        &self,
        value: &Configuration,
        running: &Running,
    ) -> std::result::Result<Listener, Error> {
        value
            .authorized_tls(
                self.0.tls_root.as_deref(),
                self.0.operator_cert.as_deref(),
                self.0.operator_key.as_deref(),
            )
            .map_err(|_| Error::Invalid)?;
        let config = value.listener().map_err(|_| Error::Invalid)?;
        let current = running
            .socket
            .local_addr()
            .map_err(|_| Error::Unavailable)?;
        // Keeping the old socket leased gives same-address restarts a reliable
        // fallback. A changed binding must use a free port so it can be reserved.
        let socket = if config.address == current {
            Some(running.socket.try_clone().map_err(|_| Error::Unavailable)?)
        } else {
            None
        };
        Listener::prepare(config, socket)
            .await
            .map_err(|_| Error::Invalid)
    }
    async fn save(
        &self,
        session: &str,
        mut value: Configuration,
    ) -> std::result::Result<(), super::boundary::Failure> {
        self.0.settings.read(session).await?;
        let running = self.0.running.lock().await;
        if running.restarting {
            return Err(Error::Conflict.into());
        }
        value.name = value.name.trim().into();
        let candidate = self.prepare(&value, &running).await?;
        value.public_url = candidate.origin().into();
        value.bind_address = candidate
            .address()
            .map_err(|_| Error::Unavailable)?
            .ip()
            .to_string();
        self.0
            .settings
            .network_save(session, &self.0.instance, &value)
            .await?;
        Ok(())
    }
    async fn restart(
        &self,
        session: &str,
    ) -> std::result::Result<String, super::boundary::Failure> {
        self.0.settings.read(session).await?;
        let mut running = self.0.running.lock().await;
        if running.restarting {
            return Err(Error::Conflict.into());
        }
        let configuration = self
            .0
            .settings
            .network_snapshot(&self.0.instance)
            .await?
            .unwrap_or_else(|| running.configuration.clone());
        let listener = self.prepare(&configuration, &running).await?;
        let permit = self.0.queue.try_reserve().map_err(|_| Error::Conflict)?;
        self.0
            .settings
            .network_restart_requested(session, &self.0.instance)
            .await?;
        let url = listener.origin().to_owned();
        running.restarting = true;
        permit.send(Restart {
            configuration,
            listener,
        });
        Ok(url)
    }
    pub async fn serve(
        &self,
        mut listener: Listener,
        mut host: NativeHost,
        mut requests: mpsc::Receiver<Restart>,
        shutdown: impl std::future::Future<Output = ()> + Send + 'static,
    ) -> std::io::Result<()> {
        tokio::pin!(shutdown);
        loop {
            let (stop, receive) = oneshot::channel();
            let app = super::router(host.clone());
            let mut server = tokio::spawn(listener.serve(app, async move {
                let _ = receive.await;
            }));
            let request = tokio::select! {
                result=&mut server=>return result.map_err(std::io::Error::other)?,
                _=&mut shutdown=>{let _=stop.send(());return server.await.map_err(std::io::Error::other)?;},
                request=requests.recv()=>request,
            };
            let Some(request) = request else {
                let _ = stop.send(());
                return server.await.map_err(std::io::Error::other)?;
            };
            // Socket and TLS were already acquired while the old host was live.
            // Validation/reservation failures therefore never interrupt service.
            let _ = stop.send(());
            server.await.map_err(std::io::Error::other)??;
            listener = request.listener;
            host = host
                .rebound(listener.origin(), listener.address()?)
                .map_err(std::io::Error::other)?;
            let mut running = self.0.running.lock().await;
            running.configuration = request.configuration;
            running.socket = listener.socket_clone()?;
            running.restarting = false;
        }
    }
}
pub(super) async fn change(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Configuration>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    host.network
        .as_ref()
        .ok_or(Error::Unavailable)?
        .save(&session, body(input)?)
        .await?;
    Ok(Json(json!({"ok":true,"restart_required":true})))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Empty {}
pub(super) async fn restart(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Empty>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    body(input)?;
    let url = host
        .network
        .as_ref()
        .ok_or(Error::Unavailable)?
        .restart(&session)
        .await?;
    Ok(Json(json!({"ok":true,"url":url})))
}
