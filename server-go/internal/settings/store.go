package settings

import (
	"encoding/json"
	"os"
	"sync"
)

// Store is the interface used throughout the settings package.
type Store interface {
	Get(key string, fallback any) (any, error)
	Set(key string, value any) error
}

// fileStore persists settings as a JSON map file.
// Phase 3 will replace this with a SQLite-backed store.
type fileStore struct {
	mu   sync.Mutex
	path string
	data map[string]json.RawMessage
}

func NewFileStore(path string) Store {
	s := &fileStore{path: path, data: make(map[string]json.RawMessage)}
	s.load()
	return s
}

func (s *fileStore) load() {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(raw, &s.data)
}

func (s *fileStore) save() {
	raw, _ := json.MarshalIndent(s.data, "", "  ")
	_ = os.WriteFile(s.path, raw, 0o644)
}

func (s *fileStore) Get(key string, fallback any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, ok := s.data[key]
	if !ok {
		return fallback, nil
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return fallback, nil
	}
	return v, nil
}

func (s *fileStore) Set(key string, value any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	s.data[key] = raw
	s.save()
	return nil
}

// Typed helpers

func GetBool(s Store, key string, def bool) bool {
	v, _ := s.Get(key, def)
	if b, ok := v.(bool); ok {
		return b
	}
	return def
}

func GetFloat(s Store, key string, def float64) float64 {
	v, _ := s.Get(key, def)
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	}
	return def
}

func GetInt(s Store, key string, def int) int {
	return int(GetFloat(s, key, float64(def)))
}
