package workspace

import (
	"testing"

	"github.com/blaisetiong/workbench-cli/server-go/internal/git"
)

func TestWorktreeBranchToDelete(t *testing.T) {
	base := "main"
	branch := "feat-x"
	w := &Worktree{
		Branch:     &branch,
		BaseBranch: &base,
	}
	if got := worktreeBranchToDelete(t.TempDir(), w); got != "feat-x" {
		t.Fatalf("got %q want feat-x", got)
	}

	w.BaseBranch = nil
	if got := worktreeBranchToDelete(t.TempDir(), w); got != "" {
		t.Fatalf("existing-branch worktree should not delete branch, got %q", got)
	}

	w.BaseBranch = &base
	def := git.GetDefaultBranch(t.TempDir()) // likely "main"
	w.Branch = &def
	if got := worktreeBranchToDelete(t.TempDir(), w); got != "" {
		t.Fatalf("default branch should not be deleted, got %q", got)
	}
}
