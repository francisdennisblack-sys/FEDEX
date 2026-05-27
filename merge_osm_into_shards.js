#!/usr/bin/env node
/**
 * merge_osm_into_shards.js
 *
 * Takes  pois/osm/<State>.json  (produced by fetch_osm_state_data.js) and folds the real OSM
 * places + schools INTO the existing pois/states/<State>.json shards, deduping by lowercase
 * (name + 4dp lat/lon). After merging it rebuilds:
 *   - pois/states/<State>.json  (the shard, in-place)
 *   - pois/manifest.json        (refreshes counts/sizes)
 *   - pois/search-index.json    (compact positional rows for cross-state search)
 *
 * Also populates a separate pois/places.json with all neighborhoods/towns/hamlets so the
 * recommended-areas dropdown can surface "you're in this neighborhood" cleanly without
 * loading every state's full POI shard.
 *
 * Usage:
 *   node merge_osm_into_shards.js
 *   node merge_osm_into_shards.js California   # just one state
 */

const fs = require('fs');
const path = require('path');

const STATES_DIR = path.join(__dirname, 'pois', 'states');
const OSM_DIR    = path.join(__dirname, 'pois', 'osm');
const POIS_DIR   = path.join(__dirname, 'pois');

if (!fs.existsSync(OSM_DIR)) {
    console.error(`❌ No OSM data found at ${OSM_DIR}. Run fetch_osm_state_data.js first.`);
    process.exit(1);
}

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

// Type → emoji/scope/radius mapping for new OSM entries
const SCHOOL_META = {
    high_school:       { emoji: '🏫', category: 'School',     scope: 'medium', radiusMi: 3, weight: 1.0 },
    middle_school:     { emoji: '🏫', category: 'School',     scope: 'small',  radiusMi: 2, weight: 0.8 },
    elementary_school: { emoji: '🏫', category: 'School',     scope: 'small',  radiusMi: 2, weight: 0.7 },
    school:            { emoji: '🏫', category: 'School',     scope: 'small',  radiusMi: 2, weight: 0.7 },
    college:           { emoji: '🎓', category: 'College',    scope: 'large',  radiusMi: 5, weight: 1.4 },
    university:        { emoji: '🎓', category: 'University', scope: 'xlarge', radiusMi: 7, weight: 1.8 }
};
const PLACE_META = {
    neighbourhood: { emoji: '🏘️', category: 'Neighborhood', scope: 'small',  radiusMi: 1.5, weight: 1.0, typeOut: 'neighborhood' },
    suburb:        { emoji: '🏘️', category: 'Suburb',       scope: 'medium', radiusMi: 3,   weight: 1.1, typeOut: 'suburb' },
    hamlet:        { emoji: '🏘️', category: 'Hamlet',       scope: 'small',  radiusMi: 1.5, weight: 0.8, typeOut: 'hamlet' },
    village:       { emoji: '🏘️', category: 'Village',      scope: 'medium', radiusMi: 2.5, weight: 0.9, typeOut: 'village' },
    town:          { emoji: '🏙️', category: 'Town',         scope: 'medium', radiusMi: 4,   weight: 1.0, typeOut: 'town' },
    city:          { emoji: '🌆', category: 'City',          scope: 'large',  radiusMi: 8,   weight: 1.3, typeOut: 'city' },
    locality:      { emoji: '📍', category: 'Locality',     scope: 'small',  radiusMi: 1.5, weight: 0.7, typeOut: 'locality' }
};

