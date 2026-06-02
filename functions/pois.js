const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Pool will use POIS_DB_URL env var
const pool = new Pool({ connectionString: process.env.POIS_DB_URL });

// GET /api/pois/nearby?lat=&lon=&radius_mi=100&limit=200
router.get('/pois/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radiusMi = Math.max(1, Math.min(5000, parseFloat(req.query.radius_mi || 100)));
    const limit = Math.max(10, Math.min(2000, parseInt(req.query.limit || 200, 10)));
    if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: 'missing lat/lon' });

    const radiusM = radiusMi * 1609.34;

    const sql = `
      SELECT id, name, lat, lon, category, popularity,
        ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($1, $2),4326)) AS dist_m,
        (
          (1.0 - LEAST(ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($1, $2),4326)) / $3, 1.0)) * 0.65
          + LEAST(COALESCE(popularity,0)::float / 100.0, 1.0) * 0.35
        ) AS score
      FROM pois
      WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2),4326)::geography, $3)
      ORDER BY score DESC, dist_m ASC
      LIMIT $4;
    `;

    // Note: ST_MakePoint takes (lon,lat)
    const { rows } = await pool.query(sql, [lon, lat, radiusM, limit]);
    return res.json(rows);
  } catch (err) {
    console.error('POI nearby error', err && err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
