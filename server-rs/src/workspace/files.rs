use crate::error::{file_read_error, AppError, AppResult};
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;

use super::path_guard::assert_path_within_root;

pub const MAX_FILE_PREVIEW_BYTES: usize = 512 * 1024;

const NOISE_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".next",
    "dist",
    ".turbo",
    ".cache",
    "__pycache__",
    ".venv",
    ".DS_Store",
];

#[derive(Serialize)]
pub struct FilePreview {
    pub path: String,
    pub content: String,
    pub truncated: bool,
}

fn normalize_relative_path(relative_path: &str) -> Result<String, AppError> {
    let normalized = relative_path.replace('\\', "/").trim_start_matches('/').to_string();
    if normalized.is_empty() || normalized.ends_with('/') {
        return Err(file_read_error("Invalid file path", 400));
    }
    Ok(normalized)
}

pub fn list_files_for_worktree(worktree_path: &str) -> AppResult<Vec<String>> {
    let mut paths = Vec::new();
    walk_dir(Path::new(worktree_path), Path::new(worktree_path), &mut paths)?;
    Ok(paths)
}

fn walk_dir(worktree_path: &Path, dir: &Path, paths: &mut Vec<String>) -> AppResult<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if NOISE_DIRS.contains(&name.as_ref()) {
            continue;
        }
        let full_path = entry.path();
        if full_path.is_dir() {
            walk_dir(worktree_path, &full_path, paths)?;
        } else if full_path.is_file() {
            let rel = full_path
                .strip_prefix(worktree_path)
                .unwrap_or(&full_path)
                .to_string_lossy()
                .replace('\\', "/");
            paths.push(rel);
        }
    }
    Ok(())
}

pub fn read_file_for_worktree(worktree_path: &str, relative_path: &str) -> AppResult<FilePreview> {
    let normalized = normalize_relative_path(relative_path)?;
    let absolute_path = assert_path_within_root(worktree_path, &normalized)
        .map_err(|e| file_read_error(e, 400))?;

    let metadata = fs::metadata(&absolute_path).map_err(|_| file_read_error("File not found", 404))?;
    if !metadata.is_file() {
        return Err(file_read_error("Not a file", 400));
    }

    let truncated = metadata.len() as usize > MAX_FILE_PREVIEW_BYTES;
    let read_length = if truncated {
        MAX_FILE_PREVIEW_BYTES
    } else {
        metadata.len() as usize
    };

    let mut file = fs::File::open(&absolute_path)
        .map_err(|_| file_read_error("File not found", 404))?;
    let mut buf = vec![0u8; read_length];
    let bytes_read = file
        .read(&mut buf)
        .map_err(|e| file_read_error(format!("Read failed: {e}"), 400))?;
    buf.truncate(bytes_read);

    if buf.contains(&0) {
        return Err(file_read_error("Binary file cannot be previewed", 400));
    }

    let content = String::from_utf8(buf).map_err(|_| file_read_error("Invalid UTF-8", 400))?;
    Ok(FilePreview {
        path: normalized,
        content,
        truncated,
    })
}

pub fn write_file_for_worktree(
    worktree_path: &str,
    relative_path: &str,
    content: &str,
) -> AppResult<()> {
    let normalized = normalize_relative_path(relative_path)?;
    let absolute_path = assert_path_within_root(worktree_path, &normalized)
        .map_err(|e| file_read_error(e, 400))?;

    let metadata = fs::metadata(&absolute_path).map_err(|_| file_read_error("File not found", 400))?;
    if !metadata.is_file() {
        return Err(file_read_error("Not a file", 400));
    }

    fs::write(&absolute_path, content).map_err(|e| {
        file_read_error(format!("Failed to write file: {e}"), 400)
    })
}
