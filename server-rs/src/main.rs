use std::io::{self, IsTerminal, Write};
use std::sync::Arc;

use clap::Parser;
use tracing_subscriber::EnvFilter;
use workbench_cli::cli::Cli;
use workbench_cli::config::ServerConfig;
use workbench_cli::server::{run, RunOptions};
use workbench_cli::transport::{get_mkcert_install_hint, is_mkcert_installed};

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();

    if cli.help {
        cli.print_help();
        return;
    }

    let server_config = match workbench_cli::config::resolve(&cli) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("\n  Startup failed: {e}\n");
            std::process::exit(1);
        }
    };

    println!("\n  workbench-cli (rust) starting...");

    let confirm_mkcert: Arc<dyn Fn() -> bool + Send + Sync> = if cli.assume_yes {
        Arc::new(|| true)
    } else {
        Arc::new(prompt_mkcert_install)
    };

    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    if let Err(e) = rt.block_on(run(
        server_config,
        RunOptions {
            cli,
            confirm_mkcert,
        },
    )) {
        eprintln!("\n  Startup failed: {e}\n");
        std::process::exit(1);
    }
}

fn prompt_mkcert_install() -> bool {
    if is_mkcert_installed() {
        return true;
    }

    if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
        eprintln!("\n  mkcert is not installed and this session is not interactive.");
        eprintln!("  {}", get_mkcert_install_hint());
        eprintln!("  Use --http for HTTP-only mode, or --yes to install without prompting.\n");
        return false;
    }

    eprintln!("\n  mkcert is not installed.");
    eprintln!("  It provides trusted HTTPS certificates for localhost (and LAN sharing).");
    eprintln!("  {}\n", get_mkcert_install_hint());
    eprint!("  Install mkcert now? (y/N) ");
    let _ = io::stdout().flush();
    let mut line = String::new();
    if io::stdin().read_line(&mut line).is_err() {
        return false;
    }
    let normalized = line.trim().to_lowercase();
    normalized == "y" || normalized == "yes"
}
