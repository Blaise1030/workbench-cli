# lan-terminal shell integration
if [[ -z "${LAN_TERMINAL_INTEGRATION:-}" ]]; then
  export LAN_TERMINAL_INTEGRATION=1
  if [[ -f "${HOME}/.bashrc" ]]; then
    source "${HOME}/.bashrc"
  fi
  __lan_terminal_last_cmd=""
  __lan_terminal_debug_trap() {
    [[ "${BASH_COMMAND}" == __lan_terminal_* ]] && return
    __lan_terminal_last_cmd="${BASH_COMMAND}"
  }
  trap __lan_terminal_debug_trap DEBUG
  __lan_terminal_prompt_command() {
    local ec=$?
    local cmd_b64=""
    if [[ -n "${__lan_terminal_last_cmd}" ]]; then
      cmd_b64=$(printf %s "${__lan_terminal_last_cmd}" | base64 | tr -d '\n')
    fi
    if [[ -n "${cmd_b64}" ]]; then
      printf '\033]133;C;exit=%s;cmd_b64=%s\033\\' "$ec" "$cmd_b64"
    else
      printf '\033]133;C;exit=%s\033\\' "$ec"
    fi
  }
  PROMPT_COMMAND="__lan_terminal_prompt_command${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
