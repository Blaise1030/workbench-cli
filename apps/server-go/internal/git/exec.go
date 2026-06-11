package git

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
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

// gitEnv disables interactive prompts and, crucially, opportunistic index locking.
// GIT_OPTIONAL_LOCKS=0 lets read-only commands (status/diff) run without taking
// .git/index.lock, so the panel's many parallel status/diff polls can't collide
// on the lock. Output stays correct; git just skips persisting the refreshed stat cache.
func gitEnv() []string {
	return append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "GIT_OPTIONAL_LOCKS=0")
}

// repoLocks serializes index-writing git commands per repository so concurrent
// writes (stage/unstage/discard/commit) can't fight over .git/index.lock.
var (
	repoLocksMu sync.Mutex
	repoLocks   = map[string]*sync.Mutex{}
)

// repoLockKey returns the worktree's own absolute git-dir. Each worktree (main or
// linked) has its own index and index.lock, so this is the right granularity:
// writes within one worktree serialize; unrelated worktrees stay independent.
func repoLockKey(repoPath string) string {
	if dir, err := runGit(repoPath, []string{"rev-parse", "--absolute-git-dir"}); err == nil && dir != "" {
		return dir
	}
	return repoPath
}

func lockForRepo(repoPath string) *sync.Mutex {
	key := repoLockKey(repoPath)
	repoLocksMu.Lock()
	defer repoLocksMu.Unlock()
	if m, ok := repoLocks[key]; ok {
		return m
	}
	m := &sync.Mutex{}
	repoLocks[key] = m
	return m
}

// runGit is the shared executor for read-only commands.
func runGit(repoPath string, args []string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repoPath
	cmd.Env = gitEnv()
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", &Error{Msg: err.Error(), Stderr: stderr.String()}
	}
	return strings.TrimRight(stdout.String(), "\n"), nil
}

func Run(repoPath string, args []string) (string, error) {
	return runGit(repoPath, args)
}

// RunLocked runs an index-writing command under the per-repo lock.
func RunLocked(repoPath string, args []string) (string, error) {
	m := lockForRepo(repoPath)
	m.Lock()
	defer m.Unlock()
	return runGit(repoPath, args)
}

func IsGitRepo(path string) bool {
	out, err := Run(path, []string{"rev-parse", "--git-dir"})
	return err == nil && out != ""
}

// ValidateBranchName returns an error if name is not a safe git ref component.
// It rejects empty names, names starting with '-' (flag injection), names
// containing '..' or control characters, and names with disallowed git ref chars.
func ValidateBranchName(name string) error {
	if name == "" {
		return fmt.Errorf("branch name is required")
	}
	if strings.HasPrefix(name, "-") {
		return fmt.Errorf("invalid branch name %q", name)
	}
	if strings.Contains(name, "..") {
		return fmt.Errorf("invalid branch name %q", name)
	}
	for _, ch := range name {
		if ch < 0x20 || ch == 0x7f || strings.ContainsRune(` ~^:?*[\\`, ch) {
			return fmt.Errorf("invalid branch name %q", name)
		}
	}
	return nil
}

// ValidateDirectoryPath reports whether path exists and is a directory.
// Git repositories and plain folders are accepted; files and missing paths error.
func ValidateDirectoryPath(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return os.ErrNotExist
	}
	if !info.IsDir() {
		return fmt.Errorf("not a directory")
	}
	return nil
}
