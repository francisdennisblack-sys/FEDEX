#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function normalizeName(s){ if(!s) return ''; return String(s).toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim(); }

function run(){
  const src = path.resolve('pois','places.json');
  if(!fs.existsSync(src)){ console.error('Source pois/places.json not found'); process.exit(1); }
  const raw = fs.readFileSync(src,'utf8');
  const obj = JSON.parse(raw);
  const places = obj.places || [];
  console.log('Original places count:', places.length);
  const seenNames = new Set();
  const seenCoords = new Set();
  const dedup = [];
  for (const p of places) {
    const norm = normalizeName(p.name||'');
    const coord = `${p.lat}|${p.lon}`;
    if (seenCoords.has(coord) || (norm && seenNames.has(norm))) {
      continue; // skip duplicate
    }
    seenCoords.add(coord);
    if (norm) seenNames.add(norm);
    dedup.push(p);
  }
  console.log('Deduped places count:', dedup.length);
  const outDir = path.resolve('tmp'); if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
  const outPath = path.resolve('tmp','places_deduped.json');
  fs.writeFileSync(outPath, JSON.stringify({ version: obj.version||1, builtAt: new Date().toISOString(), count: dedup.length, places: dedup }, null, 2));

  // backup original
  const bakPath = path.resolve('pois',`places.json.bak.${Date.now()}`);
  fs.copyFileSync(src,bakPath);
  fs.copyFileSync(outPath, src);
  console.log('Backup written to', bakPath);
  console.log('Replaced pois/places.json with deduped list.');
}

run();
