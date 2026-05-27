use crate::auth::{consume_invite, create_invite, InviteToken};
use crate::types::LanPublicState;

pub type BindMode = &'static str;
pub const BIND_LOCALHOST: BindMode = "localhost";
pub const BIND_LAN: BindMode = "lan";

pub struct LanManager {
    pub port: u16,
    local_host: String,
    mode: BindMode,
    invite: Option<InviteToken>,
    lan_ip: Option<String>,
    url_scheme: String,
}

impl LanManager {
    pub fn new(port: u16, local_host: impl Into<String>) -> Self {
        Self {
            port,
            local_host: local_host.into(),
            mode: BIND_LOCALHOST,
            invite: None,
            lan_ip: None,
            url_scheme: "https".to_string(),
        }
    }

    pub fn get_url_scheme(&self) -> &str {
        &self.url_scheme
    }

    pub fn set_url_scheme(&mut self, scheme: impl Into<String>) {
        self.url_scheme = scheme.into();
    }

    pub fn enable(&mut self, lan_ip: impl Into<String>) {
        self.mode = BIND_LAN;
        self.lan_ip = Some(lan_ip.into());
        self.invite = Some(create_invite());
    }

    pub fn disable(&mut self) {
        self.mode = BIND_LOCALHOST;
        self.lan_ip = None;
        self.invite = None;
    }

    pub fn refresh_invite(&mut self) -> Result<InviteToken, String> {
        if self.mode != BIND_LAN || self.lan_ip.is_none() {
            return Err("LAN is not enabled".to_string());
        }
        let invite = create_invite();
        self.invite = Some(invite.clone());
        Ok(invite)
    }

    pub fn get_invite(&self) -> Option<&InviteToken> {
        self.invite.as_ref()
    }

    pub fn consume_current_invite(&mut self) {
        if let Some(ref mut inv) = self.invite {
            consume_invite(inv);
        }
    }

    pub fn mode(&self) -> BindMode {
        self.mode
    }

    pub fn get_hostname(&self) -> &'static str {
        if self.mode == BIND_LAN {
            "0.0.0.0"
        } else {
            "127.0.0.1"
        }
    }

    pub fn get_tls_hosts(&self) -> Vec<String> {
        if self.mode == BIND_LAN {
            if let Some(ref lan_ip) = self.lan_ip {
                return vec![
                    self.local_host.clone(),
                    "localhost".to_string(),
                    lan_ip.clone(),
                ];
            }
        }
        vec![
            self.local_host.clone(),
            "localhost".to_string(),
            "127.0.0.1".to_string(),
        ]
    }

    pub fn get_local_host(&self) -> &str {
        &self.local_host
    }

    pub fn get_local_url(&self) -> String {
        format!("{}://{}:{}/", self.url_scheme, self.local_host, self.port)
    }

    pub fn get_public_state(&self) -> LanPublicState {
        if self.mode != BIND_LAN {
            return LanPublicState {
                enabled: false,
                lan_url: None,
                invite_expires_at: None,
            };
        }

        let (Some(lan_ip), Some(invite)) = (self.lan_ip.as_ref(), self.invite.as_ref()) else {
            return LanPublicState {
                enabled: false,
                lan_url: None,
                invite_expires_at: None,
            };
        };

        LanPublicState {
            enabled: true,
            lan_url: Some(format!(
                "{}://{}:{}/?invite={}",
                self.url_scheme, lan_ip, self.port, invite.value
            )),
            invite_expires_at: Some(invite.expires_at),
        }
    }
}
