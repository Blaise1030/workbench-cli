package git

type FileAction string

const (
	ActionStage   FileAction = "stage"
	ActionUnstage FileAction = "unstage"
	ActionDiscard FileAction = "discard"
)

func pathsForAction(action FileAction, paths []string, entries []StatusEntry) []string {
	byPath := make(map[string]StatusEntry, len(entries))
	for _, e := range entries {
		byPath[e.Path] = e
	}
	findEntry := func(p string) *StatusEntry {
		if e, ok := byPath[p]; ok {
			return &e
		}
		return nil
	}

	var out []string
	for _, p := range paths {
		e := findEntry(p)
		if e == nil {
			continue
		}
		switch action {
		case ActionStage:
			if e.Unstaged != nil {
				out = append(out, p)
			}
		case ActionUnstage:
			if e.Staged != nil {
				out = append(out, p)
			}
		case ActionDiscard:
			if e.Unstaged != nil {
				out = append(out, p)
			}
		}
	}
	return out
}

func ApplyFileAction(repoPath string, action FileAction, paths []string) error {
	if len(paths) == 0 {
		return nil
	}
	entries, err := GetStatus(repoPath)
	if err != nil {
		return err
	}
	applicable := pathsForAction(action, paths, entries)
	if len(applicable) == 0 {
		return nil
	}

	byPath := make(map[string]StatusEntry, len(entries))
	for _, e := range entries {
		byPath[e.Path] = e
	}

	switch action {
	case ActionStage:
		_, err = Run(repoPath, append([]string{"add", "--"}, applicable...))
	case ActionUnstage:
		_, err = Run(repoPath, append([]string{"restore", "--staged", "--"}, applicable...))
	case ActionDiscard:
		var tracked, untracked []string
		for _, p := range applicable {
			if e, ok := byPath[p]; ok && e.Unstaged != nil && *e.Unstaged == StatusUntracked {
				untracked = append(untracked, p)
			} else {
				tracked = append(tracked, p)
			}
		}
		if len(tracked) > 0 {
			if _, err = Run(repoPath, append([]string{"restore", "--worktree", "--"}, tracked...)); err != nil {
				return err
			}
		}
		if len(untracked) > 0 {
			if _, err = Run(repoPath, append([]string{"clean", "-fd", "--"}, untracked...)); err != nil {
				return err
			}
		}
		return nil
	}
	return err
}
