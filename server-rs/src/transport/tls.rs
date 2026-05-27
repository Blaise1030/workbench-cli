use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;

use crate::db::get_data_dir;

#[derive(Debug, Clone)]
pub struct TlsCredentials {
    pub key: Vec<u8>,
    pub cert: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct CertPaths {
    pub cert_file: PathBuf,
    pub key_file: PathBuf,
}

pub fn parse_cert_paths(cache_dir: &Path, hosts: &[String]) -> CertPaths {
    let base = hosts.last().cloned().unwrap_or_else(|| "localhost".to_string());
    CertPaths {
        cert_file: cache_dir.join(format!("{base}.pem")),
        key_file: cache_dir.join(format!("{base}-key.pem")),
    }
}

pub fn build_cert_args(cache_dir: &Path, hosts: &[String]) -> Vec<String> {
    let paths = parse_cert_paths(cache_dir, hosts);
    let mut args = vec![
        "-cert-file".to_string(),
        paths.cert_file.to_string_lossy().into_owned(),
        "-key-file".to_string(),
        paths.key_file.to_string_lossy().into_owned(),
    ];
    args.extend(hosts.iter().cloned());
    args
}

pub fn get_mkcert_install_hint() -> &'static str {
    if cfg!(target_os = "macos") {
        "Will install via Homebrew (brew install mkcert)."
    } else if cfg!(target_os = "linux") {
        "Will install via apt (sudo apt-get install -y mkcert)."
    } else {
        "Install manually: https://github.com/FiloSottile/mkcert#installation"
    }
}

pub fn is_mkcert_installed() -> bool {
    Command::new("mkcert")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[derive(Clone, Default)]
pub struct EnsureTlsOptions {
    pub auto_install: bool,
    pub confirm_install: Option<Arc<dyn Fn() -> bool + Send + Sync>>,
}

fn install_mkcert() -> Result<(), String> {
    if cfg!(target_os = "macos") {
        println!("  Installing mkcert via brew...");
        Command::new("brew")
            .args(["install", "mkcert"])
            .status()
            .map_err(|e| e.to_string())?
            .success()
            .then_some(())
            .ok_or_else(|| "brew install mkcert failed".to_string())
    } else if cfg!(target_os = "linux") {
        println!("  Installing mkcert via apt...");
        Command::new("sudo")
            .args(["apt-get", "install", "-y", "mkcert"])
            .status()
            .map_err(|e| e.to_string())?
            .success()
            .then_some(())
            .ok_or_else(|| "apt-get install mkcert failed".to_string())
    } else {
        Err(
            "mkcert not found. Install it manually: https://github.com/FiloSottile/mkcert#installation"
                .to_string(),
        )
    }
}

pub fn ensure_tls(
    hosts: &[String],
    options: EnsureTlsOptions,
) -> Result<TlsCredentials, String> {
    if hosts.is_empty() {
        return Err("ensureTLS requires at least one host".to_string());
    }

    let auto_install = options.auto_install;

    if !is_mkcert_installed() {
        if !auto_install {
            return Err(
                "mkcert not found. Install it manually: https://github.com/FiloSottile/mkcert#installation"
                    .to_string(),
            );
        }

        let approved = options
            .confirm_install
            .as_ref()
            .map(|cb| cb())
            .unwrap_or(false);

        if !approved {
            return Err(
                "mkcert is not installed. Install it manually: https://github.com/FiloSottile/mkcert#installation"
                    .to_string(),
            );
        }

        install_mkcert()?;
    }

    Command::new("mkcert")
        .arg("-install")
        .status()
        .map_err(|e| e.to_string())?
        .success()
        .then_some(())
        .ok_or_else(|| "mkcert -install failed".to_string())?;

    let cache_dir = get_data_dir().join("certs");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let paths = parse_cert_paths(&cache_dir, hosts);
    if !paths.cert_file.is_file() || !paths.key_file.is_file() {
        println!("  Generating cert for {}...", hosts.join(", "));
        let mut cmd = Command::new("mkcert");
        for arg in build_cert_args(&cache_dir, hosts) {
            cmd.arg(arg);
        }
        cmd.status()
            .map_err(|e| e.to_string())?
            .success()
            .then_some(())
            .ok_or_else(|| "mkcert cert generation failed".to_string())?;
    }

    Ok(TlsCredentials {
        key: std::fs::read(&paths.key_file).map_err(|e| e.to_string())?,
        cert: std::fs::read(&paths.cert_file).map_err(|e| e.to_string())?,
    })
}
