package workspace

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/blaisetiong/workbench-cli/server-go/internal/auth"
	"github.com/blaisetiong/workbench-cli/server-go/internal/git"
)

func jsonResp(w http.ResponseWriter, v any, code int) {
	w.Header().Set("Content-Type", "application/json")
	if code != http.StatusOK && code != http.StatusCreated {
		w.WriteHeader(code)
	} else if code == http.StatusCreated {
		w.WriteHeader(code)
	}
	_ = json.NewEncoder(w).Encode(v)
}

func wsErr(w http.ResponseWriter, msg string, code int) {
	jsonResp(w, map[string]string{"error": msg}, code)
}

func orNull(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func domainStatus(err error) int {
	type statusErr interface{ Error() string }
	switch e := err.(type) {
	case *ProjectError:
		if e.Status != 0 {
			return e.Status
		}
	case *WorktreeError:
		if e.Status != 0 {
			return e.Status
		}
	case *TerminalError:
		if e.Status != 0 {
			return e.Status
		}
	case *FileError:
		if e.Status != 0 {
			return e.Status
		}
	case statusErr:
		_ = e
	}
	return http.StatusInternalServerError
}

func RegisterRoutes(r chi.Router, db *sql.DB, session *auth.Session) {
	r.Use(auth.RequireSession(session))

	// Projects
	r.Get("/projects", func(w http.ResponseWriter, r *http.Request) {
		projects, err := ListProjects(db)
		if err != nil {
			wsErr(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResp(w, map[string]any{"projects": projects}, http.StatusOK)
	})
	r.Post("/projects", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			RepoPath string `json:"repoPath"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.RepoPath) == "" {
			wsErr(w, "repoPath is required", http.StatusBadRequest)
			return
		}
		p, err := RegisterProject(db, body.RepoPath)
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]any{"project": p}, http.StatusCreated)
	})
	r.Post("/projects/pick-folder", func(w http.ResponseWriter, r *http.Request) {
		if !auth.IsLocalRequest(r) {
			wsErr(w, "Folder picker is only available on localhost", http.StatusForbidden)
			return
		}
		repoPath, cancelled := PickFolder()
		if cancelled {
			jsonResp(w, map[string]any{"cancelled": true}, http.StatusOK)
			return
		}
		p, err := RegisterProject(db, repoPath)
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]any{"project": p}, http.StatusCreated)
	})
	r.Delete("/projects/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := DeleteProject(db, chi.URLParam(r, "id")); err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})
	r.Get("/projects/{id}/branches", func(w http.ResponseWriter, r *http.Request) {
		p, err := GetProject(db, chi.URLParam(r, "id"))
		if err != nil || p == nil {
			wsErr(w, "Project not found", http.StatusNotFound)
			return
		}
		branches, _ := git.ListBranches(p.RepoPath)
		if branches == nil {
			branches = []string{}
		}
		defaultBranch := git.GetDefaultBranch(p.RepoPath)
		jsonResp(w, map[string]any{"branches": branches, "defaultBranch": defaultBranch}, http.StatusOK)
	})

	// Worktrees under project
	r.Get("/projects/{id}/worktrees", func(w http.ResponseWriter, r *http.Request) {
		wts, err := ListWorktreesByProject(db, chi.URLParam(r, "id"))
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]any{"worktrees": wts}, http.StatusOK)
	})
	r.Post("/projects/{id}/worktrees", func(w http.ResponseWriter, r *http.Request) {
		var body CreateWorktreeBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Branch) == "" {
			wsErr(w, "branch is required", http.StatusBadRequest)
			return
		}
		wt, err := CreateWorktreeForProject(db, chi.URLParam(r, "id"), body)
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]any{"worktree": wt}, http.StatusCreated)
	})

	// Individual worktree
	r.Get("/worktrees/{id}", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		jsonResp(w, map[string]any{"worktree": wt}, http.StatusOK)
	})
	r.Delete("/worktrees/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := DeleteWorktree(db, chi.URLParam(r, "id")); err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})

	// Files
	r.Get("/worktrees/{id}/files", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		paths, _ := ListFiles(wt.Path)
		if paths == nil {
			paths = []string{}
		}
		jsonResp(w, map[string]any{"paths": paths}, http.StatusOK)
	})
	r.Get("/worktrees/{id}/files/content", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		path := r.URL.Query().Get("path")
		if path == "" {
			wsErr(w, "path query parameter is required", http.StatusBadRequest)
			return
		}
		fc, err := ReadFile(wt.Path, path)
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, fc, http.StatusOK)
	})
	r.Put("/worktrees/{id}/files/content", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		var body struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
			wsErr(w, "path and content are required", http.StatusBadRequest)
			return
		}
		if err := WriteFile(wt.Path, body.Path, body.Content); err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})

	// Terminals (REST stubs — no live PTY until Phase 5)
	r.Get("/worktrees/{id}/terminals", func(w http.ResponseWriter, r *http.Request) {
		terms, err := ListTerminals(db, chi.URLParam(r, "id"))
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]any{"terminals": terms}, http.StatusOK)
	})
	r.Post("/worktrees/{id}/terminals", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Title *string `json:"title,omitempty"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		t, err := CreateTerminal(db, chi.URLParam(r, "id"), body.Title)
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]any{"terminal": t}, http.StatusCreated)
	})
	r.Patch("/terminals/{id}", func(w http.ResponseWriter, r *http.Request) {
		var patch UpdateTerminalPatch
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			wsErr(w, "Bad request", http.StatusBadRequest)
			return
		}
		t, err := UpdateTerminal(db, chi.URLParam(r, "id"), patch)
		if err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]any{"terminal": t}, http.StatusOK)
	})
	r.Delete("/terminals/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := DeleteTerminal(db, chi.URLParam(r, "id"), nil); err != nil {
			wsErr(w, err.Error(), domainStatus(err))
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})

	// Git panel routes
	r.Get("/worktrees/{id}/git/status", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		if !wt.IsLinked {
			wsErr(w, "Worktree path is not available on disk", http.StatusNotFound)
			return
		}
		entries, err := git.GetStatus(wt.Path)
		if err != nil {
			wsErr(w, err.Error(), http.StatusBadRequest)
			return
		}
		branch, _ := git.GetCurrentBranch(wt.Path)
		if entries == nil {
			entries = []git.StatusEntry{}
		}
		jsonResp(w, map[string]any{"branch": branch, "files": entries}, http.StatusOK)
	})
	r.Get("/worktrees/{id}/git/diff", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		scope := git.ParseDiffScope(r.URL.Query().Get("scope"))
		path := r.URL.Query().Get("path")
		patch, err := git.GetDiff(wt.Path, scope, path)
		if err != nil {
			wsErr(w, err.Error(), http.StatusBadRequest)
			return
		}
		jsonResp(w, map[string]any{"patch": patch, "scope": scope, "path": orNull(path)}, http.StatusOK)
	})
	r.Post("/worktrees/{id}/git/actions", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		var body struct {
			Action string   `json:"action"`
			Paths  []string `json:"paths"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			wsErr(w, "Bad request", http.StatusBadRequest)
			return
		}
		action := git.FileAction(body.Action)
		if action != git.ActionStage && action != git.ActionUnstage && action != git.ActionDiscard {
			wsErr(w, "Invalid action", http.StatusBadRequest)
			return
		}
		if err := git.ApplyFileAction(wt.Path, action, body.Paths); err != nil {
			wsErr(w, err.Error(), http.StatusBadRequest)
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})
	r.Post("/worktrees/{id}/git/commit", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		var body struct {
			Message string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Message) == "" {
			wsErr(w, "message is required", http.StatusBadRequest)
			return
		}
		if err := git.CommitStaged(wt.Path, body.Message); err != nil {
			wsErr(w, err.Error(), http.StatusBadRequest)
			return
		}
		jsonResp(w, map[string]bool{"ok": true}, http.StatusOK)
	})

	// Drop assets (multipart)
	r.Post("/worktrees/{id}/drop-assets", func(w http.ResponseWriter, r *http.Request) {
		wt, err := GetWorktree(db, chi.URLParam(r, "id"))
		if err != nil || wt == nil {
			wsErr(w, "Worktree not found", http.StatusNotFound)
			return
		}
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			wsErr(w, "Failed to parse multipart form", http.StatusBadRequest)
			return
		}
		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			wsErr(w, "No files provided", http.StatusBadRequest)
			return
		}
		assetsDir := filepath.Join(wt.Path, ".workbench", "files")
		if err := os.MkdirAll(assetsDir, 0755); err != nil {
			wsErr(w, "Failed to create assets directory", http.StatusInternalServerError)
			return
		}
		var paths []string
		for _, fh := range files {
			ext := filepath.Ext(fh.Filename)
			id := fmt.Sprintf("%s%s", uuid.New().String(), ext)
			destPath := filepath.Join(assetsDir, id)
			src, err := fh.Open()
			if err != nil {
				wsErr(w, "Failed to open uploaded file", http.StatusInternalServerError)
				return
			}
			dst, err := os.Create(destPath)
			if err != nil {
				src.Close()
				wsErr(w, "Failed to create destination file", http.StatusInternalServerError)
				return
			}
			_, copyErr := io.Copy(dst, src)
			src.Close()
			dst.Close()
			if copyErr != nil {
				wsErr(w, "Failed to write file", http.StatusInternalServerError)
				return
			}
			paths = append(paths, filepath.Join(".workbench", "files", id))
		}
		jsonResp(w, map[string]any{"paths": paths}, http.StatusOK)
	})
}
