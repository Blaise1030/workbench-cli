use std::sync::Arc;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;

use crate::app_state::AppState;
use crate::auth::validate_session;
use crate::error::AppError;

pub fn parse_sid(cookie_header: Option<&str>) -> String {
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

pub struct RequireSession;

impl<S> FromRequestParts<S> for RequireSession
where
    S: Send + Sync,
    Arc<AppState>: axum::extract::FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let state: Arc<AppState> = axum::extract::FromRef::from_ref(state);
        let sid = parse_sid(
            parts
                .headers
                .get(axum::http::header::COOKIE)
                .and_then(|v| v.to_str().ok()),
        );
        if !validate_session(&state.session.read(), &sid) {
            return Err(AppError::Unauthorized("Unauthorized".into()));
        }
        Ok(Self)
    }
}

pub fn session_cookie(sid: &str, secure: bool) -> String {
    let secure_flag = if secure { "; Secure" } else { "" };
    format!("sid={sid}; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/{secure_flag}")
}
