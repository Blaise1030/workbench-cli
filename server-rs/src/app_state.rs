use std::sync::Arc;

use parking_lot::RwLock;
use tokio::sync::mpsc;

use crate::auth::{create_session, create_token, Session, SessionToken};
use crate::db::Db;
use crate::settings::{LanManager, SettingsStore};
use crate::terminal::pty_registry::PtyRegistry;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Db>,
    pub session_token: SessionToken,
    pub session: Arc<RwLock<Session>>,
    pub lan: Arc<RwLock<LanManager>>,
    pub settings_store: Arc<SettingsStore>,
    pub pty_registry: Arc<PtyRegistry>,
    pub cookie_secure: Arc<RwLock<bool>>,
    pub restart_tx: mpsc::Sender<bool>,
}

impl AppState {
    pub fn cookie_secure(&self) -> bool {
        *self.cookie_secure.read()
    }

    pub fn set_cookie_secure(&self, secure: bool) {
        *self.cookie_secure.write() = secure;
    }

    pub async fn request_lan_restart(&self, enabled: bool) -> Result<(), String> {
        self.restart_tx
            .send(enabled)
            .await
            .map_err(|_| "Server is shutting down".to_string())
    }
}

pub struct AppStateBuilder {
    pub db: Arc<Db>,
    pub session_token: SessionToken,
    pub session: Arc<RwLock<Session>>,
    pub lan: Arc<RwLock<LanManager>>,
    pub settings_store: Arc<SettingsStore>,
    pub pty_registry: Arc<PtyRegistry>,
    pub cookie_secure: bool,
    pub restart_tx: mpsc::Sender<bool>,
}

impl AppStateBuilder {
    pub fn build(self) -> AppState {
        AppState {
            db: self.db,
            session_token: self.session_token,
            session: self.session,
            lan: self.lan,
            settings_store: self.settings_store,
            pty_registry: self.pty_registry,
            cookie_secure: Arc::new(RwLock::new(self.cookie_secure)),
            restart_tx: self.restart_tx,
        }
    }
}

pub fn new_session_pair() -> (SessionToken, Arc<RwLock<Session>>) {
    (create_token(), Arc::new(RwLock::new(create_session())))
}
