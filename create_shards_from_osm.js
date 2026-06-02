#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const OSM_DIR = path.join(__dirname, 'pois', 'osm');
const STATES_DIR = path.join(__dirname, 'pois', 'states');
const POIS_DIR = path.join(__dirname, 'pois');

fs.mkdirSync(STATES_DIR, { recursive: true });

if (!fs.existsSync(OSM_DIR)) {
  console.error('No OSM dir at', OSM_DIR);
  process.exit(1);
}

const files = fs.readdirSync(OSM_DIR).filter(f => f.endsWith('.json'));
if (files.length === 0) {
  console.error('No OSM JSON files found in', OSM_DIR);
  process.exit(1);
}

function r6(x){ return typeof x==='number'?Math.round(x*1e6)/1e6:x; }
function key(n,lat,lon){ return `${String(n).toLowerCase().trim()}|${r6(lat)}|${r6(lon)}`; }

for (const f of files) {
  try {
    const full = path.join(OSM_DIR, f);
    const data = JSON.parse(fs.readFileSync(full,'utf8'));
    const stateName = (data.state || f.replace('.json','')).replace(/\s+/g,'_');
    const places = Array.isArray(data.places)?data.places:[];
    const schools = Array.isArray(data.schools)?data.schools:[];

    const out = { state: stateName, pois: [] };
    const seen = new Set();
    for (const p of places) {
      const name = p.name; const lat = p.lat; const lon = p.lon;
      if (!name || lat===undefined || lon===undefined) continue;
      const k = key(name,lat,lon);
      if (seen.has(k)) continue; seen.add(k);
      out.pois.push({ name: String(name), lat: r6(lat), lon: r6(lon), category: p.kind||'place', type: p.kind||'place', state: stateName, source: 'osm' });
    }
    for (const s of schools) {
      const name = s.name; const lat = s.lat; const lon = s.lon;
      if (!name || lat===undefined || lon===undefined) continue;
      const k = key(name,lat,lon);
      if (seen.has(k)) continue; seen.add(k);
      out.pois.push({ name: String(name), lat: r6(lat), lon: r6(lon), category: 'School', type: s.type||'school', state: stateName, source: 'osm' });
    }

    const outFile = path.join(STATES_DIR, stateName + '.json');
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log('Wrote shard:', outFile, '→', out.pois.length, 'POIs');
  } catch (e) {
    console.warn('Failed processing', f, e.message);
  }
}

console.log('Done creating shards from OSM files.');
