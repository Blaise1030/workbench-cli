# lan-terminal shell integration (sourced via ZDOTDIR — not echoed)
if [[ -z "${LAN_TERMINAL_INTEGRATION:-}" ]]; then
  export LAN_TERMINAL_INTEGRATION=1
  if [[ -n "${USER_ZDOTDIR:-}" && -f "${USER_ZDOTDIR}/.zshrc" ]]; then
    ZDOTDIR="${USER_ZDOTDIR}"
    source "${USER_ZDOTDIR}/.zshrc"
  elif [[ -f "${HOME}/.zshrc" ]]; then
    source "${HOME}/.zshrc"
  fi
  __lan_terminal_precmd() {
    local ec=$?
    printf '\033]133;C;exit=%s\033\\' "$ec"
  }
  precmd_functions+=(__lan_terminal_precmd)
fi
