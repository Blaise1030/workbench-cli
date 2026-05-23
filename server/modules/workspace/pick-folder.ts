import { execFileSync } from "node:child_process";
import { platform } from "node:os";

/** Opens a native folder picker on the server machine. Returns null if cancelled. */
export function pickFolder(): string | null {
  const os = platform();

  if (os === "darwin") {
    try {
      const out = execFileSync(
        "osascript",
        [
          "-e",
          'POSIX path of (choose folder with prompt "Select git repository")',
        ],
        { encoding: "utf-8" },
      );
      return normalizePickedPath(out);
    } catch {
      return null;
    }
  }

  if (os === "linux") {
    try {
      const out = execFileSync(
        "zenity",
        ["--file-selection", "--directory", "--title=Select git repository"],
        { encoding: "utf-8" },
      );
      return normalizePickedPath(out);
    } catch {
      return null;
    }
  }

  if (os === "win32") {
    try {
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
        '$d.Description = "Select git repository"',
        "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
        "  Write-Output $d.SelectedPath",
        "}",
      ].join("; ");
      const out = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", script],
        { encoding: "utf-8" },
      );
      return normalizePickedPath(out);
    } catch {
      return null;
    }
  }

  return null;
}

function normalizePickedPath(raw: string): string | null {
  const path = raw.trim().replace(/\/+$/, "");
  return path || null;
}
