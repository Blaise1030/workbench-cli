package workspace

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/blaisetiong/workbench-cli/server-go/internal/git"
)

type ProjectError struct {
	Msg    string
	Status int
}

func (e *ProjectError) Error() string { return e.Msg }

type Project struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	RepoPath  string    `json:"repoPath"`
	CreatedAt time.Time `json:"createdAt"`
}

func scanProject(rows *sql.Rows) (Project, error) {
	var p Project
	var createdAtMs int64
	err := rows.Scan(&p.ID, &p.Name, &p.RepoPath, &createdAtMs)
	if err == nil {
		p.CreatedAt = time.UnixMilli(createdAtMs)
	}
	return p, err
}

func ListProjects(db *sql.DB) ([]Project, error) {
	rows, err := db.Query(`SELECT id, name, repo_path, created_at FROM projects ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	if out == nil {
		out = []Project{}
	}
	return out, nil
}

func GetProject(db *sql.DB, id string) (*Project, error) {
	rows, err := db.Query(`SELECT id, name, repo_path, created_at FROM projects WHERE id = ? LIMIT 1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	p, err := scanProject(rows)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func RegisterProject(db *sql.DB, repoPathInput string) (*Project, error) {
	repoPath, err := filepath.Abs(repoPathInput)
	if err != nil {
		return nil, &ProjectError{Msg: "Invalid path: " + err.Error(), Status: 400}
	}
	if !git.IsGitRepo(repoPath) {
		return nil, &ProjectError{Msg: "Path is not a git repository", Status: 400}
	}

	var existing string
	err = db.QueryRow(`SELECT id FROM projects WHERE repo_path = ?`, repoPath).Scan(&existing)
	if err == nil {
		return nil, &ProjectError{Msg: "Project already registered", Status: 400}
	}

	id := uuid.NewString()
	name := filepath.Base(repoPath)
	createdAt := time.Now().UnixMilli()
	if _, err := db.Exec(`INSERT INTO projects (id, name, repo_path, created_at) VALUES (?,?,?,?)`,
		id, name, repoPath, createdAt); err != nil {
		return nil, fmt.Errorf("insert project: %w", err)
	}
	if err := syncWorktreesForProject(db, id); err != nil {
		return nil, err
	}
	return GetProject(db, id)
}

func DeleteProject(db *sql.DB, id string) error {
	p, err := GetProject(db, id)
	if err != nil {
		return err
	}
	if p == nil {
		return &ProjectError{Msg: "Project not found", Status: 404}
	}
	_, err = db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}
