package git

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateDirectoryPath(t *testing.T) {
	tmp := t.TempDir()
	missing := filepath.Join(tmp, "missing")
	file := filepath.Join(tmp, "file.txt")
	if err := os.WriteFile(file, []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(tmp, "dir")
	if err := os.Mkdir(dir, 0755); err != nil {
		t.Fatal(err)
	}

	if err := ValidateDirectoryPath(missing); err == nil {
		t.Fatalf("missing path: got nil, want error; run err sample: %v", runErrSample(missing))
	}
	if err := ValidateDirectoryPath(file); err == nil {
		t.Fatalf("file path: got nil, want error; run err sample: %v", runErrSample(file))
	}
	if err := ValidateDirectoryPath(dir); err != nil {
		t.Fatalf("directory path: %v", err)
	}
}

func runErrSample(path string) error {
	_, err := Run(path, []string{"rev-parse"})
	return err
}
