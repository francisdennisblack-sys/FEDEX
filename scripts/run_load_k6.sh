#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${1:-http://localhost:3000}
if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 not found. Install from https://k6.io/ or run via Docker."
  exit 2
fi
k6 run -e BASE_URL="$BASE_URL" scripts/k6_load_test.js
