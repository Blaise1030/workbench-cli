use crate::db::{get_scrollback_dir, get_scrollback_previous_dir};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrollbackMeta {
    pub terminal_id: String,
    pub cwd: String,
    pub last_activity: i64,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct OmitScrollbackMeta {
    pub cwd: String,
    pub last_activity: i64,
    pub exit_code: Option<i32>,
}

fn scrollback_paths(terminal_id: &str, previous: bool) -> (PathBuf, PathBuf) {
    let base = if previous {
        get_scrollback_previous_dir()
    } else {
        get_scrollback_dir()
    };
    (
        base.join(format!("{terminal_id}.bin")),
        base.join(format!("{terminal_id}.meta.json")),
    )
}

fn ensure_dirs() -> std::io::Result<()> {
    fs::create_dir_all(get_scrollback_dir())?;
    fs::create_dir_all(get_scrollback_previous_dir())?;
    Ok(())
}

pub fn dump_scrollback(
    terminal_id: &str,
    data: &[u8],
    meta: OmitScrollbackMeta,
) -> std::io::Result<()> {
    if data.is_empty() {
        return Ok(());
    }
    ensure_dirs()?;
    let payload = ScrollbackMeta {
        terminal_id: terminal_id.to_string(),
        cwd: meta.cwd,
        last_activity: meta.last_activity,
        exit_code: meta.exit_code,
    };
    let (active_bin, active_meta) = scrollback_paths(terminal_id, false);
    let (previous_bin, previous_meta) = scrollback_paths(terminal_id, true);
    fs::write(&active_bin, data)?;
    fs::write(&active_meta, serde_json::to_string(&payload)?)?;
    fs::copy(&active_bin, &previous_bin)?;
    fs::copy(&active_meta, &previous_meta)?;
    Ok(())
}

pub fn load_scrollback(terminal_id: &str) -> Option<(Vec<u8>, ScrollbackMeta)> {
    let (bin, meta_path) = scrollback_paths(terminal_id, false);
    if !bin.is_file() || !meta_path.is_file() {
        return None;
    }
    let data = fs::read(&bin).ok()?;
    let meta: ScrollbackMeta = serde_json::from_str(&fs::read_to_string(&meta_path).ok()?).ok()?;
    if meta.terminal_id != terminal_id {
        return None;
    }
    Some((data, meta))
}

pub fn delete_scrollback(terminal_id: &str) {
    for previous in [false, true] {
        let (bin, meta) = scrollback_paths(terminal_id, previous);
        let _ = fs::remove_file(bin);
        let _ = fs::remove_file(meta);
    }
}

pub fn has_scrollback_dump(terminal_id: &str) -> bool {
    let (bin, meta) = scrollback_paths(terminal_id, false);
    bin.is_file() && meta.is_file()
}
