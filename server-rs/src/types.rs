use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Worktree {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub path: String,
    pub branch: Option<String>,
    #[serde(rename = "baseBranch")]
    pub base_branch: Option<String>,
    #[serde(rename = "gitDir")]
    pub git_dir: Option<String>,
    #[serde(rename = "isLinked")]
    pub is_linked: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Terminal {
    pub id: String,
    #[serde(rename = "worktreeId")]
    pub worktree_id: String,
    pub title: String,
    #[serde(rename = "sortOrder")]
    pub sort_order: i64,
    #[serde(rename = "resumeCommand")]
    pub resume_command: Option<String>,
    #[serde(rename = "resumeTrusted")]
    pub resume_trusted: bool,
    #[serde(rename = "agentKind")]
    pub agent_kind: Option<String>,
    #[serde(rename = "agentSessionId")]
    pub agent_session_id: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_path: Option<String>,
    pub staged: Option<String>,
    pub unstaged: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanPublicState {
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lan_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invite_expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSettings {
    pub host: String,
    pub port: u16,
    pub local_url: String,
    pub scheme: String,
    pub hosts_file_line: String,
    pub pending_restart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSettings {
    pub auto_resume_agent_sessions: bool,
    pub pty_idle_ttl_hours: f64,
    pub scrollback_cap_kb: i64,
    pub scrollback_persist_on_shutdown: bool,
    pub agent_hooks: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovedResumePrefix {
    pub id: String,
    pub prefix: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    pub approved_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct AuthBody {
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LanToggleBody {
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct PatchNetworkBody {
    pub host: Option<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterProjectBody {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorktreeBody {
    pub branch: String,
    #[serde(rename = "baseBranch")]
    pub base_branch: Option<String>,
    pub path: Option<String>,
    #[serde(rename = "isNewBranch")]
    pub is_new_branch: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTerminalBody {
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTerminalBody {
    pub title: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: Option<i64>,
    #[serde(rename = "resumeCommand")]
    pub resume_command: Option<String>,
    #[serde(rename = "resumeTrusted")]
    pub resume_trusted: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct GitFileActionsBody {
    pub action: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GitCommitBody {
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct WriteFileBody {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateApprovedResumePrefixBody {
    pub prefix: String,
    pub label: Option<String>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}
