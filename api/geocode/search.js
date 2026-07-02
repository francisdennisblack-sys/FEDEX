const { handleOptions, setCommonHeaders } = require('../_utils');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  const q = String(req.query.q || '').trim();
  const limit = Math.max(1, Math.min(20, Number(req.query.limit || 12)));
  if (!q) return res.status(200).json({ results: [], attribution: 'Data © OpenStreetMap contributors' });

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en`;
    const resp = await fetch(photonUrl);
    if (!resp.ok) return res.status(200).json({ results: [], attribution: 'Data © OpenStreetMap contributors' });

    const payload = await resp.json();
    const features = Array.isArray(payload && payload.features) ? payload.features : [];
    const results = features.map((f) => {
      const p = f && f.properties ? f.properties : {};
      const coords = f && f.geometry && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : [];
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const name = p.name || p.city || p.county || p.state || 'Unknown';
      const state = p.state || p.county || '';
      const country = p.country || '';
      const displayName = [name, state, country].filter(Boolean).join(', ');
      return {
        id: p.osm_id ? String(p.osm_id) : null,
        locationId: p.osm_id ? String(p.osm_id) : null,
        displayName,
        name,
        city: p.city || p.county || '',
        stateOrProvince: state,
        country,
        latitude: lat,
        longitude: lon,
        type: p.osm_value || p.osm_key || 'location',
        hierarchyType: p.osm_key || 'location',
        boundingBox: null,
        importance: 0,
      };
    }).filter(Boolean);

    return res.status(200).json({
      results,
      attribution: 'Data © OpenStreetMap contributors, Photon'
    });
  } catch (e) {
    return res.status(200).json({ results: [], attribution: 'Data © OpenStreetMap contributors' });
  }
};
