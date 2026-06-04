package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCreateFile_file(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "hello.txt", false); err != nil {
		t.Fatalf("CreateFile: %v", err)
	}
	info, err := os.Stat(filepath.Join(root, "hello.txt"))
	if err != nil {
		t.Fatalf("file not created: %v", err)
	}
	if info.IsDir() {
		t.Fatal("expected file, got directory")
	}
}

func TestCreateFile_directory(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "subdir", true); err != nil {
		t.Fatalf("CreateFile dir: %v", err)
	}
	info, err := os.Stat(filepath.Join(root, "subdir"))
	if err != nil {
		t.Fatalf("dir not created: %v", err)
	}
	if !info.IsDir() {
		t.Fatal("expected directory, got file")
	}
}

func TestCreateFile_nestedPath(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "a/b/c.txt", false); err != nil {
		t.Fatalf("CreateFile nested: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "a/b/c.txt")); err != nil {
		t.Fatalf("nested file not created: %v", err)
	}
}

func TestCreateFile_pathTraversal(t *testing.T) {
	root := t.TempDir()
	if err := CreateFile(root, "../escape.txt", false); err == nil {
		t.Fatal("expected error for path traversal, got nil")
	}
}

func TestDeleteFile_file(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "del.txt")
	if err := os.WriteFile(target, []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := DeleteFile(root, "del.txt"); err != nil {
		t.Fatalf("DeleteFile: %v", err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatal("file still exists after delete")
	}
}

func TestDeleteFile_directory(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "mydir")
	if err := os.MkdirAll(filepath.Join(dir, "nested"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := DeleteFile(root, "mydir"); err != nil {
		t.Fatalf("DeleteFile dir: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("dir still exists after delete")
	}
}

func TestDeleteFile_notFound(t *testing.T) {
	root := t.TempDir()
	if err := DeleteFile(root, "nonexistent.txt"); err == nil {
		t.Fatal("expected error for non-existent file, got nil")
	}
}

func TestDeleteFile_emptyPath(t *testing.T) {
	root := t.TempDir()
	if err := DeleteFile(root, ""); err == nil {
		t.Fatal("expected error for empty path, got nil")
	}
	if err := DeleteFile(root, "."); err == nil {
		t.Fatal("expected error for '.' path, got nil")
	}
}

func TestMoveFile_rename(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "old.txt"), []byte("hi"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := MoveFile(root, "old.txt", "new.txt"); err != nil {
		t.Fatalf("MoveFile: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "old.txt")); !os.IsNotExist(err) {
		t.Fatal("old file still exists")
	}
	if _, err := os.Stat(filepath.Join(root, "new.txt")); err != nil {
		t.Fatal("new file not found")
	}
}

func TestMoveFile_toSubdir(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := MoveFile(root, "file.txt", "subdir/file.txt"); err != nil {
		t.Fatalf("MoveFile to subdir: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "subdir/file.txt")); err != nil {
		t.Fatal("moved file not found in subdir")
	}
}

func TestMoveFile_pathTraversal(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "file.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := MoveFile(root, "file.txt", "../outside.txt"); err == nil {
		t.Fatal("expected error for path traversal destination")
	}
}
