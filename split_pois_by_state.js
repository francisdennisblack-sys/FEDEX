#!/usr/bin/env node
/**
 * split_pois_by_state.js
 *
 * Take the monolithic poi_database_worldwide.json (89 MB) and shard it into:
 *
 *   pois/manifest.json                      — list of states + sizes + counts
 *   pois/cities.json                        — original .cities namespace (worldwide POIs)
 *   pois/states/<STATE>.json                — full POI records for one state (1–2 MB)
 *   pois/states/<STATE>.index.json          — compact name-only index (50–100 KB)
 *
 * The compact index uses positional arrays `[name, lat, lon, typeCode, emoji]`
 * with type codes (h=high_school, c=college, u=university, r=restaurant, k=cafe, s=shopping)
 * so the runtime can search across ALL 500k POIs after loading only ~3 MB total.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'poi_database_worldwide.json');
const OUT_DIR = path.join(ROOT, 'pois');
const STATES_DIR = path.join(OUT_DIR, 'states');

if (!fs.existsSync(SRC)) {
    console.error(`❌ Missing ${SRC}`);
    process.exit(1);
}

fs.mkdirSync(STATES_DIR, { recursive: true });

const TYPE_CODES = {
    high_school: 'h',
    college:     'c',
    university:  'u',
    restaurant:  'r',
    cafe:        'k',
    shopping:    's',
};

console.log('📖 Loading worldwide POI database…');
const world = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// 1. Write cities namespace (worldwide POIs — small)
const citiesPayload = { cities: world.cities || {} };
const citiesPath = path.join(OUT_DIR, 'cities.json');
fs.writeFileSync(citiesPath, JSON.stringify(citiesPayload));
console.log(`💾 pois/cities.json (${(fs.statSync(citiesPath).size / 1024).toFixed(1)} KB)`);

// 2. Per-state shards
const manifest = { generatedAt: new Date().toISOString(), states: {} };
let totalPois = 0;

const stateEntries = Object.entries(world.states || {});
stateEntries.sort((a, b) => a[0].localeCompare(b[0]));

for (const [stateName, stateObj] of stateEntries) {
    const pois = stateObj.pois || [];
    const safeName = stateName.replace(/[^A-Za-z0-9]/g, '_');
    const fullPath  = path.join(STATES_DIR, `${safeName}.json`);
    const indexPath = path.join(STATES_DIR, `${safeName}.index.json`);

    // Full records (keep all fields)
    const fullPayload = {
        state: stateName,
        country: stateObj.country || 'United States',
        poiCount: pois.length,
        pois,
    };
    fs.writeFileSync(fullPath, JSON.stringify(fullPayload));

    // Compact index: [name, lat, lon, typeCode, emoji]
    const indexRows = pois.map(p => [
        p.name,
        +(p.lat).toFixed(5),
        +(p.lon).toFixed(5),
        TYPE_CODES[p.type] || 'o',
        p.emoji || '📍',
    ]);
    const indexPayload = { state: stateName, rows: indexRows };
    fs.writeFileSync(indexPath, JSON.stringify(indexPayload));

    const fullKB  = fs.statSync(fullPath).size  / 1024;
    const idxKB   = fs.statSync(indexPath).size / 1024;
    manifest.states[stateName] = {
        file: `states/${safeName}.json`,
        index: `states/${safeName}.index.json`,
        count: pois.length,
        fullKB: +fullKB.toFixed(1),
        indexKB: +idxKB.toFixed(1),
    };
    totalPois += pois.length;
    console.log(`   ✓ ${stateName.padEnd(20)} ${String(pois.length).padStart(6)} POIs  full=${fullKB.toFixed(1)}KB  idx=${idxKB.toFixed(1)}KB`);
}

manifest.totalStates = stateEntries.length;
manifest.totalPois = totalPois;
manifest.typeCodes = TYPE_CODES;

const manifestPath = path.join(OUT_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\n📋 pois/manifest.json (${(fs.statSync(manifestPath).size / 1024).toFixed(1)} KB) — ${stateEntries.length} states, ${totalPois.toLocaleString()} POIs`);
console.log('✅ Sharding complete.');
