#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'samples');
const POI_SRC = path.join(ROOT, 'master_pois_database.json');
const LOC_SRC = path.join(ROOT, 'mega_master_locations_chunk_01.json');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function writeJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8'); }

function sampleArray(arr, n) {
  if (!Array.isArray(arr)) return [];
  if (arr.length <= n) return arr.slice(0, n);
  const out = [];
  const step = Math.max(1, Math.floor(arr.length / n));
  for (let i = 0; i < arr.length && out.length < n; i += step) out.push(arr[i]);
  return out;
}

function main() {
  console.log('Generating samples...');
  const poiJson = readJson(POI_SRC) || [];
  const poiArr = Array.isArray(poiJson) ? poiJson : (poiJson.pois || []);
  const poiSample = sampleArray(poiArr, 2000);
  const poiOut = path.join(OUT_DIR, 'master_pois_sample.json');
  writeJson(poiOut, poiSample);
  console.log('Wrote', poiOut, poiSample.length, 'items');

  const locJson = readJson(LOC_SRC) || [];
  const locArr = Array.isArray(locJson) ? locJson : (locJson.locations || []);
  const locSample = sampleArray(locArr, 2000);
  const locOut = path.join(OUT_DIR, 'master_locations_sample.json');
  writeJson(locOut, locSample);
  console.log('Wrote', locOut, locSample.length, 'items');
}

main();
