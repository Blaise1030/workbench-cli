use crate::db::Db;
use crate::error::{AppError, AppResult};
use parking_lot::Mutex;
use rusqlite::params;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

pub struct SettingsStore {
    db: Arc<Db>,
    cache: Mutex<HashMap<String, Value>>,
}

impl SettingsStore {
    pub fn new(db: Arc<Db>) -> Self {
        Self {
            db,
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn get<T: serde::de::DeserializeOwned + serde::Serialize>(&self, key: &str, fallback: T) -> AppResult<T> {
        if let Some(cached) = self.cache.lock().get(key) {
            if let Ok(value) = serde_json::from_value(cached.clone()) {
                return Ok(value);
            }
        }

        let conn = self.db.conn();
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?1 LIMIT 1")
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let result = stmt.query_row(params![key], |row| row.get::<_, String>(0));

        match result {
            Ok(raw) => match serde_json::from_str::<T>(&raw) {
                Ok(parsed) => {
                    self.cache
                        .lock()
                        .insert(key.to_string(), serde_json::to_value(&parsed).unwrap_or(Value::Null));
                    Ok(parsed)
                }
                Err(_) => Ok(fallback),
            },
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(fallback),
            Err(e) => Err(AppError::Internal(e.to_string())),
        }
    }

    pub fn set<T: serde::Serialize>(&self, key: &str, value: &T) -> AppResult<()> {
        let encoded = serde_json::to_string(value)
            .map_err(|e| AppError::Internal(format!("Failed to encode setting: {e}")))?;
        let updated_at = chrono::Utc::now().timestamp_millis();

        self.db
            .conn()
            .execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![key, encoded, updated_at],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        self.cache
            .lock()
            .insert(key.to_string(), serde_json::to_value(value).unwrap_or(Value::Null));
        Ok(())
    }

    pub fn get_all(&self, prefix: Option<&str>) -> AppResult<HashMap<String, Value>> {
        let conn = self.db.conn();
        let mut out = HashMap::new();

        if let Some(prefix) = prefix {
            let mut stmt = conn
                .prepare("SELECT key, value FROM settings WHERE key LIKE ?1")
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let rows = stmt
                .query_map(params![format!("{prefix}%")], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map_err(|e| AppError::Internal(e.to_string()))?;

            for row in rows {
                let (key, raw) = row.map_err(|e| AppError::Internal(e.to_string()))?;
                out.insert(
                    key,
                    serde_json::from_str(&raw).unwrap_or(Value::String(raw)),
                );
            }
        } else {
            let mut stmt = conn
                .prepare("SELECT key, value FROM settings")
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map_err(|e| AppError::Internal(e.to_string()))?;

            for row in rows {
                let (key, raw) = row.map_err(|e| AppError::Internal(e.to_string()))?;
                out.insert(
                    key,
                    serde_json::from_str(&raw).unwrap_or(Value::String(raw)),
                );
            }
        }

        Ok(out)
    }
}
