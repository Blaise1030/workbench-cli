pub mod adapters;
pub mod handle_command;
pub mod r#match;
pub mod types;

pub use adapters::{agent_adapters, default_agent_home};
pub use handle_command::handle_agent_command_complete;
pub use r#match::{build_agent_resume_argv, extract_invocation, get_agent_adapter, match_agent_adapter};
pub use types::{AgentAdapter, AgentKind, CommandCompleteEvent};
