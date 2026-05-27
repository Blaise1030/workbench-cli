const TOKEN_TTL_MS: i64 = 60 * 60 * 1000;

#[derive(Debug, Clone)]
pub struct SessionToken {
    pub value: String,
    pub expires_at: i64,
}

fn random_hex_64() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

pub fn create_token() -> SessionToken {
    SessionToken {
        value: random_hex_64(),
        expires_at: now_ms() + TOKEN_TTL_MS,
    }
}

pub fn is_token_expired(token: &SessionToken) -> bool {
    now_ms() >= token.expires_at
}

pub fn is_token_valid(token: &SessionToken, input: &str) -> bool {
    !is_token_expired(token) && input == token.value
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}
