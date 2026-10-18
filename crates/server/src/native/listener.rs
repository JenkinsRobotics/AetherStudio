//! Operator-owned HTTP/TLS transport. Remote listeners never silently downgrade
//! to plaintext. Proxy headers do not define the application's public origin.
use axum::Router;
use axum_server::{Handle, tls_rustls::RustlsConfig};
use std::{
    io::Read,
    net::{IpAddr, SocketAddr, TcpListener},
    path::{Path, PathBuf},
    time::Duration,
};

#[derive(Clone)]
pub struct Configuration {
    pub address: SocketAddr,
    pub public_origin: Option<String>,
    pub certificate: Option<PathBuf>,
    pub private_key: Option<PathBuf>,
}
pub struct Listener {
    socket: TcpListener,
    tls: Option<RustlsConfig>,
    origin: String,
}
fn read_pem(path: &Path, secret: bool) -> Result<Vec<u8>, String> {
    if !path.is_absolute() {
        return Err("TLS paths must be absolute.".into());
    }
    #[cfg(unix)]
    let file = {
        use rustix::fs::{Mode, OFlags, open};
        let fd = open(
            path,
            OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::CLOEXEC | OFlags::NONBLOCK,
            Mode::empty(),
        )
        .map_err(|_| "Cannot open TLS material.")?;
        std::fs::File::from(fd)
    };
    #[cfg(not(unix))]
    let file = std::fs::File::open(path).map_err(|_| "Cannot open TLS material.")?;
    let info = file
        .metadata()
        .map_err(|_| "Cannot inspect TLS material.")?;
    if !info.is_file() || info.len() > 1024 * 1024 {
        return Err("TLS material must be a bounded regular file.".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if secret && info.permissions().mode() & 0o077 != 0 {
            return Err("TLS private key must be accessible only to its owner.".into());
        }
    }
    #[cfg(not(unix))]
    let _ = secret;
    let mut bytes = Vec::new();
    file.take(1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read TLS material.")?;
    if bytes.len() > 1024 * 1024 {
        return Err("TLS material exceeds limit.".into());
    }
    Ok(bytes)
}
impl Listener {
    pub async fn bind(config: Configuration) -> Result<Self, String> {
        Self::prepare(config, None).await
    }
    pub(super) async fn prepare(
        config: Configuration,
        existing: Option<TcpListener>,
    ) -> Result<Self, String> {
        let tls = match (config.certificate, config.private_key) {
            (None, None) => None,
            (Some(cert), Some(key)) => {
                let _ = rustls::crypto::ring::default_provider().install_default();
                let (cert, key) = tokio::task::spawn_blocking(move || {
                    Ok::<_, String>((read_pem(&cert, false)?, read_pem(&key, true)?))
                })
                .await
                .map_err(|_| "TLS configuration task failed.")??;
                let tls = RustlsConfig::from_pem(cert, key)
                    .await
                    .map_err(|_| "TLS certificate and private key are invalid or do not match.")?;
                // The current origin boundary validates HTTP/1 Host headers.
                // Do not advertise HTTP/2 before pseudo-header handling is qualified.
                let mut configuration = (*tls.get_inner()).clone();
                configuration.alpn_protocols = vec![b"http/1.1".to_vec()];
                Some(RustlsConfig::from_config(std::sync::Arc::new(
                    configuration,
                )))
            }
            _ => return Err("Configure both the TLS certificate and private key.".into()),
        };
        if !config.address.ip().is_loopback() && tls.is_none() {
            return Err("Network listeners require HTTPS.".into());
        }
        let socket = if let Some(socket) = existing {
            if socket
                .local_addr()
                .map_err(|_| "Cannot inspect existing listener.")?
                != config.address
            {
                return Err("Existing listener address does not match.".into());
            }
            socket
        } else {
            TcpListener::bind(config.address)
                .map_err(|_| "The native listener address is unavailable.")?
        };
        socket
            .set_nonblocking(true)
            .map_err(|_| "Cannot configure native listener.")?;
        let address = socket
            .local_addr()
            .map_err(|_| "Cannot read listener address.")?;
        let origin = match config.public_origin {
            Some(origin) => origin,
            None if address.ip().is_loopback() => format!(
                "{}://{address}",
                if tls.is_some() { "https" } else { "http" }
            ),
            None => {
                return Err("A network listener requires an explicit HTTPS public origin.".into());
            }
        };
        let url = reqwest::Url::parse(&origin).map_err(|_| "Invalid native public origin.")?;
        let local = url.host_str().is_some_and(|host| {
            host == "localhost"
                || host
                    .trim_matches(['[', ']'])
                    .parse::<IpAddr>()
                    .is_ok_and(|ip| ip.is_loopback())
        });
        if (url.scheme() == "https") != tls.is_some()
            || !matches!(url.scheme(), "http" | "https")
            || (url.scheme() == "http" && !local)
            || (address.ip().is_loopback() && !local)
            || url.port_or_known_default() != Some(address.port())
            || !url.username().is_empty()
            || url.password().is_some()
            || url.host_str().is_none()
            || url.path() != "/"
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(
                "Use a matching HTTPS origin and listener port, or loopback HTTP for local use."
                    .into(),
            );
        }
        Ok(Self {
            socket,
            tls,
            origin: url.origin().ascii_serialization(),
        })
    }
    pub fn origin(&self) -> &str {
        &self.origin
    }
    pub fn address(&self) -> std::io::Result<SocketAddr> {
        self.socket.local_addr()
    }
    pub(super) fn socket_clone(&self) -> std::io::Result<TcpListener> {
        self.socket.try_clone()
    }
    pub async fn serve(
        self,
        router: Router,
        shutdown: impl std::future::Future<Output = ()> + Send + 'static,
    ) -> std::io::Result<()> {
        let handle = Handle::new();
        let stop = handle.clone();
        let watcher = tokio::spawn(async move {
            shutdown.await;
            stop.graceful_shutdown(Some(Duration::from_secs(30)));
        });
        let service = router.into_make_service_with_connect_info::<SocketAddr>();
        let result = match self.tls {
            Some(tls) => match axum_server::from_tcp_rustls(self.socket, tls) {
                Ok(server) => server.handle(handle).serve(service).await,
                Err(error) => Err(error),
            },
            None => match axum_server::from_tcp(self.socket) {
                Ok(server) => server.handle(handle).serve(service).await,
                Err(error) => Err(error),
            },
        };
        watcher.abort();
        result
    }
}
