use std::path::PathBuf;

pub fn get_data_dir() -> PathBuf {
    dirs::home_dir()
        .map(|h| h.join(".workbench"))
        .unwrap_or_else(|| PathBuf::from(".workbench"))
}

pub fn get_db_path() -> PathBuf {
    get_data_dir().join("data.db")
}

pub fn get_scrollback_dir() -> PathBuf {
    get_data_dir().join("scrollback")
}

pub fn get_scrollback_previous_dir() -> PathBuf {
    get_scrollback_dir().join("previous")
}
