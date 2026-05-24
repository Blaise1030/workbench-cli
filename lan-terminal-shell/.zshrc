# lan-terminal shell integration (sourced via ZDOTDIR — not echoed)
if [[ -z "${LAN_TERMINAL_INTEGRATION:-}" ]]; then
  export LAN_TERMINAL_INTEGRATION=1
  if [[ -n "${USER_ZDOTDIR:-}" && -f "${USER_ZDOTDIR}/.zshrc" ]]; then
    ZDOTDIR="${USER_ZDOTDIR}"
    source "${USER_ZDOTDIR}/.zshrc"
  elif [[ -f "${HOME}/.zshrc" ]]; then
    source "${HOME}/.zshrc"
  fi
  __lan_terminal_last_cmd=""
  __lan_terminal_preexec() {
    __lan_terminal_last_cmd=$1
  }
  __lan_terminal_precmd() {
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
  preexec_functions+=(__lan_terminal_preexec)
  precmd_functions+=(__lan_terminal_precmd)
fi
