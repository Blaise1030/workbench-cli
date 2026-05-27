use std::path::{Component, Path, PathBuf};

pub fn assert_path_within_root(root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let resolved_root = Path::new(root)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(root));
    let resolved_path = resolved_root.join(relative_path);
    let resolved_path = resolved_path
        .canonicalize()
        .unwrap_or(resolved_path);

    let relative_to_root = path_relative(&resolved_root, &resolved_path);

    if relative_to_root.components().all(|c| c != Component::ParentDir) {
        Ok(resolved_path)
    } else {
        Err(format!(
            "Path escapes worktree: \"{relative_path}\" resolves outside \"{}\"",
            resolved_root.display()
        ))
    }
}

fn path_relative(base: &Path, path: &Path) -> PathBuf {
    let base_components: Vec<_> = base.components().collect();
    let path_components: Vec<_> = path.components().collect();
    let mut i = 0;
    while i < base_components.len()
        && i < path_components.len()
        && base_components[i] == path_components[i]
    {
        i += 1;
    }
    let ups = std::iter::repeat(Component::ParentDir).take(base_components.len() - i);
    let rest = path_components.into_iter().skip(i);
    ups.chain(rest).collect()
}
