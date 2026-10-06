#!/usr/bin/env bash
# Makes the personal skills-library (rrangelsegura/skills-library) available in
# cloud sessions, mirroring what tools/install.ps1 does locally with junctions:
# the repo is the single source of truth and ~/.claude/skills/<name> links to it.
# Never blocks the session: any failure only prints a warning.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

REPO_URL="${SKILLS_LIBRARY_URL:-https://github.com/rrangelsegura/skills-library}"
LIB_DIR="${SKILLS_LIBRARY_DIR:-/home/user/skills-library}"
TARGET="$HOME/.claude/skills"

if [ -d "$LIB_DIR/.git" ]; then
  # Fast-forward only: never touch uncommitted or unpushed work done in the cloud.
  if [ -z "$(git -C "$LIB_DIR" status --porcelain)" ]; then
    git -C "$LIB_DIR" pull --ff-only --quiet 2>/dev/null \
      || echo "[skills] WARNING: could not update $LIB_DIR (using existing copy)"
  else
    echo "[skills] $LIB_DIR has local changes: skipping pull (commit and push them)"
  fi
elif [ ! -e "$LIB_DIR" ]; then
  git clone --depth 1 --quiet "$REPO_URL" "$LIB_DIR" 2>/dev/null \
    || { echo "[skills] WARNING: could not clone skills-library; attach the repo to this cloud environment/session"; exit 0; }
else
  echo "[skills] WARNING: $LIB_DIR exists and is not a git clone; skipping"; exit 0
fi

mkdir -p "$TARGET"
linked=0
for dir in "$LIB_DIR"/skills/*/; do
  name="$(basename "$dir")"
  [ -f "$dir/SKILL.md" ] || continue
  dest="$TARGET/$name"
  # Only manage our own links; never overwrite a real directory.
  if [ -L "$dest" ] || [ ! -e "$dest" ]; then
    ln -sfn "${dir%/}" "$dest" && linked=$((linked + 1))
  fi
done
# Drop links whose skill was removed from the library.
for link in "$TARGET"/*; do
  [ -L "$link" ] && [ ! -e "$link" ] && rm -f "$link"
done
echo "[skills] skills-library linked: $linked skills"
exit 0
