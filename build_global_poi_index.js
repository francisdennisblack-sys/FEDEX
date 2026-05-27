#!/usr/bin/env node
/**
 * build_global_poi_index.js  (v3)
 *
 * Builds one compact search index from the per-state shards in pois/states/*.json
 *
 * Each row is a positional array — keeps the file small:
 *   [name, lat, lon, stateIdx, typeCode, tier, radiusMi, weight]
 *
 * stateCodes[i] gives the state name for stateIdx=i.
 * typeCodes is the legend for one-char type codes.
 *
 * Tier/radius/weight let the client run the same scope-aware boost on cross-state hits
 * without lazy-loading the shard first.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STATES_DIR = path.join(ROOT, 'pois', 'states');
const OUT = path.join(ROOT, 'pois', 'search-index.json');

if (!fs.existsSync(STATES_DIR)) { console.error('Missing pois/states/'); process.exit(1); }

const TYPE_CODES = {
    // education
    high_school: 'h', middle_school: 'm', elementary_school: 'e', school: 'l',
    college: 'c', university: 'u',
    // food
    restaurant: 'r', cafe: 'k', fast_food: 'f', bar: 'b', pub: 'b',
    // shop
    shopping: 's', mall: 'M', supermarket: 'g', convenience: 'v', pharmacy: 'p',
    // places
    neighborhood: 'N', neighbourhood: 'N', suburb: 'B', hamlet: 'H',
    village: 'V', town: 'T', city: 'Y', locality: 'L',
    // services
    hospital: '+', fuel: 'G', gas_station: 'G', atm: 'A', post_office: 'P',
    // leisure
    park: 'q', gym: 'y', fitness_centre: 'y', library: 'i', museum: 'x',
    cinema: 'X', theatre: 'X', hotel: 'I', stadium: 'd', airport: 'P', theme_park: 'd',
};

const files = fs.readdirSync(STATES_DIR).filter(f => f.endsWith('.json') && !f.includes('.index'));
files.sort();

const stateCodes = [];
const stateIdx = new Map();
const rows = [];

let totalRead = 0;
for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(STATES_DIR, f), 'utf8'));
    const stateName = data.state || f.replace('.json', '').replace(/_/g, ' ');
    if (!stateIdx.has(stateName)) { stateIdx.set(stateName, stateCodes.length); stateCodes.push(stateName); }
    const sIdx = stateIdx.get(stateName);
    for (const p of (data.pois || [])) {
        if (!p || !p.name || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
        const tc = TYPE_CODES[p.type] || 'o';
        rows.push([
            p.name,
            +p.lat.toFixed(5),
            +p.lon.toFixed(5),
            sIdx,
            tc,
            p.tier || 0,
            +(p.radiusMi || 0).toFixed(2),
            +(p.weight || 0).toFixed(2),
        ]);
        totalRead++;
    }
}

const payload = {
    version: 3,
    generatedAt: new Date().toISOString(),
    stateCodes,
    typeCodes: TYPE_CODES,
    rowSchema: ['name', 'lat', 'lon', 'stateIdx', 'typeCode', 'tier', 'radiusMi', 'weight'],
    totalRows: rows.length,
    rows,
};
fs.writeFileSync(OUT, JSON.stringify(payload));
const sizeMB = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`✅ ${OUT}`);
console.log(`   rows: ${rows.length.toLocaleString()} (${totalRead.toLocaleString()} read)`);
console.log(`   states: ${stateCodes.length}`);
console.log(`   size: ${sizeMB} MB raw  (~${(sizeMB * 0.18).toFixed(1)} MB gzipped over the wire)`);
