use std::sync::Arc;

use axum::extract::State;
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use serde_json::json;

use crate::app_state::AppState;
use super::middleware::RequireSession;
use crate::error::AppError;
use crate::settings::{
    build_network_settings, get_lan_ip, patch_network_settings, terminal_settings,
    NetworkConfigPatch,
};
use crate::types::{CreateApprovedResumePrefixBody, LanToggleBody, PatchNetworkBody};


async fn get_lan(_: RequireSession, State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::to_value(state.lan.read().get_public_state()).unwrap())
}

async fn post_lan(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<LanToggleBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.enabled {
        let ip = get_lan_ip();
        if ip == "127.0.0.1" {
            return Err(AppError::ServiceUnavailable(
                "No network interface found".into(),
            ));
        }
        state.lan.write().enable(ip);
    } else {
        state.lan.write().disable();
    }

    state
        .request_lan_restart(body.enabled)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(
        serde_json::to_value(state.lan.read().get_public_state()).unwrap(),
    ))
}

async fn refresh_invite(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    state
        .lan
        .write()
        .refresh_invite()
        .map_err(|e| AppError::BadRequest(e))?;
    Ok(Json(
        serde_json::to_value(state.lan.read().get_public_state()).unwrap(),
    ))
}

async fn get_network(_: RequireSession, State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(serde_json::to_value(build_network_settings(&state.lan.read())).unwrap())
}

async fn patch_network(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<PatchNetworkBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if body.host.is_none() && body.port.is_none() {
        return Err(AppError::BadRequest("No changes provided".into()));
    }
    let patch = NetworkConfigPatch {
        host: body.host,
        port: body.port,
    };
    let settings = patch_network_settings(&state.lan.read(), &patch)?;
    Ok(Json(serde_json::to_value(settings).unwrap()))
}

async fn get_terminal_settings(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let settings = terminal_settings::get_terminal_settings(&state.settings_store)?;
    Ok(Json(serde_json::to_value(settings).unwrap()))
}

async fn patch_terminal_settings(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<terminal_settings::PatchTerminalSettings>,
) -> Result<Json<serde_json::Value>, AppError> {
    let settings = terminal_settings::patch_terminal_settings(&state.settings_store, &body)?;
    Ok(Json(serde_json::to_value(settings).unwrap()))
}

async fn list_resume_commands(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let approved = terminal_settings::list_approved_resume_prefixes(&state.settings_store)?;
    Ok(Json(json!({ "approvedPrefixes": approved })))
}

async fn add_resume_command(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateApprovedResumePrefixBody>,
) -> Result<(axum::http::StatusCode, Json<serde_json::Value>), AppError> {
    let entry = terminal_settings::add_approved_resume_prefix(
        &state.settings_store,
        &terminal_settings::CreateApprovedResumePrefixInput {
            prefix: body.prefix,
            label: body.label,
            cwd: body.cwd,
            env: body.env,
        },
    )?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({ "prefix": entry })),
    ))
}

async fn delete_resume_command(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ok = terminal_settings::revoke_approved_resume_prefix(&state.settings_store, &id)?;
    if !ok {
        return Err(AppError::NotFound("Not found".into()));
    }
    Ok(Json(json!({ "ok": true })))
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/lan", get(get_lan).post(post_lan))
        .route("/lan/refresh-invite", post(refresh_invite))
        .route("/network", get(get_network).patch(patch_network))
        .route("/terminal", get(get_terminal_settings).patch(patch_terminal_settings))
        .route("/terminal/resume-commands", get(list_resume_commands).post(add_resume_command))
        .route("/terminal/resume-commands/{id}", delete(delete_resume_command))
}
