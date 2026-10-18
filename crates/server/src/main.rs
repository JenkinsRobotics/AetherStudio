use std::{net::SocketAddr, time::Duration};
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let address: SocketAddr = std::env::var("AETHER_RUST_LISTEN")
        .unwrap_or_else(|_| "127.0.0.1:8879".into())
        .parse()?;
    if !address.ip().is_loopback() {
        return Err("This migration gateway only accepts a loopback listen address.".into());
    }
    let upstream =
        std::env::var("AETHER_LEGACY_URL").unwrap_or_else(|_| "http://127.0.0.1:8781".into());
    let gateway = aether_server::Gateway::new(&upstream, 64, Duration::from_secs(30))?;
    let listener = tokio::net::TcpListener::bind(address).await?;
    eprintln!(
        "Aether Rust command gateway on {} (legacy storage authority)",
        listener.local_addr()?
    );
    axum::serve(listener, aether_server::router(gateway))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
