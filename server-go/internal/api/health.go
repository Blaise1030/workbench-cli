package api

import (
	"encoding/json"
	"net/http"
)

type healthResponse struct {
	OK      bool   `json:"ok"`
	Server  string `json:"server"`
	Version string `json:"version"`
}

func Health(version string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(healthResponse{
			OK: true, Server: "go", Version: version,
		})
	}
}
