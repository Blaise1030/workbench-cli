use std::sync::Arc;

use crate::db::Db;
use crate::settings::terminal_settings::is_agent_hook_enabled;
use crate::settings::SettingsStore;
use crate::workspace::terminals::update_terminal_agent_session;

use super::adapters::default_agent_home;
use super::r#match::match_agent_adapter;
use super::types::CommandCompleteEvent;

pub fn handle_agent_command_complete(
    db: &Db,
    settings_store: &SettingsStore,
    terminal_id: &str,
    event: &CommandCompleteEvent,
    on_stored: Option<Arc<dyn Fn(String, String) + Send + Sync>>,
) -> crate::error::AppResult<()> {
    let adapter = match match_agent_adapter(&event.command_line) {
        Some(a) => a,
        None => return Ok(()),
    };

    if !is_agent_hook_enabled(settings_store, adapter.kind().as_str())? {
        return Ok(());
    }

    let home = default_agent_home();
    let home_str = home.to_string_lossy();
    let session_id = match adapter.find_latest_session_id(&event.cwd, &home_str) {
        Some(id) => id,
        None => return Ok(()),
    };

    update_terminal_agent_session(
        db,
        terminal_id,
        adapter.kind().as_str(),
        &session_id,
    )?;

    if let Some(cb) = on_stored {
        cb(adapter.kind().as_str().to_string(), session_id);
    }

    Ok(())
}
