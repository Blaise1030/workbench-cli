package git

import (
	"os"
	"strings"
)

type WorktreeEntry struct {
	Path   string
	Head   string
	Branch string
	GitDir string
}

func ParseWorktreePorcelain(output string) []WorktreeEntry {
	var entries []WorktreeEntry
	current := WorktreeEntry{}
	flush := func() {
		if current.Path != "" {
			current.Branch = strings.TrimPrefix(current.Branch, "refs/heads/")
			entries = append(entries, current)
			current = WorktreeEntry{}
		}
	}
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimRight(line, "\r")
		if line == "" {
			flush()
			continue
		}
		switch {
		case strings.HasPrefix(line, "worktree "):
			current.Path = strings.TrimPrefix(line, "worktree ")
		case strings.HasPrefix(line, "HEAD "):
			current.Head = strings.TrimPrefix(line, "HEAD ")
		case strings.HasPrefix(line, "branch "):
			current.Branch = strings.TrimPrefix(line, "branch ")
		case strings.HasPrefix(line, "gitdir "):
			current.GitDir = strings.TrimPrefix(line, "gitdir ")
		}
	}
	flush()
	return entries
}

func ListWorktrees(repoPath string) ([]WorktreeEntry, error) {
	out, err := Run(repoPath, []string{"worktree", "list", "--porcelain"})
	if err != nil {
		return nil, err
	}
	return ParseWorktreePorcelain(out), nil
}

func ListBranches(repoPath string) ([]string, error) {
	out, err := Run(repoPath, []string{"branch", "--format=%(refname:short)"})
	if err != nil {
		return nil, err
	}
	var branches []string
	for _, b := range strings.Split(out, "\n") {
		b = strings.TrimSpace(b)
		if b != "" {
			branches = append(branches, b)
		}
	}
	return branches, nil
}

func GetDefaultBranch(repoPath string) string {
	sym, err := Run(repoPath, []string{"symbolic-ref", "refs/remotes/origin/HEAD"})
	if err == nil {
		parts := strings.SplitN(sym, "refs/remotes/origin/", 2)
		if len(parts) == 2 && parts[1] != "" {
			return parts[1]
		}
	}
	cur, err := Run(repoPath, []string{"branch", "--show-current"})
	if err == nil && cur != "" {
		return cur
	}
	branches, _ := ListBranches(repoPath)
	if len(branches) > 0 {
		return branches[0]
	}
	return "main"
}

func WorktreePathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
