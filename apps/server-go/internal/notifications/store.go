package notifications

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID         string  `json:"id"`
	WorktreeID *string `json:"worktreeId"`
	TerminalID *string `json:"terminalId"`
	Title      string  `json:"title"`
	Subtitle   *string `json:"subtitle"`
	Body       string  `json:"body"`
	Read       bool    `json:"read"`
	CreatedAt  string  `json:"createdAt"`
}

type CreateInput struct {
	WorktreeID *string
	TerminalID *string
	Title      string
	Subtitle   *string
	Body       string
}

func List(db *sql.DB) ([]Notification, error) {
	rows, err := db.Query(`
		SELECT id, worktree_id, terminal_id, title, subtitle, body, read, created_at
		FROM notifications
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Notification
	for rows.Next() {
		n, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func Create(db *sql.DB, input CreateInput) (Notification, error) {
	id := uuid.NewString()
	createdAt := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec(`
		INSERT INTO notifications (id, worktree_id, terminal_id, title, subtitle, body, read, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
		id, input.WorktreeID, input.TerminalID, input.Title, input.Subtitle, input.Body, createdAt,
	)
	if err != nil {
		return Notification{}, err
	}
	return Notification{
		ID:         id,
		WorktreeID: input.WorktreeID,
		TerminalID: input.TerminalID,
		Title:      input.Title,
		Subtitle:   input.Subtitle,
		Body:       input.Body,
		Read:       false,
		CreatedAt:  createdAt,
	}, nil
}

func MarkRead(db *sql.DB, id string) (bool, error) {
	res, err := db.Exec(`UPDATE notifications SET read = 1 WHERE id = ?`, id)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func MarkAllRead(db *sql.DB) error {
	_, err := db.Exec(`UPDATE notifications SET read = 1 WHERE read = 0`)
	return err
}

func Delete(db *sql.DB, id string) (bool, error) {
	res, err := db.Exec(`DELETE FROM notifications WHERE id = ?`, id)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func scanRow(rows *sql.Rows) (Notification, error) {
	var n Notification
	var worktreeID sql.NullString
	var terminalID sql.NullString
	var subtitle sql.NullString
	var read int
	if err := rows.Scan(&n.ID, &worktreeID, &terminalID, &n.Title, &subtitle, &n.Body, &read, &n.CreatedAt); err != nil {
		return Notification{}, err
	}
	if worktreeID.Valid {
		s := worktreeID.String
		n.WorktreeID = &s
	}
	if terminalID.Valid {
		s := terminalID.String
		n.TerminalID = &s
	}
	if subtitle.Valid {
		s := subtitle.String
		n.Subtitle = &s
	}
	n.Read = read != 0
	return n, nil
}
