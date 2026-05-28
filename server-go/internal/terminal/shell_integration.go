package terminal

import (
	"os"
	"path/filepath"
)

var integrationDir = filepath.Join(os.TempDir(), "workbench-shell")

const zshRC = `# workbench-cli shell integration (sourced via ZDOTDIR — not echoed)
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
    __workbench_last_cmd="${1}"
  }
  __workbench_precmd() {
    local ec=$?
    if [[ -n "${__workbench_last_cmd}" ]]; then
      local cmd_b64
      cmd_b64=$(printf '%s' "${__workbench_last_cmd}" | base64 | tr -d '\n')
      if [[ -n "${cmd_b64}" ]]; then
        printf '\033]133;C;exit=%s;cmd_b64=%s\033\\' "${ec}" "${cmd_b64}"
      else
        printf '\033]133;C;exit=%s\033\\' "${ec}"
      fi
    fi
  }
  preexec_functions+=(__workbench_preexec)
  precmd_functions+=(__workbench_precmd)
fi
`

const bashRC = `# workbench-cli shell integration
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
    if [[ -n "${__workbench_last_cmd}" ]]; then
      local cmd_b64
      cmd_b64=$(printf '%s' "${__workbench_last_cmd}" | base64 | tr -d '\n')
      if [[ -n "${cmd_b64}" ]]; then
        printf '\033]133;C;exit=%s;cmd_b64=%s\033\\' "${ec}" "${cmd_b64}"
      else
        printf '\033]133;C;exit=%s\033\\' "${ec}"
      fi
    fi
  }
  PROMPT_COMMAND="__workbench_prompt_command${PROMPT_COMMAND:+;${PROMPT_COMMAND}}"
fi
`

func EnsureShellIntegrationFiles() error {
	if err := os.MkdirAll(integrationDir, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(integrationDir, ".zshrc"), []byte(zshRC), 0o644); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(integrationDir, "workbench.bashrc"), []byte(bashRC), 0o644)
}

func BashIntegrationRCPath() string {
	return filepath.Join(integrationDir, "workbench.bashrc")
}

func shellName(shellPath string) string {
	return filepath.Base(shellPath)
}

type SpawnConfig struct {
	Env  map[string]string
	Args []string
}

// ShellIntegrationSpawn returns env overrides and args for OSC 133 reporting.
func ShellIntegrationSpawn(shellPath string, baseEnv map[string]string) SpawnConfig {
	_ = EnsureShellIntegrationFiles()
	name := shellName(shellPath)
	home := baseEnv["HOME"]
	if home == "" {
		home, _ = os.UserHomeDir()
	}

	env := make(map[string]string, len(baseEnv)+3)
	for k, v := range baseEnv {
		env[k] = v
	}

	switch name {
	case "zsh":
		userZdot := baseEnv["ZDOTDIR"]
		if userZdot == "" || userZdot == integrationDir {
			userZdot = home
		}
		env["WORKBENCH"] = "1"
		env["USER_ZDOTDIR"] = userZdot
		env["ZDOTDIR"] = integrationDir
		return SpawnConfig{Env: env, Args: []string{"-l"}}
	case "bash":
		env["WORKBENCH"] = "1"
		return SpawnConfig{Env: env, Args: []string{"--rcfile", BashIntegrationRCPath(), "-i"}}
	default:
		return SpawnConfig{Env: env, Args: []string{"-l"}}
	}
}
