Project finalization notes

What I did:
- Fetched OSM place data for all 50 US states into `pois/osm/`
- Created per-state shards `pois/states/`
- Merged shards into `pois/manifest.json`, `pois/search-index.json`, `pois/places.json`
- Patched `index.html` to prefer `pois/search-index.json` as the primary POI source
- Added `smoke_nearest_poi.js` to verify nearest-POI lookup from `search-index.json`

Quick checks you can run locally:

1) Smoke test (Node):

```bash
cd /path/to/Fedex
node smoke_nearest_poi.js
```

2) Serve the site locally (to let `index.html` fetch `pois/search-index.json`):

```bash
# Python 3
python3 -m http.server 8000
# or using Node's serve package
npx serve . -l 8000
```

Then open http://localhost:8000/index.html and verify in DevTools console you see "Loaded POIs from pois/search-index.json".

Deployment notes:
- Upload the entire `pois/` folder and `master_*` files to your static hosting or CDN.
- Ensure `index.html` can fetch `/pois/search-index.json` at the same origin or via CORS if hosted separately.
- Periodically re-run `fetch_osm_state_data.js` + `create_shards_from_osm.js` + `merge_osm_into_shards.js` to refresh POIs.

Local geosearch server (optional):

You can run a small local geosearch server to offload nearest-N queries instead of performing them in the browser worker.

```bash
node geosearch_server.js
# then query:
curl 'http://localhost:3030/search?lat=37.7749&lon=-122.4194&n=10'
```

Client worker:

- A simple WebWorker (`poi_worker.js`) is included and the client will spawn it when `pois/search-index.json` is loaded. The Worker answers nearest-N queries off the main thread.
- Ensure your static server serves `poi_worker.js` at the web root (it's in the repo root).

Next steps you may want:
- Add a small server-side API to serve a trimmed geospatial index for low-memory clients.
- Implement incremental loading in `index.html` to load only nearby index tiles.

