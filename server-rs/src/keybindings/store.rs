use crate::db::get_data_dir;
use crate::error::{AppError, AppResult};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use std::sync::LazyLock;

pub type KeybindingsMap = HashMap<String, String>;

pub static KEYBINDING_OPTIONS: LazyLock<KeybindingsMap> =
    LazyLock::new(default_keybinding_options);

pub static KEYBINDING_OPTIONS_PATH: LazyLock<PathBuf> =
    LazyLock::new(|| get_data_dir().join("keybindings.json"));

pub fn keybinding_options_path() -> PathBuf {
    KEYBINDING_OPTIONS_PATH.clone()
}

/// macOS US: Option+1…9 → ¡ ™ £ ¢ ∞ § ¶ • ª
const MAC_OPTION_TAB_CHARS: [&str; 9] = ["¡", "™", "£", "¢", "∞", "§", "¶", "•", "ª"];

pub fn default_keybinding_options() -> KeybindingsMap {
    let mut map = HashMap::new();
    map.insert("terminal.newTerminal".to_string(), "Ctrl+Shift+n".to_string());
    map.insert("panel.explorer".to_string(), "Ctrl+Shift+e".to_string());
    map.insert("panel.git".to_string(), "Ctrl+Shift+g".to_string());
    map.insert("contextQueue.invoke".to_string(), "Ctrl+l".to_string());
    map.insert("settings.open".to_string(), "Ctrl+Shift+,".to_string());
    for (i, ch) in MAC_OPTION_TAB_CHARS.iter().enumerate() {
        map.insert(format!("terminal.tab.{}", i + 1), format!("Option+{ch}"));
    }
    map
}

pub fn get_keybindings(file_path: Option<&PathBuf>) -> AppResult<KeybindingsMap> {
    let path = file_path.cloned().unwrap_or_else(keybinding_options_path);
    let defaults = default_keybinding_options();

    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(_) => return Ok(defaults),
    };

    let parsed: HashMap<String, String> = match serde_json::from_str(&raw) {
        Ok(parsed) => parsed,
        Err(_) => return Ok(defaults),
    };

    let mut merged = defaults;
    merged.extend(parsed);
    Ok(merged)
}

pub fn put_keybindings(map: &KeybindingsMap, file_path: Option<&PathBuf>) -> AppResult<()> {
    let path = file_path.cloned().unwrap_or_else(keybinding_options_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::Internal(e.to_string()))?;
    }
    let json = serde_json::to_string_pretty(map)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(&path, json).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}
