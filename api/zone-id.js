const { handleOptions, setCommonHeaders, tileKey } = require('./_utils');

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat and lon query params are required' });
  }

  return res.status(200).json({
    zoneId: tileKey(lat, lon),
    latitude: lat,
    longitude: lon,
  });
};
