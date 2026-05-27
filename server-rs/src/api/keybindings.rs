use std::sync::Arc;

use axum::extract::State;
use axum::routing::{get, put};
use axum::{Json, Router};

use crate::app_state::AppState;
use super::middleware::RequireSession;
use crate::error::AppError;
use crate::keybindings::store::{get_keybindings, put_keybindings, KeybindingsMap};

async fn get_bindings(_: RequireSession, State(_state): State<Arc<AppState>>) -> Result<Json<KeybindingsMap>, AppError> {
    Ok(Json(get_keybindings(None)?))
}

async fn put_bindings(
    _: RequireSession,
    State(_state): State<Arc<AppState>>,
    Json(map): Json<KeybindingsMap>,
) -> Result<Json<KeybindingsMap>, AppError> {
    put_keybindings(&map, None)?;
    Ok(Json(map))
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", get(get_bindings).put(put_bindings))
}
