# workbench-cli shell integration
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
