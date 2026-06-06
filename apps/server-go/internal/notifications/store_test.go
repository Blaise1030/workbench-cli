package notifications

import (
	"testing"

	"github.com/blaisetiong/workbench-cli/server-go/internal/db"
)

func TestCreateListMarkReadDelete(t *testing.T) {
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if err := db.Migrate(database); err != nil {
		t.Fatal(err)
	}

	n, err := Create(database, CreateInput{
		Title: "Claude Code finished",
		Body:  "claude --resume abc",
	})
	if err != nil {
		t.Fatal(err)
	}
	if n.Read {
		t.Fatal("expected unread")
	}

	list, err := List(database)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != n.ID {
		t.Fatalf("list: %+v", list)
	}

	ok, err := MarkRead(database, n.ID)
	if err != nil || !ok {
		t.Fatalf("mark read: ok=%v err=%v", ok, err)
	}
	list, _ = List(database)
	if !list[0].Read {
		t.Fatal("expected read after mark")
	}

	ok, err = Delete(database, n.ID)
	if err != nil || !ok {
		t.Fatalf("delete: ok=%v err=%v", ok, err)
	}
	list, _ = List(database)
	if len(list) != 0 {
		t.Fatalf("expected empty list, got %d", len(list))
	}
}
