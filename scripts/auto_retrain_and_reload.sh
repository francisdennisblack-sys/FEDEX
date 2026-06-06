#!/usr/bin/env bash
set -euo pipefail
BASE=${1:-http://localhost:5001}
ADMIN_PASS=${2:-19696}

# Train model (local)
bash scripts/run_ml_train.sh

# POST to load model
curl -s -X POST -H "Content-Type: application/json" -H "x-admin-password: ${ADMIN_PASS}" ${BASE}/api/admin/load-model | jq .
# enable ML globally (optional) - by default enable only canary zone set below
# curl -s -X POST -H "Content-Type: application/json" -H "x-admin-password: ${ADMIN_PASS}" ${BASE}/api/admin/enable-ml | jq .

# Example: enable model for 'test-zone' only (canary)
curl -s -X POST -H "Content-Type: application/json" -H "x-admin-password: ${ADMIN_PASS}" -d '{"zoneId":"test-zone"}' ${BASE}/api/admin/enable-ml-zone | jq .

echo "Auto retrain and reload completed. Model loaded and test-zone enabled for ML scoring."
