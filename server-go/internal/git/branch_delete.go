package git

// DeleteBranch deletes a local branch. When force is true, uses -D (even if unmerged).
func DeleteBranch(repoPath, branch string, force bool) error {
	flag := "-d"
	if force {
		flag = "-D"
	}
	_, err := Run(repoPath, []string{"branch", flag, branch})
	return err
}

// BranchCheckedOutInWorktree reports whether any linked worktree has branch checked out.
func BranchCheckedOutInWorktree(repoPath, branch string) (bool, error) {
	entries, err := ListWorktrees(repoPath)
	if err != nil {
		return false, err
	}
	for _, e := range entries {
		if e.Branch == branch {
			return true, nil
		}
	}
	return false, nil
}
