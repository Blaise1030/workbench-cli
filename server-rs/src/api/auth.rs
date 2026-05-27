use std::sync::Arc;

use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};

use crate::app_state::AppState;
use crate::auth::{
    activate_session, is_invite_valid, is_local_addr, is_token_expired, is_token_valid,
};
use crate::error::AppError;
use crate::types::AuthBody;

use super::middleware::{parse_sid, session_cookie};

async fn auth_local(
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer): ConnectInfo<std::net::SocketAddr>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    if !is_local_addr(&peer.ip().to_string()) {
        return Err(AppError::Forbidden("Forbidden".into()));
    }

    {
        let mut session = state.session.write();
        if !session.active {
            activate_session(&mut session);
        }
        let sid = session.sid.clone();
        let cookie = session_cookie(&sid, state.cookie_secure());
        drop(session);
        return Ok((
            StatusCode::OK,
            [(axum::http::header::SET_COOKIE, cookie)],
            Json(serde_json::json!({ "ok": true })),
        )
            .into_response());
    }
}

async fn auth_token(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AuthBody>,
) -> Result<Response, AppError> {
    let input = body.token.unwrap_or_default();

    if let Some(invite) = state.lan.read().get_invite().cloned() {
        if is_invite_valid(Some(&invite), &input) {
            if state.session.read().active {
                return Err(AppError::Conflict(
                    "Another session is already active".into(),
                ));
            }
            state.lan.write().consume_current_invite();
            let mut session = state.session.write();
            activate_session(&mut session);
            let sid = session.sid.clone();
            let cookie = session_cookie(&sid, state.cookie_secure());
            return Ok((
                StatusCode::OK,
                [(axum::http::header::SET_COOKIE, cookie)],
                Json(serde_json::json!({ "ok": true })),
            )
                .into_response());
        }

        if input == invite.value {
            if invite.used {
                return Err(AppError::Unauthorized(
                    "Invite link already used".into(),
                ));
            }
            if chrono::Utc::now().timestamp_millis() >= invite.expires_at {
                return Err(AppError::Unauthorized(
                    "Invite link expired — ask host to regenerate".into(),
                ));
            }
        }
    }

    if !is_token_valid(&state.session_token, &input) {
        if is_token_expired(&state.session_token) {
            return Err(AppError::Unauthorized(
                "Token expired — restart the server".into(),
            ));
        }
        return Err(AppError::Unauthorized("Invalid token".into()));
    }

    if state.session.read().active {
        return Err(AppError::Conflict(
            "Another session is already active".into(),
        ));
    }

    let mut session = state.session.write();
    activate_session(&mut session);
    let sid = session.sid.clone();
    let cookie = session_cookie(&sid, state.cookie_secure());

    Ok((
        StatusCode::OK,
        [(axum::http::header::SET_COOKIE, cookie)],
        Json(serde_json::json!({ "ok": true })),
    )
        .into_response())
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/local", post(auth_local))
        .route("/", post(auth_token))
}
