#!/usr/bin/env node
/**
 * fetch_osm_state_data.js
 *
 * Pulls REAL OpenStreetMap data per US state via the Overpass API:
 *   • place=neighbourhood|suburb|hamlet|village|town  (for richer dropdown / "I'm in this neighborhood")
 *   • amenity=school|college|university              (real schools, not templated names)
 *
 * Writes one JSON per state to  pois/osm/<State_Name>.json  with the schema:
 *   { state, fetchedAt, places: [...], schools: [...] }
 *
 * Features:
 *   • Resumable — re-running skips states whose file already exists (delete file to re-fetch)
 *   • Rate-limit friendly — 1 request every 3s, exponential backoff on 429/504
 *   • Per-state retry budget (5 attempts) before giving up and moving on
 *   • Mirrors rotated to spread load
 *
 * Usage:
 *   node fetch_osm_state_data.js                # all 50 states
 *   node fetch_osm_state_data.js California     # one state
 *   node fetch_osm_state_data.js --only-places  # skip schools (faster)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'pois', 'osm');
fs.mkdirSync(OUT_DIR, { recursive: true });

const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
];

// All 50 US states — Overpass uses ISO codes US-XX for area lookup
const STATES = {
    'Alabama':'US-AL','Alaska':'US-AK','Arizona':'US-AZ','Arkansas':'US-AR','California':'US-CA',
    'Colorado':'US-CO','Connecticut':'US-CT','Delaware':'US-DE','Florida':'US-FL','Georgia':'US-GA',
    'Hawaii':'US-HI','Idaho':'US-ID','Illinois':'US-IL','Indiana':'US-IN','Iowa':'US-IA',
    'Kansas':'US-KS','Kentucky':'US-KY','Louisiana':'US-LA','Maine':'US-ME','Maryland':'US-MD',
    'Massachusetts':'US-MA','Michigan':'US-MI','Minnesota':'US-MN','Mississippi':'US-MS','Missouri':'US-MO',
    'Montana':'US-MT','Nebraska':'US-NE','Nevada':'US-NV','New Hampshire':'US-NH','New Jersey':'US-NJ',
    'New Mexico':'US-NM','New York':'US-NY','North Carolina':'US-NC','North Dakota':'US-ND','Ohio':'US-OH',
    'Oklahoma':'US-OK','Oregon':'US-OR','Pennsylvania':'US-PA','Rhode Island':'US-RI','South Carolina':'US-SC',
    'South Dakota':'US-SD','Tennessee':'US-TN','Texas':'US-TX','Utah':'US-UT','Vermont':'US-VT',
    'Virginia':'US-VA','Washington':'US-WA','West Virginia':'US-WV','Wisconsin':'US-WI','Wyoming':'US-WY'
};

const args = process.argv.slice(2);
const onlyPlaces = args.includes('--only-places');
const filterArgs = args.filter(a => !a.startsWith('--'));
const targetStates = filterArgs.length ? filterArgs : Object.keys(STATES);

let mirrorIdx = 0;
function nextMirror() {
    mirrorIdx = (mirrorIdx + 1) % OVERPASS_MIRRORS.length;
    return OVERPASS_MIRRORS[mirrorIdx];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function postOverpass(query, attempt = 1) {
    return new Promise((resolve, reject) => {
        const url = new URL(OVERPASS_MIRRORS[mirrorIdx]);
        const body = 'data=' + encodeURIComponent(query);
        const req = https.request({
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'fedex-poi-enrichment/1.0 (offline build script)'
            },
            timeout: 180000
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('JSON parse: ' + e.message + ' (first 200: ' + data.slice(0, 200) + ')')); }
                } else if ((res.statusCode === 429 || res.statusCode === 504 || res.statusCode === 502) && attempt < 6) {
                    const wait = Math.min(60000, 5000 * Math.pow(2, attempt - 1));
                    console.log(`     ⏳ HTTP ${res.statusCode}, retry ${attempt}/5 in ${wait/1000}s on next mirror`);
                    nextMirror();
                    sleep(wait).then(() => postOverpass(query, attempt + 1).then(resolve, reject));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on('error', err => {
            if (attempt < 5) {
                const wait = 5000 * attempt;
                console.log(`     ⚠️  ${err.message}, retry ${attempt}/5 in ${wait/1000}s on next mirror`);
                nextMirror();
                sleep(wait).then(() => postOverpass(query, attempt + 1).then(resolve, reject));
            } else reject(err);
        });
        req.on('timeout', () => { req.destroy(new Error('timeout')); });
        req.write(body);
        req.end();
    });
}

function placeQuery(isoCode) {
    return `[out:json][timeout:120];
area["ISO3166-2"="${isoCode}"]->.s;
(
  node["place"~"^(neighbourhood|suburb|hamlet|village|town|city|locality)$"](area.s);
);
out body;`;
}

function schoolQuery(isoCode) {
    return `[out:json][timeout:180];
area["ISO3166-2"="${isoCode}"]->.s;
(
  node["amenity"~"^(school|college|university)$"](area.s);
  way["amenity"~"^(school|college|university)$"](area.s);
);
out center;`;
}

function extractPlaces(json) {
    if (!json || !Array.isArray(json.elements)) return [];
    const out = [];
    for (const el of json.elements) {
        const name = el.tags && el.tags.name;
        if (!name) continue;
        const lat = el.lat || (el.center && el.center.lat);
        const lon = el.lon || (el.center && el.center.lon);
        if (typeof lat !== 'number' || typeof lon !== 'number') continue;
        out.push({
            name,
            lat: Math.round(lat * 1e6) / 1e6,  // 6dp = ~10cm precision (more than enough)
            lon: Math.round(lon * 1e6) / 1e6,
            kind: (el.tags && el.tags.place) || 'place'
        });
    }
    return out;
}

function extractSchools(json) {
    if (!json || !Array.isArray(json.elements)) return [];
    const out = [];
    for (const el of json.elements) {
        const name = el.tags && el.tags.name;
        if (!name) continue;
        const lat = el.lat || (el.center && el.center.lat);
        const lon = el.lon || (el.center && el.center.lon);
        if (typeof lat !== 'number' || typeof lon !== 'number') continue;
        const amenity = el.tags && el.tags.amenity;
        let type = 'school';
        if (amenity === 'college') type = 'college';
        else if (amenity === 'university') type = 'university';
        else {
            const n = name.toLowerCase();
            if (n.includes('high school') || n.includes('high sch.') || /\bhs\b/.test(n)) type = 'high_school';
            else if (n.includes('middle school') || n.includes('junior high')) type = 'middle_school';
            else if (n.includes('elementary') || n.includes('primary')) type = 'elementary_school';
        }
        out.push({
            name,
            lat: Math.round(lat * 1e6) / 1e6,
            lon: Math.round(lon * 1e6) / 1e6,
            type
        });
    }
    return out;
}

async function fetchState(stateName, isoCode) {
    const outFile = path.join(OUT_DIR, stateName.replace(/ /g, '_') + '.json');
    if (fs.existsSync(outFile)) {
        const cur = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        const haveSchools = cur.schools && cur.schools.length > 0;
        if (cur.places && cur.places.length > 0 && (onlyPlaces || haveSchools)) {
            console.log(`✅ ${stateName}: already have ${cur.places.length} places + ${cur.schools ? cur.schools.length : 0} schools (skip)`);
            return cur;
        }
    }

    console.log(`\n🌍 ${stateName} (${isoCode})`);
    let places = [], schools = [];

    try {
        console.log(`   → places (neighbourhood/suburb/hamlet/village/town/city)…`);
        const t0 = Date.now();
        const placesJson = await postOverpass(placeQuery(isoCode));
        places = extractPlaces(placesJson);
        console.log(`     ✓ ${places.length.toLocaleString()} places (${((Date.now()-t0)/1000).toFixed(1)}s)`);
        await sleep(3000); // be nice to the server
    } catch (e) {
        console.log(`     ❌ places fetch failed: ${e.message}`);
    }

    if (!onlyPlaces) {
        try {
            console.log(`   → schools/colleges/universities…`);
            const t0 = Date.now();
            const schoolsJson = await postOverpass(schoolQuery(isoCode));
            schools = extractSchools(schoolsJson);
            console.log(`     ✓ ${schools.length.toLocaleString()} schools (${((Date.now()-t0)/1000).toFixed(1)}s)`);
            await sleep(3000);
        } catch (e) {
            console.log(`     ❌ schools fetch failed: ${e.message}`);
        }
    }

    const payload = { state: stateName, isoCode, fetchedAt: new Date().toISOString(), places, schools };
    fs.writeFileSync(outFile, JSON.stringify(payload));
    const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
    console.log(`   💾 ${outFile}  (${kb} KB)`);
    return payload;
}

(async () => {
    console.log(`📡 OSM enrichment fetcher`);
    console.log(`   states: ${targetStates.length}  ·  onlyPlaces: ${onlyPlaces}`);
    console.log(`   output: ${OUT_DIR}`);

    let totalPlaces = 0, totalSchools = 0;
    for (const stName of targetStates) {
        const iso = STATES[stName];
        if (!iso) { console.log(`⚠️  Unknown state: ${stName}`); continue; }
        try {
            const r = await fetchState(stName, iso);
            totalPlaces += (r.places || []).length;
            totalSchools += (r.schools || []).length;
        } catch (e) {
            console.log(`💥 ${stName}: ${e.message}`);
        }
    }

    console.log(`\n🎯 Done. Totals across ${targetStates.length} states:`);
    console.log(`   places (neighborhoods/towns):  ${totalPlaces.toLocaleString()}`);
    console.log(`   schools/colleges/universities: ${totalSchools.toLocaleString()}`);
    console.log(`\nNext: run  node merge_osm_into_shards.js  to fold this data into the POI shards & search index.`);
})();
