#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function coordKey(lat,lon){ return `${Number(lat).toFixed(6)}|${Number(lon).toFixed(6)}`; }

function run(){
  const placesPath = path.resolve('pois','places.json');
  const mergedPath = path.resolve('tmp','poi_merged_list.json');
  if(!fs.existsSync(placesPath)) { console.error('pois/places.json not found'); process.exit(1); }
  if(!fs.existsSync(mergedPath)) { console.error('tmp/poi_merged_list.json not found'); process.exit(1); }
  const placesObj = JSON.parse(fs.readFileSync(placesPath,'utf8'));
  const origPlaces = placesObj.places || [];
  const merged = JSON.parse(fs.readFileSync(mergedPath,'utf8'));
  console.log('orig count', origPlaces.length, 'merged count', merged.length);

  const origMap = new Map();
  for (const p of origPlaces) {
    origMap.set(coordKey(p.lat,p.lon), p);
  }

  const finalPlaces = merged.map(m=>{
    const key = coordKey(m.lat,m.lon);
    const orig = origMap.get(key);
    if (orig) {
      // preserve kind/state and other fields, but update name/coords
      const copy = Object.assign({}, orig);
      copy.name = m.name;
      copy.lat = m.lat;
      copy.lon = m.lon;
      return copy;
    }
    // fallback minimal record
    return { name: m.name, lat: m.lat, lon: m.lon };
  });

  const out = { version: placesObj.version||1, builtAt: new Date().toISOString(), count: finalPlaces.length, places: finalPlaces };
  const bak = path.resolve('pois',`places.json.bak.${Date.now()}`);
  fs.copyFileSync(placesPath,bak);
  fs.writeFileSync(placesPath, JSON.stringify(out, null, 2));
  console.log('Wrote deduped places.json, backup:', bak);
}

run();
