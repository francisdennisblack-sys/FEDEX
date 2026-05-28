#!/usr/bin/env node
/**
 * expand_pois_per_state.js
 *
 * Generate 10,000+ POIs per US state focused on:
 *   - Schools (high schools, colleges, universities)  🎓 🏫
 *   - Restaurants (fast food, cafes, sit-down)        🍔 ☕ 🍽️
 *   - Shopping (malls, big-box, boutiques)            🛍️ 🛒
 *
 * Strategy
 *  1. Seed each state with N "anchor cities" drawn from us_locations_database.json.
 *  2. Around each anchor (within ~25 mi), synthesize POIs whose names follow real
 *     brand / institution patterns ("<Brand> - <City>", "<City> High School", etc.)
 *     with lat/lon jittered around the anchor.
 *  3. Merge into poi_database_worldwide.json under a "states" namespace so it
 *     coexists with the existing "cities" namespace and the runtime loader
 *     (loadWorldwideLocationsAndPOIs) can pick it up after a small loader patch.
 *
 *  Output:
 *    poi_database_states.json     (state -> {pois: [...]} structure)
 *    poi_database_worldwide.json  (updated with .states namespace + bumped counts)
 *
 * Usage:
 *    node expand_pois_per_state.js [--per-state=10000] [--states=ALL|CA,NY,TX]
 */

const fs = require('fs');
const path = require('path');

const ARGS = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
}));

const PER_STATE_TARGET = parseInt(ARGS['per-state'] || '10000', 10);
const STATE_FILTER     = (ARGS.states && ARGS.states !== 'ALL') ? ARGS.states.split(',') : null;

const ROOT = __dirname;
const LOC_PATH = path.join(ROOT, 'us_locations_database.json');
const WORLD_PATH = path.join(ROOT, 'poi_database_worldwide.json');
const OUT_PATH = path.join(ROOT, 'poi_database_states.json');

// ─────────────────────────────────────────────────────────────────────────────
// Brand catalogs
// ─────────────────────────────────────────────────────────────────────────────
const RESTAURANT_BRANDS = [
    { n: "McDonald's",       e: '🍔', c: 'Fast Food'      },
    { n: 'Burger King',      e: '🍔', c: 'Fast Food'      },
    { n: 'Wendy\'s',         e: '🍔', c: 'Fast Food'      },
    { n: 'Taco Bell',        e: '🌮', c: 'Fast Food'      },
    { n: 'Chipotle',         e: '🌯', c: 'Fast Casual'    },
    { n: 'Subway',           e: '🥪', c: 'Fast Food'      },
    { n: 'Chick-fil-A',      e: '🍗', c: 'Fast Food'      },
    { n: 'Domino\'s Pizza',  e: '🍕', c: 'Pizza'          },
    { n: 'Pizza Hut',        e: '🍕', c: 'Pizza'          },
    { n: 'Papa John\'s',     e: '🍕', c: 'Pizza'          },
    { n: 'Panera Bread',     e: '🥖', c: 'Bakery Cafe'    },
    { n: 'Starbucks',        e: '☕', c: 'Cafe'           },
    { n: 'Dunkin\'',         e: '☕', c: 'Cafe'           },
    { n: 'Olive Garden',     e: '🍝', c: 'Italian'        },
    { n: 'Applebee\'s',      e: '🍽️', c: 'Casual Dining' },
    { n: 'Chili\'s',         e: '🌶️', c: 'Casual Dining' },
    { n: 'Outback Steakhouse', e: '🥩', c: 'Steakhouse'   },
    { n: 'Texas Roadhouse',  e: '🥩', c: 'Steakhouse'     },
    { n: 'IHOP',             e: '🥞', c: 'Diner'          },
    { n: 'Denny\'s',         e: '🥞', c: 'Diner'          },
    { n: 'Cracker Barrel',   e: '🍳', c: 'Diner'          },
    { n: 'Five Guys',        e: '🍔', c: 'Burger'         },
    { n: 'Shake Shack',      e: '🍔', c: 'Burger'         },
    { n: 'In-N-Out Burger',  e: '🍔', c: 'Burger'         },
    { n: 'Panda Express',    e: '🥡', c: 'Chinese'        },
    { n: 'P.F. Chang\'s',    e: '🥢', c: 'Chinese'        },
    { n: 'Buffalo Wild Wings', e: '🍗', c: 'Sports Bar'   },
    { n: 'Cheesecake Factory', e: '🍰', c: 'Casual Dining'},
    { n: 'Red Lobster',      e: '🦞', c: 'Seafood'        },
    { n: 'Waffle House',     e: '🧇', c: 'Diner'          },
];

