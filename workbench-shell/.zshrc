# workbench-cli shell integration (sourced via ZDOTDIR — not echoed)
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
