package cli

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/blaisetiong/workbench-cli/server-go/internal/config"
)

type Config struct {
	Port      int
	Host      string
	ForceHTTP bool
	AssumeYes bool
	ShowHelp  bool
}

var helpText = fmt.Sprintf(`workbench-cli — local dev workbench in the browser

Usage:
  workbench-cli [options]

Options:
  -p, --port <number>   Port (default: %d, or PORT env, or ~/.workbench/config.json)
  --host <hostname>     Local hostname (default: %s, or WORKBENCH_HOST env)
  --http, --insecure    Serve HTTP on localhost only (no mkcert)
  -y, --yes             Install mkcert without prompting if missing
  -h, --help            Show this help

HTTPS uses mkcert for trusted local certificates. HTTP mode skips mkcert.
Without --yes, the CLI asks before installing mkcert.

Add to /etc/hosts once: 127.0.0.1 %s
`, config.DefaultPort, config.DefaultHost, config.DefaultHost)

func ParseArgs(argv []string) (Config, error) {
	fileCfg := config.LoadNetworkConfig()

	port := fileCfg.Port
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			port = p
		}
	}

	host := fileCfg.Host
	if envHost := strings.TrimSpace(os.Getenv("WORKBENCH_HOST")); envHost != "" {
		host = envHost
	}

	var forceHTTP, assumeYes, showHelp bool

	for i := 0; i < len(argv); i++ {
		arg := argv[i]
		switch arg {
		case "--help", "-h":
			showHelp = true
		case "--yes", "-y":
			assumeYes = true
		case "--http", "--insecure":
			forceHTTP = true
		case "--port", "-p":
			i++
			if i >= len(argv) {
				return Config{}, fmt.Errorf("missing value for --port")
			}
			p, err := strconv.Atoi(argv[i])
			if err != nil {
				return Config{}, fmt.Errorf("invalid port: %s", argv[i])
			}
			port = p
		case "--host":
			i++
			if i >= len(argv) {
				return Config{}, fmt.Errorf("missing value for --host")
			}
			host = argv[i]
		default:
			if strings.HasPrefix(arg, "-") {
				return Config{}, fmt.Errorf("unknown option: %s", arg)
			}
		}
	}

	return Config{
		Port:      port,
		Host:      host,
		ForceHTTP: forceHTTP,
		AssumeYes: assumeYes,
		ShowHelp:  showHelp,
	}, nil
}
