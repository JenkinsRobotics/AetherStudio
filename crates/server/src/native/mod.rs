//! Native identity and authorized document integration. No legacy session proxy
//! or application frontend fallback.
mod admin_directory;
mod admin_state;
mod admission;
mod agents;
pub mod animation;
mod automation;
pub mod backups;
mod boundary;
mod changes;
pub mod configuration;
mod documents;
mod download;
mod drive;
pub mod frontends;
pub mod installation;
mod library;
pub mod listener;
mod mail;
pub mod maintenance;
mod map_devices;
pub mod map_distribution;
mod map_exports;
mod map_media;
mod map_pixabay;
mod map_search;
mod mcp_http;
pub mod network;
mod oauth;
pub mod presentation;
mod product_services;
pub mod revision_signals;
mod routes;
mod services;
mod settings;
pub mod setup;
mod status;
mod workspace;

use aether_identity::Identity;
use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{get, post},
};
use std::{sync::Arc, time::Duration};
use tokio::sync::Semaphore;

pub const COOKIE: &str = "aether_native_session";
pub const MAX_BODY: usize = 16 * 1024;

#[derive(Clone)]
pub struct NativeHost {
    identity: Identity,
    mail: Option<crate::mail::Mail>,
    setup: Option<setup::Setup>,
    diagnostics: Option<maintenance::Diagnostics>,
    network: Option<network::Network>,
    backups: Option<backups::Backups>,
    started: std::time::Instant,
    listen_address: Option<std::net::SocketAddr>,
    animation: Option<animation::Animation>,
    agents: Option<crate::agents::Agents>,
    presentation: presentation::Presentation,
    settings: Option<crate::settings::Settings>,
    catalog: Vec<status::Application>,
    documents: Option<crate::documents::Documents>,
    attachments: Option<crate::attachments::Attachments>,
    workspace_assets: Option<crate::workspace_assets::WorkspaceAssets>,
    frontends: Option<frontends::Frontends>,
    map_distribution: Option<map_distribution::Distribution>,
    document_admission: Arc<Semaphore>,
    document_metadata: Arc<Semaphore>,
    media_uploads: Arc<Semaphore>,
    map_exports: Arc<Semaphore>,
    map_searches: Arc<Semaphore>,
    map_search_client: reqwest::Client,
    map_pixabay: Arc<map_pixabay::Library>,
    document_slots: Arc<Semaphore>,
    change_streams: Arc<Semaphore>,
    change_reads: Arc<Semaphore>,
    revision_signals: Option<revision_signals::RevisionSignals>,
    origin: String,
    authority: String,
    secure: bool,
    admission: Arc<Semaphore>,
    deadline: Duration,
}
impl NativeHost {
    pub fn with_network(mut self, network: network::Network) -> Self {
        self.network = Some(network);
        self
    }
    pub(super) fn rebound(
        mut self,
        origin: &str,
        address: std::net::SocketAddr,
    ) -> Result<Self, String> {
        // Only the already validated/prepared Listener calls this transition.
        let url = reqwest::Url::parse(origin).map_err(|_| "Invalid prepared origin.")?;
        self.origin = url.origin().ascii_serialization();
        self.authority = self
            .origin
            .split_once("://")
            .ok_or("Invalid prepared origin.")?
            .1
            .to_owned();
        self.secure = url.scheme() == "https";
        self.listen_address = Some(address);
        self.started = std::time::Instant::now();
        Ok(self)
    }
    pub fn with_backups(mut self, backups: backups::Backups) -> Self {
        self.backups = Some(backups);
        self
    }
    pub fn with_diagnostics(mut self, diagnostics: maintenance::Diagnostics) -> Self {
        self.diagnostics = Some(diagnostics);
        self
    }

    pub fn with_setup(mut self, setup: setup::Setup) -> Self {
        self.setup = Some(setup);
        self
    }

    pub fn with_listen_address(mut self, address: std::net::SocketAddr) -> Self {
        self.listen_address = Some(address);
        self
    }

    pub fn with_mail(mut self, mail: crate::mail::Mail) -> Self {
        self.mail = Some(mail);
        self
    }

