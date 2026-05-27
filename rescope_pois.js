#!/usr/bin/env node
/**
 * rescope_pois.js
 *
 * Re-assigns every POI a TIER (1..20) based on its type/category, then sets radiusMi & weight
 * from the tier, then DENSITY-BALANCES: POIs in sparse cells get their radius scaled up so
 * users can still match them; POIs in dense cells get scaled down so the feed doesn't drown.
 *
 * Writes back into pois/states/*.json in-place. Run once, then rebuild the search index.
 *
 *   node rescope_pois.js
 *
 * 20-TIER LADDER (informal "economy" map):
 *
 *   1  ATM / mailbox / vending           radius 0.05 mi  (tiny pinpoint)
 *   2  bench / kiosk / drinking fountain        0.08
 *   3  cafe / convenience / food truck          0.12
 *   4  bar / casual restaurant / dry cleaner    0.18
 *   5  pharmacy / gas station / fast food       0.25
 *   6  elementary school / hair salon           0.40
 *   7  middle school / clinic / small shop      0.55
 *   8  high school / hamlet / locality          0.80
 *   9  library / gym / playground / post office 1.0
 *  10  neighborhood / suburb / mid grocery      1.5
 *  11  big-box store / hospital / fire station  2.0
 *  12  village / hotel / community center       2.5
 *  13  town / mid college / regional museum     3.5
 *  14  large mall / movie theater / stadium     4.5
 *  15  university / large hospital / park       6.0
 *  16  small city / district / convention ctr   8.0
 *  17  metro city / theme park                 12.0
 *  18  county / airport / mega mall            18.0
 *  19  region / national park entrance         30.0
 *  20  mega-region / state landmark            60.0
 *
 * Density rule: for each ~5km geohash cell, count POIs.
 *   median cell count = M
 *   sparse  cell (count < 0.3*M):  scale radius * 1.6 (still capped at tier+2 radius)
 *   dense   cell (count > 3*M):    scale radius * 0.65
 *   weight scales inversely (sparse +20%, dense -20%) so each "unit area" still gets fair feed share.
 */

const fs = require('fs');
const path = require('path');

const STATES_DIR = path.join(__dirname, 'pois', 'states');

// =============================================================================
// TIER LADDER
// =============================================================================
const TIERS = [
    null, // 0 — placeholder, tiers are 1-indexed
    { radius: 0.05, weight: 0.5  }, // 1
    { radius: 0.08, weight: 0.55 }, // 2
    { radius: 0.12, weight: 0.6  }, // 3
    { radius: 0.18, weight: 0.65 }, // 4
    { radius: 0.25, weight: 0.7  }, // 5
    { radius: 0.40, weight: 0.75 }, // 6
    { radius: 0.55, weight: 0.8  }, // 7
    { radius: 0.80, weight: 0.9  }, // 8
    { radius: 1.0,  weight: 0.95 }, // 9
    { radius: 1.5,  weight: 1.0  }, // 10
    { radius: 2.0,  weight: 1.1  }, // 11
    { radius: 2.5,  weight: 1.2  }, // 12
    { radius: 3.5,  weight: 1.3  }, // 13
    { radius: 4.5,  weight: 1.4  }, // 14
    { radius: 6.0,  weight: 1.5  }, // 15
    { radius: 8.0,  weight: 1.7  }, // 16
    { radius: 12.0, weight: 1.9  }, // 17
    { radius: 18.0, weight: 2.1  }, // 18
    { radius: 30.0, weight: 2.4  }, // 19
    { radius: 60.0, weight: 2.8  }, // 20
];

function tierToScope(t) {
    if (t <= 4)  return 'tiny';
    if (t <= 7)  return 'small';
    if (t <= 11) return 'medium';
    if (t <= 15) return 'large';
    return 'xlarge';
}

