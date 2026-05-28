# Fix PTY Mutex Contention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate executor-stalling mutex contention in the Rust PTY registry by moving PTY output processing off the blocking read thread and into an async pump task.

**Architecture:** The `spawn_blocking` read task currently holds `parking_lot::Mutex<entries>` on every PTY output chunk while doing OSC parsing, ring-buffer appends, and broadcast sends — blocking any Tokio thread that tries to call `handle_message` concurrently. Fix: the read task becomes a pure I/O forwarder that sends chunks to an `mpsc::unbounded_channel`; a new async `pump_task` receives from that channel and holds the mutex only for brief CPU work (no blocking I/O inside the lock).

**Tech Stack:** Rust, Tokio, `parking_lot::Mutex`, `tokio::sync::mpsc`

---

### Task 1: Add `pump_task` field to `PtyProcess` and wire the new read/pump split in `spawn_pty`

**Files:**
- Modify: `server-rs/src/terminal/pty_registry.rs`

The entire fix lives in this one file. Three sub-changes:
1. `PtyProcess` gains a `pump_task` field.
2. `spawn_pty` creates a data channel; the read task sends to it (no mutex); the pump task receives and briefly locks `entries`.
3. `kill` aborts `pump_task`.

- [ ] **Step 1: Update `PtyProcess` struct to include `pump_task`**

In `pty_registry.rs`, replace:

```rust
struct PtyProcess {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    read_task: JoinHandle<()>,
    wait_task: JoinHandle<()>,
}
```

with:

```rust
struct PtyProcess {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    read_task: JoinHandle<()>,
    wait_task: JoinHandle<()>,
    pump_task: JoinHandle<()>,
}
```

- [ ] **Step 2: Replace the read task body and add pump task in `spawn_pty`**

Find the section in `spawn_pty` starting at `let registry = Arc::clone(self);` through the closing `entry.pty = Some(PtyProcess { ... });` and replace it entirely:

```rust
            let registry = Arc::clone(self);
            let terminal_id_read = terminal_id.to_string();

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
                    let mut entries = registry_pump.entries.lock();
                    let Some(entry) = entries.get_mut(&terminal_id_pump) else {
                        break;
                    };
                    entry.last_activity = now_ms();
                    registry_pump.handle_osc_reports(&terminal_id_pump, entry, &chunk);
                    entry.ring.append(chunk.as_bytes());
                    PtyRegistry::broadcast(entry, &chunk);
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
```

- [ ] **Step 3: Abort `pump_task` in `kill`**

Find the `kill` method's PTY teardown block:

```rust
        if let Some(pty) = entry.pty.take() {
            let _ = pty.child.lock().kill();
            pty.read_task.abort();
            pty.wait_task.abort();
        }
```

Replace with:

```rust
        if let Some(pty) = entry.pty.take() {
            let _ = pty.child.lock().kill();
            pty.read_task.abort();
            pty.pump_task.abort();
            pty.wait_task.abort();
        }
```

- [ ] **Step 4: Build to verify no compiler errors**

```bash
cd /Users/blaisetiong/Developer/v2/server-rs && cargo build 2>&1 | tail -20
```

Expected: `Finished` with no errors. If there are borrow-checker errors on `registry_pump.handle_osc_reports(...)` inside the pump task while holding the entries guard, extract the broadcast and ring ops inline and pass `self.on_command_complete` separately — but this should compile as-is since the existing read task already does the same pattern.

- [ ] **Step 5: Commit**

```bash
cd /Users/blaisetiong/Developer/v2 && git add server-rs/src/terminal/pty_registry.rs && git commit -m "fix(server-rs): decouple PTY read loop from entries mutex to prevent executor stall

The spawn_blocking read task previously held parking_lot::Mutex<entries>
on every PTY output chunk. Any concurrent handle_message call (async Tokio
task) would block an OS thread waiting for the lock, stalling the executor
under terminal activity.

Fix: read task becomes a pure I/O forwarder via mpsc channel; a new async
pump_task receives chunks and holds the mutex only for brief CPU work (OSC
parse, ring append, broadcast sends) with no blocking I/O inside the lock."
```

- [ ] **Step 6: Smoke-test in the running app**

Start the Rust server, open two or more terminal tabs, run a command that produces continuous output (e.g. `yes` or `ping 1.1.1.1`) in one tab, and type in another tab simultaneously. Before this fix, the typing tab would freeze or lag during high output. After the fix, both tabs should remain responsive.