const SHOPPING_BRANDS = [
    { n: 'Walmart',          e: '🛒', c: 'Supercenter'    },
    { n: 'Target',           e: '🎯', c: 'Department'     },
    { n: 'Costco',           e: '🛒', c: 'Warehouse Club' },
    { n: 'Sam\'s Club',      e: '🛒', c: 'Warehouse Club' },
    { n: 'Kroger',           e: '🛒', c: 'Grocery'        },
    { n: 'Publix',           e: '🛒', c: 'Grocery'        },
    { n: 'Whole Foods Market', e: '🥬', c: 'Grocery'      },
    { n: 'Trader Joe\'s',    e: '🥑', c: 'Grocery'        },
    { n: 'Aldi',             e: '🛒', c: 'Grocery'        },
    { n: 'Safeway',          e: '🛒', c: 'Grocery'        },
    { n: 'Best Buy',         e: '🔌', c: 'Electronics'    },
    { n: 'Home Depot',       e: '🔨', c: 'Home Improvement'},
    { n: 'Lowe\'s',          e: '🔨', c: 'Home Improvement'},
    { n: 'IKEA',             e: '🛋️', c: 'Home Goods'    },
    { n: 'Macy\'s',          e: '🛍️', c: 'Department'    },
    { n: 'Nordstrom',        e: '🛍️', c: 'Department'    },
    { n: 'Kohl\'s',          e: '🛍️', c: 'Department'    },
    { n: 'TJ Maxx',          e: '🛍️', c: 'Discount Apparel'},
    { n: 'Marshalls',        e: '🛍️', c: 'Discount Apparel'},
    { n: 'Ross Dress for Less', e: '🛍️', c: 'Discount Apparel'},
    { n: 'CVS Pharmacy',     e: '💊', c: 'Pharmacy'       },
    { n: 'Walgreens',        e: '💊', c: 'Pharmacy'       },
    { n: 'Apple Store',      e: '🍎', c: 'Electronics'    },
    { n: 'Nike Store',       e: '👟', c: 'Apparel'        },
    { n: 'Adidas',           e: '👟', c: 'Apparel'        },
    { n: 'Foot Locker',      e: '👟', c: 'Apparel'        },
    { n: 'GameStop',         e: '🎮', c: 'Entertainment'  },
    { n: 'Barnes & Noble',   e: '📚', c: 'Bookstore'      },
    { n: 'Petco',            e: '🐾', c: 'Pet Supply'     },
    { n: 'PetSmart',         e: '🐾', c: 'Pet Supply'     },
];

// School name templates (filled with city + index)
const HS_SUFFIXES = ['High School', 'Senior High', 'Preparatory', 'Tech High', 'Charter High'];
const HS_PREFIX_POOL = ['North', 'South', 'East', 'West', 'Central', 'Lakeside', 'Riverside', 'Hillside', 'Heritage', 'Liberty', 'Lincoln', 'Jefferson', 'Roosevelt', 'Kennedy', 'Washington'];
const COLLEGE_TYPES = ['Community College', 'Technical College', 'City College', 'County College'];
const UNI_PATTERNS = [
    s => `University of ${s}`,
    s => `${s} State University`,
    s => `${s} A&M University`,
    s => `${s} Tech`,
    s => `${s} College`,
];

// ─────────────────────────────────────────────────────────────────────────────
// Load anchor cities
// ─────────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(LOC_PATH)) {
    console.error(`❌ Missing ${LOC_PATH}`);
    process.exit(1);
}
const locDb = JSON.parse(fs.readFileSync(LOC_PATH, 'utf8'));

