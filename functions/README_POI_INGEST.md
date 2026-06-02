POI Ingestion Guide
===================

This guide shows a minimal, repeatable pipeline to ingest OpenStreetMap POIs into PostGIS using Geofabrik extracts and `osm2pgsql`.

Prereqs
- A Postgres/PostGIS database (Postgres >=12, PostGIS installed)
- `osm2pgsql` installed (recommended latest stable)
- `psql` client
- Enough disk space for PBFs and the DB import (country extracts: 100s MB → several GB depending on region)

1) Download a Geofabrik extract (example: california-latest.osm.pbf)

```bash
mkdir -p ~/osmdata && cd ~/osmdata
curl -O https://download.geofabrik.de/north-america/us/california-latest.osm.pbf
```

2) Import into PostGIS using `osm2pgsql` (example options)

```bash
# create DB and enable PostGIS
createdb gis
psql -d gis -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS hstore;"

# Import PBF into DB (slim mode recommended for large imports)
osm2pgsql --create --slim -d gis --hstore --prefix planet --number-processes 2 --cache 2000 california-latest.osm.pbf
```

Notes:
- `--hstore` stores raw tags in a `tags` hstore column; useful to filter by tag keys like `shop`, `amenity`, `office`.
- `--prefix planet` will create tables like `planet_point`, `planet_line`, `planet_polygon`, but many deployments use `planet_osm_point` depending on version. Inspect your DB after import.

3) Extract POIs into a compact `pois` table (example SQL)

Create a file `functions/sql/create_pois_table.sql` (provided in this repo). Run:

```bash
psql -d gis -f functions/sql/create_pois_table.sql
```

This will create a `pois` table with columns: `id,name,category,lat,lon,geom,popularity` and appropriate spatial indexes.

4) Keep data fresh
- Use Osmium replication or periodic re-imports. For production, set up diffs with `osmium` or `osm2pgsql` replication to apply minute/hourly diffs.

5) Serve POIs
- The Cloud Function API (`/api/pois/nearby`) queries the `pois` table. Ensure your `POIS_DB_URL` environment variable points to the `gis` DB.

License / Attribution
- OSM data is provided under the ODbL license. Ensure you include required attribution in your UI (e.g., “© OpenStreetMap contributors”) and comply with share-alike if you publish derived datasets.
