package tlsutil

import (
	"crypto/tls"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

type Credentials struct {
	Cert tls.Certificate
}

func certPaths(cacheDir string, hosts []string) (certFile, keyFile string) {
	base := hosts[len(hosts)-1]
	return filepath.Join(cacheDir, base+".pem"),
		filepath.Join(cacheDir, base+"-key.pem")
}

func IsMkcertInstalled() bool {
	_, err := exec.LookPath("mkcert")
	return err == nil
}

func installMkcert() error {
	switch runtime.GOOS {
	case "darwin":
		fmt.Println("  Installing mkcert via brew...")
		return exec.Command("brew", "install", "mkcert").Run()
	case "linux":
		fmt.Println("  Installing mkcert via apt...")
		return exec.Command("sudo", "apt-get", "install", "-y", "mkcert").Run()
	default:
		return fmt.Errorf("mkcert not found. Install manually: https://github.com/FiloSottile/mkcert#installation")
	}
}

type EnsureOptions struct {
	AutoInstall     bool
	ConfirmInstall  func() (bool, error)
}

func EnsureTLS(hosts []string, opts EnsureOptions) (*Credentials, error) {
	if len(hosts) == 0 {
		return nil, fmt.Errorf("ensureTLS requires at least one host")
	}
	if !IsMkcertInstalled() {
		if !opts.AutoInstall {
			return nil, fmt.Errorf("mkcert not found. Install manually: https://github.com/FiloSottile/mkcert#installation")
		}
		ok := true
		if opts.ConfirmInstall != nil {
			var err error
			ok, err = opts.ConfirmInstall()
			if err != nil {
				return nil, err
			}
		}
		if !ok {
			return nil, fmt.Errorf("mkcert is not installed. Install manually: https://github.com/FiloSottile/mkcert#installation")
		}
		if err := installMkcert(); err != nil {
			return nil, err
		}
	}

	// Install local CA (idempotent)
	if err := exec.Command("mkcert", "-install").Run(); err != nil {
		return nil, fmt.Errorf("mkcert -install: %w", err)
	}

	home, _ := os.UserHomeDir()
	cacheDir := filepath.Join(home, ".workbench", "certs")
	if err := os.MkdirAll(cacheDir, 0o755); err != nil {
		return nil, err
	}
	certFile, keyFile := certPaths(cacheDir, hosts)

	if _, err := os.Stat(certFile); os.IsNotExist(err) {
		args := []string{"-cert-file", certFile, "-key-file", keyFile}
		args = append(args, hosts...)
		fmt.Printf("  Generating cert for %v...\n", hosts)
		if err := exec.Command("mkcert", args...).Run(); err != nil {
			return nil, fmt.Errorf("mkcert generate: %w", err)
		}
	}

	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, fmt.Errorf("load cert: %w", err)
	}
	return &Credentials{Cert: cert}, nil
}

func IsLocalhostOnly(hosts []string) bool {
	for _, h := range hosts {
		if h != "localhost" && h != "127.0.0.1" {
			return false
		}
	}
	return true
}
