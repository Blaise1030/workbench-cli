package terminal

import "os/exec"

func buildCmd(shell string, args, env []string, cwd string) *exec.Cmd {
	cmd := exec.Command(shell, args...)
	cmd.Env = env
	cmd.Dir = cwd
	return cmd
}
