package workspace

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/blaisetiong/workbench-cli/server-go/internal/git"
)

type TerminalError struct {
	Msg    string
	Status int
}

func (e *TerminalError) Error() string { return e.Msg }

type Terminal struct {
	ID             string    `json:"id"`
	WorktreeID     string    `json:"worktreeId"`
	Title          string    `json:"title"`
	SortOrder      int       `json:"sortOrder"`
	ResumeCommand  *string   `json:"resumeCommand"`
	ResumeTrusted  bool      `json:"resumeTrusted"`
	AgentKind      *string   `json:"agentKind"`
	AgentSessionID *string   `json:"agentSessionId"`
	CreatedAt      time.Time `json:"createdAt"`
}

func scanTerminal(rows *sql.Rows) (Terminal, error) {
	var t Terminal
	var createdAtMs int64
	var resumeTrustedInt int
	err := rows.Scan(&t.ID, &t.WorktreeID, &t.Title, &t.SortOrder,
		&t.ResumeCommand, &resumeTrustedInt, &t.AgentKind, &t.AgentSessionID, &createdAtMs)
	if err == nil {
		t.ResumeTrusted = resumeTrustedInt != 0
		t.CreatedAt = time.UnixMilli(createdAtMs)
	}
	return t, err
}

const terminalCols = `id, worktree_id, title, sort_order, resume_command, resume_trusted, agent_kind, agent_session_id, created_at`

func ListTerminals(db *sql.DB, worktreeID string) ([]Terminal, error) {
	wt, err := GetWorktree(db, worktreeID)
	if err != nil {
		return nil, err
	}
	if wt == nil {
		return nil, &WorktreeError{Msg: "Worktree not found", Status: 404}
	}
	rows, err := db.Query(`SELECT `+terminalCols+` FROM terminals WHERE worktree_id = ? ORDER BY sort_order ASC, created_at ASC`, worktreeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Terminal
	for rows.Next() {
		t, err := scanTerminal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	if out == nil {
		out = []Terminal{}
	}
	return out, nil
}

func GetTerminal(db *sql.DB, id string) (*Terminal, error) {
	rows, err := db.Query(`SELECT `+terminalCols+` FROM terminals WHERE id = ? LIMIT 1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	t, err := scanTerminal(rows)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func GetTerminalWithWorktree(db *sql.DB, id string) (*Terminal, *Worktree, error) {
	t, err := GetTerminal(db, id)
	if err != nil || t == nil {
		return nil, nil, err
	}
	wt, err := GetWorktree(db, t.WorktreeID)
	if err != nil || wt == nil {
		return nil, nil, err
	}
	if !git.WorktreePathExists(wt.Path) {
		return nil, nil, &TerminalError{Msg: "Worktree path no longer exists on disk", Status: 404}
	}
	return t, wt, nil
}

func CreateTerminal(db *sql.DB, worktreeID string, title *string) (*Terminal, error) {
	wt, err := GetWorktree(db, worktreeID)
	if err != nil || wt == nil {
		return nil, &WorktreeError{Msg: "Worktree not found", Status: 404}
	}
	existing, _ := ListTerminals(db, worktreeID)
	id := uuid.NewString()
	resolvedTitle := fmt.Sprintf("Terminal %d", len(existing)+1)
	if title != nil && *title != "" {
		resolvedTitle = *title
	}
	sortOrder := len(existing)
	createdAt := time.Now().UnixMilli()
	_, err = db.Exec(`INSERT INTO terminals (id,worktree_id,title,sort_order,resume_command,resume_trusted,agent_kind,agent_session_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
		id, worktreeID, resolvedTitle, sortOrder, nil, 0, nil, nil, createdAt)
	if err != nil {
		return nil, err
	}
	return GetTerminal(db, id)
}

type UpdateTerminalPatch struct {
	Title         *string  `json:"title,omitempty"`
	SortOrder     *int     `json:"sortOrder,omitempty"`
	ResumeCommand *string  `json:"resumeCommand"` // explicit null = clear
	ResumeTrusted *bool    `json:"resumeTrusted,omitempty"`
}

func UpdateTerminal(db *sql.DB, id string, patch UpdateTerminalPatch) (*Terminal, error) {
	t, err := GetTerminal(db, id)
	if err != nil || t == nil {
		return nil, &TerminalError{Msg: "Terminal not found", Status: 404}
	}
	if patch.Title != nil && *patch.Title != "" {
		t.Title = *patch.Title
	}
	if patch.SortOrder != nil {
		t.SortOrder = *patch.SortOrder
	}
	if patch.ResumeCommand != nil {
		trimmed := *patch.ResumeCommand
		if trimmed == "" {
			t.ResumeCommand = nil
			t.ResumeTrusted = false
		} else {
			t.ResumeCommand = &trimmed
		}
	}
	if patch.ResumeTrusted != nil {
		t.ResumeTrusted = *patch.ResumeTrusted
	}
	resumeTrustedInt := 0
	if t.ResumeTrusted {
		resumeTrustedInt = 1
	}
	_, err = db.Exec(`UPDATE terminals SET title=?, sort_order=?, resume_command=?, resume_trusted=? WHERE id=?`,
		t.Title, t.SortOrder, t.ResumeCommand, resumeTrustedInt, id)
	if err != nil {
		return nil, err
	}
	return GetTerminal(db, id)
}

func DeleteTerminal(db *sql.DB, id string, onKill func(string)) error {
	t, err := GetTerminal(db, id)
	if err != nil || t == nil {
		return &TerminalError{Msg: "Terminal not found", Status: 404}
	}
	if onKill != nil {
		onKill(id)
	}
	_, err = db.Exec(`DELETE FROM terminals WHERE id = ?`, id)
	return err
}

func UpdateTerminalAgentSession(db *sql.DB, id, agentKind, agentSessionID string) error {
	_, err := db.Exec(`UPDATE terminals SET agent_kind=?, agent_session_id=? WHERE id=?`, agentKind, agentSessionID, id)
	return err
}
