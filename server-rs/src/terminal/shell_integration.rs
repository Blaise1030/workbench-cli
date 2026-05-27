use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const ZSH_RC: &str = r#"# workbench-cli shell integration (sourced via ZDOTDIR — not echoed)
if [[ -z "${WORKBENCH_INTEGRATION:-}" ]]; then
  export WORKBENCH_INTEGRATION=1
  if [[ -n "${USER_ZDOTDIR:-}" && -f "${USER_ZDOTDIR}/.zshrc" ]]; then
    ZDOTDIR="${USER_ZDOTDIR}"
    source "${USER_ZDOTDIR}/.zshrc"
  elif [[ -f "${HOME}/.zshrc" ]]; then
    source "${HOME}/.zshrc"
  fi
  __workbench_last_cmd=""
  __workbench_preexec() {
    __workbench_last_cmd=$1
  }
  __workbench_precmd() {
    local ec=$?
  local cmd_b64=""
    if [[ -n "${__workbench_last_cmd}" ]]; then
      cmd_b64=$(printf %s "${__workbench_last_cmd}" | base64 | tr -d '\n')
    fi
    if [[ -n "${cmd_b64}" ]]; then
      printf '\033]133;C;exit=%s;cmd_b64=%s\033\\' "$ec" "$cmd_b64"
    else
      printf '\033]133;C;exit=%s\033\\' "$ec"
    fi
  }
  preexec_functions+=(__workbench_preexec)
  precmd_functions+=(__workbench_precmd)
fi
"#;

const BASH_RC: &str = r#"# workbench-cli shell integration
if [[ -z "${WORKBENCH_INTEGRATION:-}" ]]; then
  export WORKBENCH_INTEGRATION=1
  if [[ -f "${HOME}/.bashrc" ]]; then
    source "${HOME}/.bashrc"
  fi
  __workbench_last_cmd=""
  __workbench_debug_trap() {
    [[ "${BASH_COMMAND}" == __workbench_* ]] && return
    __workbench_last_cmd="${BASH_COMMAND}"
  }
  trap __workbench_debug_trap DEBUG
  __workbench_prompt_command() {
    local ec=$?
    local cmd_b64=""
    if [[ -n "${__workbench_last_cmd}" ]]; then
      cmd_b64=$(printf %s "${__workbench_last_cmd}" | base64 | tr -d '\n')
    fi
    if [[ -n "${cmd_b64}" ]]; then
      printf '\033]133;C;exit=%s;cmd_b64=%s\033\\' "$ec" "$cmd_b64"
    else
      printf '\033]133;C;exit=%s\033\\' "$ec"
    fi
  }
  PROMPT_COMMAND="__workbench_prompt_command${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
"#;

fn integration_dir() -> PathBuf {
    env::temp_dir().join("workbench-shell")
}

fn shell_name(shell_path: &str) -> &str {
    Path::new(shell_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("sh")
}

pub fn ensure_shell_integration_files() -> std::io::Result<()> {
    let dir = integration_dir();
    fs::create_dir_all(&dir)?;
    fs::write(dir.join(".zshrc"), ZSH_RC)?;
    fs::write(dir.join("workbench.bashrc"), BASH_RC)?;
    Ok(())
}

pub fn bash_integration_rc_path() -> PathBuf {
    integration_dir().join("workbench.bashrc")
}

pub struct ShellIntegrationSpawn {
    pub env: HashMap<String, String>,
    pub args: Vec<String>,
}

/// Env overrides + spawn args for OSC 133 command-exit reporting.
pub fn shell_integration_spawn(
    shell_path: &str,
    base_env: HashMap<String, String>,
) -> std::io::Result<ShellIntegrationSpawn> {
    ensure_shell_integration_files()?;
    let name = shell_name(shell_path);
    let home = base_env
        .get("HOME")
        .cloned()
        .or_else(|| {
            dirs::home_dir()
                .and_then(|p| p.to_str().map(str::to_string))
        })
        .unwrap_or_else(|| "/".to_string());

    if name == "zsh" {
        let integration = integration_dir();
        let user_zdot = base_env
            .get("ZDOTDIR")
            .filter(|z| z.as_str() != integration.to_string_lossy())
            .cloned()
            .unwrap_or_else(|| home.clone());

        let mut env = base_env;
        env.insert("WORKBENCH".to_string(), "1".to_string());
        env.insert("USER_ZDOTDIR".to_string(), user_zdot);
        env.insert(
            "ZDOTDIR".to_string(),
            integration.to_string_lossy().into_owned(),
        );
        return Ok(ShellIntegrationSpawn {
            env,
            args: vec!["-l".to_string()],
        });
    }

    if name == "bash" {
        let mut env = base_env;
        env.insert("WORKBENCH".to_string(), "1".to_string());
        return Ok(ShellIntegrationSpawn {
            env,
            args: vec![
                "--rcfile".to_string(),
                bash_integration_rc_path().to_string_lossy().into_owned(),
                "-i".to_string(),
            ],
        });
    }

    Ok(ShellIntegrationSpawn {
        env: base_env,
        args: vec!["-l".to_string()],
    })
}
