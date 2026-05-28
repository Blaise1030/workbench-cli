package git

import "strings"

type FileStatusCode string

const (
	StatusAdded     FileStatusCode = "added"
	StatusModified  FileStatusCode = "modified"
	StatusDeleted   FileStatusCode = "deleted"
	StatusRenamed   FileStatusCode = "renamed"
	StatusCopied    FileStatusCode = "copied"
	StatusUntracked FileStatusCode = "untracked"
	StatusUnmerged  FileStatusCode = "unmerged"
	StatusIgnored   FileStatusCode = "ignored"
	StatusUnknown   FileStatusCode = "unknown"
)

type StatusEntry struct {
	Path         string          `json:"path"`
	PreviousPath *string         `json:"previousPath,omitempty"`
	Staged       *FileStatusCode `json:"staged"`
	Unstaged     *FileStatusCode `json:"unstaged"`
}

func mapStatusChar(c byte) *FileStatusCode {
	var code FileStatusCode
	switch c {
	case ' ':
		return nil
	case '?':
		code = StatusUntracked
	case '!':
		code = StatusIgnored
	case 'A':
		code = StatusAdded
	case 'M':
		code = StatusModified
	case 'D':
		code = StatusDeleted
	case 'R':
		code = StatusRenamed
	case 'C':
		code = StatusCopied
	case 'U':
		code = StatusUnmerged
	default:
		code = StatusUnknown
	}
	return &code
}

func ParseStatusPorcelain(output string) []StatusEntry {
	var entries []StatusEntry
	for _, line := range strings.Split(output, "\n") {
		if strings.TrimSpace(line) == "" || len(line) < 3 {
			continue
		}
		indexStatus := line[0]
		worktreeStatus := line[1]
		pathPart := line[3:]

		var previousPath *string
		if idx := strings.Index(pathPart, " -> "); idx >= 0 {
			prev := strings.TrimSpace(pathPart[:idx])
			previousPath = &prev
			pathPart = strings.TrimSpace(pathPart[idx+4:])
		}

		path := strings.TrimSpace(pathPart)
		if path == "" {
			continue
		}
		staged := mapStatusChar(indexStatus)
		unstaged := mapStatusChar(worktreeStatus)
		if staged == nil && unstaged == nil {
			continue
		}
		entries = append(entries, StatusEntry{
			Path:         path,
			PreviousPath: previousPath,
			Staged:       staged,
			Unstaged:     unstaged,
		})
	}
	return entries
}

func GetStatus(repoPath string) ([]StatusEntry, error) {
	out, err := Run(repoPath, []string{"status", "--porcelain"})
	if err != nil {
		return nil, err
	}
	return ParseStatusPorcelain(out + "\n"), nil
}

func GetCurrentBranch(repoPath string) (string, error) {
	out, err := Run(repoPath, []string{"branch", "--show-current"})
	if err != nil {
		return "", err
	}
	return out, nil
}
