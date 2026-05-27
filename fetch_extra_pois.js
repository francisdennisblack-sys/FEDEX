#!/usr/bin/env node
/**
 * fetch_extra_pois.js
 *
 * Targeted Overpass fetch for one or more states. Pulls a WIDER set of POI categories
 * than fetch_osm_state_data.js (which only got places + schools):
 *
 *   - food:        restaurant, cafe, fast_food, bar, pub
 *   - shop:        supermarket, mall, department_store, convenience, pharmacy, hardware
 *   - leisure:     park, fitness_centre, playground, stadium
 *   - culture:     museum, theatre, cinema, library
 *   - travel:      hotel, motel, hostel
 *   - services:    bank, atm, post_office, fire_station, police, hospital, clinic
 *   - transport:   fuel (gas station), bus_station, station (train/subway), airport
 *
 * Writes pois/osm/extra_<state>.json   (merger picks it up automatically)
 *
 * Usage:
 *   node fetch_extra_pois.js "Washington" "California"
 *   node fetch_extra_pois.js  (no args = WA + CA default)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'pois', 'osm');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const STATE_CODES = {
    'Alabama': 'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
    'Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID',
    'Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
    'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS',
    'Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
    'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
    'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
    'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA',
    'West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};

const MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
];

const args = process.argv.slice(2);
const targets = args.length ? args : ['Washington', 'California'];

function buildQuery(stateCode) {
    // Massive multi-filter Overpass query — kept under typical timeout by splitting into ONE query block
    // with all tags OR'd. Returns only nodes for speed.
    const code = stateCode;
    return `
[out:json][timeout:300];
area["ISO3166-2"="US-${code}"][admin_level=4]->.s;
(
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bank|atm|post_office|fire_station|police|hospital|clinic|pharmacy|fuel|library|theatre|cinema|fitness_centre|gym|townhall|community_centre|place_of_worship)$"](area.s);
  node["shop"~"^(supermarket|mall|department_store|convenience|hardware|electronics|clothing|bakery|butcher|greengrocer|books|sports|pet|toys)$"](area.s);
  node["leisure"~"^(park|playground|stadium|sports_centre|swimming_pool|golf_course|nature_reserve)$"](area.s);
  node["tourism"~"^(hotel|motel|hostel|museum|attraction|gallery|theme_park|zoo|aquarium)$"](area.s);
  node["public_transport"="station"](area.s);
  node["railway"="station"](area.s);
  node["aeroway"="aerodrome"](area.s);
);
out tags center;
`.trim();
}

function postQuery(url, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname, path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'fedex-poi-fetcher/1.0' },
            timeout: 320000,
        }, res => {
            let buf = '';
            res.on('data', d => buf += d);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('bad json')); }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write('data=' + encodeURIComponent(body));
        req.end();
    });
}

async function fetchWithRetry(query, label) {
    for (let attempt = 0; attempt < 6; attempt++) {
        const mirror = MIRRORS[attempt % MIRRORS.length];
        try {
            const t = Date.now();
            const res = await postQuery(mirror, query);
            console.log(`     ✓ ${(res.elements || []).length.toLocaleString()} ${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
            return res.elements || [];
        } catch (e) {
            console.log(`     ⏳ ${e.message}, retry ${attempt + 1}/6 on next mirror in 6s`);
            await new Promise(r => setTimeout(r, 6000));
        }
    }
    console.log(`     ❌ giving up after 6 attempts`);
    return [];
}

function classify(tags) {
    if (!tags) return null;
    if (tags.amenity) {
        const a = tags.amenity;
        if (['restaurant','cafe','fast_food','bar','pub'].includes(a)) return { type: a, category: 'Food' };
        if (a === 'bank' || a === 'atm') return { type: a, category: 'Bank' };
        if (a === 'pharmacy') return { type: 'pharmacy', category: 'Pharmacy' };
        if (a === 'fuel') return { type: 'gas_station', category: 'Gas Station' };
        if (a === 'hospital') return { type: 'hospital', category: 'Hospital' };
        if (a === 'clinic') return { type: 'clinic', category: 'Clinic' };
        if (a === 'post_office') return { type: 'post_office', category: 'Service' };
        if (a === 'fire_station') return { type: 'fire_station', category: 'Service' };
        if (a === 'police') return { type: 'police', category: 'Service' };
        if (a === 'library') return { type: 'library', category: 'Culture' };
        if (a === 'theatre') return { type: 'theatre', category: 'Culture' };
        if (a === 'cinema') return { type: 'cinema', category: 'Culture' };
        if (a === 'fitness_centre' || a === 'gym') return { type: 'gym', category: 'Leisure' };
        if (a === 'townhall' || a === 'community_centre') return { type: 'community_centre', category: 'Service' };
        if (a === 'place_of_worship') return { type: 'place_of_worship', category: 'Religious' };
    }
    if (tags.shop) {
        const s = tags.shop;
        if (s === 'supermarket') return { type: 'supermarket', category: 'Grocery' };
        if (s === 'mall') return { type: 'mall', category: 'Shopping' };
        if (s === 'department_store') return { type: 'shopping', category: 'Department' };
        if (s === 'convenience') return { type: 'convenience', category: 'Convenience' };
        if (s === 'pharmacy') return { type: 'pharmacy', category: 'Pharmacy' };
        return { type: 'shopping', category: s.replace(/_/g, ' ') };
    }
    if (tags.leisure) {
        const l = tags.leisure;
        if (l === 'park') return { type: 'park', category: 'Park' };
        if (l === 'playground') return { type: 'playground', category: 'Leisure' };
        if (l === 'stadium') return { type: 'stadium', category: 'Stadium' };
        if (l === 'sports_centre' || l === 'swimming_pool' || l === 'golf_course') return { type: 'gym', category: 'Leisure' };
        return { type: 'park', category: 'Leisure' };
    }
    if (tags.tourism) {
        const t = tags.tourism;
        if (t === 'hotel' || t === 'motel' || t === 'hostel') return { type: 'hotel', category: 'Hotel' };
        if (t === 'museum') return { type: 'museum', category: 'Culture' };
        if (t === 'gallery') return { type: 'museum', category: 'Culture' };
        if (t === 'theme_park') return { type: 'theme_park', category: 'Entertainment' };
        if (t === 'zoo' || t === 'aquarium') return { type: 'theme_park', category: 'Entertainment' };
        return { type: 'museum', category: 'Tourism' };
    }
    if (tags.public_transport === 'station' || tags.railway === 'station') return { type: 'transit_station', category: 'Transit' };
    if (tags.aeroway === 'aerodrome') return { type: 'airport', category: 'Airport' };
    return null;
}

(async () => {
    for (const stateName of targets) {
        const code = STATE_CODES[stateName];
        if (!code) { console.log(`❓ unknown state: ${stateName}`); continue; }
        console.log(`\n🌍 ${stateName} (US-${code}) — extra POIs`);
        const elements = await fetchWithRetry(buildQuery(code), 'extra POIs');

        const out = [];
        for (const el of elements) {
            const lat = el.lat ?? (el.center && el.center.lat);
            const lon = el.lon ?? (el.center && el.center.lon);
            const name = el.tags && el.tags.name;
            if (!lat || !lon || !name) continue;
            const cls = classify(el.tags);
            if (!cls) continue;
            out.push({
                name,
                lat: +(+lat).toFixed(6),
                lon: +(+lon).toFixed(6),
                type: cls.type,
                category: cls.category,
                source: 'osm-extra'
            });
        }

        const outFile = path.join(OUT_DIR, `extra_${stateName.replace(/ /g, '_')}.json`);
        fs.writeFileSync(outFile, JSON.stringify({
            state: stateName, stateCode: code, fetchedAt: new Date().toISOString(),
            count: out.length, pois: out
        }));
        const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
        console.log(`   💾 ${outFile}  (${out.length.toLocaleString()} POIs, ${kb} KB)`);
    }
    console.log('\n✅ Done. Run: node merge_osm_into_shards.js   (it auto-picks up extra_*.json)');
})();
