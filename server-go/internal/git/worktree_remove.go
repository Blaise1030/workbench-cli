package git

// RemoveWorktree removes a linked worktree from the repository.
func RemoveWorktree(repoPath, worktreePath string, force bool) error {
	args := []string{"worktree", "remove"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, worktreePath)
	_, err := Run(repoPath, args)
	return err
}
