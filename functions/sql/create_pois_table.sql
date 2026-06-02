-- Create a compact pois table from the osm2pgsql import
-- Adjust source table name depending on your osm2pgsql prefix/version.

BEGIN;

-- Example: many osm2pgsql installs create planet_point, planet_polygon, planet_line
-- Some older setups create planet_osm_point; inspect `
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'planet%';`

DROP TABLE IF EXISTS pois;
CREATE TABLE pois AS
SELECT
  (osm_id::text) AS id,
  COALESCE(name, (tags -> 'name')) AS name,
  COALESCE((tags -> 'shop'), (tags -> 'amenity'), (tags -> 'office'), (tags -> 'tourism'), (tags -> 'leisure')) AS category,
  ST_Y(way::geometry) AS lat,
  ST_X(way::geometry) AS lon,
  way::geometry AS geom,
  0::integer AS popularity
FROM planet_point
WHERE (tags ? 'shop') OR (tags ? 'amenity') OR (tags ? 'office') OR (tags ? 'craft') OR (tags ? 'tourism') OR (tags ? 'leisure') OR (tags ? 'man_made');

-- Add spatial index
CREATE INDEX idx_pois_geom ON pois USING GIST(geom);
CREATE INDEX idx_pois_category ON pois(category);

ANALYZE pois;

COMMIT;

-- Optionally: tune `popularity` from checkins/external sources
