# lan-terminal shell integration
if [[ -z "${LAN_TERMINAL_INTEGRATION:-}" ]]; then
  export LAN_TERMINAL_INTEGRATION=1
  if [[ -f "${HOME}/.bashrc" ]]; then
    source "${HOME}/.bashrc"
  fi
  __lan_terminal_prompt_command() {
  local ec=$?
    printf '\033]133;C;exit=%s\033\\' "$ec"
  }
  PROMPT_COMMAND="__lan_terminal_prompt_command${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
