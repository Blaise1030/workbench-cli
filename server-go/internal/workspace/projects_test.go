package workspace

import (
	"database/sql"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/blaisetiong/workbench-cli/server-go/internal/db"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatal(err)
	}
	return database
}

func TestRegisterProject_nonGitFolder(t *testing.T) {
	database := openTestDB(t)
	folder := t.TempDir()
	if err := os.WriteFile(filepath.Join(folder, "notes.txt"), []byte("hello"), 0644); err != nil {
		t.Fatal(err)
	}

	project, err := RegisterProject(database, folder)
	if err != nil {
		t.Fatalf("RegisterProject: %v", err)
	}
	if project.IsGitRepo {
		t.Fatal("expected non-git project")
	}

	worktrees, err := ListWorktreesByProject(database, project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(worktrees) != 1 {
		t.Fatalf("expected one folder worktree, got %d", len(worktrees))
	}
	if worktrees[0].Path != project.RepoPath {
		t.Fatalf("worktree path = %q, want %q", worktrees[0].Path, project.RepoPath)
	}
	if !worktrees[0].IsLinked {
		t.Fatal("expected folder worktree to be linked")
	}
}

func TestRegisterProject_rejectsMissingPath(t *testing.T) {
	database := openTestDB(t)
	_, err := RegisterProject(database, filepath.Join(t.TempDir(), "missing"))
	if err == nil {
		t.Fatal("expected error for missing path")
	}
}

func TestRegisterProject_rejectsFilePath(t *testing.T) {
	database := openTestDB(t)
	filePath := filepath.Join(t.TempDir(), "file.txt")
	if err := os.WriteFile(filePath, []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	_, err := RegisterProject(database, filePath)
	if err == nil {
		t.Fatal("expected error for file path")
	}
}

func TestRegisterProject_gitRepo(t *testing.T) {
	database := openTestDB(t)
	folder := t.TempDir()
	if out, err := exec.Command("git", "-C", folder, "init").CombinedOutput(); err != nil {
		t.Fatalf("git init: %v\n%s", err, out)
	}

	project, err := RegisterProject(database, folder)
	if err != nil {
		t.Fatalf("RegisterProject: %v", err)
	}
	if !project.IsGitRepo {
		t.Fatal("expected git project")
	}

	worktrees, err := ListWorktreesByProject(database, project.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(worktrees) == 0 {
		t.Fatal("expected at least one worktree for git project")
	}
}

func TestCreateWorktreeForProject_rejectsNonGitProject(t *testing.T) {
	database := openTestDB(t)
	folder := t.TempDir()
	project, err := RegisterProject(database, folder)
	if err != nil {
		t.Fatalf("RegisterProject: %v", err)
	}

	_, err = CreateWorktreeForProject(database, project.ID, CreateWorktreeBody{Branch: "feature"})
	if err == nil {
		t.Fatal("expected error creating worktree for non-git project")
	}
}
