// Simple backfill script: read wifi_database.json and write posts_by_zone.json
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'wifi_database.json');
const OUT_PATH = path.join(__dirname, '..', 'posts_by_zone.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('No wifi_database.json found at', DB_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.posts || {};
}

function run() {
  const postsByZone = {};
  const posts = load();
  // posts expected to be object: { zoneId: [post,...] } or array
  if (Array.isArray(posts)) {
    for (const p of posts) {
      const z = p.zoneId || p.zone || 'unknown';
      postsByZone[z] = postsByZone[z] || [];
      postsByZone[z].push(p);
    }
  } else {
    // assume object keyed by zone
    Object.keys(posts).forEach(k => { postsByZone[k] = posts[k]; });
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: Date.now(), zones: Object.keys(postsByZone).length, postsByZone }, null, 2));
  console.log('Wrote', OUT_PATH);
}

run();
