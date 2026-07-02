#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
CERT_DIR="$ROOT_DIR/.certs"
HOST_DOMAIN="${1:-wificontent.local}"
HTTP_PORT="${HTTP_PORT:-5001}"
HTTPS_PORT="${HTTPS_PORT:-5443}"
CERT_FILE="$CERT_DIR/$HOST_DOMAIN.pem"
KEY_FILE="$CERT_DIR/$HOST_DOMAIN-key.pem"
SERVER_PID_FILE="$RUN_DIR/server-$HTTP_PORT.pid"
PROXY_PID_FILE="$RUN_DIR/https-proxy-$HTTPS_PORT.pid"
SERVER_LOG="$RUN_DIR/server-$HTTP_PORT.log"
PROXY_LOG="$RUN_DIR/https-proxy-$HTTPS_PORT.log"

mkdir -p "$RUN_DIR"

if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "[run] Missing cert/key for $HOST_DOMAIN. Running setup first..."
  "$ROOT_DIR/scripts/setup_safari_local_profile.sh" "$HOST_DOMAIN"
fi

if lsof -iTCP:"$HTTP_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "[run] App server already listening on :$HTTP_PORT"
else
  echo "[run] Starting app server on :$HTTP_PORT"
  (
    cd "$ROOT_DIR"
    nohup node server.js >"$SERVER_LOG" 2>&1 &
    echo $! > "$SERVER_PID_FILE"
  )
fi

if lsof -iTCP:"$HTTPS_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "[run] HTTPS proxy already listening on :$HTTPS_PORT"
else
  echo "[run] Starting HTTPS proxy :$HTTPS_PORT -> :$HTTP_PORT"
  (
    cd "$ROOT_DIR"
    nohup npx --yes local-ssl-proxy \
      --source "$HTTPS_PORT" \
      --target "$HTTP_PORT" \
      --cert "$CERT_FILE" \
      --key "$KEY_FILE" >"$PROXY_LOG" 2>&1 &
    echo $! > "$PROXY_PID_FILE"
  )
fi

sleep 1

TARGET_URL="https://$HOST_DOMAIN:$HTTPS_PORT"
if ! dscacheutil -q host -a name "$HOST_DOMAIN" | grep -q "ip_address: 127.0.0.1"; then
  TARGET_URL="https://localhost:$HTTPS_PORT"
  echo "[run] Hosts entry for $HOST_DOMAIN not detected; using localhost fallback"
fi

echo "[run] Opening Safari: $TARGET_URL"
open -a Safari "$TARGET_URL"

echo "[run] Safari-like local profile is up"
echo "[run] URL: $TARGET_URL"
echo "[run] For private test: open a Private Window in Safari at the same URL"
echo "[run] To stop: ./scripts/stop_safari_like_local.sh"
