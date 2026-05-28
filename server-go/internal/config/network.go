package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const (
	DefaultHost = "workbench.local"
	DefaultPort = 4738
)

type NetworkConfig struct {
	Host string `json:"host"`
	Port int    `json:"port"`
}

func DataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".", ".workbench")
	}
	return filepath.Join(home, ".workbench")
}

func ConfigPath() string {
	return filepath.Join(DataDir(), "config.json")
}

func DbPath() string {
	return filepath.Join(DataDir(), "data.db")
}

func ScrollbackDir() string {
	return filepath.Join(DataDir(), "scrollback")
}

func LoadNetworkConfig() NetworkConfig {
	defaults := NetworkConfig{Host: DefaultHost, Port: DefaultPort}
	data, err := os.ReadFile(ConfigPath())
	if err != nil {
		return defaults
	}
	var cfg NetworkConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return defaults
	}
	if cfg.Host == "" {
		cfg.Host = defaults.Host
	}
	if cfg.Port <= 0 || cfg.Port > 65535 {
		cfg.Port = defaults.Port
	}
	return cfg
}

func SaveNetworkConfig(cfg NetworkConfig) error {
	if err := os.MkdirAll(DataDir(), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(ConfigPath(), append(data, '\n'), 0o644)
}
