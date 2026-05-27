use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tracing::error;

use crate::auth::local::is_loopback_address;
use crate::auth::session::{activate_session, validate_session};
use crate::app_state::AppState;
use crate::error::AppError;
use crate::workspace::terminals::get_terminal_with_worktree;

use super::pty_registry::{
    next_client_id, PtyRegistry, PtyRegistryAttachOptions, TerminalAttachContext,
};

#[derive(Debug, serde::Deserialize)]
pub struct WsQuery {
    #[serde(rename = "terminalId")]
    pub terminal_id: Option<String>,
    #[serde(rename = "skipReplay")]
    pub skip_replay: Option<String>,
}

fn parse_sid(cookie_header: Option<&str>) -> String {
    let Some(header) = cookie_header else {
        return String::new();
    };
    for part in header.split(';') {
        let part = part.trim();
        if let Some(sid) = part.strip_prefix("sid=") {
            return sid.to_string();
        }
    }
    String::new()
}

fn parse_skip_replay(value: Option<&str>) -> bool {
    matches!(
        value.map(str::trim).map(str::to_lowercase).as_deref(),
        Some("1") | Some("true")
    )
}

async fn handle_terminal_socket(
    socket: WebSocket,
    registry: Arc<PtyRegistry>,
    terminal_id: String,
    ctx: TerminalAttachContext,
    skip_replay: bool,
) {
    let client_id = next_client_id();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    registry.attach(
        &terminal_id,
        client_id,
        ctx,
        PtyRegistryAttachOptions { skip_replay },
        tx,
    );

    let (mut ws_tx, mut ws_rx) = socket.split();
    let registry_fwd = Arc::clone(&registry);
    let terminal_id_fwd = terminal_id.clone();

    let forward = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(Message::Text(text)) => {
                registry_fwd.handle_message(&terminal_id_fwd, client_id, &text);
            }
            Ok(Message::Binary(data)) => {
                let text = String::from_utf8_lossy(&data);
                registry_fwd.handle_message(&terminal_id_fwd, client_id, &text);
            }
            Ok(Message::Close(_)) | Err(_) => break,
            Ok(_) => {}
        }
    }

    forward.abort();
    registry.detach(&terminal_id, client_id);
}

pub async fn terminal_ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
) -> Response {
    let sid = parse_sid(headers.get(axum::http::header::COOKIE).and_then(|v| v.to_str().ok()));
    let peer_addr = peer.ip().to_string();

    {
        let session = state.session.read();
        if !validate_session(&session, &sid) {
            if !is_loopback_address(&peer_addr) {
                return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
            }
            drop(session);
            activate_session(&mut state.session.write());
        }
    }

    let terminal_id = query.terminal_id.unwrap_or_default().trim().to_string();
    if terminal_id.is_empty() {
        return (StatusCode::BAD_REQUEST, "terminalId required").into_response();
    }

    let record = match get_terminal_with_worktree(&state.db, &terminal_id) {
        Ok(Some(record)) => record,
        Ok(None) => return (StatusCode::NOT_FOUND, "Terminal not found").into_response(),
        Err(AppError::NotFound(msg)) => return (StatusCode::NOT_FOUND, msg).into_response(),
        Err(AppError::BadRequest(msg)) => return (StatusCode::BAD_REQUEST, msg).into_response(),
        Err(err) => {
            error!("terminal ws lookup failed: {err}");
            return (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response();
        }
    };

    let skip_replay = parse_skip_replay(query.skip_replay.as_deref());
    let ctx = TerminalAttachContext {
        cwd: record.worktree.path,
        resume_command: record.terminal.resume_command,
        resume_trusted: record.terminal.resume_trusted,
        agent_kind: record.terminal.agent_kind,
        agent_session_id: record.terminal.agent_session_id,
    };

    let registry = Arc::clone(&state.pty_registry);
    ws.on_upgrade(move |socket| {
        handle_terminal_socket(socket, registry, terminal_id, ctx, skip_replay)
    })
}
