#!/usr/bin/env bash
# Simple autosave auto-commit script for local workspaces
# Usage: run from repository root or with absolute path. Example:
#   nohup ./scripts/auto_commit.sh 60 >/tmp/auto_commit.log 2>&1 &

INTERVAL_SECONDS=${1:-60}
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

echo "[auto-commit] starting in $REPO_ROOT (interval=$INTERVAL_SECONDS s)"

while true; do
  # Only attempt git if this is a git repo
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # Check for changes
    if ! git diff --quiet --ignore-submodules --; then
      # Stage all changes, but avoid failing if nothing to add
      git add -A || true
      # Commit with timestamp if there are staged changes
      if ! git diff --cached --quiet --ignore-submodules --; then
        GIT_MSG="autosave: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        git commit -m "$GIT_MSG" || true
        echo "[auto-commit] committed: $GIT_MSG"
      fi
    fi
  else
    echo "[auto-commit] not a git repo: $REPO_ROOT"
    exit 1
  fi
  sleep "$INTERVAL_SECONDS"
done
