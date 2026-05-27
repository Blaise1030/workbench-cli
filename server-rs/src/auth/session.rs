#[derive(Debug, Clone)]
pub struct Session {
    pub sid: String,
    pub active: bool,
}

fn random_hex_64() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

pub fn create_session() -> Session {
    Session {
        sid: random_hex_64(),
        active: false,
    }
}

pub fn activate_session(session: &mut Session) {
    session.active = true;
}

pub fn deactivate_session(session: &mut Session) {
    session.active = false;
}

pub fn validate_session(session: &Session, sid: &str) -> bool {
    session.active && session.sid == sid
}