// =============================================================================
// TYPE / CATEGORY → TIER
// =============================================================================
// Order matters — first match wins. Uses lowercase substring/regex matching.
function poiTier(poi) {
    const t = String(poi.type || '').toLowerCase();
    const c = String(poi.category || '').toLowerCase();
    const n = String(poi.name || '').toLowerCase();

    // --- direct type matches (most reliable) ---
    if (t === 'atm' || t === 'vending_machine' || t === 'mailbox') return 1;
    if (t === 'bench' || t === 'kiosk' || t === 'drinking_fountain') return 2;
    if (t === 'food_truck' || t === 'convenience') return 3;
    if (t === 'cafe') return 3;
    if (t === 'bar' || t === 'pub' || t === 'dry_cleaner') return 4;
    if (t === 'fast_food') return 5;
    if (t === 'pharmacy' || t === 'fuel' || t === 'gas_station') return 5;
    if (t === 'restaurant') return 4;
    if (t === 'elementary_school') return 6;
    if (t === 'middle_school') return 7;
    if (t === 'school') return 7;
    if (t === 'hamlet' || t === 'locality') return 8;
    if (t === 'high_school') return 8;
    if (t === 'library') return 9;
    if (t === 'gym' || t === 'fitness_centre' || t === 'fitness_center') return 9;
    if (t === 'playground') return 9;
    if (t === 'post_office') return 9;
    if (t === 'neighborhood' || t === 'neighbourhood' || t === 'suburb') return 10;
    if (t === 'hospital') return 11;
    if (t === 'fire_station' || t === 'police') return 11;
    if (t === 'village') return 12;
    if (t === 'hotel' || t === 'motel') return 12;
    if (t === 'town') return 13;
    if (t === 'college') return 13;
    if (t === 'cinema' || t === 'movie_theater') return 14;
    if (t === 'mall') return 14;
    if (t === 'stadium') return 14;
    if (t === 'university') return 15;
    if (t === 'park') return 15;
    if (t === 'city') return 16;
    if (t === 'airport') return 18;
    if (t === 'theme_park') return 17;

    // --- shopping subtypes by category ---
    if (t === 'shopping') {
        if (/(supercenter|warehouse)/.test(c)) return 11;
        if (/(department|home improvement|electronics|sports)/.test(c)) return 10;
        if (/(grocery|pharmacy|pet)/.test(c)) return 7;
        if (/(apparel|book|bakery)/.test(c)) return 5;
        return 6; // generic shop
    }

    // --- name-based hints (when type was generic) ---
    if (/(international airport)/.test(n)) return 18;
    if (/(university|state college)/.test(n)) return 15;
    if (/(community college|technical college)/.test(n)) return 13;
    if (/(high school)/.test(n)) return 8;
    if (/(middle school)/.test(n)) return 7;
    if (/(elementary)/.test(n)) return 6;
    if (/(national park|monument)/.test(n)) return 19;
    if (/(museum)/.test(n)) return 13;
    if (/(library)/.test(n)) return 9;
    if (/(park$|park\b)/.test(n)) return 12;

    // --- fallback by scope (legacy field) ---
    const sc = String(poi.scope || '').toLowerCase();
    if (sc === 'xlarge') return 15;
    if (sc === 'large') return 13;
    if (sc === 'medium') return 10;
    if (sc === 'small') return 7;
    return 6; // unknown — give it a modest reach
}

// =============================================================================
// GEOHASH (simple 5-char, ~5km cells)
// =============================================================================
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function geohash5(lat, lon) {
    let evenBit = true;
    let bit = 0, ch = 0, hash = '';
    let latRange = [-90, 90], lonRange = [-180, 180];
    while (hash.length < 5) {
        if (evenBit) {
            const mid = (lonRange[0] + lonRange[1]) / 2;
            if (lon >= mid) { ch = (ch << 1) | 1; lonRange[0] = mid; }
            else            { ch = (ch << 1) | 0; lonRange[1] = mid; }
        } else {
            const mid = (latRange[0] + latRange[1]) / 2;
            if (lat >= mid) { ch = (ch << 1) | 1; latRange[0] = mid; }
            else            { ch = (ch << 1) | 0; latRange[1] = mid; }
        }
        evenBit = !evenBit;
        if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
    }
    return hash;
}

