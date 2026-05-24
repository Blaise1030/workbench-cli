import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const INTEGRATION_DIR = join(tmpdir(), "lan-terminal-shell");

const ZSH_RC = `# lan-terminal shell integration (sourced via ZDOTDIR — not echoed)
if [[ -z "\${LAN_TERMINAL_INTEGRATION:-}" ]]; then
  export LAN_TERMINAL_INTEGRATION=1
  if [[ -n "\${USER_ZDOTDIR:-}" && -f "\${USER_ZDOTDIR}/.zshrc" ]]; then
    ZDOTDIR="\${USER_ZDOTDIR}"
    source "\${USER_ZDOTDIR}/.zshrc"
  elif [[ -f "\${HOME}/.zshrc" ]]; then
    source "\${HOME}/.zshrc"
  fi
  __lan_terminal_last_cmd=""
  __lan_terminal_preexec() {
    __lan_terminal_last_cmd=\$1
  }
  __lan_terminal_precmd() {
    local ec=\$?
  local cmd_b64=""
    if [[ -n "\${__lan_terminal_last_cmd}" ]]; then
      cmd_b64=\$(printf %s "\${__lan_terminal_last_cmd}" | base64 | tr -d '\\n')
    fi
    if [[ -n "\${cmd_b64}" ]]; then
      printf '\\033]133;C;exit=%s;cmd_b64=%s\\033\\\\' "\$ec" "\$cmd_b64"
    else
      printf '\\033]133;C;exit=%s\\033\\\\' "\$ec"
    fi
  }
  preexec_functions+=(__lan_terminal_preexec)
  precmd_functions+=(__lan_terminal_precmd)
fi
`;

const BASH_RC = `# lan-terminal shell integration
if [[ -z "\${LAN_TERMINAL_INTEGRATION:-}" ]]; then
  export LAN_TERMINAL_INTEGRATION=1
  if [[ -f "\${HOME}/.bashrc" ]]; then
    source "\${HOME}/.bashrc"
  fi
  __lan_terminal_last_cmd=""
  __lan_terminal_debug_trap() {
    [[ "\${BASH_COMMAND}" == __lan_terminal_* ]] && return
    __lan_terminal_last_cmd="\${BASH_COMMAND}"
  }
  trap __lan_terminal_debug_trap DEBUG
  __lan_terminal_prompt_command() {
    local ec=\$?
    local cmd_b64=""
    if [[ -n "\${__lan_terminal_last_cmd}" ]]; then
      cmd_b64=\$(printf %s "\${__lan_terminal_last_cmd}" | base64 | tr -d '\\n')
    fi
    if [[ -n "\${cmd_b64}" ]]; then
      printf '\\033]133;C;exit=%s;cmd_b64=%s\\033\\\\' "\$ec" "\$cmd_b64"
    else
      printf '\\033]133;C;exit=%s\\033\\\\' "\$ec"
    fi
  }
  PROMPT_COMMAND="__lan_terminal_prompt_command\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"
fi
`;

function shellName(shellPath: string): string {
  return shellPath.split("/").pop() ?? "sh";
}

export function ensureShellIntegrationFiles(): void {
  mkdirSync(INTEGRATION_DIR, { recursive: true });
  const zshrc = join(INTEGRATION_DIR, ".zshrc");
  writeFileSync(zshrc, ZSH_RC, "utf8");
  const bashrc = join(INTEGRATION_DIR, "lan-terminal.bashrc");
  writeFileSync(bashrc, BASH_RC, "utf8");
}

export function bashIntegrationRcPath(): string {
  return join(INTEGRATION_DIR, "lan-terminal.bashrc");
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
        LAN_TERMINAL: "1",
        USER_ZDOTDIR: userZdot,
        ZDOTDIR: INTEGRATION_DIR,
      },
      args: ["-l"],
    };
  }

  if (name === "bash") {
    return {
      env: { ...baseEnv, LAN_TERMINAL: "1" },
      args: ["--rcfile", bashIntegrationRcPath(), "-i"],
    };
  }

  return { env: baseEnv, args: ["-l"] };
}
