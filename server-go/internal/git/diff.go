package git

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type DiffScope string

const (
	DiffAll       DiffScope = "all"
	DiffStaged    DiffScope = "staged"
	DiffUnstaged  DiffScope = "unstaged"
	DiffUntracked DiffScope = "untracked"
)

func ParseDiffScope(s string) DiffScope {
	switch s {
	case "staged", "unstaged", "untracked":
		return DiffScope(s)
	}
	return DiffAll
}

// runGitAllowExit1 treats exit code 1 with stdout as success (git diff behaviour).
func runGitAllowExit1(repoPath string, args []string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repoPath
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		if cmd.ProcessState != nil && cmd.ProcessState.ExitCode() == 1 && stdout.Len() > 0 {
			return stdout.String(), nil
		}
		return "", &Error{Msg: err.Error(), Stderr: stderr.String()}
	}
	return stdout.String(), nil
}

func listUntrackedFiles(repoPath string, path string) ([]string, error) {
	out, err := Run(repoPath, []string{"ls-files", "--others", "--exclude-standard"})
	if err != nil {
		return nil, err
	}
	var paths []string
	for _, p := range strings.Split(out, "\n") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if path != "" && p != path && !strings.HasPrefix(p, path+"/") {
			continue
		}
		full := filepath.Join(repoPath, p)
		if fi, err := os.Stat(full); err == nil && fi.Mode().IsRegular() {
			paths = append(paths, p)
		}
	}
	return paths, nil
}

func untrackedDiff(repoPath string, path string) (string, error) {
	files, err := listUntrackedFiles(repoPath, path)
	if err != nil {
		return "", err
	}
	var patches []string
	for _, f := range files {
		patch, _ := runGitAllowExit1(repoPath, []string{"diff", "--no-index", "--", os.DevNull, f})
		if strings.TrimSpace(patch) != "" {
			patches = append(patches, patch)
		}
	}
	return strings.Join(patches, "\n"), nil
}

func GetDiff(repoPath string, scope DiffScope, path string) (string, error) {
	if scope == DiffUntracked {
		return untrackedDiff(repoPath, path)
	}

	switch scope {
	case DiffStaged:
		args := []string{"diff", "--cached"}
		if path != "" {
			args = append(args, "--", path)
		}
		return runGitAllowExit1(repoPath, args)
	case DiffUnstaged:
		unstagedArgs := []string{"diff"}
		if path != "" {
			unstagedArgs = append(unstagedArgs, "--", path)
		}
		unstaged, _ := runGitAllowExit1(repoPath, unstagedArgs)
		untracked, _ := untrackedDiff(repoPath, path)
		return joinPatches(unstaged, untracked), nil
	default: // DiffAll
		args := []string{"diff", "HEAD"}
		if path != "" {
			args = append(args, "--", path)
		}
		return runGitAllowExit1(repoPath, args)
	}
}

func joinPatches(parts ...string) string {
	var nonEmpty []string
	for _, p := range parts {
		if strings.TrimSpace(p) != "" {
			nonEmpty = append(nonEmpty, p)
		}
	}
	return strings.Join(nonEmpty, "\n")
}
