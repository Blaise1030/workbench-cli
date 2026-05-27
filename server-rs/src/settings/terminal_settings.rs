use super::store::SettingsStore;
use crate::error::AppResult;
use crate::types::{ApprovedResumePrefix, TerminalSettings};
use serde::Deserialize;
use std::collections::HashMap;

pub const KEY_AUTO_RESUME: &str = "terminal.autoResumeAgentSessions";
pub const KEY_PTY_IDLE_TTL_HOURS: &str = "terminal.ptyIdleTtlHours";
pub const KEY_SCROLLBACK_CAP_KB: &str = "terminal.scrollbackCapKb";
pub const KEY_SCROLLBACK_PERSIST: &str = "terminal.scrollbackPersistOnShutdown";
pub const KEY_APPROVED_PREFIXES: &str = "terminal.resumeCommands.approvedPrefixes";

pub const SUPPORTED_AGENT_KINDS: [&str; 4] = ["claude", "codex", "cursor", "gemini"];

pub fn agent_hook_settings_key(kind: &str) -> String {
    format!("terminal.agentHooks.{kind}.enabled")
}

pub const DEFAULT_AUTO_RESUME: bool = true;
pub const DEFAULT_PTY_IDLE_TTL_HOURS: f64 = 24.0;
pub const DEFAULT_SCROLLBACK_CAP_KB: i64 = 4096;
pub const DEFAULT_SCROLLBACK_PERSIST: bool = true;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PatchTerminalSettings {
    pub auto_resume_agent_sessions: Option<bool>,
    pub pty_idle_ttl_hours: Option<f64>,
    pub scrollback_cap_kb: Option<i64>,
    pub scrollback_persist_on_shutdown: Option<bool>,
    pub agent_hooks: Option<HashMap<String, bool>>,
}

pub fn get_terminal_settings(store: &SettingsStore) -> AppResult<TerminalSettings> {
    let auto_resume_agent_sessions = store.get(KEY_AUTO_RESUME, DEFAULT_AUTO_RESUME)?;
    let pty_idle_ttl_hours = store.get(KEY_PTY_IDLE_TTL_HOURS, DEFAULT_PTY_IDLE_TTL_HOURS)?;
    let scrollback_cap_kb = store.get(KEY_SCROLLBACK_CAP_KB, DEFAULT_SCROLLBACK_CAP_KB)?;
    let scrollback_persist_on_shutdown =
        store.get(KEY_SCROLLBACK_PERSIST, DEFAULT_SCROLLBACK_PERSIST)?;

    let mut agent_hooks = HashMap::new();
    for kind in SUPPORTED_AGENT_KINDS {
        agent_hooks.insert(kind.to_string(), store.get(&agent_hook_settings_key(kind), true)?);
    }

    Ok(TerminalSettings {
        auto_resume_agent_sessions,
        pty_idle_ttl_hours,
        scrollback_cap_kb,
        scrollback_persist_on_shutdown,
        agent_hooks,
    })
}

pub fn is_agent_hook_enabled(store: &SettingsStore, kind: &str) -> AppResult<bool> {
    store.get(&agent_hook_settings_key(kind), true)
}

pub fn patch_terminal_settings(
    store: &SettingsStore,
    patch: &PatchTerminalSettings,
) -> AppResult<TerminalSettings> {
    let current = get_terminal_settings(store)?;
    let mut next = current.clone();

    if let Some(v) = patch.auto_resume_agent_sessions {
        next.auto_resume_agent_sessions = v;
    }
    if let Some(v) = patch.pty_idle_ttl_hours {
        next.pty_idle_ttl_hours = v;
    }
    if let Some(v) = patch.scrollback_cap_kb {
        next.scrollback_cap_kb = v;
    }
    if let Some(v) = patch.scrollback_persist_on_shutdown {
        next.scrollback_persist_on_shutdown = v;
    }
    if let Some(ref hooks) = patch.agent_hooks {
        for (kind, enabled) in hooks {
            next.agent_hooks.insert(kind.clone(), *enabled);
        }
    }

    store.set(KEY_AUTO_RESUME, &next.auto_resume_agent_sessions)?;
    store.set(KEY_PTY_IDLE_TTL_HOURS, &next.pty_idle_ttl_hours)?;
    store.set(KEY_SCROLLBACK_CAP_KB, &next.scrollback_cap_kb)?;
    store.set(
        KEY_SCROLLBACK_PERSIST,
        &next.scrollback_persist_on_shutdown,
    )?;
    for kind in SUPPORTED_AGENT_KINDS {
        let enabled = next.agent_hooks.get(kind).copied().unwrap_or(true);
        store.set(&agent_hook_settings_key(kind), &enabled)?;
    }

    Ok(next)
}

pub fn list_approved_resume_prefixes(
    store: &SettingsStore,
) -> AppResult<Vec<ApprovedResumePrefix>> {
    store.get(KEY_APPROVED_PREFIXES, Vec::<ApprovedResumePrefix>::new())
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateApprovedResumePrefixInput {
    pub prefix: String,
    pub label: Option<String>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

pub fn add_approved_resume_prefix(
    store: &SettingsStore,
    input: &CreateApprovedResumePrefixInput,
) -> AppResult<ApprovedResumePrefix> {
    let mut list = list_approved_resume_prefixes(store)?;
    let entry = ApprovedResumePrefix {
        id: uuid::Uuid::new_v4().to_string(),
        prefix: input.prefix.trim().to_string(),
        label: input
            .label
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        cwd: input
            .cwd
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        env: input.env.clone(),
        approved_at: chrono::Utc::now().timestamp_millis(),
    };
    list.push(entry.clone());
    store.set(KEY_APPROVED_PREFIXES, &list)?;
    Ok(entry)
}

pub fn revoke_approved_resume_prefix(store: &SettingsStore, id: &str) -> AppResult<bool> {
    let list = list_approved_resume_prefixes(store)?;
    let next: Vec<_> = list.iter().filter(|item| item.id != id).cloned().collect();
    if next.len() == list.len() {
        return Ok(false);
    }
    store.set(KEY_APPROVED_PREFIXES, &next)?;
    Ok(true)
}

pub fn scrollback_cap_bytes(scrollback_cap_kb: i64) -> i64 {
    scrollback_cap_kb.max(64) * 1024
}

pub fn pty_idle_ttl_ms(pty_idle_ttl_hours: f64) -> i64 {
    (pty_idle_ttl_hours.max(1.0) * 60.0 * 60.0 * 1000.0) as i64
}
