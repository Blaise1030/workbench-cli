use regex::Regex;
use std::sync::OnceLock;

use super::adapters::agent_adapters;
use super::types::{AgentAdapter, AgentKind};

fn env_assignments_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"^(?:\s*[A-Za-z_][A-Za-z0-9_]*=\S*\s*)+").expect("env assignments regex")
    })
}

pub fn extract_invocation(command_line: &str) -> Option<String> {
    let mut current = command_line.trim().to_string();
    if current.is_empty() {
        return None;
    }

    for _ in 0..8 {
        let without_assignments = env_assignments_re().replace(&current, "");
        if without_assignments.as_ref() != current.as_str() {
            current = without_assignments.trim_start().to_string();
            continue;
        }
        if let Some(rest) = current.strip_prefix("env ") {
            current = rest.trim_start().to_string();
            continue;
        }
        break;
    }

    let token = current.split([' ', '|', ';', '&']).next()?.trim();
    if token.is_empty() {
        return None;
    }
    if let Some(idx) = token.rfind('/') {
        Some(token[idx + 1..].to_string())
    } else {
        Some(token.to_string())
    }
}

pub fn match_agent_adapter(command_line: &str) -> Option<&'static dyn AgentAdapter> {
    let invocation = extract_invocation(command_line)?;
    for adapter in agent_adapters() {
        if adapter.binaries().contains(&invocation.as_str()) {
            return Some(adapter);
        }
    }
    None
}

pub fn get_agent_adapter(kind: AgentKind) -> Option<&'static dyn AgentAdapter> {
    for adapter in agent_adapters() {
        if adapter.kind() == kind {
            return Some(adapter);
        }
    }
    None
}

pub fn build_agent_resume_argv(kind: AgentKind, session_id: &str) -> Option<Vec<String>> {
    get_agent_adapter(kind).map(|adapter| adapter.resume_args(session_id))
}
