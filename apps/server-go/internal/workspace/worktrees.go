package workspace

import (
	"database/sql"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/blaisetiong/workbench-cli/server-go/internal/git"
)

type WorktreeError struct {
	Msg    string
	Status int
}

func (e *WorktreeError) Error() string { return e.Msg }

type Worktree struct {
	ID         string    `json:"id"`
	ProjectID  string    `json:"projectId"`
	Path       string    `json:"path"`
	Branch     *string   `json:"branch"`
	BaseBranch *string   `json:"baseBranch"`
	GitDir     *string   `json:"gitDir"`
	IsLinked   bool      `json:"isLinked"`
	CreatedAt  time.Time `json:"createdAt"`
}

func scanWorktree(rows *sql.Rows) (Worktree, error) {
	var w Worktree
	var createdAtMs int64
	var isLinkedInt int
	err := rows.Scan(&w.ID, &w.ProjectID, &w.Path, &w.Branch, &w.BaseBranch, &w.GitDir, &isLinkedInt, &createdAtMs)
	if err == nil {
		w.IsLinked = isLinkedInt != 0
		w.CreatedAt = time.UnixMilli(createdAtMs)
	}
	return w, err
}

func GetWorktree(db *sql.DB, id string) (*Worktree, error) {
	rows, err := db.Query(`SELECT id, project_id, path, branch, base_branch, git_dir, is_linked, created_at FROM worktrees WHERE id = ? LIMIT 1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	w, err := scanWorktree(rows)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

func listWorktreesByProjectID(db *sql.DB, projectID string) ([]Worktree, error) {
	rows, err := db.Query(`SELECT id, project_id, path, branch, base_branch, git_dir, is_linked, created_at FROM worktrees WHERE project_id = ?`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Worktree
	for rows.Next() {
		w, err := scanWorktree(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	if out == nil {
		out = []Worktree{}
	}
	return out, nil
}

func ensureFolderWorktree(db *sql.DB, projectID, folderPath string) error {
	existing, err := listWorktreesByProjectID(db, projectID)
	if err != nil {
		return err
	}
	isLinkedInt := 0
	if git.WorktreePathExists(folderPath) {
		isLinkedInt = 1
	}
	for _, w := range existing {
		if w.Path == folderPath {
			_, err = db.Exec(`UPDATE worktrees SET is_linked=? WHERE id=?`, isLinkedInt, w.ID)
			return err
		}
	}
	_, err = db.Exec(`INSERT OR IGNORE INTO worktrees (id,project_id,path,branch,base_branch,git_dir,is_linked,created_at) VALUES (?,?,?,?,?,?,?,?)`,
		uuid.NewString(), projectID, folderPath, nil, nil, nil, isLinkedInt, time.Now().UnixMilli())
	return err
}

func syncWorktreesForProject(db *sql.DB, projectID string) error {
	p, err := GetProject(db, projectID)
	if err != nil || p == nil {
		return &ProjectError{Msg: "Project not found", Status: 404}
	}
	gitEntries, err := git.ListWorktrees(p.RepoPath)
	if err != nil {
		if !git.IsGitRepo(p.RepoPath) {
			return ensureFolderWorktree(db, projectID, p.RepoPath)
		}
		return nil // transient git failure — keep existing worktrees
	}
	existing, err := listWorktreesByProjectID(db, projectID)
	if err != nil {
		return err
	}
	byPath := make(map[string]Worktree, len(existing))
	for _, w := range existing {
		byPath[w.Path] = w
	}
	for _, entry := range gitEntries {
		linked := git.WorktreePathExists(entry.Path)
		prev, found := byPath[entry.Path]
		if found {
			branch := prev.Branch
			if entry.Branch != "" {
				branch = &entry.Branch
			}
			gitDir := prev.GitDir
			if entry.GitDir != "" {
				gitDir = &entry.GitDir
			}
			isLinkedInt := 0
			if linked {
				isLinkedInt = 1
			}
			_, err = db.Exec(`UPDATE worktrees SET branch=?, git_dir=?, is_linked=? WHERE id=?`,
				branch, gitDir, isLinkedInt, prev.ID)
			if err != nil {
				return err
			}
			delete(byPath, entry.Path)
		} else {
			var branch, gitDir *string
			if entry.Branch != "" {
				branch = &entry.Branch
			}
			if entry.GitDir != "" {
				gitDir = &entry.GitDir
			}
			isLinkedInt := 0
			if linked {
				isLinkedInt = 1
			}
			_, err = db.Exec(`INSERT OR IGNORE INTO worktrees (id,project_id,path,branch,base_branch,git_dir,is_linked,created_at) VALUES (?,?,?,?,?,?,?,?)`,
				uuid.NewString(), projectID, entry.Path, branch, nil, gitDir, isLinkedInt, time.Now().UnixMilli())
			if err != nil {
				return err
			}
		}
	}
	// Mark orphans as unlinked
	for _, orphan := range byPath {
		_, _ = db.Exec(`UPDATE worktrees SET is_linked=0 WHERE id=?`, orphan.ID)
	}
	return nil
}

func requireGitProjectForWorktree(db *sql.DB, wt *Worktree) error {
	p, err := GetProject(db, wt.ProjectID)
	if err != nil {
		return err
	}
	if p == nil {
		return &ProjectError{Msg: "Project not found", Status: 404}
	}
	if !p.IsGitRepo {
		return &ProjectError{Msg: "Project is not a git repository", Status: 400}
	}
	return nil
}

func ListWorktreesByProject(db *sql.DB, projectID string) ([]Worktree, error) {
	p, err := GetProject(db, projectID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, &ProjectError{Msg: "Project not found", Status: 404}
	}
	_ = syncWorktreesForProject(db, projectID)
	return listWorktreesByProjectID(db, projectID)
}

type CreateWorktreeBody struct {
	Branch      string  `json:"branch"`
	BaseBranch  *string `json:"baseBranch,omitempty"`
	Path        *string `json:"path,omitempty"`
	IsNewBranch *bool   `json:"isNewBranch,omitempty"`
}

func CreateWorktreeForProject(db *sql.DB, projectID string, body CreateWorktreeBody) (*Worktree, error) {
	p, err := GetProject(db, projectID)
	if err != nil || p == nil {
		return nil, &ProjectError{Msg: "Project not found", Status: 404}
	}
	if !git.IsGitRepo(p.RepoPath) {
		return nil, &WorktreeError{Msg: "Project is not a git repository", Status: 400}
	}

	if err := git.ValidateBranchName(body.Branch); err != nil {
		return nil, &WorktreeError{Msg: "invalid branch name", Status: 400}
	}
	if body.BaseBranch != nil && *body.BaseBranch != "" {
		if err := git.ValidateBranchName(*body.BaseBranch); err != nil {
			return nil, &WorktreeError{Msg: "invalid base branch name", Status: 400}
		}
	}

	args := []string{"worktree", "add"}
	wtPath := ""
	if body.Path != nil && *body.Path != "" {
		wtPath = filepath.Clean(*body.Path)
		if strings.HasPrefix(wtPath, "-") || strings.ContainsRune(wtPath, 0) {
			return nil, &WorktreeError{Msg: "invalid worktree path", Status: 400}
		}
	} else {
		wtPath = filepath.Clean(p.RepoPath + "/../" + body.Branch)
	}
	args = append(args, "--", wtPath)

	if body.IsNewBranch != nil && *body.IsNewBranch {
		args = append(args, "-b", body.Branch)
		if body.BaseBranch != nil && *body.BaseBranch != "" {
			args = append(args, *body.BaseBranch)
		}
	} else {
		args = append(args, body.Branch)
	}

	if _, err := git.Run(p.RepoPath, args); err != nil {
		return nil, &WorktreeError{Msg: err.Error(), Status: 400}
	}
	if err := syncWorktreesForProject(db, projectID); err != nil {
		return nil, err
	}
	wts, err := listWorktreesByProjectID(db, projectID)
	if err != nil {
		return nil, err
	}
	for _, w := range wts {
		if w.Path == wtPath {
			if body.BaseBranch != nil {
				_, _ = db.Exec(`UPDATE worktrees SET base_branch=? WHERE id=?`, *body.BaseBranch, w.ID)
			}
			return GetWorktree(db, w.ID)
		}
	}
	return nil, &WorktreeError{Msg: "Worktree created but not found after sync"}
}

func DeleteWorktree(db *sql.DB, id string) error {
	w, err := GetWorktree(db, id)
	if err != nil {
		return err
	}
	if w == nil {
		return &WorktreeError{Msg: "Worktree not found", Status: 404}
	}
	p, err := GetProject(db, w.ProjectID)
	if err != nil {
		return err
	}
	if p == nil {
		return &ProjectError{Msg: "Project not found", Status: 404}
	}
	repoPath := filepath.Clean(p.RepoPath)
	wtPath := filepath.Clean(w.Path)
	if repoPath == wtPath {
		return &WorktreeError{Msg: "Cannot remove the main worktree", Status: 400}
	}
	if git.WorktreePathExists(w.Path) {
		if err := git.RemoveWorktree(p.RepoPath, w.Path, true); err != nil {
			return &WorktreeError{Msg: err.Error(), Status: 400}
		}
	}
	if branch := worktreeBranchToDelete(p.RepoPath, w); branch != "" {
		checkedOut, err := git.BranchCheckedOutInWorktree(p.RepoPath, branch)
		if err != nil {
			return &WorktreeError{Msg: err.Error(), Status: 400}
		}
		if !checkedOut {
			if err := git.DeleteBranch(p.RepoPath, branch, true); err != nil {
				return &WorktreeError{Msg: err.Error(), Status: 400}
			}
		}
	}
	_, err = db.Exec(`DELETE FROM worktrees WHERE id = ?`, id)
	return err
}

// worktreeBranchToDelete returns the branch to remove after deleting an app-created worktree.
// Worktrees created from an existing branch (no base_branch) keep their branch.
func worktreeBranchToDelete(repoPath string, w *Worktree) string {
	if w.Branch == nil || *w.Branch == "" {
		return ""
	}
	if w.BaseBranch == nil || *w.BaseBranch == "" {
		return ""
	}
	branch := *w.Branch
	if branch == git.GetDefaultBranch(repoPath) {
		return ""
	}
	return branch
}
