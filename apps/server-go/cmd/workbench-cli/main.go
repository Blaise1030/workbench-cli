package main

import (
	"log/slog"
	"os"

	"github.com/blaisetiong/workbench-cli/server-go/internal/cli"
)

func main() {
	if err := cli.Execute(os.Args[1:]); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}
