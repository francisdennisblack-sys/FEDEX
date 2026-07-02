#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"

kill_from_pid_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && ps -p "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
      echo "[stop] Stopped PID $pid from $(basename "$file")"
    fi
    rm -f "$file"
  fi
}

kill_from_pid_file "$RUN_DIR/server-5001.pid"
kill_from_pid_file "$RUN_DIR/https-proxy-5443.pid"

echo "[stop] Done"
