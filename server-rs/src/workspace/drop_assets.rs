use crate::db::get_data_dir;
use crate::error::{AppError, AppResult};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Dropped files land at `~/.workbench/image/`.
pub fn get_workbench_image_dir() -> PathBuf {
    get_data_dir().join("image")
}

/// Max size for a single dropped file (50 MB).
pub const DROP_ASSET_MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;

/// Max total size of `~/.workbench/image` (512 MB).
pub const DROP_ASSET_MAX_DIR_BYTES: u64 = 512 * 1024 * 1024;

/// Delete assets older than this (7 days).
pub const DROP_ASSET_MAX_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1000;

pub struct DropAssetUpload {
    pub name: String,
    pub data: Vec<u8>,
}

#[derive(Clone)]
pub struct PruneDropAssetsOptions {
    pub dir: Option<PathBuf>,
    pub max_dir_bytes: Option<u64>,
    pub max_age_ms: Option<u64>,
}

struct DirEntry {
    path: PathBuf,
    size: u64,
    mtime_ms: u64,
}

fn safe_extension(original_name: &str) -> String {
    let ext = Path::new(original_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default();
    if regex::Regex::new(r"^\.[a-z0-9]{1,12}$")
        .map(|re| re.is_match(&ext))
        .unwrap_or(false)
    {
        ext
    } else {
        String::new()
    }
}

fn list_dir_entries(dir: &Path) -> AppResult<Vec<DirEntry>> {
    let names = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(AppError::Internal(e.to_string())),
    };

    let mut entries = Vec::new();
    for entry in names.flatten() {
        let path = entry.path();
        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !metadata.is_file() {
            continue;
        }
        let mtime_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        entries.push(DirEntry {
            path,
            size: metadata.len(),
            mtime_ms,
        });
    }
    Ok(entries)
}

/// Remove expired files, then oldest until under quota.
pub fn prune_workbench_image_dir(options: Option<&PruneDropAssetsOptions>) -> AppResult<()> {
    let opts = options.cloned().unwrap_or(PruneDropAssetsOptions {
        dir: None,
        max_dir_bytes: None,
        max_age_ms: None,
    });
    let max_dir_bytes = opts.max_dir_bytes.unwrap_or(DROP_ASSET_MAX_DIR_BYTES);
    let max_age_ms = opts.max_age_ms.unwrap_or(DROP_ASSET_MAX_AGE_MS);
    let dir = opts.dir.unwrap_or_else(get_workbench_image_dir);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let entries = list_dir_entries(&dir)?;

    let mut to_delete = std::collections::HashSet::new();
    for entry in &entries {
        if now.saturating_sub(entry.mtime_ms) > max_age_ms {
            to_delete.insert(entry.path.clone());
        }
    }

    let mut total: u64 = entries
        .iter()
        .filter(|e| !to_delete.contains(&e.path))
        .map(|e| e.size)
        .sum();

    if total > max_dir_bytes {
        let mut by_age: Vec<_> = entries
            .iter()
            .filter(|e| !to_delete.contains(&e.path))
            .collect();
        by_age.sort_by_key(|e| e.mtime_ms);
        for entry in by_age {
            if total <= max_dir_bytes {
                break;
            }
            to_delete.insert(entry.path.clone());
            total -= entry.size;
        }
    }

    for path in to_delete {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

pub struct SaveDropAssetsOptions {
    pub dir: Option<PathBuf>,
}

pub fn save_workbench_drop_assets(
    files: &[DropAssetUpload],
    options: Option<&SaveDropAssetsOptions>,
) -> AppResult<Vec<String>> {
    if files.is_empty() {
        return Ok(vec![]);
    }

    let dir = options
        .and_then(|o| o.dir.clone())
        .unwrap_or_else(get_workbench_image_dir);
    fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    prune_workbench_image_dir(Some(&PruneDropAssetsOptions {
        dir: Some(dir.clone()),
        max_dir_bytes: None,
        max_age_ms: None,
    }))?;

    let mut paths = Vec::new();
    for file in files {
        if file.data.len() as u64 > DROP_ASSET_MAX_FILE_BYTES {
            return Err(AppError::PayloadTooLarge(format!(
                "File exceeds {DROP_ASSET_MAX_FILE_BYTES} byte limit"
            )));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let dest = dir.join(format!("{id}{}", safe_extension(&file.name)));
        fs::write(&dest, &file.data).map_err(|e| AppError::Internal(e.to_string()))?;
        paths.push(dest.to_string_lossy().into_owned());
    }

    prune_workbench_image_dir(Some(&PruneDropAssetsOptions {
        dir: Some(dir),
        max_dir_bytes: None,
        max_age_ms: None,
    }))?;
    Ok(paths)
}
