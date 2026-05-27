pub mod lan;
pub mod network;
pub mod network_config;
pub mod network_settings;
pub mod store;
pub mod terminal_settings;

pub use lan::LanManager;
pub use network::get_lan_ip;
pub use network_config::{
    config_differs_from_running, default_network_config, get_network_config_path,
    hosts_file_line, load_network_config, resolve_network_config, save_network_config,
    NetworkConfig, NetworkConfigPatch, ResolveNetworkOptions, DEFAULT_NETWORK_HOST,
    DEFAULT_NETWORK_PORT,
};
pub use network_settings::{build_network_settings, get_running_network_config, patch_network_settings};
pub use store::SettingsStore;
pub use terminal_settings::{
    add_approved_resume_prefix, agent_hook_settings_key, get_terminal_settings,
    is_agent_hook_enabled, list_approved_resume_prefixes, patch_terminal_settings,
    pty_idle_ttl_ms, revoke_approved_resume_prefix, scrollback_cap_bytes,
    CreateApprovedResumePrefixInput, PatchTerminalSettings, SUPPORTED_AGENT_KINDS,
};
