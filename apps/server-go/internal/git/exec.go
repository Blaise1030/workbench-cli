package git

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type Error struct {
	Msg    string
	Stderr string
}

func (e *Error) Error() string {
	if e.Stderr != "" {
		return fmt.Sprintf("%s: %s", e.Msg, strings.TrimSpace(e.Stderr))
	}
	return e.Msg
}

func Run(repoPath string, args []string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repoPath
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", &Error{Msg: err.Error(), Stderr: stderr.String()}
	}
	return strings.TrimRight(stdout.String(), "\n"), nil
}

func IsGitRepo(path string) bool {
	out, err := Run(path, []string{"rev-parse", "--git-dir"})
	return err == nil && out != ""
}

// ValidateDirectoryPath reports whether path exists and is a directory.
// Git repositories and plain folders are accepted; files and missing paths error.
func ValidateDirectoryPath(path string) error {
	_, err := Run(path, []string{"rev-parse"})
	if err == nil {
		return nil
	}
	errMsg := strings.ToLower(err.Error())
	if strings.Contains(errMsg, "no such file or directory") {
		return os.ErrNotExist
	}
	if strings.Contains(errMsg, "not a directory") {
		return fmt.Errorf("not a directory")
	}
	return nil
}
