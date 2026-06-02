// Simple dependency-free Node HTTP geosearch server
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const PORT = process.env.PORT || 3030;

function toRad(v){return v*Math.PI/180}
function haversineKm(lat1,lon1,lat2,lon2){
  const R=6371; const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}

let index = null;
try {
  const p = path.join(__dirname, 'pois', 'search-index.json');
  const raw = fs.readFileSync(p, 'utf8');
  index = JSON.parse(raw);
  console.log('Loaded search-index.json rows:', index.rows.length);
} catch (e) {
  console.warn('Could not load search-index.json:', e && e.message);
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/search') {
    if (!index || !Array.isArray(index.rows)) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'search index not loaded' }));
      return;
    }
    const q = u.query || {};
    const lat = parseFloat(q.lat);
    const lon = parseFloat(q.lon);
    const n = Math.min(200, parseInt(q.n || '30', 10));
    const maxMiles = parseFloat(q.maxMiles || '25');
    if (!isFinite(lat) || !isFinite(lon)) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'lat & lon required' }));
      return;
    }
    const maxKm = maxMiles * 1.60934;
    const out = [];
    for (let i = 0; i < index.rows.length; i++) {
      const r = index.rows[i];
      const d = haversineKm(lat, lon, Number(r[1]), Number(r[2]));
      if (d <= maxKm) out.push({ name: r[0], lat: Number(r[1]), lon: Number(r[2]), stateIndex: r[3], type: r[4], distanceKm: d });
    }
    out.sort((a,b)=>a.distanceKm - b.distanceKm);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ count: out.length, results: out.slice(0,n) }));
    return;
  }
  res.writeHead(404, {'Content-Type':'text/plain'});
  res.end('Not found');
});

server.listen(PORT, () => console.log('GeoSearch server listening on', PORT));
