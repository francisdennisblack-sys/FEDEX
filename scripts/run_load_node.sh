#!/usr/bin/env bash
set -euo pipefail
BASE=${1:-http://localhost:5001}
CONCURRENCY=${2:-20}
DURATION=${3:-10}
BASE_URL="$BASE" CONCURRENCY="$CONCURRENCY" DURATION="$DURATION" node scripts/load_test_node.js
