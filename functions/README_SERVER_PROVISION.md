Server provisioning for POI ingestion
===================================

This document explains how to provision a dedicated Ubuntu server to host PostGIS and run `osm2pgsql` ingestion for the `pois` dataset.

Quick steps
1. Create an Ubuntu 22.04 (or later) VM with at least 8-16GB RAM and disk space (PBFs and Postgres index may require tens to hundreds of GB depending on region).
2. SSH into the VM and copy `provision_poi_server.sh` from this repo.
3. Run the script as root: `sudo ./provision_poi_server.sh <db_user> <db_password> <db_name>`
4. Upload your Geofabrik PBF to the server (e.g., `/root/california-latest.osm.pbf`).
5. Run `osm2pgsql` (see `/root/ingest_pois_readme.txt` created by the script) and then create the `pois` table using `functions/sql/create_pois_table.sql`.

Security and networking
- Open firewall only for your application servers and your IP to the Postgres port (5432).
- Use strong passwords and consider networking VPC peering or private IPs between your app and DB.

Scale and operations
- For large imports, increase `--cache` to available RAM (e.g., 16GB) and use multiple processes.
- Use replication/diff tools (osmium or osm2pgsql replication) to apply incremental updates.
- Consider using managed Postgres (AWS RDS with PostGIS) if you prefer not to manage a VM.

After provisioning
- Set `POIS_DB_URL` in your Cloud Functions environment to `postgres://<db_user>:<db_pass>@<host>:5432/<db_name>` and deploy `functions:api`.
