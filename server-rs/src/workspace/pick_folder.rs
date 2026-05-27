use std::process::Command;

/// Opens a native folder picker on the server machine. Returns None if cancelled.
pub fn pick_folder() -> Option<String> {
    let os = std::env::consts::OS;

    let raw = if os == "macos" {
        Command::new("osascript")
            .args([
                "-e",
                r#"POSIX path of (choose folder with prompt "Select git repository")"#,
            ])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
    } else if os == "linux" {
        Command::new("zenity")
            .args([
                "--file-selection",
                "--directory",
                "--title=Select git repository",
            ])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
    } else if os == "windows" {
        let script = [
            "Add-Type -AssemblyName System.Windows.Forms",
            "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
            "$d.Description = \"Select git repository\"",
            "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
            "  Write-Output $d.SelectedPath",
            "}",
        ]
        .join("; ");
        Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
    } else {
        None
    }?;

    normalize_picked_path(&raw)
}

fn normalize_picked_path(raw: &str) -> Option<String> {
    let path = raw.trim().trim_end_matches('/').to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}
