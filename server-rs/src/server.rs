use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum_server::Handle;
use parking_lot::RwLock;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tracing::{info, warn};

use crate::agents::handle_command::handle_agent_command_complete;
use crate::agents::types::CommandCompleteEvent;
use crate::api;
use crate::app_state::{AppState, AppStateBuilder, new_session_pair};
use crate::assets;
use crate::settings::lan::BIND_LAN;
use crate::cli::Cli;
use crate::config::ServerConfig;
use crate::db::Db;
use crate::settings::{get_lan_ip, resolve_network_config, LanManager, SettingsStore};
use crate::terminal::handler::terminal_ws_handler;
use crate::terminal::pty_registry::PtyRegistry;
use crate::transport::{resolve_transport, ResolveTransportOptions, ServerTransport};

pub struct RunOptions {
    pub cli: Cli,
    pub confirm_mkcert: Arc<dyn Fn() -> bool + Send + Sync>,
}

pub async fn run(config: ServerConfig, options: RunOptions) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let network = resolve_network_config(&crate::settings::ResolveNetworkOptions {
        port: Some(config.bind_port),
        host: Some(config.public_host.clone()),
    })?;

    let db = Arc::new(Db::open()?);
    let settings_store = Arc::new(SettingsStore::new(Arc::clone(&db)));
    let (session_token, session) = new_session_pair();

    let (restart_tx, mut restart_rx) = mpsc::channel::<bool>(8);
    let mut lan_enabled = false;

    loop {
        let mut lan = LanManager::new(network.port, network.host.clone());
        if lan_enabled {
            let ip = get_lan_ip();
            if ip != "127.0.0.1" {
                lan.enable(ip);
            }
        }

        let transport = bind_transport(&lan, &options)?;
        lan.set_url_scheme(transport.scheme);
        let cookie_secure = transport.scheme == "https";

        let pty_registry = build_pty_registry(Arc::clone(&db), Arc::clone(&settings_store));

        let state = AppStateBuilder {
            db: Arc::clone(&db),
            session_token: session_token.clone(),
            session: Arc::clone(&session),
            lan: Arc::new(RwLock::new(lan)),
            settings_store: Arc::clone(&settings_store),
            pty_registry: Arc::clone(&pty_registry),
            cookie_secure,
            restart_tx: restart_tx.clone(),
        }
        .build();

        let state = Arc::new(state);

        let addr: SocketAddr = format!("{}:{}", state.lan.read().get_hostname(), network.port)
            .parse()
            .map_err(|e| format!("Invalid bind address: {e}"))?;

        print_startup_banner(&state, &session_token.value);

        let app = build_router(Arc::clone(&state));
        let handle = Handle::new();

        let mut server_task: JoinHandle<Result<(), Box<dyn std::error::Error + Send + Sync>>> = {
            let handle = handle.clone();
            let transport = transport.clone();
            tokio::spawn(async move {
                serve(app, addr, transport, handle).await
            })
        };

        let exit = loop {
            tokio::select! {
                result = &mut server_task => {
                    result??;
                    break true;
                }
                Some(enabled) = restart_rx.recv() => {
                    stop_server(&handle, &pty_registry, &mut server_task).await;
                    lan_enabled = enabled;
                    if enabled {
                        let mut lan = state.lan.write();
                        let ip = get_lan_ip();
                        if ip != "127.0.0.1" {
                            lan.enable(ip);
                        }
                    } else {
                        state.lan.write().disable();
                    }
                    break false;
                }
                _ = shutdown_signal() => {
                    stop_server(&handle, &pty_registry, &mut server_task).await;
                    break true;
                }
            }
        };

        if exit {
            break;
        }
    }

    Ok(())
}

fn build_pty_registry(db: Arc<Db>, settings_store: Arc<SettingsStore>) -> Arc<PtyRegistry> {
    let db_cb = Arc::clone(&db);
    let store_cb = Arc::clone(&settings_store);
    PtyRegistry::new(
        settings_store,
        Some(Arc::new(move |terminal_id, event: CommandCompleteEvent| {
            let db = Arc::clone(&db_cb);
            let store = Arc::clone(&store_cb);
            if let Err(err) = handle_agent_command_complete(
                &db,
                &store,
                &terminal_id,
                &event,
                None,
            ) {
                tracing::error!("agent hook failed: {err}");
            }
        })),
    )
}

fn bind_transport(lan: &LanManager, options: &RunOptions) -> Result<ServerTransport, String> {
    resolve_transport(ResolveTransportOptions {
        hosts: lan.get_tls_hosts(),
        require_tls: lan.mode() == BIND_LAN,
        force_http: options.cli.force_http,
        auto_install_mkcert: Some(!options.cli.force_http),
        confirm_mkcert_install: Some(Arc::clone(&options.confirm_mkcert)),
    })
}

fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .nest("/api", api::router(Arc::clone(&state)))
        .route("/ws", axum::routing::get(terminal_ws_handler))
        .with_state(state)
        .merge(assets::spa_router())
        .layer(tower_http::trace::TraceLayer::new_for_http())
}

async fn serve(
    app: Router,
    addr: SocketAddr,
    transport: ServerTransport,
    handle: Handle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if let Some(tls) = transport.tls {
        let rustls = axum_server::tls_rustls::RustlsConfig::from_pem(tls.cert, tls.key).await?;
        axum_server::bind_rustls(addr, rustls)
            .handle(handle)
            .serve(app.into_make_service_with_connect_info::<SocketAddr>())
            .await?;
    } else {
        axum_server::bind(addr)
            .handle(handle)
            .serve(app.into_make_service_with_connect_info::<SocketAddr>())
            .await?;
    }
    Ok(())
}

fn print_startup_banner(state: &AppState, token: &str) {
    let local_url = state.lan.read().get_local_url();
    println!("\n  Access token: {token}");
    println!("  Open: {local_url}");
    let lan = state.lan.read();
    let host = lan.get_local_host().to_string();
    drop(lan);
    if host != "localhost" && host != "127.0.0.1" {
        println!("  Add to /etc/hosts: 127.0.0.1 {host}");
    }
    println!();
    info!(%local_url, "workbench-cli rust server listening");
}

type ServeResult = Result<(), Box<dyn std::error::Error + Send + Sync>>;

/// Tear down listeners and PTYs so Ctrl+C releases the bind port promptly.
async fn stop_server(
    handle: &Handle,
    pty_registry: &PtyRegistry,
    server_task: &mut JoinHandle<ServeResult>,
) {
    pty_registry.kill_all();
    handle.graceful_shutdown(Some(Duration::from_secs(2)));
    match tokio::time::timeout(Duration::from_secs(5), &mut *server_task).await {
        Ok(Ok(Ok(()))) => {}
        Ok(Ok(Err(e))) => tracing::error!("server stopped with error: {e}"),
        Ok(Err(e)) => tracing::error!("server task failed: {e}"),
        Err(_) => {
            server_task.abort();
            warn!("server shutdown timed out after 5s; aborted remaining task");
        }
    }
    pty_registry.shutdown().await;
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("shutdown signal received");
}
