const { handleOptions, setCommonHeaders } = require('./_utils');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat and lon query params are required' });
  }

  const fallback = {
    label: 'Local area',
    areaTag: 'Local area',
    latitude: lat,
    longitude: lon,
  };

  try {
    // Keep this endpoint fast for mobile Safari. If upstream geocoding is slow,
    // immediately fall back to a stable local label instead of stalling startup.
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => {
      try { ctrl.abort(); } catch (e) {}
    }, 650);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'wificontent/1.0 (+https://wificontent.com)'
      },
      signal: ctrl.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) return res.status(200).json(fallback);

    const data = await resp.json();
    const a = data && data.address ? data.address : {};
    const parts = [a.city || a.town || a.village || a.suburb || a.county, a.state].filter(Boolean);
    const label = parts.length ? parts.join(', ') : (data && data.display_name ? String(data.display_name).split(',').slice(0, 2).join(',') : 'Local area');

    return res.status(200).json({
      label,
      areaTag: label,
      latitude: lat,
      longitude: lon,
      source: 'nominatim'
    });
  } catch (e) {
    return res.status(200).json(fallback);
  }
};