function dedupKey(name, lat, lon) {
    return `${String(name).toLowerCase().trim()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
}

// 6 decimal places ≈ 11 cm precision — way more than needed for POI ranking.
// Existing shards have 13-14 digits per coord; truncating saves ~30% on shard size.
function r6(x) { return typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x; }

function mergeState(stateName) {
    const osmFile   = path.join(OSM_DIR, stateName.replace(/ /g, '_') + '.json');
    const shardFile = path.join(STATES_DIR, stateName.replace(/ /g, '_') + '.json');
    if (!fs.existsSync(osmFile))   { console.log(`⏭️  ${stateName}: no OSM data, skip`); return null; }
    if (!fs.existsSync(shardFile)) { console.log(`⏭️  ${stateName}: no shard, skip`);    return null; }

    const osm   = JSON.parse(fs.readFileSync(osmFile, 'utf8'));
    const shard = JSON.parse(fs.readFileSync(shardFile, 'utf8'));
    const pois  = shard.pois || [];

    // Build dedupe set from existing shard
    const seen = new Set();
    for (const p of pois) {
        if (typeof p.lat === 'number' && typeof p.lon === 'number') {
            seen.add(dedupKey(p.name, p.lat, p.lon));
        }
    }

    let addedSchools = 0, addedPlaces = 0;

    // Schools/colleges/universities
    for (const s of (osm.schools || [])) {
        const meta = SCHOOL_META[s.type] || SCHOOL_META.school;
        const lat = r6(s.lat), lon = r6(s.lon);
        const key = dedupKey(s.name, lat, lon);
        if (seen.has(key)) continue;
        seen.add(key);
        pois.push({
            name: s.name, lat, lon,
            category: meta.category, type: s.type, emoji: meta.emoji,
            scope: meta.scope, radiusMi: meta.radiusMi, weight: meta.weight,
            source: 'osm'
        });
        addedSchools++;
    }

    // Places (neighborhoods, suburbs, hamlets, villages, towns, cities)
    const placeOut = []; // separate file
    for (const pl of (osm.places || [])) {
        const meta = PLACE_META[pl.kind] || PLACE_META.locality;
        const lat = r6(pl.lat), lon = r6(pl.lon);
        const key = dedupKey(pl.name, lat, lon);
        if (!seen.has(key)) {
            seen.add(key);
            pois.push({
                name: pl.name, lat, lon,
                category: meta.category, type: meta.typeOut, emoji: meta.emoji,
                scope: meta.scope, radiusMi: meta.radiusMi, weight: meta.weight,
                source: 'osm'
            });
            addedPlaces++;
        }
        placeOut.push({ name: pl.name, lat, lon, kind: meta.typeOut, state: stateName });
    }

    // Truncate ALL coords (existing entries too) to 6dp on rewrite — shrinks shard ~30%
    for (const p of pois) {
        if (typeof p.lat === 'number') p.lat = r6(p.lat);
        if (typeof p.lon === 'number') p.lon = r6(p.lon);
    }

    shard.pois = pois;
    shard.poiCount = pois.length;
    shard.osmMerged = true;
    shard.osmMergedAt = new Date().toISOString();
    fs.writeFileSync(shardFile, JSON.stringify(shard));

    console.log(`✅ ${stateName}: +${addedSchools} schools, +${addedPlaces} places  (total now ${pois.length.toLocaleString()})`);
    return { state: stateName, addedSchools, addedPlaces, total: pois.length, places: placeOut };
}

function rebuildManifest() {
    const files = fs.readdirSync(STATES_DIR).filter(f => f.endsWith('.json') && !f.includes('.index'));
    const states = {};
    for (const f of files) {
        const full = path.join(STATES_DIR, f);
        const stat = fs.statSync(full);
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        const stateName = data.state || f.replace('.json', '').replace(/_/g, ' ');
        states[stateName] = {
            file: 'states/' + f,
            count: (data.pois || []).length,
            sizeBytes: stat.size,
            osmMerged: !!data.osmMerged
        };
    }
    const manifestPath = path.join(POIS_DIR, 'manifest.json');
    const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
    const out = { ...existing, version: 2, updatedAt: new Date().toISOString(), states };
    fs.writeFileSync(manifestPath, JSON.stringify(out, null, 2));
    const total = Object.values(states).reduce((a, b) => a + b.count, 0);
    console.log(`📋 manifest.json refreshed: ${Object.keys(states).length} states, ${total.toLocaleString()} POIs total`);
}

function rebuildSearchIndex() {
    const files = fs.readdirSync(STATES_DIR).filter(f => f.endsWith('.json') && !f.includes('.index'));
    const stateCodes = [];
    const stateIdx = new Map();
    const rows = [];
    const TYPE_CODE = {
        high_school: 'h', middle_school: 'm', elementary_school: 'e', school: 'l',
        college: 'c', university: 'u',
        restaurant: 'r', cafe: 'k', shopping: 's',
        neighborhood: 'N', suburb: 'B', hamlet: 'H', village: 'V', town: 'T', city: 'Y', locality: 'L'
    };
    for (const f of files) {
        const data = JSON.parse(fs.readFileSync(path.join(STATES_DIR, f), 'utf8'));
        const stateName = data.state || f.replace('.json', '').replace(/_/g, ' ');
        if (!stateIdx.has(stateName)) { stateIdx.set(stateName, stateCodes.length); stateCodes.push(stateName); }
        const sIdx = stateIdx.get(stateName);
        for (const p of (data.pois || [])) {
            if (!p || !p.name || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
            const tc = TYPE_CODE[p.type] || 'o';
            rows.push([p.name, Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5, sIdx, tc]);
        }
    }
    const out = { version: 2, builtAt: new Date().toISOString(), stateCodes, rows };
    const p = path.join(POIS_DIR, 'search-index.json');
    fs.writeFileSync(p, JSON.stringify(out));
    const mb = (fs.statSync(p).size / 1024 / 1024).toFixed(1);
    console.log(`🔎 search-index.json rebuilt: ${rows.length.toLocaleString()} rows, ${stateCodes.length} states, ${mb} MB`);
}

function writePlacesFile(allPlaces) {
    // Combined neighborhoods/towns file — small enough to ship in initial load for the
    // recommended-areas dropdown without dragging the full search index.
    const out = { version: 1, builtAt: new Date().toISOString(), count: allPlaces.length, places: allPlaces };
    const p = path.join(POIS_DIR, 'places.json');
    fs.writeFileSync(p, JSON.stringify(out));
    const kb = (fs.statSync(p).size / 1024).toFixed(1);
    console.log(`🏘️  places.json written: ${allPlaces.length.toLocaleString()} neighborhoods/towns (${kb} KB)`);
}

(async () => {
    const allStateFiles = fs.readdirSync(OSM_DIR).filter(f => f.endsWith('.json'));
    const targetStates = args.length ? args : allStateFiles.map(f => f.replace('.json', '').replace(/_/g, ' '));
    console.log(`🔧 Merging OSM into shards for ${targetStates.length} state(s)…\n`);

    const allPlaces = [];
    for (const st of targetStates) {
        const r = mergeState(st);
        if (r && r.places) allPlaces.push(...r.places);
    }

    console.log('');
    rebuildManifest();
    rebuildSearchIndex();
    writePlacesFile(allPlaces);

    console.log(`\n🎯 Merge complete. Commit & push the updated pois/* files.`);
})();
