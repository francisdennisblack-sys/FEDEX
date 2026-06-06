#!/usr/bin/env bash
set -euo pipefail
BASE=${1:-http://localhost:5001}
ADMIN_PASS=${2:-19696}

# 1) Create a new post in zone 'zone-A'
resp=$(curl -s -X POST -H "Content-Type: application/json" -d '{"zoneId":"zone-A","content":"E2E test post","clientId":"e2e-1"}' ${BASE}/api/posts)
echo "Created post: $resp"
postId=$(echo "$resp" | jq -r '.post.id')

# 2) Fetch best for zone-A
echo "Best for zone-A before retag:" 
curl -s ${BASE}/api/posts/best/zone-A | jq .

# 3) Delete post then recreate in test-zone (simulate retag)
curl -s -X DELETE ${BASE}/api/posts/${postId} | jq .
resp2=$(curl -s -X POST -H "Content-Type: application/json" -d '{"zoneId":"test-zone","content":"E2E test post","providedPostId":"'${postId}'"}' ${BASE}/api/posts)
echo "Recreated in test-zone: $resp2"

# 4) Force refresh best on server
curl -s -X POST -H "Content-Type: application/json" -H "x-admin-password: ${ADMIN_PASS}" ${BASE}/api/admin/refresh-best | jq .

# 5) Check best for both zones
echo "Best for zone-A after retag:" 
curl -s ${BASE}/api/posts/best/zone-A | jq .
echo "Best for test-zone after retag:" 
curl -s ${BASE}/api/posts/best/test-zone | jq .

echo "Verify retag end-to-end completed."
