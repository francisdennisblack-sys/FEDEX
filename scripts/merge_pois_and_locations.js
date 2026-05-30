#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE_DIR = path.join(ROOT, 'data', 'archives');
const OUT_DIR = path.join(ROOT, 'data');

function listFiles(dir) {
  try { return fs.readdirSync(dir); } catch (e) { return []; }
}

function safeStat(p) {
  try { return fs.statSync(p); } catch (e) { return null; }
}

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function moveFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
}

function gatherCandidates() {
  const files = listFiles(ROOT);
  const poiCandidates = files.filter(f => /poi/i.test(f) || /pois_/i.test(f));
  const locCandidates = files.filter(f => /location/i.test(f) || /locations/i.test(f) || /master_locations/i.test(f) || /us_locations/i.test(f));
  // remove overlaps
  const poiSet = new Set(poiCandidates);
  const locSet = new Set(locCandidates.filter(f => !poiSet.has(f)));
  return { poi: Array.from(poiSet), locations: Array.from(locSet) };
}

function extractArray(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  // common patterns
  if (Array.isArray(json.pois)) return json.pois;
  if (Array.isArray(json.features)) return json.features;
  if (Array.isArray(json.data)) return json.data;
  // fallback: try to find first array value
  for (const k of Object.keys(json)) {
    if (Array.isArray(json[k])) return json[k];
  }
  return [];
}

function dedupeById(arr) {
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const id = item && (item.id || item.place_id || item.osm_id || item.uid || (item.lat && item.lon && `${item.lat},${item.lon}`));
    const key = id ? String(id) : JSON.stringify(item);
    if (!seen.has(key)) { seen.add(key); out.push(item); }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  console.log('merge_pois_and_locations: dry-run=', !execute);

  const { poi, locations } = gatherCandidates();
  console.log('Found POI candidates:', poi.length);
  console.log('Found location candidates:', locations.length);

  let poiItems = [];
  for (const f of poi) {
    const fp = path.join(ROOT, f);
    const json = readJson(fp);
    const arr = extractArray(json);
    console.log('  ->', f, '->', arr.length, 'items');
    poiItems = poiItems.concat(arr);
  }
  poiItems = dedupeById(poiItems);
  console.log('POI merged items (deduped):', poiItems.length);

  let locItems = [];
  for (const f of locations) {
    const fp = path.join(ROOT, f);
    const json = readJson(fp);
    const arr = extractArray(json);
    console.log('  ->', f, '->', arr.length, 'items');
    locItems = locItems.concat(arr);
  }
  locItems = dedupeById(locItems);
  console.log('Locations merged items (deduped):', locItems.length);

  if (!execute) {
    console.log('\nDry-run complete. To write canonical files and archive sources, re-run with `--execute`.');
    console.log('Will write:');
    console.log('  ', path.join(OUT_DIR, 'master_pois_database.json'));
    console.log('  ', path.join(OUT_DIR, 'master_locations_database.json'));
    console.log('And move source chunks into:', ARCHIVE_DIR);
    return;
  }

  // Execute: write merged files and move sources
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const poiOut = path.join(OUT_DIR, 'master_pois_database.json');
  const locOut = path.join(OUT_DIR, 'master_locations_database.json');
  writeJson(poiOut, poiItems);
  writeJson(locOut, locItems);
  console.log('Wrote canonical files.');

  // move source files into archive
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const timestamp = Date.now();
  for (const f of poi.concat(locations)) {
    const src = path.join(ROOT, f);
    const dest = path.join(ARCHIVE_DIR, `${timestamp}-${f}`);
    try { moveFile(src, dest); console.log('Archived', f); } catch (e) { console.warn('Failed to archive', f, e.message); }
  }
  console.log('Archive complete.');
}

main().catch(e=>{ console.error('merge script failed', e); process.exit(1); });
