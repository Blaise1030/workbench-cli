use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    PayloadTooLarge(String),
    #[error("{0}")]
    ServiceUnavailable(String),
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::PayloadTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

pub fn project_error(msg: impl Into<String>, status: u16) -> AppError {
    match status {
        404 => AppError::NotFound(msg.into()),
        _ => AppError::BadRequest(msg.into()),
    }
}

pub fn worktree_error(msg: impl Into<String>, status: u16) -> AppError {
    match status {
        404 => AppError::NotFound(msg.into()),
        _ => AppError::BadRequest(msg.into()),
    }
}

pub fn terminal_error(msg: impl Into<String>, status: u16) -> AppError {
    match status {
        404 => AppError::NotFound(msg.into()),
        _ => AppError::BadRequest(msg.into()),
    }
}

pub fn git_panel_error(msg: impl Into<String>, status: u16) -> AppError {
    match status {
        404 => AppError::NotFound(msg.into()),
        _ => AppError::BadRequest(msg.into()),
    }
}

pub fn file_read_error(msg: impl Into<String>, status: u16) -> AppError {
    match status {
        404 => AppError::NotFound(msg.into()),
        413 => AppError::PayloadTooLarge(msg.into()),
        _ => AppError::BadRequest(msg.into()),
    }
}
