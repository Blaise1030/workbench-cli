#!/bin/sh
# Install workbench-cli from GitHub Releases (manifest served via GitHub Pages).
#
#   curl -fsSL https://blaise1030.github.io/workbench-cli/install.sh | sh
#
# Override install dir:  WORKBENCH_INSTALL_DIR=~/bin sh
# Override manifest URL: WORKBENCH_MANIFEST_URL=https://.../latest.json sh

set -eu

BIN="workbench-cli"
MANIFEST_URL="${WORKBENCH_MANIFEST_URL:-https://blaise1030.github.io/workbench-cli/latest.json}"
INSTALL_DIR="${WORKBENCH_INSTALL_DIR:-$HOME/.local/bin}"

main() {
  echo ""
  echo "  workbench-cli installer"
  echo "  https://github.com/Blaise1030/workbench-cli"
  echo ""

  OS="$(uname -s)"
  case "$OS" in
    Linux)  os="linux" ;;
    Darwin) os="macos" ;;
    *)      err "unsupported OS: $OS (Linux and macOS only)" ;;
  esac

  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64)   arch="x86_64" ;;
    aarch64|arm64)  arch="aarch64" ;;
    *)              err "unsupported architecture: $ARCH" ;;
  esac

  TARGET="${os}-${arch}"
  log "detected ${TARGET}"

  need curl
  need tar
  need awk

  log "fetching latest release manifest..."
  MANIFEST="$(curl -fsSL --retry 3 --connect-timeout 10 --max-time 20 "$MANIFEST_URL")" \
    || err "can't reach ${MANIFEST_URL} — check your network or try again later"

  URL="$(printf '%s\n' "$MANIFEST" | awk -v target="\"${TARGET}\"" '
    /^[[:space:]]*"assets"[[:space:]]*:/ { in_assets = 1; next }
    in_assets && /^[[:space:]]*}/ { exit }
    in_assets && index($0, target) {
      sub(/^.*:[[:space:]]*"/, "")
      sub(/".*$/, "")
      print
      exit
    }
  ')"

  VERSION="$(printf '%s\n' "$MANIFEST" | awk -F '"' '/^[[:space:]]*"version"[[:space:]]*:/ { print $4; exit }')"

  if [ -z "$URL" ]; then
    err "no release asset for ${TARGET} — see https://github.com/Blaise1030/workbench-cli/releases"
  fi

  if [ -n "$VERSION" ]; then
    log "downloading v${VERSION}..."
  else
    log "downloading latest release..."
  fi

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  ARCHIVE="${TMP}/release.tar.gz"
  if ! curl -fsSL --retry 3 --connect-timeout 10 --max-time 120 "$URL" -o "$ARCHIVE"; then
    err "download failed from ${URL}"
  fi

  EXTRACT="${TMP}/extract"
  mkdir -p "$EXTRACT"
  if ! tar xzf "$ARCHIVE" -C "$EXTRACT"; then
    err "failed to extract ${URL}"
  fi

  SRC="$(find "$EXTRACT" -maxdepth 1 -type f ! -name '.*' | head -1)"
  if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
    err "archive did not contain a binary"
  fi

  mkdir -p "$INSTALL_DIR"
  mv "$SRC" "${INSTALL_DIR}/${BIN}"
  chmod +x "${INSTALL_DIR}/${BIN}"

  log "installed ${BIN} → ${INSTALL_DIR}/${BIN}"

  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      echo ""
      warn "${INSTALL_DIR} is not in your PATH"
      echo "  add to your shell config:"
      echo ""
      echo "    export PATH=\"${INSTALL_DIR}:\$PATH\""
      echo ""
      ;;
  esac

  if command -v "$BIN" >/dev/null 2>&1; then
    echo ""
    log "ready — run: ${BIN} --http"
  fi
  echo ""
}

log()  { printf '  \033[32m>\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
err()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "requires '$1' — install it first, or download manually from https://github.com/Blaise1030/workbench-cli/releases"
  fi
}

main "$@"
