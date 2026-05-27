use clap::Parser;
use crate::settings::{DEFAULT_NETWORK_HOST, DEFAULT_NETWORK_PORT};

#[derive(Parser, Debug)]
#[command(
    name = "workbench-cli",
    about = "Local dev workbench in the browser (Rust server)",
    disable_help_flag = true
)]
pub struct Cli {
    #[arg(short = 'p', long = "port", env = "PORT")]
    pub port: Option<u16>,

    #[arg(long = "host", env = "WORKBENCH_HOST")]
    pub host: Option<String>,

    #[arg(long = "http", visible_aliases = ["insecure"])]
    pub force_http: bool,

    #[arg(short = 'y', long = "yes")]
    pub assume_yes: bool,

    #[arg(short = 'h', long = "help")]
    pub help: bool,
}

impl Cli {
    pub fn print_help(&self) {
        println!(
            r#"workbench-cli — local dev workbench in the browser

Usage:
  workbench-cli [options]

Options:
  -p, --port <number>   Port (default: {DEFAULT_NETWORK_PORT}, or PORT env)
  --host <hostname>     Local hostname (default: {DEFAULT_NETWORK_HOST}, or WORKBENCH_HOST env)
  --http, --insecure    Serve HTTP on localhost only (no mkcert)
  -y, --yes             Install mkcert without prompting if missing
  -h, --help            Show this help

LAN sharing in the UI requires mkcert (HTTPS). HTTP mode disables LAN until mkcert is installed.

Add to /etc/hosts once: 127.0.0.1 {DEFAULT_NETWORK_HOST}
"#
        );
    }
}

pub mod config {
    use super::Cli;
    use crate::settings::{
        resolve_network_config, ResolveNetworkOptions, DEFAULT_NETWORK_HOST, DEFAULT_NETWORK_PORT,
    };

    #[derive(Debug, Clone)]
    pub struct ServerConfig {
        pub bind_port: u16,
        pub public_host: String,
        pub force_http: bool,
        pub assume_yes: bool,
    }

    pub fn resolve(cli: &Cli) -> Result<ServerConfig, String> {
        let network = resolve_network_config(&ResolveNetworkOptions {
            port: cli.port,
            host: cli.host.clone(),
        })
        .map_err(|e| e.to_string())?;

        Ok(ServerConfig {
            bind_port: network.port,
            public_host: network.host,
            force_http: cli.force_http,
            assume_yes: cli.assume_yes,
        })
    }

    pub fn default_host() -> &'static str {
        DEFAULT_NETWORK_HOST
    }

    pub fn default_port() -> u16 {
        DEFAULT_NETWORK_PORT
    }
}
