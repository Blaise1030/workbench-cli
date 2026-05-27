use std::fs;
use std::path::{Path, PathBuf};

use super::types::{AgentAdapter, AgentKind};

use session_utils::{
    cursor_workspace_hash, gemini_project_hash, is_gemini_session_file, newest_by_mtime,
    normalize_cwd, read_first_json_line, session_id_from_gemini_file, walk_files,
};

fn sanitize_claude_project_key(cwd: &str) -> String {
    cwd.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c
            } else {
                '-'
            }
        })
        .collect()
}

fn newest_jsonl_session_id(dir: &Path) -> Option<String> {
    let entries = fs::read_dir(dir).ok()?;
    let mut best: Option<(String, i64)> = None;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.ends_with(".jsonl") {
            continue;
        }
        let mtime = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let id = name.trim_end_matches(".jsonl").to_string();
        if best.as_ref().is_none_or(|(_, best_mtime)| mtime > *best_mtime) {
            best = Some((id, mtime));
        }
    }
    best.map(|(id, _)| id)
}

struct ClaudeAdapter;

impl AgentAdapter for ClaudeAdapter {
    fn kind(&self) -> AgentKind {
        AgentKind::Claude
    }

    fn binaries(&self) -> &[&str] {
        &["claude"]
    }

    fn resume_args(&self, session_id: &str) -> Vec<String> {
        vec![
            "claude".to_string(),
            "--resume".to_string(),
            session_id.to_string(),
        ]
    }

    fn find_latest_session_id(&self, cwd: &str, home: &str) -> Option<String> {
        let project_dir = PathBuf::from(home)
            .join(".claude")
            .join("projects")
            .join(sanitize_claude_project_key(cwd));
        newest_jsonl_session_id(&project_dir)
    }
}

fn codex_session_id_from_path(path: &str) -> Option<String> {
    let base = Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .trim_end_matches(".jsonl");
    if let Some(rest) = base.strip_prefix("rollout-") {
        return Some(rest.to_string());
    }
    let uuid_re = regex::Regex::new(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    )
    .ok()?;
    if uuid_re.is_match(base) {
        return Some(base.to_string());
    }
    None
}

struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn kind(&self) -> AgentKind {
        AgentKind::Codex
    }

    fn binaries(&self) -> &[&str] {
        &["codex"]
    }

    fn resume_args(&self, session_id: &str) -> Vec<String> {
        vec![
            "codex".to_string(),
            "resume".to_string(),
            session_id.to_string(),
        ]
    }

    fn find_latest_session_id(&self, _cwd: &str, home: &str) -> Option<String> {
        let root = PathBuf::from(home).join(".codex").join("sessions");
        let files = walk_files(&root, |name| name.ends_with(".jsonl"));
        let mut candidates = Vec::new();
        for file in files {
            let Some(id) = codex_session_id_from_path(&file) else {
                continue;
            };
            let mtime = fs::metadata(&file)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            candidates.push((id, mtime));
        }
        newest_by_mtime(&candidates).map(|(id, _)| id.clone())
    }
}

fn find_latest_cursor_session_in_workspace(workspace_dir: &Path) -> Option<String> {
    let entries = fs::read_dir(workspace_dir).ok()?;
    let mut candidates = Vec::new();
    for entry in entries.flatten() {
        let chat_id = entry.file_name().to_string_lossy().into_owned();
        let store_db = workspace_dir.join(&chat_id).join("store.db");
        let mtime = fs::metadata(&store_db)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)?;
        candidates.push((chat_id, mtime));
    }
    newest_by_mtime(&candidates).map(|(id, _)| id.clone())
}

struct CursorAdapter;

impl AgentAdapter for CursorAdapter {
    fn kind(&self) -> AgentKind {
        AgentKind::Cursor
    }

    fn binaries(&self) -> &[&str] {
        &["agent", "cursor-agent"]
    }

    fn resume_args(&self, session_id: &str) -> Vec<String> {
        vec![
            "agent".to_string(),
            "--resume".to_string(),
            session_id.to_string(),
        ]
    }

    fn find_latest_session_id(&self, cwd: &str, home: &str) -> Option<String> {
        let workspace_dir = PathBuf::from(home)
            .join(".cursor")
            .join("chats")
            .join(cursor_workspace_hash(cwd));
        if let Some(direct) = find_latest_cursor_session_in_workspace(&workspace_dir) {
            return Some(direct);
        }

        let root = PathBuf::from(home).join(".cursor").join("chats");
        let workspaces = fs::read_dir(&root).ok()?;
        let mut candidates = Vec::new();
        for entry in workspaces.flatten() {
            let workspace_id = entry.path();
            let chat_id = find_latest_cursor_session_in_workspace(&workspace_id)?;
            let store_db = workspace_id.join(&chat_id).join("store.db");
            let mtime = fs::metadata(&store_db)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)?;
            candidates.push((chat_id, mtime));
        }
        newest_by_mtime(&candidates).map(|(id, _)| id.clone())
    }
}

