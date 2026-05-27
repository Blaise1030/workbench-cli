mod data_dir;
mod migrate;

pub use data_dir::{
    get_data_dir, get_db_path, get_scrollback_dir, get_scrollback_previous_dir,
};
pub use migrate::run_migrations;

use crate::error::{AppError, AppResult};
use parking_lot::Mutex;
use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

pub struct Db {
    conn: Mutex<Connection>,
    db_path: PathBuf,
}

impl Db {
    pub fn open() -> AppResult<Self> {
        Self::open_at(get_db_path())
    }

    pub fn open_at(db_path: impl AsRef<Path>) -> AppResult<Self> {
        let db_path = db_path.as_ref().to_path_buf();
        if db_path.to_string_lossy() != ":memory:" {
            fs::create_dir_all(get_data_dir()).map_err(|e| {
                AppError::Internal(format!("Failed to create data dir: {e}"))
            })?;
            if let Some(parent) = db_path.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    AppError::Internal(format!("Failed to create db parent dir: {e}"))
                })?;
            }
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| AppError::Internal(format!("Failed to open database: {e}")))?;
        run_migrations(&conn)
            .map_err(|e| AppError::Internal(format!("Failed to run migrations: {e}")))?;

        Ok(Self {
            conn: Mutex::new(conn),
            db_path,
        })
    }

    pub fn conn(&self) -> parking_lot::MutexGuard<'_, Connection> {
        self.conn.lock()
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }
}