    pub fn with_animation(mut self, value: animation::Animation) -> Self {
        self.animation = Some(value);
        self
    }
    pub fn with_map_distribution(mut self, value: map_distribution::Distribution) -> Self {
        self.map_distribution = Some(value);
        self
    }
    pub fn with_agents(mut self, agents: crate::agents::Agents) -> Self {
        self.agents = Some(agents);
        self
    }
    pub fn with_change_stream_capacity(mut self, capacity: usize) -> Result<Self, String> {
        if !(1..=4096).contains(&capacity) {
            return Err("Use 1–4096 document subscriptions.".into());
        }
        self.change_streams = Arc::new(Semaphore::new(capacity));
        Ok(self)
    }
    pub fn with_revision_signals(mut self, signals: revision_signals::RevisionSignals) -> Self {
        self.revision_signals = Some(signals);
        self
    }
    pub fn with_workspace_assets(
        mut self,
        assets: crate::workspace_assets::WorkspaceAssets,
    ) -> Self {
        self.workspace_assets = Some(assets);
        self
    }
    pub fn with_settings(mut self, settings: crate::settings::Settings) -> Self {
        self.settings = Some(settings);
        self
    }
    pub fn with_attachments(mut self, attachments: crate::attachments::Attachments) -> Self {
        self.attachments = Some(attachments);
        self
    }
    pub fn with_frontends(mut self, frontends: frontends::Frontends) -> Self {
        self.frontends = Some(frontends);
        self
    }
    pub fn with_presentation(mut self, presentation: presentation::Presentation) -> Self {
        self.presentation = presentation;
        self
    }
    pub fn with_documents(mut self, documents: crate::documents::Documents) -> Self {
        self.documents = Some(documents);
        self
    }
    /// The operator chooses the origin and tenant; client Host/Forwarded headers
    /// never define trust. HTTP is permitted only for local loopback development.
    pub fn new(
        identity: Identity,
        public_origin: &str,
        max_in_flight: usize,
        deadline: Duration,
    ) -> Result<Self, String> {
        let url = reqwest::Url::parse(public_origin).map_err(|_| "Invalid public origin.")?;
        let local = url
            .host_str()
            .is_some_and(|h| matches!(h, "127.0.0.1" | "localhost" | "[::1]"));
        if !(url.scheme() == "https" || (url.scheme() == "http" && local))
            || !url.username().is_empty()
            || url.password().is_some()
            || url.path() != "/"
            || url.query().is_some()
            || url.fragment().is_some()
            || url.host_str().is_none()
            || !(1..=256).contains(&max_in_flight)
            || deadline.is_zero()
            || deadline > Duration::from_secs(120)
        {
            return Err(
                "Use an HTTPS origin (or local HTTP), 1–256 requests and a 1–120s deadline.".into(),
            );
        }
        let origin = url.origin().ascii_serialization();
        let authority = origin
            .split_once("://")
            .expect("validated URL")
            .1
            .to_string();
        Ok(Self {
            identity,
            mail: None,
            setup: None,
            diagnostics: None,
            network: None,
            backups: None,
            started: std::time::Instant::now(),
            listen_address: None,
            animation: None,
            agents: None,
            presentation: presentation::Presentation::default(),
            settings: None,
            catalog: status::catalog(),
            documents: None,
            attachments: None,
            workspace_assets: None,
            frontends: None,
            map_distribution: None,
            document_admission: Arc::new(Semaphore::new(4)),
            document_metadata: Arc::new(Semaphore::new(4)),
            media_uploads: Arc::new(Semaphore::new(2)),
            map_exports: Arc::new(Semaphore::new(2)),
            map_searches: Arc::new(Semaphore::new(2)),
            map_pixabay: Arc::new(map_pixabay::Library::from_environment()),
            map_search_client: map_search::client()
                .map_err(|_| "Cannot initialize media search transport.")?,
            document_slots: Arc::new(Semaphore::new(20)),
            change_streams: Arc::new(Semaphore::new(512)),
            change_reads: Arc::new(Semaphore::new(4)),
            revision_signals: None,
            origin,
            authority,
            secure: url.scheme() == "https",
            admission: Arc::new(Semaphore::new(max_in_flight)),
            deadline,
        })
    }
}

