package workspace

import (
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"
)

func mustExec(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatalf("exec %q: %v", query, err)
	}
}

func TestListAgentTerminals_includesProjectNameAndBranch(t *testing.T) {
	database := openTestDB(t)

	projectID := uuid.NewString()
	worktreeID := uuid.NewString()
	terminalID := uuid.NewString()
	now := time.Now().UnixMilli()
	branch := "main"
	kind := "claude"

	mustExec(t, database, `INSERT INTO projects (id, name, repo_path, created_at) VALUES (?,?,?,?)`,
		projectID, "v2", t.TempDir(), now)
	mustExec(t, database, `INSERT INTO worktrees (id,project_id,path,branch,base_branch,git_dir,is_linked,created_at) VALUES (?,?,?,?,?,?,?,?)`,
		worktreeID, projectID, t.TempDir(), branch, nil, nil, 0, now)
	mustExec(t, database, `INSERT INTO terminals (id,worktree_id,title,sort_order,resume_command,resume_trusted,agent_kind,agent_session_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
		terminalID, worktreeID, "Claude Code", 0, nil, 0, kind, nil, now)

	got, err := ListAgentTerminals(database)
	if err != nil {
		t.Fatalf("ListAgentTerminals: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 agent terminal, got %d", len(got))
	}
	if got[0].ProjectName != "v2" {
		t.Fatalf("ProjectName = %q, want %q", got[0].ProjectName, "v2")
	}
	if got[0].Branch == nil || *got[0].Branch != "main" {
		t.Fatalf("Branch = %v, want \"main\"", got[0].Branch)
	}
	if got[0].ID != terminalID {
		t.Fatalf("ID = %q, want %q", got[0].ID, terminalID)
	}
}

func TestListAgentTerminals_nullBranch(t *testing.T) {
	database := openTestDB(t)

	projectID := uuid.NewString()
	worktreeID := uuid.NewString()
	terminalID := uuid.NewString()
	now := time.Now().UnixMilli()
	kind := "claude"

	mustExec(t, database, `INSERT INTO projects (id, name, repo_path, created_at) VALUES (?,?,?,?)`,
		projectID, "v2", t.TempDir(), now)
	mustExec(t, database, `INSERT INTO worktrees (id,project_id,path,branch,base_branch,git_dir,is_linked,created_at) VALUES (?,?,?,?,?,?,?,?)`,
		worktreeID, projectID, t.TempDir(), nil, nil, nil, 0, now)
	mustExec(t, database, `INSERT INTO terminals (id,worktree_id,title,sort_order,resume_command,resume_trusted,agent_kind,agent_session_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
		terminalID, worktreeID, "Claude Code", 0, nil, 0, kind, nil, now)

	got, err := ListAgentTerminals(database)
	if err != nil {
		t.Fatalf("ListAgentTerminals: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 agent terminal, got %d", len(got))
	}
	if got[0].Branch != nil {
		t.Fatalf("Branch = %v, want nil", got[0].Branch)
	}
}

// The terminals table has a FOREIGN KEY on worktree_id and FK enforcement is
// on, so a terminal can never reference a missing worktree. This guards that
// invariant: inserting an orphaned terminal must be rejected, which is what
// lets ListAgentTerminals safely use an inner JOIN without dropping sessions.
func TestInsertTerminal_orphanedWorktreeRejected(t *testing.T) {
	database := openTestDB(t)

	now := time.Now().UnixMilli()
	_, err := database.Exec(`INSERT INTO terminals (id,worktree_id,title,sort_order,resume_command,resume_trusted,agent_kind,agent_session_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
		uuid.NewString(), uuid.NewString(), "Claude Code", 0, nil, 0, "claude", nil, now)
	if err == nil {
		t.Fatal("expected FOREIGN KEY constraint failure inserting a terminal with a missing worktree, got nil")
	}
}
