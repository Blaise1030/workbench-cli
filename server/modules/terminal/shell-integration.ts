import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const INTEGRATION_DIR = join(tmpdir(), "workbench-shell");

const ZSH_RC = `# workbench-cli shell integration (sourced via ZDOTDIR — not echoed)
if [[ -z "\${WORKBENCH_INTEGRATION:-}" ]]; then
  export WORKBENCH_INTEGRATION=1
  if [[ -n "\${USER_ZDOTDIR:-}" && -f "\${USER_ZDOTDIR}/.zshrc" ]]; then
    ZDOTDIR="\${USER_ZDOTDIR}"
    source "\${USER_ZDOTDIR}/.zshrc"
  elif [[ -f "\${HOME}/.zshrc" ]]; then
    source "\${HOME}/.zshrc"
  fi
  __workbench_last_cmd=""
  __workbench_preexec() {
    __workbench_last_cmd=\$1
  }
  __workbench_precmd() {
    local ec=\$?
  local cmd_b64=""
    if [[ -n "\${__workbench_last_cmd}" ]]; then
      cmd_b64=\$(printf %s "\${__workbench_last_cmd}" | base64 | tr -d '\\n')
    fi
    if [[ -n "\${cmd_b64}" ]]; then
      printf '\\033]133;C;exit=%s;cmd_b64=%s\\033\\\\' "\$ec" "\$cmd_b64"
    else
      printf '\\033]133;C;exit=%s\\033\\\\' "\$ec"
    fi
  }
  preexec_functions+=(__workbench_preexec)
  precmd_functions+=(__workbench_precmd)
fi
`;

const BASH_RC = `# workbench-cli shell integration
if [[ -z "\${WORKBENCH_INTEGRATION:-}" ]]; then
  export WORKBENCH_INTEGRATION=1
  if [[ -f "\${HOME}/.bashrc" ]]; then
    source "\${HOME}/.bashrc"
  fi
  __workbench_last_cmd=""
  __workbench_debug_trap() {
    [[ "\${BASH_COMMAND}" == __workbench_* ]] && return
    __workbench_last_cmd="\${BASH_COMMAND}"
  }
  trap __workbench_debug_trap DEBUG
  __workbench_prompt_command() {
    local ec=\$?
    local cmd_b64=""
    if [[ -n "\${__workbench_last_cmd}" ]]; then
      cmd_b64=\$(printf %s "\${__workbench_last_cmd}" | base64 | tr -d '\\n')
    fi
    if [[ -n "\${cmd_b64}" ]]; then
      printf '\\033]133;C;exit=%s;cmd_b64=%s\\033\\\\' "\$ec" "\$cmd_b64"
    else
      printf '\\033]133;C;exit=%s\\033\\\\' "\$ec"
    fi
  }
  PROMPT_COMMAND="__workbench_prompt_command\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"
fi
`;

function shellName(shellPath: string): string {
  return shellPath.split("/").pop() ?? "sh";
}

export function ensureShellIntegrationFiles(): void {
  mkdirSync(INTEGRATION_DIR, { recursive: true });
  const zshrc = join(INTEGRATION_DIR, ".zshrc");
  writeFileSync(zshrc, ZSH_RC, "utf8");
  const bashrc = join(INTEGRATION_DIR, "workbench.bashrc");
  writeFileSync(bashrc, BASH_RC, "utf8");
}

export function bashIntegrationRcPath(): string {
  return join(INTEGRATION_DIR, "workbench.bashrc");
}

export function integrationDir(): string {
  return INTEGRATION_DIR;
}

/** Env overrides + spawn args for OSC 133 command-exit reporting. */
export function shellIntegrationSpawn(
  shellPath: string,
  baseEnv: Record<string, string>,
): { env: Record<string, string>; args: string[] } {
  ensureShellIntegrationFiles();
  const name = shellName(shellPath);
  const home = baseEnv.HOME ?? homedir();

  if (name === "zsh") {
    const userZdot =
      baseEnv.ZDOTDIR && baseEnv.ZDOTDIR !== INTEGRATION_DIR
        ? baseEnv.ZDOTDIR
        : home;
    return {
      env: {
        ...baseEnv,
        WORKBENCH: "1",
        USER_ZDOTDIR: userZdot,
        ZDOTDIR: INTEGRATION_DIR,
      },
      args: ["-l"],
    };
  }

  if (name === "bash") {
    return {
      env: { ...baseEnv, WORKBENCH: "1" },
      args: ["--rcfile", bashIntegrationRcPath(), "-i"],
    };
  }

  return { env: baseEnv, args: ["-l"] };
}
