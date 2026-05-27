use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::sync::Arc;

use crate::app_state::AppState;

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
    server: &'static str,
    version: &'static str,
}

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        server: "rust",
        version: env!("CARGO_PKG_VERSION"),
    })
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/health", get(health))
}
