#!/usr/bin/env node
/**
 * build_global_poi_index.js
 *
 * Build ONE compact search index for all 500k POIs so any user can search
 * for any POI in the country (even outside their state) with a single fetch.
 *
 * Output: pois/search-index.json
 *   { stateCodes: [...], typeCodes: {h,c,u,r,k,s,o}, rows: [[name, lat, lon, stateIdx, typeCode], ...] }
 *
 * Uses positional arrays + integer state indices to minimize size.
 * Expected: ~22 MB raw, ~5-7 MB gzipped over the wire.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'poi_database_worldwide.json');
const OUT = path.join(ROOT, 'pois', 'search-index.json');

if (!fs.existsSync(SRC)) { console.error('Missing source'); process.exit(1); }

const TYPE_CODES = { high_school:'h', college:'c', university:'u', restaurant:'r', cafe:'k', shopping:'s' };

console.log('📖 Reading source…');
const world = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const stateCodes = [];
const stateIdx = {};
const rows = [];

const entries = Object.entries(world.states || {}).sort((a,b)=>a[0].localeCompare(b[0]));
for (const [stateName, stateObj] of entries) {
    const i = stateCodes.length;
    stateCodes.push(stateName);
    stateIdx[stateName] = i;
    for (const p of (stateObj.pois || [])) {
        rows.push([
            p.name,
            +(p.lat).toFixed(4),
            +(p.lon).toFixed(4),
            i,
            TYPE_CODES[p.type] || 'o',
        ]);
    }
}

// also fold in worldwide city POIs (different bucket — state stays null index = -1)
for (const [cityName, city] of Object.entries(world.cities || {})) {
    for (const p of (city.pois || [])) {
        rows.push([ p.name, +(p.lat||0).toFixed(4), +(p.lon||0).toFixed(4), -1, TYPE_CODES[p.type] || 'o' ]);
    }
}

const payload = {
    generatedAt: new Date().toISOString(),
    stateCodes,
    typeCodes: TYPE_CODES,
    totalRows: rows.length,
    rows,
};
fs.writeFileSync(OUT, JSON.stringify(payload));
const sizeMB = fs.statSync(OUT).size / 1024 / 1024;
console.log(`✅ ${OUT}  rows=${rows.length.toLocaleString()}  size=${sizeMB.toFixed(1)} MB`);
console.log('   (Vercel will gzip this on the wire; expected wire size ~5-7 MB.)');
