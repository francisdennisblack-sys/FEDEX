#!/usr/bin/env node
// generate_tiles.js
// Lightweight H3-like geohash tile generator (uses geohash-style encode)
const fs = require('fs');
const path = require('path');

function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

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

function haversineMi(lat1, lon1, lat2, lon2){
  const R = 3958.8; const toR = Math.PI/180;
  const dLat = (lat2-lat1)*toR, dLon=(lon2-lon1)*toR;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

async function main(){
  const outDir = path.resolve('pois','tiles');
  ensureDir(outDir);
  const precision = 5; // small tiles (~5km)
  const srcSearch = path.resolve('pois','search-index.json');
  const manifestPath = path.resolve('pois','manifest.json');
  let rows = [];
  if (fs.existsSync(srcSearch)){
    console.log('Loading pois/search-index.json');
    const data = JSON.parse(fs.readFileSync(srcSearch,'utf8'));
    if (Array.isArray(data.rows)) rows = data.rows.map(r => ({ name: r.name || r[0], lat: r.lat || r[1], lon: r.lon || r[2], state: r.state || r[3], category: r.category || null }));
  } else if (fs.existsSync(manifestPath)){
    console.log('No search-index.json; falling back to manifest + state shards');
    const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    const states = manifest.states || {};
    for (const [st, info] of Object.entries(states)){
      const file = info && info.file ? path.resolve('pois', info.file) : null;
      if (file && fs.existsSync(file)){
        try {
          const arr = JSON.parse(fs.readFileSync(file,'utf8'));
          if (Array.isArray(arr)) rows.push(...arr);
        } catch(e){ console.warn('Failed load state shard', file, e && e.message); }
      }
    }
  } else {
    console.error('No POI source found (pois/search-index.json or pois/manifest.json + shards)');
    process.exit(1);
  }

  console.log(`Loaded ${rows.length} POIs; generating tiles at precision ${precision}`);
  const map = new Map();
  for (const p of rows){
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const gh = encodeGeohash(p.lat, p.lon, precision);
    if (!map.has(gh)) map.set(gh, []);
    map.get(gh).push({ name: p.name, lat: p.lat, lon: p.lon, state: p.state || null, category: p.category || null });
  }

  // write tiles
  const tileDir = path.join(outDir, String(precision));
  ensureDir(tileDir);
  let written = 0;
  for (const [gh, arr] of map.entries()){
    const file = path.join(tileDir, gh + '.json');
    fs.writeFileSync(file, JSON.stringify(arr));
    written++;
  }
  console.log(`Wrote ${written} tile files to ${tileDir}`);
}

if (require.main === module) main().catch(e=>{console.error(e); process.exit(1);});
