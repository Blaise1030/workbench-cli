mod tls;

pub use tls::{ensure_tls, get_mkcert_install_hint, is_mkcert_installed, CertPaths, EnsureTlsOptions, TlsCredentials};

use std::sync::Arc;

pub type TransportScheme = &'static str;

#[derive(Debug, Clone)]
pub struct ServerTransport {
    pub scheme: TransportScheme,
    pub tls: Option<TlsCredentials>,
}

#[derive(Clone, Default)]
pub struct ResolveTransportOptions {
    pub hosts: Vec<String>,
    pub require_tls: bool,
    pub force_http: bool,
    pub auto_install_mkcert: Option<bool>,
    pub confirm_mkcert_install: Option<Arc<dyn Fn() -> bool + Send + Sync>>,
}

pub const LAN_REQUIRES_TLS_MESSAGE: &str =
    "LAN sharing requires HTTPS. Install mkcert: https://github.com/FiloSottile/mkcert#installation";

fn is_localhost_only_hosts(hosts: &[String]) -> bool {
    hosts
        .iter()
        .all(|host| host == "localhost" || host == "127.0.0.1")
}

fn warn_http_fallback(reason: &str) {
    eprintln!("\n  ⚠ Serving over HTTP on localhost only (not encrypted).");
    eprintln!("  {reason}");
    eprintln!(
        "  Install mkcert for HTTPS: https://github.com/FiloSottile/mkcert#installation\n"
    );
}

pub fn resolve_transport(options: ResolveTransportOptions) -> Result<ServerTransport, String> {
    let ResolveTransportOptions {
        hosts,
        require_tls,
        force_http,
        auto_install_mkcert,
        confirm_mkcert_install,
    } = options;

    let auto_install = auto_install_mkcert.unwrap_or(!force_http);

    if hosts.is_empty() {
        return Err("resolveTransport requires at least one host".to_string());
    }

    if force_http {
        if require_tls {
            return Err("Cannot use HTTP when TLS is required".to_string());
        }
        if !is_localhost_only_hosts(&hosts) {
            return Err("HTTP mode is only allowed for localhost".to_string());
        }
        warn_http_fallback("Started with --http.");
        return Ok(ServerTransport {
            scheme: "http",
            tls: None,
        });
    }

    match ensure_tls(
        &hosts,
        EnsureTlsOptions {
            auto_install,
            confirm_install: confirm_mkcert_install,
        },
    ) {
        Ok(tls) => Ok(ServerTransport {
            scheme: "https",
            tls: Some(tls),
        }),
        Err(err) => {
            if require_tls {
                return Err(format!("{LAN_REQUIRES_TLS_MESSAGE} ({err})"));
            }
            if !is_localhost_only_hosts(&hosts) {
                return Err(err);
            }
            warn_http_fallback(&err);
            Ok(ServerTransport {
                scheme: "http",
                tls: None,
            })
        }
    }
}

pub fn format_origin(scheme: &str, host: &str, port: u16) -> String {
    format!("{scheme}://{host}:{port}/")
}
