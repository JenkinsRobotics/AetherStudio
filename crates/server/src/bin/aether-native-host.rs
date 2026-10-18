//! Explicit operator commands for the native identity integration host.
use aether_identity::{NewAccount, Role};
use aether_server::native::{NativeHost, configuration::local_pool, router};
use serde::Deserialize;
use std::{io::Read, net::SocketAddr, time::Duration};
use zeroize::Zeroizing;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Bootstrap {
    username: String,
    password: Zeroizing<String>,
    full_name: String,
    email: String,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.len() == 3 && args[1] == "--config" {
        return aether_server::native::installation::execute(
            &args[0],
            std::path::Path::new(&args[2]),
        );
    }
    run(args)
}

#[tokio::main]
async fn run(args: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
    if args.len() != 1
        || !matches!(
            args[0].as_str(),
            "migrate" | "bootstrap" | "setup-link" | "serve" | "verify-store" | "backup"
        )
    {
        return Err("Usage: aether-native-host migrate|bootstrap|setup-link|serve|verify-store|backup [--config /private/installation.json]. Requires AETHER_NATIVE_PG and AETHER_NATIVE_TENANT. Bootstrap reads one JSON object from stdin; never put passwords in arguments.".into());
    }
    let dsn = Zeroizing::new(
        std::env::var("AETHER_NATIVE_PG")
            .map_err(|_| "Set AETHER_NATIVE_PG to a dedicated development database.")?,
    );
    let tenant = std::env::var("AETHER_NATIVE_TENANT")
        .map_err(|_| "Set AETHER_NATIVE_TENANT explicitly.")?;
    let pool = local_pool(&dsn)?;
    let identity = aether_identity::Identity::new(pool.clone(), &tenant, 2)?;
    let settings = aether_server::settings::Settings::new(pool.clone(), identity.clone());
    let presentation = std::env::var_os("AETHER_NATIVE_PRESENTATION")
        .map(|path| {
            aether_server::native::presentation::Presentation::load(std::path::Path::new(&path))
        })
        .transpose()?;
    let documents = std::env::var_os("AETHER_NATIVE_OBJECTS")
        .map(|root| {
            let content =
                aether_store::hosted::ContentStore::local(std::path::PathBuf::from(root))?;
            Ok::<_, aether_store::StoreError>(aether_server::documents::Documents::new(
                pool.clone(),
                identity.clone(),
                aether_store::hosted::HostedStore::new(pool.clone(), content),
            ))
        })
        .transpose()?;
    if args[0] == "migrate" {
        identity.migrate().await?;
        settings
            .migrate(&presentation.clone().unwrap_or_default())
            .await?;
        if let Some(documents) = &documents {
            documents.migrate().await?;
        }
        eprintln!("Native identity schema is ready. Existing installation was not accessed.");
        return Ok(());
    }
    identity.check_schema().await?;
    settings.check_schema().await?;
    if args[0] == "verify-store" {
        let documents = documents
            .as_ref()
            .ok_or("Set AETHER_NATIVE_OBJECTS for verification.")?;
        documents.check_schema().await?;
        let content = aether_store::hosted::ContentStore::local(std::path::PathBuf::from(
            std::env::var_os("AETHER_NATIVE_OBJECTS").unwrap(),
        ))?;
        let store = aether_store::hosted::HostedStore::new(pool.clone(), content);
        // An explicit local operator audit, never an HTTP/client authorization grant.
        let scope = aether_store::hosted::AuthorizedScope::new(&tenant, "migration-audit")?;
        let mut report = serde_json::to_value(store.verify(&scope).await?)?;
        report["upload_manifests"] = serde_json::json!(documents.verify_uploads().await?);
        println!("{}", serde_json::to_string(&report)?);
        return Ok(());
    }
    if args[0] == "setup-link" {
        if identity.session_status(None).await?.ready {
            return Err("This installation is already configured.".into());
        }
        let path = std::env::var_os("AETHER_NATIVE_SETUP")
            .ok_or("Set AETHER_NATIVE_SETUP to a new file in a private (0700) directory.")?;
        let address: SocketAddr = std::env::var("AETHER_NATIVE_LISTEN")
            .unwrap_or_else(|_| "127.0.0.1:8880".into())
            .parse()?;
        if !address.ip().is_loopback() || address.port() == 0 {
            return Err("Use a fixed loopback address for local setup.".into());
        }
        if std::env::var_os("AETHER_NATIVE_TLS_CERT").is_some()
            || std::env::var_os("AETHER_NATIVE_TLS_KEY").is_some()
            || std::env::var_os("AETHER_NATIVE_PUBLIC_ORIGIN").is_some()
        {
            return Err("Complete first-run setup on loopback HTTP before enabling the public HTTPS listener.".into());
        }
        let secret = aether_server::native::setup::Setup::create_key(std::path::Path::new(&path))?;
        println!("http://{address}/#setup={}", secret.as_str());
        eprintln!(
            "Private setup link expires in 15 minutes. Start serve with the same AETHER_NATIVE_SETUP path."
        );
        return Ok(());
    }
    if args[0] == "bootstrap" {
        let mut bytes = Zeroizing::new(Vec::new());
        std::io::stdin()
            .take(16 * 1024 + 1)
            .read_to_end(&mut bytes)?;
        if bytes.len() > 16 * 1024 {
            return Err("Bootstrap input exceeds 16 KiB.".into());
        }
        let input: Bootstrap =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid bootstrap JSON.")?;
        let account = NewAccount {
            username: input.username,
            role: Role::Admin,
            must_change: false,
            full_name: input.full_name,
            email: input.email,
        };
        identity.bootstrap(&account, &input.password).await?;
        eprintln!("Initial native administrator created. Sign in through the account API.");
        return Ok(());
    }
    let mail = std::env::var_os("AETHER_NATIVE_MAIL_SECRETS")
        .map(|path| {
            aether_server::mail::Vault::open(std::path::Path::new(&path), &tenant)
                .map(|vault| aether_server::mail::Mail::new(settings.clone(), vault))
        })
        .transpose()?;
    let setup = if identity.session_status(None).await?.ready {
        None
    } else {
        std::env::var_os("AETHER_NATIVE_SETUP")
            .map(|path| {
                aether_server::native::setup::Setup::load(std::path::Path::new(&path), pool.clone())
            })
            .transpose()?
    };
    let attachments = std::env::var_os("AETHER_NATIVE_ATTACHMENTS")
        .map(|path| aether_server::attachments::Attachments::load(std::path::Path::new(&path)))
        .transpose()?;
    let workspace_assets = std::env::var_os("AETHER_NATIVE_WORKSPACES")
        .map(|path| {
            aether_server::workspace_assets::WorkspaceAssets::load(std::path::Path::new(&path))
        })
        .transpose()?;
    if args[0] == "backup" {
        let path = |name: &str| -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
            Ok(std::env::var_os(name)
                .ok_or("Set the operator backup paths.")?
                .into())
        };
        let config = aether_server::backup::Configuration {
            pg_dump: path("AETHER_NATIVE_PG_DUMP")?,
            objects: path("AETHER_NATIVE_OBJECTS")?,
            destination: path("AETHER_NATIVE_BACKUP_DESTINATION")?,
        };
        documents
            .as_ref()
            .ok_or("Configure native object storage.")?
            .check_schema()
            .await?;
        let extras = aether_server::backup::extras(attachments.as_ref(), workspace_assets.as_ref());
        let report = aether_server::backup::create(pool, tenant, dsn, config, extras).await?;
        println!(
            "{}",
            serde_json::json!({"ok":true,"files":report["files"].as_object().map(|v|v.len()),"schema":1})
        );
        return Ok(());
    }
    if let Some(presentation) = presentation
        && settings.snapshot().await?.presentation != presentation
    {
        return Err("Presentation seed differs from saved settings. Unset AETHER_NATIVE_PRESENTATION; use the admin presentation API to update saved settings.".into());
    }
    let animation = std::env::var_os("AETHER_NATIVE_ANIMATION")
        .map(|path| aether_server::native::animation::Animation::load(std::path::Path::new(&path)))
        .transpose()?;
    let products = std::env::var_os("AETHER_NATIVE_PRODUCTS")
        .map(|path| aether_server::products::Products::load(std::path::Path::new(&path)))
        .transpose()?;
    let documents = documents.map(|d| {
        if let Some(products) = products {
            d.with_products(products)
        } else {
            d
        }
    });
    let map_distribution = std::env::var_os("AETHER_NATIVE_MAP_DOWNLOADS")
        .map(|path| {
            aether_server::native::map_distribution::Distribution::load(std::path::Path::new(&path))
        })
        .transpose()?;
    let frontends = std::env::var_os("AETHER_NATIVE_FRONTENDS")
        .map(|path| aether_server::native::frontends::Frontends::load(std::path::Path::new(&path)))
        .transpose()?;
    let agents = std::env::var_os("AETHER_NATIVE_AGENTS")
        .map(|path| {
            let config = aether_server::agents::Configuration::load(std::path::Path::new(&path))
                .map_err(|_| "Invalid native agent configuration.")?;
            aether_server::agents::Agents::open(config, &tenant)
                .map_err(|_| "Could not open private native agent runtime state.")
        })
        .transpose()?;
    let backups = if let Some(root) = std::env::var_os("AETHER_NATIVE_BACKUPS") {
        let objects =
            std::env::var_os("AETHER_NATIVE_OBJECTS").ok_or("Backups require object storage.")?;
        let dump = std::env::var_os("AETHER_NATIVE_PG_DUMP").ok_or("Backups require pg_dump.")?;
        Some(aether_server::native::backups::Backups::new(
            pool.clone(),
            &tenant,
            dsn.clone(),
            std::path::Path::new(&root),
            std::path::Path::new(&objects),
            std::path::Path::new(&dump),
            aether_server::backup::extras(attachments.as_ref(), workspace_assets.as_ref()),
        )?)
    } else {
        None
    };
    let address: SocketAddr = std::env::var("AETHER_NATIVE_LISTEN")
        .unwrap_or_else(|_| "127.0.0.1:8880".into())
        .parse()
        .map_err(|_| "Invalid listen address.")?;
    let operator = aether_server::native::listener::Configuration {
        address,
        public_origin: std::env::var("AETHER_NATIVE_PUBLIC_ORIGIN").ok(),
        certificate: std::env::var_os("AETHER_NATIVE_TLS_CERT").map(Into::into),
        private_key: std::env::var_os("AETHER_NATIVE_TLS_KEY").map(Into::into),
    };
    let instance = std::env::var("AETHER_NATIVE_INSTANCE").ok();
    let tls_root = std::env::var_os("AETHER_NATIVE_TLS_ROOT").map(std::path::PathBuf::from);
    let saved = if let Some(instance) = &instance {
        if std::env::var("AETHER_NATIVE_NETWORK_RESET").ok().as_deref() == Some("1") {
            None
        } else {
            settings.network_snapshot(instance).await?
        }
    } else {
        None
    };
    let selected = if let Some(config) = &saved {
        config.authorized_tls(
            tls_root.as_deref(),
            operator.certificate.as_deref(),
            operator.private_key.as_deref(),
        )?;
        config.listener()?
    } else {
        operator.clone()
    };
    let cert_path = selected.certificate.clone();
    let key_path = selected.private_key.clone();
    let listener = aether_server::native::listener::Listener::bind(selected).await?;
    let origin = listener.origin().to_owned();
    let network = if let Some(instance) = instance {
        let running = aether_server::native::network::Configuration {
            name: settings.snapshot().await?.presentation.name().to_owned(),
            bind_address: listener.address()?.ip().to_string(),
            port: listener.address()?.port(),
            public_url: origin.clone(),
            tls_cert: cert_path
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default(),
            tls_key: key_path
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default(),
        };
        Some(aether_server::native::network::Network::new(
            settings.clone(),
            &instance,
            tls_root,
            running,
            &listener,
        )?)
    } else {
        None
    };
    let mut host = NativeHost::new(identity, &origin, 64, Duration::from_secs(45))?
        .with_settings(settings)
        .with_listen_address(listener.address()?);
    if let Some((network, _)) = &network {
        host = host.with_network(network.clone());
    }
    let backup_scheduler = backups.as_ref().map(|backups| backups.scheduler());
    if let Some(backups) = backups {
        host = host.with_backups(backups);
    }
    if let Some(path) = std::env::var_os("AETHER_NATIVE_OBJECTS") {
        host = host.with_diagnostics(aether_server::native::maintenance::Diagnostics::new(
            std::path::Path::new(&path),
        )?);
    }
    if let Some(setup) = setup {
        host = host.with_setup(setup);
    }
    if let Some(mail) = mail {
        host = host.with_mail(mail);
    }
    if let Some(animation) = animation {
        host = host.with_animation(animation);
    }
    if let Some(agents) = &agents {
        host = host.with_agents(agents.clone());
    }
    if let Some(documents) = documents {
        documents.check_schema().await?;
        let signals = aether_server::native::revision_signals::RevisionSignals::connect_local(
            aether_server::native::configuration::local_config(&dsn)?,
        )
        .await?;
        host = host.with_revision_signals(signals);
        host = host.with_documents(documents);
    }
    if let Some(attachments) = attachments {
        host = host.with_attachments(attachments);
    }
    if let Some(assets) = workspace_assets {
        host = host.with_workspace_assets(assets);
    }
    if let Some(distribution) = map_distribution {
        host = host.with_map_distribution(distribution);
    }
    if let Some(frontends) = frontends {
        host = host.with_frontends(frontends);
    }
    eprintln!("Aether Studio native server on {origin}");
    let shutdown = async move {
        #[cfg(unix)]
        {
            if let Ok(mut terminate) =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            {
                tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
            } else {
                let _ = tokio::signal::ctrl_c().await;
            }
        }
        #[cfg(not(unix))]
        let _ = tokio::signal::ctrl_c().await;
        if let Some(task) = backup_scheduler {
            task.abort();
        }
        if let Some(agents) = agents {
            agents.shutdown().await;
        }
    };
    if let Some((network, requests)) = network {
        network.serve(listener, host, requests, shutdown).await?;
    } else {
        listener.serve(router(host), shutdown).await?;
    }
    Ok(())
}
