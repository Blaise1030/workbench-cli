use crate::db::get_data_dir;
use crate::error::{AppError, AppResult};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::LazyLock;

pub const DEFAULT_NETWORK_HOST: &str = "workbench.local";
pub const DEFAULT_NETWORK_PORT: u16 = 4738;

static HOST_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$")
        .expect("valid host regex")
});

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NetworkConfig {
    pub host: String,
    pub port: u16,
}

pub type PatchNetworkConfig = NetworkConfigPatch;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct NetworkConfigPatch {
    pub host: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Default)]
pub struct ResolveNetworkOptions {
    pub port: Option<u16>,
    pub host: Option<String>,
}

pub fn get_network_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}

pub fn default_network_config() -> NetworkConfig {
    NetworkConfig {
        host: DEFAULT_NETWORK_HOST.to_string(),
        port: DEFAULT_NETWORK_PORT,
    }
}

fn validate_network_config(config: &NetworkConfig) -> AppResult<()> {
    if config.host.is_empty() || config.host.len() > 253 {
        return Err(AppError::BadRequest("Invalid hostname".into()));
    }
    if !HOST_PATTERN.is_match(&config.host) {
        return Err(AppError::BadRequest("Invalid hostname".into()));
    }
    if config.port == 0 {
        return Err(AppError::BadRequest("Invalid port".into()));
    }
    Ok(())
}

pub fn load_network_config() -> NetworkConfig {
    let path = get_network_config_path();
    if !path.exists() {
        return default_network_config();
    }

    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(_) => return default_network_config(),
    };

    match serde_json::from_str::<NetworkConfig>(&raw) {
        Ok(config) if validate_network_config(&config).is_ok() => config,
        _ => default_network_config(),
    }
}

pub fn save_network_config(patch: &NetworkConfigPatch) -> AppResult<NetworkConfig> {
    let current = load_network_config();
    let next = NetworkConfig {
        host: patch.host.clone().unwrap_or(current.host),
        port: patch.port.unwrap_or(current.port),
    };
    validate_network_config(&next)?;

    let dir = get_data_dir();
    fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    let json = serde_json::to_string_pretty(&next)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(get_network_config_path(), format!("{json}\n"))
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(next)
}

pub fn resolve_network_config(options: &ResolveNetworkOptions) -> AppResult<NetworkConfig> {
    let file = load_network_config();
    let env_port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok());
    let env_host = std::env::var("WORKBENCH_HOST")
        .ok()
        .map(|h| h.trim().to_string())
        .filter(|h| !h.is_empty());

    let port = options.port.or(env_port).unwrap_or(file.port);
    let host = options
        .host
        .clone()
        .or(env_host)
        .unwrap_or_else(|| file.host.clone());

    let config = NetworkConfig { host, port };
    validate_network_config(&config)?;
    Ok(config)
}

pub fn hosts_file_line(host: &str) -> String {
    format!("127.0.0.1 {host}")
}

pub fn config_differs_from_running(saved: &NetworkConfig, running: &NetworkConfig) -> bool {
    saved.host != running.host || saved.port != running.port
}
