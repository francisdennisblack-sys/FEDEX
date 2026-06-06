Operational quickstart

Run the server locally:

```bash
node server.js
```

Run smoke tests:

```bash
scripts/run_smoke.sh http://localhost:3000
```

Run load test (requires `k6`):

```bash
scripts/run_load_k6.sh http://localhost:3000
```

Collect ML training data: events are written to `ml/data/events.jsonl` by the metrics endpoints.

Train a simple model (optional, requires Python and scikit-learn):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 ml/train_model.py --input ml/data/events.jsonl --output ml/model.json
```

Admin authentication

Set an admin password to protect admin APIs:

```bash
export ADMIN_PASSWORD="<strong-password>"
```

For legacy development only, you can allow the weak fallback password by setting:

```bash
export ALLOW_WEAK_ADMIN=1
```

Reload ML scorer plugin on the running server (admin password required):

```bash
curl -X POST -H "Content-Type: application/json" -H "x-admin-password: ${ADMIN_PASSWORD}" http://localhost:3000/api/admin/reload-ml
```

Load a trained JSON model and enable ML scoring:

```bash
curl -X POST -H "Content-Type: application/json" -H "x-admin-password: 19696" http://localhost:3000/api/admin/load-model
curl -X POST -H "Content-Type: application/json" -H "x-admin-password: 19696" http://localhost:3000/api/admin/enable-ml
```

Run an auto-retrain-and-reload (trains, uploads, and enables canary zone):

```bash
scripts/auto_retrain_and_reload.sh http://localhost:3000 19696
```

Notes
- The server will attempt to load `ml/scorer.js` if present and use its `score(post)` export when computing best posts.
- For production, replace the weak admin password in `server.js` and move to a secrets store.
