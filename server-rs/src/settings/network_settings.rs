use super::lan::LanManager;
use super::network_config::{
    config_differs_from_running, hosts_file_line, load_network_config, save_network_config,
    NetworkConfig, NetworkConfigPatch,
};
use crate::types::NetworkSettings;

pub fn get_running_network_config(lan: &LanManager) -> NetworkConfig {
    NetworkConfig {
        host: lan.get_local_host().to_string(),
        port: lan.port,
    }
}

pub fn build_network_settings(lan: &LanManager) -> NetworkSettings {
    let running = get_running_network_config(lan);
    let saved = load_network_config();
    NetworkSettings {
        host: saved.host.clone(),
        port: saved.port,
        local_url: lan.get_local_url(),
        scheme: lan.get_url_scheme().to_string(),
        hosts_file_line: hosts_file_line(&saved.host),
        pending_restart: config_differs_from_running(&saved, &running),
    }
}

pub fn patch_network_settings(
    lan: &LanManager,
    patch: &NetworkConfigPatch,
) -> crate::error::AppResult<NetworkSettings> {
    save_network_config(patch)?;
    Ok(build_network_settings(lan))
}