fn gemini_sessions_for_project(cwd: &str, home: &str) -> Vec<String> {
    let resolved = normalize_cwd(cwd);
    let hash = gemini_project_hash(&resolved);
    let direct_dir = PathBuf::from(home)
        .join(".gemini")
        .join("tmp")
        .join(&hash)
        .join("chats");
    let direct = walk_files(&direct_dir, is_gemini_session_file);
    if !direct.is_empty() {
        return direct;
    }

    let root = PathBuf::from(home).join(".gemini").join("tmp");
    walk_files(&root, is_gemini_session_file)
        .into_iter()
        .filter(|file| {
            read_first_json_line(file)
                .and_then(|meta| meta.get("projectHash").and_then(|v| v.as_str()).map(str::to_string))
                .is_some_and(|h| h == hash)
        })
        .collect()
}

struct GeminiAdapter;

impl AgentAdapter for GeminiAdapter {
    fn kind(&self) -> AgentKind {
        AgentKind::Gemini
    }

    fn binaries(&self) -> &[&str] {
        &["gemini"]
    }

    fn resume_args(&self, session_id: &str) -> Vec<String> {
        vec![
            "gemini".to_string(),
            "--resume".to_string(),
            session_id.to_string(),
        ]
    }

    fn find_latest_session_id(&self, cwd: &str, home: &str) -> Option<String> {
        let files = gemini_sessions_for_project(cwd, home);
        let mut candidates = Vec::new();
        for file in files {
            let id = session_id_from_gemini_file(&file)?;
            let mtime = fs::metadata(&file)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            candidates.push((id, mtime));
        }
        newest_by_mtime(&candidates).map(|(id, _)| id.clone())
    }
}

static CLAUDE: ClaudeAdapter = ClaudeAdapter;
static CODEX: CodexAdapter = CodexAdapter;
static CURSOR: CursorAdapter = CursorAdapter;
static GEMINI: GeminiAdapter = GeminiAdapter;

static ADAPTERS: [&dyn AgentAdapter; 4] = [&CLAUDE, &CODEX, &CURSOR, &GEMINI];

pub fn agent_adapters() -> [&'static dyn AgentAdapter; 4] {
    ADAPTERS
}

pub fn default_agent_home() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"))
}

mod session_utils {
    use md5::{Digest, Md5};
    use regex::Regex;
    use sha2::{Digest as ShaDigest, Sha256};
    use std::collections::HashMap;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::OnceLock;

    pub fn normalize_cwd(cwd: &str) -> String {
        fs::canonicalize(cwd)
            .ok()
            .and_then(|p| p.to_str().map(str::to_string))
            .unwrap_or_else(|| cwd.to_string())
    }

    pub fn cursor_workspace_hash(cwd: &str) -> String {
        format!("{:x}", Md5::digest(normalize_cwd(cwd).as_bytes()))
    }

    pub fn gemini_project_hash(cwd: &str) -> String {
        format!("{:x}", Sha256::digest(normalize_cwd(cwd).as_bytes()))
    }

    pub fn newest_by_mtime(items: &[(String, i64)]) -> Option<&(String, i64)> {
        items.iter().max_by_key(|(_, mtime)| *mtime)
    }

    pub fn read_first_json_line(path: &str) -> Option<HashMap<String, serde_json::Value>> {
        let head = fs::read_to_string(path).ok()?;
        let line = head.lines().next()?.trim();
        if line.is_empty() {
            return None;
        }
        serde_json::from_str(line).ok()
    }

    pub fn session_id_from_gemini_file(path: &str) -> Option<String> {
        if let Some(meta) = read_first_json_line(path) {
            if let Some(serde_json::Value::String(session_id)) = meta.get("sessionId") {
                if !session_id.is_empty() {
                    return Some(session_id.clone());
                }
            }
        }
        let base = Path::new(path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .trim_end_matches(".json")
            .trim_end_matches(".jsonl");
        static UUID_RE: OnceLock<Regex> = OnceLock::new();
        let re = UUID_RE.get_or_init(|| {
            Regex::new(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
                .expect("uuid regex")
        });
        re.captures(base)
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().to_string())
    }

    pub fn walk_files(root: &Path, filter: fn(&str) -> bool) -> Vec<String> {
        let mut files = Vec::new();
        let mut stack = vec![root.to_path_buf()];
        while let Some(dir) = stack.pop() {
            let entries = match fs::read_dir(&dir) {
                Ok(entries) => entries,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                let path = entry.path();
                let meta = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                if meta.is_dir() {
                    stack.push(path);
                } else if filter(
                    path.file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or(""),
                ) {
                    files.push(path.to_string_lossy().into_owned());
                }
            }
        }
        files
    }

    pub fn is_gemini_session_file(name: &str) -> bool {
        static RE: OnceLock<Regex> = OnceLock::new();
        RE.get_or_init(|| Regex::new(r"^session-.*\.(jsonl?|json)$").expect("gemini file regex"))
            .is_match(name)
    }
}
