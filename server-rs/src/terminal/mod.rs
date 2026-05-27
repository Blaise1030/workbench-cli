pub mod handler;
pub mod osc_parser;
pub mod pty;
pub mod pty_registry;
pub mod ring_buffer;
pub mod scrollback_persist;
pub mod shell_integration;

pub use handler::terminal_ws_handler;
pub use osc_parser::{parse_osc133_command, parse_osc_stream, OscCommandReport, OscStreamParseResult};
pub use pty::{parse_resize, Resize};
pub use pty_registry::{
    next_client_id, ClientId, PtyRegistry, PtyRegistryAttachOptions, TerminalAttachContext,
};
pub use ring_buffer::RingBuffer;
pub use scrollback_persist::{
    delete_scrollback, dump_scrollback, has_scrollback_dump, load_scrollback, OmitScrollbackMeta,
    ScrollbackMeta,
};
pub use shell_integration::{
    bash_integration_rc_path, ensure_shell_integration_files, shell_integration_spawn,
    ShellIntegrationSpawn,
};
