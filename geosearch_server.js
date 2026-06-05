#!/usr/bin/env node
// geosearch_server.js — minimal HTTP server that serves nearest-N POIs from tiles or shards
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3030;
const TILE_PREC = 5;

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash(lat, lon, precision){
  let even = true, bit = 0, ch = 0, hash = '';
  let latLo = -90, latHi = 90, lonLo = -180, lonHi = 180;
  while (hash.length < precision){
    if (even){
      const mid = (lonLo + lonHi) / 2;
      if (lon >= mid) { ch = (ch << 1) | 1; lonLo = mid; } else { ch = (ch << 1) | 0; lonHi = mid; }
    } else {
      const mid = (latLo + latHi) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latLo = mid; } else { ch = (ch << 1) | 0; latHi = mid; }
    }
    even = !even;
    if (++bit === 5){ hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

function haversineMeters(lat1, lon1, lat2, lon2){
  if (lat1==null||lon1==null||lat2==null||lon2==null) return Infinity;
  const R=6371000; const toR=Math.PI/180; const dLat=(lat2-lat1)*toR; const dLon=(lon2-lon1)*toR;
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}

function loadTile(tileDir, gh){
  const file = path.join(tileDir, gh + '.json');
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file,'utf8')) || []; } catch(e){ return []; }
}

function loadAllShards(){
  const manifestPath = path.resolve('pois','manifest.json');
  const out = [];
  if (!fs.existsSync(manifestPath)) return out;
  const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const states = manifest.states || {};
  for (const info of Object.values(states)){
    if (!info || !info.file) continue;
    const file = path.resolve('pois', info.file);
    if (!fs.existsSync(file)) continue;
    try { const arr = JSON.parse(fs.readFileSync(file,'utf8')); out.push(...arr); } catch(e){ }
  }
  return out;
}

// Try to use tiles if available; else load shards into memory
const tileDir = path.resolve('pois','tiles', String(TILE_PREC));
let inMemoryPOIs = null;
if (fs.existsSync(tileDir) && fs.statSync(tileDir).isDirectory()){
  console.log('Geosearch: using tiles from', tileDir);
} else {
  console.log('Geosearch: tiles not found; loading shards into memory (may be slow)');
  inMemoryPOIs = loadAllShards();
  console.log('Loaded POIs into memory:', inMemoryPOIs.length);
}

function handleSearch(query){
  const lat = Number(query.lat || query.latitude);
  const lon = Number(query.lon || query.longitude);
  const n = Math.min(500, Math.max(1, Number(query.n || 50)));
  const radiusMi = Number(query.radiusMi || 25);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: 'lat & lon required' };

  let candidates = [];
  if (inMemoryPOIs) {
    candidates = inMemoryPOIs;
  } else {
    // load relevant tiles (home + neighbors)
    const home = encodeGeohash(lat, lon, TILE_PREC);
    // neighbors heuristics: take small lat/lon perturbations to cover 9 cells
    const cells = [home];
    // add simple neighbor by shifting +/- small degrees (approx cell size)
    const stepLat = 0.05, stepLon = 0.05;
    const pts = [ [lat-stepLat, lon], [lat+stepLat, lon], [lat, lon-stepLon], [lat, lon+stepLon], [lat-stepLat, lon-stepLon], [lat-stepLat, lon+stepLon], [lat+stepLat, lon-stepLon], [lat+stepLat, lon+stepLon] ];
    for (const [la,lo] of pts) cells.push(encodeGeohash(la, lo, TILE_PREC));
    const seen = new Set();
    for (const c of cells){ if (seen.has(c)) continue; seen.add(c); const arr = loadTile(tileDir, c); if (arr && arr.length) candidates.push(...arr); }
  }

  // compute distances and pick top n within radius
  const withDist = [];
  for (const p of candidates){
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const m = haversineMeters(lat, lon, p.lat, p.lon);
    const mi = m / 1609.34;
    if (mi <= radiusMi) withDist.push({ poi: p, mi, meters: m });
  }
  withDist.sort((a,b)=>a.meters - b.meters);
  return { results: withDist.slice(0, n).map(w => ({ name: w.poi.name, lat: w.poi.lat, lon: w.poi.lon, category: w.poi.category || null, state: w.poi.state || null, distanceMi: w.mi })) };
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/geosearch'){
    const out = handleSearch(u.query);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(out));
    return;
  }
  // simple health
  if (u.pathname === '/health'){
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true })); return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => console.log(`Geosearch server listening on http://localhost:${PORT}`));

