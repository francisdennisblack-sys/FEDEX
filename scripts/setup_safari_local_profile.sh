#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT_DIR/.certs"
RUN_DIR="$ROOT_DIR/.run"
HOST_DOMAIN="${1:-wificontent.local}"
HOST_IP="127.0.0.1"
CERT_FILE="$CERT_DIR/$HOST_DOMAIN.pem"
KEY_FILE="$CERT_DIR/$HOST_DOMAIN-key.pem"

mkdir -p "$CERT_DIR" "$RUN_DIR"

echo "[setup] Root: $ROOT_DIR"
echo "[setup] Domain: $HOST_DOMAIN"

if grep -Eq "^[[:space:]]*$HOST_IP[[:space:]]+$HOST_DOMAIN([[:space:]]|$)" /etc/hosts; then
  echo "[setup] /etc/hosts already contains: $HOST_IP $HOST_DOMAIN"
else
  echo "[setup] Missing hosts entry: $HOST_IP $HOST_DOMAIN"
  echo "[setup] Add it with:"
  echo "        echo '$HOST_IP $HOST_DOMAIN' | sudo tee -a /etc/hosts"
fi

if command -v mkcert >/dev/null 2>&1; then
  echo "[setup] mkcert found, generating trusted local certificate"
  if ! mkcert -install; then
    echo "[setup] mkcert trust install may need manual approval in Keychain"
  fi
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "$HOST_DOMAIN" localhost 127.0.0.1
else
  echo "[setup] mkcert not found; generating self-signed cert via openssl"
  echo "[setup] Safari may show trust warnings until cert is trusted manually"

  TMP_CONF="$RUN_DIR/openssl-$HOST_DOMAIN.cnf"
  cat > "$TMP_CONF" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = $HOST_DOMAIN

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = $HOST_DOMAIN
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "$KEY_FILE" -out "$CERT_FILE" -config "$TMP_CONF" >/dev/null 2>&1

  rm -f "$TMP_CONF"
fi

echo "[setup] Certificate ready: $CERT_FILE"
echo "[setup] Key ready:         $KEY_FILE"
echo "[setup] Next: ./scripts/run_safari_like_local.sh $HOST_DOMAIN"
