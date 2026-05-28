use std::collections::{hash_map::Entry, HashMap, HashSet};
use std::env;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tracing::error;

use crate::agents::r#match::build_agent_resume_argv;
use crate::agents::types::{AgentKind, CommandCompleteEvent};
use crate::settings::terminal_settings::{
    get_terminal_settings, is_agent_hook_enabled, pty_idle_ttl_ms, scrollback_cap_bytes,
};
use crate::settings::SettingsStore;

use super::osc_parser::parse_osc_stream;
use super::pty::parse_resize;
use super::ring_buffer::RingBuffer;
use super::scrollback_persist::{
    delete_scrollback, dump_scrollback, load_scrollback, OmitScrollbackMeta,
};
use super::shell_integration::shell_integration_spawn;

pub type ClientId = u64;

static NEXT_CLIENT_ID: AtomicU64 = AtomicU64::new(1);

pub fn next_client_id() -> ClientId {
    NEXT_CLIENT_ID.fetch_add(1, Ordering::Relaxed)
}

#[derive(Debug, Clone)]
pub struct TerminalAttachContext {
    pub cwd: String,
    pub resume_command: Option<String>,
    pub resume_trusted: bool,
    pub agent_kind: Option<String>,
    pub agent_session_id: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct PtyRegistryAttachOptions {
    pub skip_replay: bool,
}

struct PtyProcess {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    read_task: JoinHandle<()>,
    wait_task: JoinHandle<()>,
    pump_task: JoinHandle<()>,
}

struct PtyEntry {
    cwd: String,
    resume_command: Option<String>,
    resume_trusted: bool,
    agent_kind: Option<String>,
    agent_session_id: Option<String>,
    pty: Option<PtyProcess>,
    ring: RingBuffer,
    clients: HashSet<ClientId>,
    client_tx: HashMap<ClientId, mpsc::UnboundedSender<String>>,
    idle_timer: Option<JoinHandle<()>>,
    last_activity: i64,
    exit_code: Option<i32>,
    pending_disk_scrollback: bool,
    osc_carry: String,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn process_env() -> HashMap<String, String> {
    env::vars().collect()
}

fn apply_attach_context(entry: &mut PtyEntry, ctx: &TerminalAttachContext) {
    entry.cwd = ctx.cwd.clone();
    if ctx.resume_command.is_some() {
        entry.resume_command = ctx.resume_command.clone();
    }
    entry.resume_trusted = ctx.resume_trusted;
    if ctx.agent_kind.is_some() {
        entry.agent_kind = ctx.agent_kind.clone();
    }
    if ctx.agent_session_id.is_some() {
        entry.agent_session_id = ctx.agent_session_id.clone();
    }
}

pub struct PtyRegistry {
    settings_store: Arc<SettingsStore>,
    entries: Mutex<HashMap<String, PtyEntry>>,
    on_command_complete:
        Option<Arc<dyn Fn(String, CommandCompleteEvent) + Send + Sync>>,
}

impl PtyRegistry {
    pub fn new(
        settings_store: Arc<SettingsStore>,
        on_command_complete: Option<Arc<dyn Fn(String, CommandCompleteEvent) + Send + Sync>>,
    ) -> Arc<Self> {
        Arc::new(Self {
            settings_store,
            entries: Mutex::new(HashMap::new()),
            on_command_complete,
        })
    }

    fn scrollback_cap(&self) -> usize {
        scrollback_cap_bytes(
            get_terminal_settings(&self.settings_store)
                .map(|s| s.scrollback_cap_kb)
                .unwrap_or(4096),
        ) as usize
    }

    fn hydrate_from_disk(&self, terminal_id: &str, entry: &mut PtyEntry) {
        if entry.pty.is_some() || entry.ring.byte_length() > 0 {
            return;
        }
        let persist = get_terminal_settings(&self.settings_store)
            .map(|s| s.scrollback_persist_on_shutdown)
            .unwrap_or(true);
        if !persist {
            return;
        }
        let Some((data, meta)) = load_scrollback(terminal_id) else {
            return;
        };
        entry.ring.append(&data);
        if !meta.cwd.is_empty() {
            entry.cwd = meta.cwd;
        }
        entry.last_activity = meta.last_activity;
        entry.exit_code = meta.exit_code;
        entry.pending_disk_scrollback = true;
    }

    fn clear_idle_timer(entry: &mut PtyEntry) {
        if let Some(handle) = entry.idle_timer.take() {
            handle.abort();
        }
    }

