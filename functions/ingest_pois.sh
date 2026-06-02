#!/usr/bin/env bash
set -euo pipefail

# Simple helper script to ingest a Geofabrik PBF into PostGIS and create the `pois` table.
# Edit variables below for your environment.

PBF_FILE="${1:-california-latest.osm.pbf}"   # pass path as first arg or default
DB_NAME="${2:-gis}"
OSM_PREFIX="planet"

echo "Ingesting ${PBF_FILE} into DB ${DB_NAME}"

echo "Ensure DB exists and PostGIS + hstore extensions are enabled"
psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS hstore;"

echo "Running osm2pgsql import (slim, hstore)"
osm2pgsql --create --slim -d "$DB_NAME" --hstore --prefix "$OSM_PREFIX" --number-processes 2 --cache 2000 "$PBF_FILE"

echo "Creating compact pois table (SQL will use table ${OSM_PREFIX}_point)
psql -d "$DB_NAME" -f functions/sql/create_pois_table.sql

echo "Done. Run: psql -d $DB_NAME -c 'SELECT count(*) FROM pois;' to validate."
