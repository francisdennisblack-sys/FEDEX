#!/usr/bin/env bash
set -euo pipefail
PY=${PY:-python3}
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "$PY not found"
  exit 2
fi
$PY ml/train_model.py --input ml/data/events.jsonl --output ml/model.json
