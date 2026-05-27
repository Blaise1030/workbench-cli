mod auth;
mod health;
mod keybindings;
pub mod middleware;
mod settings;
mod workspace;

use std::sync::Arc;

use axum::Router;

use crate::app_state::AppState;

pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .nest("/auth", auth::router())
        .nest("/settings", settings::router())
        .nest("/keybindings", keybindings::router())
        .merge(workspace::router())
        .merge(health::router())
        .with_state(state)
}