pub fn router(host: NativeHost) -> Router {
    Router::new()
        .route("/healthz", get(routes::health))
        .route("/api/map/assets/search", get(map_search::search))
        .route(
            "/api/map/media/{name}",
            get(map_media::read)
                .put(map_media::upload)
                .delete(map_media::delete)
                .layer(DefaultBodyLimit::disable()),
        )
        .route(
            "/api/map/devices/announce",
            post(map_devices::announce).layer(DefaultBodyLimit::max(4096)),
        )
        .route(
            "/api/map/devices/{action}",
            post(map_devices::action).layer(DefaultBodyLimit::max(70000)),
        )
        .route(
            "/api/map/device/cast",
            get(map_devices::cast_read)
                .post(map_devices::cast_write)
                .layer(DefaultBodyLimit::max(70000)),
        )
        .route("/api/map/project/{name}", get(map_exports::export))
        .route("/api/map/ping", get(map_distribution::ping))
        .route("/api/map/{name}", get(map_distribution::serve))
        .route("/api/map/devices", get(map_devices::list))
        .route("/api/map/device/show", get(map_devices::show))
        .route(
            "/.well-known/oauth-protected-resource/mcp",
            get(oauth::metadata),
        )
        .route(
            "/.well-known/oauth-protected-resource",
            get(oauth::metadata),
        )
        .route(
            "/.well-known/oauth-authorization-server",
            get(oauth::issuer),
        )
        .route("/oauth/register", post(oauth::register))
        .route("/oauth/authorize", get(oauth::authorize))
        .route("/oauth/token", post(oauth::exchange))
        .route(
            "/api/automation/authorization/{action}",
            post(oauth::consent),
        )
        .route(
            "/mcp",
            post(mcp_http::post).layer(DefaultBodyLimit::max(1024 * 1024 + 4096)),
        )
        .route(
            "/api/automation/editor/{action}",
            post(automation::editor).layer(DefaultBodyLimit::max(400 * 1024)),
        )
        .route(
            "/api/automation/connections/{action}",
            post(automation::connections),
        )
        .route(
            "/api/automation/commands/{action}",
            post(automation::commands).layer(DefaultBodyLimit::max(1024 * 1024 + 4096)),
        )
        .route("/readyz", get(routes::ready))
        .route("/api/v1/identity/session", get(routes::session))
        .route("/api/drive/download", get(download::download))
        .route("/{app}/workspace/{*path}", get(workspace::serve))
        .route(
            "/{app}/files/save",
            post(workspace::save).layer(DefaultBodyLimit::max(5 * 1024 * 1024)),
        )
        .route("/api/status", get(status::status))
        .route("/api/library/changes", get(changes::changes))
        .route(
            "/api/v1/server/presentation",
            get(settings::read).post(settings::change),
        )
        .route("/api/admin/theme", post(settings::theme))
        .route("/api/admin/state", get(admin_state::read))
        .route("/api/admin/service", post(services::change))
        .route("/api/admin/maintenance", get(maintenance::read))
        .route("/api/admin/settings", post(network::change))
        .route("/api/admin/restart", post(network::restart))
        .route("/api/admin/backup", post(backups::create))
        .route("/api/admin/storage", post(backups::configure))
        .route("/api/admin/backups/{name}", get(backups::download))
        .route(
            "/animation/rpc",
            post(animation::rpc).layer(DefaultBodyLimit::max(4 * 1024 * 1024)),
        )
        .route(
            "/cad/rpc",
            post(animation::cad::rpc).layer(DefaultBodyLimit::max(4 * 1024 * 1024)),
        )
        .route("/api/login", post(routes::login))
        .route("/api/setup/authorize", post(setup::authorize))
        .route("/api/setup", post(setup::complete))
        .route("/api/admin/mail", get(mail::read).post(mail::change))
        .route("/api/admin/mail/test", post(mail::test))
        .route("/api/admin/mail/events", get(mail::events))
        .route("/api/recovery/request", post(mail::request))
        .route("/api/recovery/reset", post(mail::reset))
        .route("/api/logout", post(routes::logout))
        .route("/api/password", post(routes::password))
        .route("/api/profile", post(routes::profile))
        .route("/api/admin/users", post(routes::create_user))
        .route("/api/admin/apps", post(routes::app_enabled))
        .route("/api/admin/access", post(admin_directory::access))
        .route("/api/admin/team", post(admin_directory::team))
        .route("/api/v1/admin/directory", get(admin_directory::read))
        .route("/api/admin/user", post(routes::admin_user))
        .route("/api/v1/documents/read", post(documents::read))
        .route("/api/v1/documents/list", post(documents::list))
        .route("/api/v1/documents/browse", post(documents::browse))
        .route("/api/v1/documents/recycle", post(documents::recycle))
        .route(
            "/api/v1/documents/resource-state",
            post(documents::resource_state),
        )
        .route(
            "/api/v1/documents/resource-change",
            post(documents::resource_change),
        )
        .route("/api/v1/documents/history", post(documents::history))
        .route("/api/v1/documents/grant", post(documents::grant))
        .route("/api/v1/documents/folder", post(documents::folder))
        .route("/api/v1/documents/admin", post(documents::administration))
        .route("/api/v1/documents/directory", post(documents::directory))
        .route(
            "/api/v1/documents/organizations",
            post(documents::organizations),
        )
        .route("/api/v1/documents/workspaces", post(documents::workspaces))
        .fallback(frontends::serve)
        .layer(DefaultBodyLimit::max(MAX_BODY))
        .route(
            "/api/v1/documents/mutate",
            post(documents::mutate).layer(DefaultBodyLimit::max(24 * 1024 * 1024)),
        )
        .route(
            "/api/library/{action}",
            post(library::library).layer(DefaultBodyLimit::max(9 * 1024 * 1024)),
        )
        .route(
            "/api/drive/{action}",
            post(drive::drive).layer(DefaultBodyLimit::max(9 * 1024 * 1024)),
        )
        .route(
            "/api/agent/{action}",
            post(agents::dispatch).layer(DefaultBodyLimit::max(512 * 1024)),
        )
        .route(
            "/api/cad/{action}",
            post(product_services::cad).layer(DefaultBodyLimit::max(4 * 1024 * 1024)),
        )
        .route(
            "/api/preferences",
            post(routes::preferences).layer(DefaultBodyLimit::max(384 * 1024)),
        )
        .method_not_allowed_fallback(routes::method_not_allowed)
        .layer(middleware::from_fn_with_state(
            host.clone(),
            boundary::guard,
        ))
        .with_state(host)
}