// Flatten nested locations[].regions[].areas[] into [{name,state,lat,lon}]
const allLocs = [];
if (Array.isArray(locDb)) {
    locDb.forEach(l => allLocs.push(l));
} else if (locDb && Array.isArray(locDb.locations)) {
    for (const entry of locDb.locations) {
        const state = entry.state || entry.stateCode || 'Unknown';
        const regions = entry.regions || [];
        for (const region of regions) {
            const areas = region.areas || region.cities || [];
            for (const area of areas) {
                const lat = parseFloat(area.lat);
                const lon = parseFloat(area.lon);
                if (!isFinite(lat) || !isFinite(lon)) continue;
                allLocs.push({ name: area.name, state, lat, lon, type: area.type || 'city' });
            }
        }
    }
} else if (locDb && locDb.states) {
    Object.values(locDb.states).forEach(s => (s.cities || []).forEach(c => {
        const lat = parseFloat(c.lat); const lon = parseFloat(c.lon);
        if (!isFinite(lat) || !isFinite(lon)) return;
        allLocs.push({ name: c.name, state: s.name, lat, lon, type: c.type || 'city' });
    }));
}

// group by state (handles {name,state,lat,lon} shape)
const byState = {};
for (const loc of allLocs) {
    const st = (loc.state || loc.region || loc.adminArea || '').toString().trim();
    if (!st) continue;
    if (typeof loc.lat !== 'number' || typeof loc.lon !== 'number') continue;
    (byState[st] = byState[st] || []).push(loc);
}
const stateKeys = Object.keys(byState).sort();
console.log(`📚 Loaded ${allLocs.length.toLocaleString()} locations across ${stateKeys.length} states.`);

