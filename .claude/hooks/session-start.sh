#!/usr/bin/env bash
# Installs project dependencies from the manifests committed in git, so any
# environment (cloud or local) rebuilds the same libraries from the same source.
# Runs only in Claude Code cloud sessions; idempotent (cached by manifest hash).
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

install_node() {
  local dir="$1"
  [ -f "$dir/package-lock.json" ] || return 0
  local stamp="$dir/node_modules/.manifest-hash"
  local hash; hash="$(sha256sum "$dir/package-lock.json" | cut -d' ' -f1)"
  if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$hash" ]; then
    echo "[deps] $dir: up to date"; return 0
  fi
  echo "[deps] $dir: npm ci"
  (cd "$dir" && npm ci --no-audit --no-fund) && echo "$hash" > "$stamp" \
    || echo "[deps] WARNING: npm ci failed in $dir"
}

install_python() {
  local req="backend/requirements.txt"
  [ -f "$req" ] || return 0
  local venv=".venv"
  local stamp="$venv/.manifest-hash"
  local hash; hash="$(sha256sum "$req" | cut -d' ' -f1)"
  if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$hash" ]; then
    echo "[deps] python: up to date"; return 0
  fi
  echo "[deps] python: pip install"
  [ -d "$venv" ] || python3 -m venv "$venv"
  "$venv/bin/pip" install --quiet -r "$req" && echo "$hash" > "$stamp" \
    || echo "[deps] WARNING: pip install failed"
}

install_node backend
install_node frontend
install_python

if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -d "$ROOT/.venv/bin" ]; then
  echo "export PATH=\"$ROOT/.venv/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
exit 0
