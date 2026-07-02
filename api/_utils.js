const fs = require('fs');
const path = require('path');

function setCommonHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function handleOptions(req, res) {
  setCommonHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function safeReadJson(...parts) {
  try {
    const filePath = path.join(process.cwd(), ...parts);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function tileKey(lat, lon, zoom = 10) {
  const scale = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
  );
  return `z${zoom}_x${x}_y${y}`;
}

module.exports = {
  setCommonHeaders,
  handleOptions,
  safeReadJson,
  tileKey,
};
