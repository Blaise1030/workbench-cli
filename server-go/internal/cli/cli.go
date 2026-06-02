package cli

import (
	"fmt"

	"github.com/blaisetiong/workbench-cli/server-go/internal/server"
)

func Execute(argv []string) error {
	if len(argv) > 0 && argv[0] == "notify" {
		return RunNotify(argv[1:])
	}

	cfg, err := ParseArgs(argv)
	if err != nil {
		return fmt.Errorf("argument error: %w", err)
	}
	if cfg.ShowHelp {
		fmt.Print(helpText)
		return nil
	}
	return server.Run(server.Config{
		Port:      cfg.Port,
		Host:      cfg.Host,
		ForceHTTP: cfg.ForceHTTP,
		AssumeYes: cfg.AssumeYes,
	})
}
