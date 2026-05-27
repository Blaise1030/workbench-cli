const INVITE_TTL_MS: i64 = 15 * 60 * 1000;

#[derive(Debug, Clone)]
pub struct InviteToken {
    pub value: String,
    pub expires_at: i64,
    pub used: bool,
}

fn random_hex_64() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn create_invite() -> InviteToken {
    InviteToken {
        value: random_hex_64(),
        expires_at: now_ms() + INVITE_TTL_MS,
        used: false,
    }
}

pub fn is_invite_valid(invite: Option<&InviteToken>, input: &str) -> bool {
    let Some(invite) = invite else {
        return false;
    };
    if invite.used {
        return false;
    }
    if now_ms() >= invite.expires_at {
        return false;
    }
    input == invite.value
}

pub fn consume_invite(invite: &mut InviteToken) {
    invite.used = true;
}
