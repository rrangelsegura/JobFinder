#!/bin/bash
# SessionStart hook for Claude Code cloud sessions.
#   1. Runs only in a cloud session ($CLAUDE_CODE_REMOTE=true).
#   2. Installs the OpenSpec CLI (`openspec`) if it is missing.
#   3. Makes Rene's own skills library (rrangelsegura/skills-library) available
#      by cloning it and linking each skill into ~/.claude/skills/.
# Idempotent and non-interactive. A failure in step 2 or 3 never blocks the
# session: it logs a warning and carries on.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

OPENSPEC_PACKAGE="@fission-ai/openspec"
SKILLS_REPO_URL="${SKILLS_LIBRARY_URL:-https://github.com/rrangelsegura/skills-library}"
SKILLS_LIBRARY_DIR="${SKILLS_LIBRARY_DIR:-$HOME/skills-library}"
SKILLS_TARGET_DIR="$HOME/.claude/skills"

log() { echo "[session-start] $*" >&2; }

install_openspec() {
  if command -v openspec >/dev/null 2>&1; then
    log "openspec already installed ($(openspec --version 2>/dev/null))"
    return 0
  fi
  log "installing $OPENSPEC_PACKAGE ..."
  if npm install -g "$OPENSPEC_PACKAGE" >/dev/null 2>&1 && command -v openspec >/dev/null 2>&1; then
    log "openspec installed ($(openspec --version 2>/dev/null))"
  else
    log "WARNING: could not install $OPENSPEC_PACKAGE (network or npm problem)"
    return 1
  fi
}

link_skills_library() {
  if [ -d "$SKILLS_LIBRARY_DIR/.git" ]; then
    log "updating skills library in $SKILLS_LIBRARY_DIR"
    timeout 120 git -C "$SKILLS_LIBRARY_DIR" pull --ff-only --depth 1 -q 2>/dev/null \
      || log "WARNING: could not update the skills library; using the existing clone"
  else
    log "cloning skills library from $SKILLS_REPO_URL"
    if ! timeout 300 git clone --depth 1 -q "$SKILLS_REPO_URL" "$SKILLS_LIBRARY_DIR" 2>/dev/null; then
      log "WARNING: could not clone $SKILLS_REPO_URL. It is private and this session's GitHub access only covers the repositories selected when the session started. Start a new session with rrangelsegura/skills-library selected (or attach it with add_repo), and make sure GitHub is connected at https://claude.ai/connect-github."
      return 1
    fi
  fi

  mkdir -p "$SKILLS_TARGET_DIR"
  local linked=0 skill_dir name target
  for skill_dir in "$SKILLS_LIBRARY_DIR"/skills/*/; do
    [ -f "${skill_dir}SKILL.md" ] || continue
    name="$(basename "$skill_dir")"
    target="$SKILLS_TARGET_DIR/$name"
    # Never overwrite a real directory or a link that points somewhere else.
    if [ -e "$target" ] && [ ! -L "$target" ]; then continue; fi
    ln -sfn "${skill_dir%/}" "$target"
    linked=$((linked + 1))
  done
  log "skills library linked: $linked skills available in $SKILLS_TARGET_DIR"
}

install_openspec
link_skills_library
exit 0
