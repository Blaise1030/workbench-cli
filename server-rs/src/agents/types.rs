use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AgentKind {
    Claude,
    Codex,
    Cursor,
    Gemini,
}

impl AgentKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Cursor => "cursor",
            Self::Gemini => "gemini",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "claude" => Some(Self::Claude),
            "codex" => Some(Self::Codex),
            "cursor" => Some(Self::Cursor),
            "gemini" => Some(Self::Gemini),
            _ => None,
        }
    }
}

impl fmt::Display for AgentKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone)]
pub struct CommandCompleteEvent {
    pub command_line: String,
    pub exit_code: i32,
    pub cwd: String,
}

pub trait AgentAdapter: Send + Sync {
    fn kind(&self) -> AgentKind;
    fn binaries(&self) -> &[&str];
    fn resume_args(&self, session_id: &str) -> Vec<String>;
    fn find_latest_session_id(&self, cwd: &str, home: &str) -> Option<String>;
}