    fn schedule_idle_kill(self: &Arc<Self>, terminal_id: String) {
        let ttl = pty_idle_ttl_ms(
            get_terminal_settings(&self.settings_store)
                .map(|s| s.pty_idle_ttl_hours)
                .unwrap_or(24.0),
        );
        let registry = Arc::clone(self);
        let terminal_id_for_timer = terminal_id.clone();
        let handle = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(ttl as u64)).await;
            let clients_empty = registry
                .entries
                .lock()
                .get(&terminal_id_for_timer)
                .is_some_and(|e| e.clients.is_empty());
            if clients_empty {
                registry.kill(&terminal_id_for_timer);
            }
        });

        if let Some(entry) = self.entries.lock().get_mut(&terminal_id) {
            entry.idle_timer = Some(handle);
        }
    }

    fn broadcast(entry: &PtyEntry, data: &str) {
        for tx in entry.client_tx.values() {
            let _ = tx.send(data.to_string());
        }
    }

    fn collect_osc_command_completes(
        entry: &mut PtyEntry,
        chunk: &str,
    ) -> Vec<CommandCompleteEvent> {
        let parsed = parse_osc_stream(&entry.osc_carry, chunk);
        entry.osc_carry = parsed.carry;
        let cwd = entry.cwd.clone();
        parsed
            .reports
            .into_iter()
            .filter_map(|report| {
                Some(CommandCompleteEvent {
                    command_line: report.command_line?,
                    exit_code: report.command_exit?,
                    cwd: cwd.clone(),
                })
            })
            .collect()
    }

    fn dispatch_command_completes(
        &self,
        terminal_id: &str,
        events: Vec<CommandCompleteEvent>,
    ) {
        let Some(cb) = &self.on_command_complete else {
            return;
        };
        for event in events {
            cb(terminal_id.to_string(), event);
        }
    }

    fn build_command(
        &self,
        entry: &PtyEntry,
        shell: &str,
        base_env: &HashMap<String, String>,
    ) -> Result<CommandBuilder, Box<dyn std::error::Error + Send + Sync>> {
        let settings = get_terminal_settings(&self.settings_store)?;
        let use_custom_resume = entry
            .resume_command
            .as_ref()
            .is_some_and(|c| !c.trim().is_empty())
            && entry.resume_trusted;

        if use_custom_resume {
            let mut builder = CommandBuilder::new(shell);
            builder.arg("-c");
            builder.arg(entry.resume_command.as_ref().unwrap().trim());
            builder.cwd(entry.cwd.clone());
            for (k, v) in base_env {
                builder.env(k, v);
            }
            return Ok(builder);
        }

        if settings.auto_resume_agent_sessions
            && entry.agent_kind.is_some()
            && entry.agent_session_id.is_some()
            && entry
                .agent_kind
                .as_ref()
                .and_then(|k| AgentKind::parse(k))
                .is_some_and(|kind| {
                    is_agent_hook_enabled(&self.settings_store, kind.as_str()).unwrap_or(false)
                })
        {
            let kind = AgentKind::parse(entry.agent_kind.as_ref().unwrap()).unwrap();
            let session_id = entry.agent_session_id.as_ref().unwrap();
            if let Some(argv) = build_agent_resume_argv(kind, session_id) {
                if argv.len() >= 2 {
                    let mut builder = CommandBuilder::new(&argv[0]);
                    for arg in &argv[1..] {
                        builder.arg(arg);
                    }
                    builder.cwd(entry.cwd.clone());
                    for (k, v) in base_env {
                        builder.env(k, v);
                    }
                    return Ok(builder);
                }
            }
        }

        let spawn = shell_integration_spawn(shell, base_env.clone())?;
        let mut builder = CommandBuilder::new(shell);
        for arg in &spawn.args {
            builder.arg(arg);
        }
        builder.cwd(entry.cwd.clone());
        for (k, v) in &spawn.env {
            builder.env(k, v);
        }
        Ok(builder)
    }

    fn spawn_pty(
        self: &Arc<Self>,
        terminal_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        {
            let mut entries = self.entries.lock();
            let entry = entries
                .get_mut(terminal_id)
                .ok_or("terminal entry missing")?;

            if entry.pending_disk_scrollback {
                delete_scrollback(terminal_id);
                entry.pending_disk_scrollback = false;
            }

            if entry.pty.is_some() {
                return Ok(());
            }

            let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
            let base_env = process_env();
            let cmd = self.build_command(entry, &shell, &base_env)?;

            let pty_system = native_pty_system();
            let pair = pty_system.openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })?;

            let child = pair.slave.spawn_command(cmd)?;
            drop(pair.slave);

            let child_shared = Arc::new(Mutex::new(child));

            let mut reader = pair.master.try_clone_reader()?;
            let writer = pair.master.take_writer()?;
            let master: Box<dyn MasterPty + Send> = pair.master;

            entry.last_activity = now_ms();
            entry.osc_carry.clear();

            let registry = Arc::clone(self);

            // Channel decouples blocking PTY I/O from the async registry lock.
            let (data_tx, mut data_rx) = mpsc::unbounded_channel::<String>();

            // Pure I/O thread: reads PTY bytes and forwards to channel, never touches entries.
            let read_task = tokio::task::spawn_blocking(move || {
                let mut buf = [0u8; 8192];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            let chunk = String::from_utf8_lossy(&buf[..n]).into_owned();
                            if data_tx.send(chunk).is_err() {
                                break;
                            }
                        }
                    }
                }
            });

            // Async pump: holds parking_lot mutex only for brief CPU work — no blocking I/O inside.
            let registry_pump = Arc::clone(&registry);
            let terminal_id_pump = terminal_id.to_string();
            let pump_task = tokio::spawn(async move {
                while let Some(chunk) = data_rx.recv().await {
                    let command_completes = {
                        let mut entries = registry_pump.entries.lock();
                        let Some(entry) = entries.get_mut(&terminal_id_pump) else {
                            // Entry was removed (killed) while pump was still draining; remaining chunks discarded.
                            break;
                        };
                        entry.last_activity = now_ms();
                        let completes =
                            PtyRegistry::collect_osc_command_completes(entry, &chunk);
                        entry.ring.append(chunk.as_bytes());
                        PtyRegistry::broadcast(entry, &chunk);
                        completes
                    };
                    registry_pump.dispatch_command_completes(
                        &terminal_id_pump,
                        command_completes,
                    );
                }
            });

            let registry_wait = Arc::clone(&registry);
            let terminal_id_wait = terminal_id.to_string();
            let child_wait = Arc::clone(&child_shared);
            let wait_task = tokio::task::spawn_blocking(move || {
                let exit_code = child_wait.lock().wait().ok().map(|s| s.exit_code() as i32);
                let client_ids: Vec<ClientId>;
                let schedule_idle;
                {
                    let mut entries = registry_wait.entries.lock();
                    let Some(entry) = entries.get_mut(&terminal_id_wait) else {
                        return;
                    };
                    entry.pty = None;
                    entry.exit_code = exit_code;
                    schedule_idle = entry.clients.is_empty();
                    client_ids = entry.clients.iter().copied().collect();
                }
                if schedule_idle {
                    registry_wait.schedule_idle_kill(terminal_id_wait);
                } else {
                    for id in client_ids {
                        registry_wait.detach(terminal_id_wait.as_str(), id);
                    }
                }
            });

            entry.pty = Some(PtyProcess {
                master,
                writer,
                child: child_shared,
                read_task,
                wait_task,
                pump_task,
            });
        }

        Ok(())
    }

    pub fn attach(
        self: &Arc<Self>,
        terminal_id: &str,
        client_id: ClientId,
        ctx: TerminalAttachContext,
        options: PtyRegistryAttachOptions,
        outbound: mpsc::UnboundedSender<String>,
    ) {
        let replay = {
            let mut entries = self.entries.lock();
            let entry = match entries.entry(terminal_id.to_string()) {
                Entry::Occupied(mut slot) => {
                    apply_attach_context(slot.get_mut(), &ctx);
                    slot.into_mut()
                }
                Entry::Vacant(slot) => {
                    let mut entry = PtyEntry {
                        cwd: ctx.cwd.clone(),
                        resume_command: ctx.resume_command.clone(),
                        resume_trusted: ctx.resume_trusted,
                        agent_kind: ctx.agent_kind.clone(),
                        agent_session_id: ctx.agent_session_id.clone(),
                        pty: None,
                        ring: RingBuffer::new(self.scrollback_cap()),
                        clients: HashSet::new(),
                        client_tx: HashMap::new(),
                        idle_timer: None,
                        last_activity: now_ms(),
                        exit_code: None,
                        pending_disk_scrollback: false,
                        osc_carry: String::new(),
                    };
                    self.hydrate_from_disk(terminal_id, &mut entry);
                    slot.insert(entry)
                }
            };

            Self::clear_idle_timer(entry);
            entry.clients.insert(client_id);
            entry.client_tx.insert(client_id, outbound);

            if options.skip_replay {
                None
            } else {
                Some(entry.ring.snapshot())
            }
        };

        if let Some(snapshot) = replay {
            if !snapshot.is_empty() {
                let text = String::from_utf8_lossy(&snapshot).into_owned();
                if let Some(entry) = self.entries.lock().get(terminal_id) {
                    if let Some(tx) = entry.client_tx.get(&client_id) {
                        let _ = tx.send(text);
                    }
                }
            }
        }
    }

    pub fn handle_message(self: &Arc<Self>, terminal_id: &str, client_id: ClientId, raw: &str) {
        if let Some(resize) = parse_resize(raw) {
            let attached = self
                .entries
                .lock()
                .get(terminal_id)
                .is_some_and(|e| e.clients.contains(&client_id));

            if !attached {
                return;
            }

            let needs_spawn = self
                .entries
                .lock()
                .get(terminal_id)
                .is_some_and(|e| e.pty.is_none());

            if needs_spawn {
                let registry = Arc::clone(self);
                let terminal_id = terminal_id.to_string();
                if let Err(err) = registry.spawn_pty(&terminal_id, resize.cols, resize.rows) {
                    error!("PTY spawn failed: {err}");
                    registry.detach(&terminal_id, client_id);
                }
            } else if let Some(entry) = self.entries.lock().get_mut(terminal_id) {
                if let Some(pty) = &entry.pty {
                    let _ = pty.master.resize(PtySize {
                        rows: resize.rows,
                        cols: resize.cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    });
                }
            }
            return;
        }

        let mut entries = self.entries.lock();
        let Some(entry) = entries.get_mut(terminal_id) else {
            return;
        };
        if !entry.clients.contains(&client_id) {
            return;
        }
        if let Some(pty) = &mut entry.pty {
            let _ = pty.writer.write_all(raw.as_bytes());
        }
    }

    pub fn detach(self: &Arc<Self>, terminal_id: &str, client_id: ClientId) {
        let schedule_idle = {
            let mut entries = self.entries.lock();
            let Some(entry) = entries.get_mut(terminal_id) else {
                return;
            };
            entry.clients.remove(&client_id);
            entry.client_tx.remove(&client_id);
            entry.clients.is_empty()
        };
        if schedule_idle {
            self.schedule_idle_kill(terminal_id.to_string());
        }
    }

    /// Stop every live PTY (used on server shutdown so spawn_blocking wait/read tasks exit).
    pub fn kill_all(&self) {
        let ids: Vec<String> = self.entries.lock().keys().cloned().collect();
        for id in ids {
            self.kill(&id);
        }
    }

    pub fn kill(&self, terminal_id: &str) {
        let pty = {
            let mut entries = self.entries.lock();
            let Some(mut entry) = entries.remove(terminal_id) else {
                delete_scrollback(terminal_id);
                return;
            };
            Self::clear_idle_timer(&mut entry);
            entry.pty.take()
        };

        if let Some(pty) = pty {
            // Abort I/O tasks before touching the child — wait_task holds the child mutex
            // for the duration of wait(); killing while holding entries.lock() deadlocks.
            pty.read_task.abort();
            pty.pump_task.abort();
            let _ = pty.child.lock().kill();
            pty.wait_task.abort();
        }
        delete_scrollback(terminal_id);
    }

    pub fn has(&self, terminal_id: &str) -> bool {
        self.entries.lock().contains_key(terminal_id)
    }

    pub fn set_agent_session(&self, terminal_id: &str, agent_kind: &str, agent_session_id: &str) {
        if let Some(entry) = self.entries.lock().get_mut(terminal_id) {
            entry.agent_kind = Some(agent_kind.to_string());
            entry.agent_session_id = Some(agent_session_id.to_string());
        }
    }

    pub async fn shutdown(&self) {
        let persist = get_terminal_settings(&self.settings_store)
            .map(|s| s.scrollback_persist_on_shutdown)
            .unwrap_or(true);
        if !persist {
            return;
        }

        let entries = self.entries.lock();
        for (terminal_id, entry) in entries.iter() {
            let snapshot = entry.ring.snapshot();
            if snapshot.is_empty() {
                continue;
            }
            let meta = OmitScrollbackMeta {
                cwd: entry.cwd.clone(),
                last_activity: entry.last_activity,
                exit_code: entry.exit_code,
            };
            if let Err(err) = dump_scrollback(terminal_id, &snapshot, meta) {
                error!("scrollback dump failed for {terminal_id}: {err}");
            }
        }
    }
}
