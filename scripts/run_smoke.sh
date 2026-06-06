#!/usr/bin/env bash
set -euo pipefail
BASE_URL=${1:-http://localhost:3000}

echo "Checking /api/status..."
curl -sS "$BASE_URL/api/status" | jq .

echo "Fetching top-liked..."
curl -sS "$BASE_URL/api/posts/top-liked?limit=5" | jq .

echo "Fetching best for test zone 'test-zone'..."
curl -sS "$BASE_URL/api/posts/best/test-zone" | jq .

echo "Done."
