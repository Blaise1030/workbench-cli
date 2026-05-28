package git

import (
	"fmt"
	"strings"
)

func HasStagedChanges(repoPath string) (bool, error) {
	entries, err := GetStatus(repoPath)
	if err != nil {
		return false, err
	}
	for _, e := range entries {
		if e.Staged != nil {
			return true, nil
		}
	}
	return false, nil
}

func CommitStaged(repoPath string, message string) error {
	trimmed := strings.TrimSpace(message)
	if trimmed == "" {
		return fmt.Errorf("commit message is required")
	}
	staged, err := HasStagedChanges(repoPath)
	if err != nil {
		return err
	}
	if !staged {
		return fmt.Errorf("nothing staged to commit")
	}
	_, err = Run(repoPath, []string{"commit", "-m", trimmed})
	return err
}