// =============================================================================
// PASS 1 — assign tiers + bucket by geohash
// =============================================================================
const stateFiles = fs.readdirSync(STATES_DIR).filter(f => f.endsWith('.json') && !f.includes('.index'));
console.log(`🔧 Rescoping ${stateFiles.length} state shards…\n`);

const cellCounts = new Map(); // geohash5 → count
const tierHist = new Map();   // tier → count
const allShards = []; // [{file, data}]

for (const f of stateFiles) {
    const full = path.join(STATES_DIR, f);
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    const pois = data.pois || [];
    for (const p of pois) {
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
        const tier = poiTier(p);
        p.tier = tier;
        const meta = TIERS[tier];
        p.radiusMi = meta.radius;
        p.weight = meta.weight;
        p.scope = tierToScope(tier);
        const cell = geohash5(p.lat, p.lon);
        p._cell = cell;
        cellCounts.set(cell, (cellCounts.get(cell) || 0) + 1);
        tierHist.set(tier, (tierHist.get(tier) || 0) + 1);
    }
    allShards.push({ file: f, full, data });
}

// =============================================================================
// PASS 2 — density balance
// =============================================================================
const counts = Array.from(cellCounts.values()).sort((a, b) => a - b);
const median = counts[Math.floor(counts.length / 2)] || 1;
const sparseThreshold = Math.max(2, Math.floor(median * 0.3));
const denseThreshold = Math.max(median * 3, median + 10);
console.log(`📊 Cell stats: ${cellCounts.size.toLocaleString()} cells, median ${median} POIs/cell, sparse < ${sparseThreshold}, dense > ${denseThreshold}\n`);

let sparseAdj = 0, denseAdj = 0;
for (const { data } of allShards) {
    for (const p of (data.pois || [])) {
        if (!p._cell) continue;
        const c = cellCounts.get(p._cell) || 0;
        if (c < sparseThreshold) {
            // sparse — extend reach so user still gets some POI nearby
            const cap = TIERS[Math.min(20, (p.tier || 1) + 2)].radius;
            p.radiusMi = Math.min(cap, +(p.radiusMi * 1.6).toFixed(3));
            p.weight = +(p.weight * 1.2).toFixed(2);
            p.density = 'sparse';
            sparseAdj++;
        } else if (c > denseThreshold) {
            p.radiusMi = +(p.radiusMi * 0.65).toFixed(3);
            p.weight = +(p.weight * 0.85).toFixed(2);
            p.density = 'dense';
            denseAdj++;
        } else {
            p.density = 'normal';
        }
        delete p._cell;
    }
}
console.log(`📏 Density balance: ${sparseAdj.toLocaleString()} sparse POIs extended, ${denseAdj.toLocaleString()} dense POIs tightened\n`);

// =============================================================================
// PASS 3 — write back
// =============================================================================
for (const { full, data } of allShards) {
    data.poiCount = (data.pois || []).length;
    data.rescopedAt = new Date().toISOString();
    data.rescopeVersion = 2;
    fs.writeFileSync(full, JSON.stringify(data));
}

console.log('📈 Tier distribution:');
const tierRows = Array.from(tierHist.entries()).sort((a, b) => a[0] - b[0]);
for (const [t, n] of tierRows) {
    const meta = TIERS[t];
    console.log(`   tier ${String(t).padStart(2)}  r=${String(meta.radius).padStart(5)}mi  w=${meta.weight}   ${n.toLocaleString().padStart(8)} POIs`);
}
console.log('\n✅ Rescope complete. Now run: node build_global_poi_index.js  (to rebuild search-index.json)');