// ─────────────────────────────────────────────────────────────────────────────
// Per-state generator
// ─────────────────────────────────────────────────────────────────────────────
function jitter(value, miles) {
    // ~1 mile ≈ 0.0145° lat ; lon scales by cos(lat), approximate
    const deg = (miles / 69) * (Math.random() * 2 - 1);
    return value + deg;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─────────────────────────────────────────────────────────────────────────────
// POI scope + influence radius (miles)
//  - scope drives how widely the POI pulls posts and how strongly it ranks
//  - radius is consumed at runtime by the POI-near boost
// ─────────────────────────────────────────────────────────────────────────────
const POI_SCOPE = {
    // schools
    high_school:        { scope: 'medium', radiusMi: 3,  weight: 1.0 },
    college:            { scope: 'large',  radiusMi: 8,  weight: 1.3 },
    university:         { scope: 'xlarge', radiusMi: 15, weight: 1.6 },
    // food
    restaurant:         { scope: 'small',  radiusMi: 1,  weight: 0.9 },
    cafe:               { scope: 'small',  radiusMi: 0.75, weight: 0.85 },
    // shopping
    shopping:           { scope: 'medium', radiusMi: 4,  weight: 1.1 },
};
function scopeFor(type, category) {
    if (POI_SCOPE[type]) return POI_SCOPE[type];
    const cat = (category || '').toLowerCase();
    if (cat.includes('mall') || cat.includes('supercenter') || cat.includes('warehouse')) return { scope: 'large', radiusMi: 6, weight: 1.2 };
    if (cat.includes('cafe')) return POI_SCOPE.cafe;
    if (cat.includes('grocery') || cat.includes('pharmacy')) return { scope: 'small', radiusMi: 1.5, weight: 0.9 };
    return { scope: 'medium', radiusMi: 3, weight: 1.0 };
}
function stamp(poi) {
    const s = scopeFor(poi.type, poi.category);
    poi.scope = s.scope;
    poi.radiusMi = s.radiusMi;
    poi.weight = s.weight;
    return poi;
}

function buildSchoolsForCity(city, count) {
    const out = [];
    const safeCity = city.name.replace(/[^\w\s-]/g, '').trim();
    // High schools
    const hsCount = Math.ceil(count * 0.55);
    for (let i = 0; i < hsCount; i++) {
        const prefix = pick(HS_PREFIX_POOL);
        const suffix = pick(HS_SUFFIXES);
        const name = i === 0
            ? `${safeCity} ${suffix}`
            : `${prefix} ${safeCity} ${suffix}`;
        out.push(stamp({
            name,
            lat: jitter(city.lat, 12),
            lon: jitter(city.lon, 12),
            category: 'School',
            type: 'high_school',
            emoji: '🏫',
        }));
    }
    // Colleges
    const collegeCount = Math.ceil(count * 0.25);
    for (let i = 0; i < collegeCount; i++) {
        const t = pick(COLLEGE_TYPES);
        out.push(stamp({
            name: `${safeCity} ${t}`,
            lat: jitter(city.lat, 18),
            lon: jitter(city.lon, 18),
            category: 'School',
            type: 'college',
            emoji: '🎓',
        }));
    }
    // Universities
    const uniCount = Math.max(1, count - hsCount - collegeCount);
    for (let i = 0; i < uniCount; i++) {
        const pattern = pick(UNI_PATTERNS);
        out.push(stamp({
            name: pattern(safeCity),
            lat: jitter(city.lat, 20),
            lon: jitter(city.lon, 20),
            category: 'School',
            type: 'university',
            emoji: '🎓',
        }));
    }
    return out;
}

function buildRestaurantsForCity(city, count) {
    const out = [];
    const safeCity = city.name.replace(/[^\w\s-]/g, '').trim();
    for (let i = 0; i < count; i++) {
        const b = pick(RESTAURANT_BRANDS);
        out.push(stamp({
            name: `${b.n} - ${safeCity}`,
            lat: jitter(city.lat, 15),
            lon: jitter(city.lon, 15),
            category: b.c,
            type: b.c.toLowerCase().includes('cafe') ? 'cafe' : 'restaurant',
            emoji: b.e,
        }));
    }
    return out;
}

function buildShoppingForCity(city, count) {
    const out = [];
    const safeCity = city.name.replace(/[^\w\s-]/g, '').trim();
    for (let i = 0; i < count; i++) {
        const b = pick(SHOPPING_BRANDS);
        out.push(stamp({
            name: `${b.n} - ${safeCity}`,
            lat: jitter(city.lat, 18),
            lon: jitter(city.lon, 18),
            category: b.c,
            type: 'shopping',
            emoji: b.e,
        }));
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate for each state
// ─────────────────────────────────────────────────────────────────────────────
const result = { generatedAt: new Date().toISOString(), perStateTarget: PER_STATE_TARGET, states: {} };
let grandTotal = 0;

const targets = STATE_FILTER ? stateKeys.filter(k => STATE_FILTER.includes(k)) : stateKeys;

for (const state of targets) {
    const cities = byState[state];
    if (!cities || cities.length === 0) continue;

    // Use top 25 most-anchored cities (or all if fewer)
    const anchors = cities.slice(0, Math.min(25, cities.length));
    const perAnchorTotal = Math.ceil(PER_STATE_TARGET / anchors.length);

    // Mix: 35% schools, 35% restaurants, 30% shopping
    const schoolsPer    = Math.ceil(perAnchorTotal * 0.35);
    const restaurantsPer = Math.ceil(perAnchorTotal * 0.35);
    const shoppingPer   = Math.max(1, perAnchorTotal - schoolsPer - restaurantsPer);

    const pois = [];
    for (const anchor of anchors) {
        pois.push(...buildSchoolsForCity(anchor, schoolsPer));
        pois.push(...buildRestaurantsForCity(anchor, restaurantsPer));
        pois.push(...buildShoppingForCity(anchor, shoppingPer));
    }
    // Trim to target
    const trimmed = pois.slice(0, PER_STATE_TARGET);
    result.states[state] = {
        country: 'United States',
        anchorCount: anchors.length,
        poiCount: trimmed.length,
        pois: trimmed,
    };
    grandTotal += trimmed.length;
    if (grandTotal % 50000 < PER_STATE_TARGET) {
        console.log(`  ✓ ${state}: ${trimmed.length.toLocaleString()} POIs (running total: ${grandTotal.toLocaleString()})`);
    }
}

console.log(`\n📦 Generated ${grandTotal.toLocaleString()} POIs across ${Object.keys(result.states).length} states.`);

// Write states file
fs.writeFileSync(OUT_PATH, JSON.stringify(result));
console.log(`💾 Wrote ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(1)} MB)`);

// Merge into worldwide
if (fs.existsSync(WORLD_PATH)) {
    const world = JSON.parse(fs.readFileSync(WORLD_PATH, 'utf8'));
    world.states = result.states;
    world.statePoiCount = grandTotal;
    fs.writeFileSync(WORLD_PATH, JSON.stringify(world));
    console.log(`🔗 Merged into ${WORLD_PATH}; new .states namespace + statePoiCount=${grandTotal}.`);
} else {
    console.warn(`⚠️ ${WORLD_PATH} not found — skipped merge.`);
}

console.log('\n✅ Done. Reload index.html and the loader will pick up new POIs.');
