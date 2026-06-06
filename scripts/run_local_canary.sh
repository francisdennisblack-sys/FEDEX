#!/usr/bin/env bash
set -euo pipefail
PROD_URL=${1:-http://localhost:5001}
CANARY_PORT=${2:-5002}
ADMIN_PASS=${3:-19696}
CANARY_DB=${4:-wifi_database_canary.json}
CANARY_URL="http://localhost:${CANARY_PORT}"

echo "Preparing local canary using DB ${CANARY_DB} on ${CANARY_URL}"
# copy database
cp -a wifi_database.json ${CANARY_DB}

# start canary server
echo "Starting canary server..."
DB_PATH=${CANARY_DB} PORT=${CANARY_PORT} ADMIN_PASSWORD=${ADMIN_PASS} node server.js > canary.log 2>&1 &
CANARY_PID=$!
sleep 1

# wait for canary to be ready
for i in {1..30}; do
  if curl -s ${CANARY_URL}/api/status >/dev/null 2>&1; then
    echo "Canary server is up"
    break
  fi
  sleep 1
done

if ! curl -s ${CANARY_URL}/api/status >/dev/null 2>&1; then
  echo "Canary server failed to start. Check canary.log"
  kill ${CANARY_PID} || true
  exit 2
fi

# Run smoke tests against canary
echo "Running smoke tests against canary..."
bash scripts/run_smoke.sh ${CANARY_URL}

# Run lightweight load test against canary
echo "Running lightweight load test against canary..."
bash scripts/run_load_node.sh ${CANARY_URL} 10 5

# Auto retrain and reload model on canary
echo "Auto retrain and reload on canary..."
bash scripts/auto_retrain_and_reload.sh ${CANARY_URL} ${ADMIN_PASS}

# Post-check: run smoke again
echo "Post-retrain smoke test..."
bash scripts/run_smoke.sh ${CANARY_URL}

# If all good, promote canary by enabling ML-zone on production
echo "Promoting canary: enabling ML for test-zone on production ${PROD_URL}"
PROMOTE_OK=1
PROMOTE_RESP=$(curl -s -X POST -H "Content-Type: application/json" -H "x-admin-password: ${ADMIN_PASS}" -d '{"zoneId":"test-zone"}' "${PROD_URL}/api/admin/enable-ml-zone" || true)
if echo "${PROMOTE_RESP}" | jq . >/dev/null 2>&1; then
  echo "Promotion response:"
  echo "${PROMOTE_RESP}" | jq .
  if [ "$(echo "${PROMOTE_RESP}" | jq -r '.success // empty')" != "true" ]; then
    echo "Promotion did not report success"
    PROMOTE_OK=0
  fi
else
  echo "Promotion returned non-JSON response:"
  echo "${PROMOTE_RESP}"
  PROMOTE_OK=0
fi

# Cleanup: stop canary server and remove canary DB
echo "Stopping canary server (PID ${CANARY_PID})"
kill ${CANARY_PID} || true
sleep 1
rm -f ${CANARY_DB}

if [ "${PROMOTE_OK:-1}" -ne 1 ]; then
  echo "Canary promotion failed. See output above."; exit 5
fi

echo "Local canary flow completed."
