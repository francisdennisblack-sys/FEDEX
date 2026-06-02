#!/usr/bin/env bash
set -euo pipefail

# Provision a Ubuntu 22.04+ VM for PostGIS + osm2pgsql POI ingestion
# Run as root (or with sudo) on the target server.

# Usage:
#   sudo ./provision_poi_server.sh <db_user> <db_password> <db_name>
# Example:
#   sudo ./provision_poi_server.sh fedex fedexpwd gis

DB_USER="${1:-fedex}"
DB_PASS="${2:-fedexpass}"
DB_NAME="${3:-gis}"

echo "Provisioning PostGIS server (DB: $DB_NAME, user: $DB_USER)"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  build-essential ca-certificates curl wget gnupg lsb-release software-properties-common \
  postgresql postgresql-contrib postgis postgresql-14-postgis-3 osmctools osmium-tool osm2pgsql

# Additional tools for large imports (optional): osmium, osm2pgsql may be newer via PPA
if ! command -v osm2pgsql >/dev/null 2>&1; then
  echo "osm2pgsql not found from apt; consider installing from packagecloud or building from source."
fi

systemctl enable --now postgresql

sudo -u postgres psql -v ON_ERROR_STOP=1 <<-PSQL
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
\connect ${DB_NAME}
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS hstore;
PSQL

echo "Database ${DB_NAME} created with user ${DB_USER}"

cat > /root/ingest_pois_readme.txt <<-EOF
Ingesting OSM PBF into PostGIS (quick steps)

1) Upload your .pbf to the server, e.g. /root/california-latest.osm.pbf
2) Run osm2pgsql in slim mode (adjust cache and processes for available RAM):

   osm2pgsql --create --slim -d ${DB_NAME} --hstore --number-processes 2 --cache 2000 /root/california-latest.osm.pbf

3) After import, create compact `pois` table using the SQL in your repo: functions/sql/create_pois_table.sql

   psql -d ${DB_NAME} -f /srv/fedex/functions/sql/create_pois_table.sql

4) Secure access: create firewall rules to only allow your application host and set POIS_DB_URL accordingly.

EOF

echo "Provision complete. See /root/ingest_pois_readme.txt for ingest instructions."
