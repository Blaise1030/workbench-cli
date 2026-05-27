use std::path::PathBuf;

use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use tower_http::services::ServeDir;

#[cfg(feature = "embed-assets")]
mod embedded {
    use rust_embed::Embed;

    #[derive(Embed)]
    #[folder = "../dist/public/"]
    pub struct PublicAssets;
}

pub fn spa_router() -> axum::Router {
    axum::Router::new().fallback(spa_handler)
}

async fn spa_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    if path.starts_with("api/") {
        return StatusCode::NOT_FOUND.into_response();
    }

    #[cfg(feature = "embed-assets")]
    {
        return serve_embedded(path).await;
    }

    #[cfg(not(feature = "embed-assets"))]
    {
        serve_filesystem(path).await
    }
}

#[cfg(feature = "embed-assets")]
async fn serve_embedded(path: &str) -> Response {
    use embedded::PublicAssets;

    let lookup = if path.is_empty() { "index.html" } else { path };

    if let Some(file) = PublicAssets::get(lookup) {
        return file_response(lookup, file.data.as_ref());
    }

    // SPA fallback — unknown routes serve index.html
    if let Some(index) = PublicAssets::get("index.html") {
        return file_response("index.html", index.data.as_ref());
    }

    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "Embedded UI missing — rebuild with `npm run build` and `--features embed-assets`",
    )
        .into_response()
}

#[cfg(not(feature = "embed-assets"))]
async fn serve_filesystem(path: &str) -> Response {
    let public_dir = public_dir();
    if !public_dir.exists() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            format!(
                "UI not found at {}. Run `npm run build` from repo root, or build with --features embed-assets.",
                public_dir.display()
            ),
        )
            .into_response();
    }

    let lookup = public_dir.join(if path.is_empty() { "index.html" } else { path });
    if lookup.is_file() {
        if let Ok(bytes) = tokio::fs::read(&lookup).await {
            let name = lookup.file_name().and_then(|n| n.to_str()).unwrap_or("");
            return file_response(name, &bytes);
        }
    }

    // SPA fallback
    let index = public_dir.join("index.html");
    if index.is_file() {
        if let Ok(bytes) = tokio::fs::read(&index).await {
            return file_response("index.html", &bytes);
        }
    }

    StatusCode::NOT_FOUND.into_response()
}

fn file_response(name: &str, bytes: &[u8]) -> Response {
    let mime = mime_guess::from_path(name)
        .first_or_octet_stream()
        .to_string();

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .body(Body::from(bytes.to_vec()))
        .unwrap()
}

#[allow(dead_code)]
pub fn filesystem_service() -> ServeDir {
    ServeDir::new(public_dir())
}

fn public_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist/public")
}
