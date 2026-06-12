package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
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

func initTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	for _, args := range [][]string{
		{"init", "-q"},
		{"config", "user.email", "t@t.co"},
		{"config", "user.name", "t"},
	} {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v (%s)", args, err, out)
		}
	}
	return dir
}

// RunLocked must serialize index-writing commands per repo: concurrent writers
// should never collide on .git/index.lock.
func TestRunLockedSerializesWrites(t *testing.T) {
	dir := initTestRepo(t)

	const writers = 12
	var wg sync.WaitGroup
	var failures int64
	for i := 0; i < writers; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			name := "f" + string(rune('a'+n)) + ".txt"
			if err := writeFile(t, dir, name); err != nil {
				atomic.AddInt64(&failures, 1)
				return
			}
			if _, err := RunLocked(dir, []string{"add", "--", name}); err != nil {
				atomic.AddInt64(&failures, 1)
			}
		}(i)
	}
	wg.Wait()

	if failures != 0 {
		t.Fatalf("expected no lock failures, got %d", failures)
	}
}

func TestRepoLockSharedAcrossCalls(t *testing.T) {
	dir := initTestRepo(t)
	a := lockForRepo(dir)
	b := lockForRepo(dir)
	if a != b {
		t.Fatal("expected the same mutex instance for the same repo")
	}
}

func writeFile(t *testing.T, dir, name string) error {
	t.Helper()
	cmd := exec.Command("sh", "-c", "printf 'x\\n' > "+name)
	cmd.Dir = dir
	return cmd.Run()
}
