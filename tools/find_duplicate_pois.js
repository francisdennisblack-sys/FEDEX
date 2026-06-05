#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371e3; // meters
  const toRad = (d) => d * Math.PI / 180;
  const φ1 = toRad(aLat), φ2 = toRad(bLat);
  const Δφ = toRad(bLat - aLat);
  const Δλ = toRad(bLon - aLon);
  const aa = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
  return (R * c); // meters
}

function normalizeName(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
}

function loadPois(files) {
  for (const f of files) {
    const p = path.resolve(f);
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p,'utf8');
        const json = JSON.parse(raw);
        // try common shapes: array of objects, or array of arrays
        if (Array.isArray(json)) return json.map(r => normalizePOIRecord(r));
        // known manifests may nest under .rows or .pois
        if (Array.isArray(json.rows)) return json.rows.map(r=>normalizePOIRecord(r));
        if (Array.isArray(json.pois)) return json.pois.map(r=>normalizePOIRecord(r));
      } catch (e) {
        console.error('Failed parsing', p, e.message);
      }
    }
  }
  return null;
}

function normalizePOIRecord(r) {
  // try to extract name, lat, lon, state
  if (!r) return null;
  if (Array.isArray(r)) {
    // fallback shape [name, lat, lon, state]
    return { name: r[0], lat: Number(r[1]), lon: Number(r[2]), raw: r };
  }
  const name = r.name || r.title || r[0] || r.display_name || r.poiName || null;
  const lat = Number(r.lat || r.latitude || r.latitude_deg || r[1]);
  const lon = Number(r.lon || r.longitude || r.longitude_deg || r[2]);
  return { name: name || '', lat: isNaN(lat)?null:lat, lon: isNaN(lon)?null:lon, raw: r };
}

function unionFind(n) {
  const p = Array.from({length:n}, (_,i)=>i);
  return {
    find(x){ return p[x]===x?x:(p[x]=this.find(p[x])); },
    union(a,b){
      const ra=this.find(a), rb=this.find(b); if (ra===rb) return; p[ra]=rb;
    },
    groups(){
      const m = new Map();
      for (let i=0;i<n;i++){ const r=this.find(i); if(!m.has(r)) m.set(r,[]); m.get(r).push(i);} return Array.from(m.values());
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const thresholdMeters = Number(args[1]||50); // default 50m
  const candidates = args[0] ? [args[0]] : ['pois/search-index.json','pois/places.json','poi_database.json','pois/manifest.json','pois/search.json'];
  const pois = loadPois(candidates);
  if (!pois) {
    console.error('No POI file found. Try: node tools/find_duplicate_pois.js <path-to-poi-json> [thresholdMeters]');
    process.exit(1);
  }
  const cleaned = pois.map((p,i)=>({
    id: p.id || p.raw && p.raw.id || `poi_${i}`,
    name: String(p.name||'').trim(),
    norm: normalizeName(p.name||''),
    lat: Number(p.lat), lon: Number(p.lon), idx: i
  })).filter(p=>p && p.lat && p.lon && p.name);

  console.log(`Loaded ${cleaned.length} POIs for scanning`);
  const uf = unionFind(cleaned.length);
  // spatially prune by sorting on lat
  const order = cleaned.map((c,i)=>i).sort((a,b)=>cleaned[a].lat-cleaned[b].lat);
  for (let ii=0; ii<order.length; ii++){
    const i = order[ii];
    const a = cleaned[i];
    for (let jj=ii+1; jj<order.length; jj++){
      const j = order[jj];
      const b = cleaned[j];
      // quick lat window: ~thresholdMeters in degrees (~111000 m per degree)
      const latDiff = Math.abs(a.lat - b.lat);
      if (latDiff*111000 > thresholdMeters) break; // too far in lat
      const d = haversineKm(a.lat,a.lon,b.lat,b.lon);
      if (d <= thresholdMeters) {
        // cluster by proximity
        uf.union(i,j);
      }
    }
  }

  const groups = uf.groups().map(g=>g.map(i=>cleaned[i]));
  const dupGroups = groups.filter(g=>g.length>1 && new Set(g.map(x=>x.norm)).size>1);
  const report = dupGroups.map(g=>({
    count: g.length,
    names: Array.from(new Set(g.map(x=>x.name))).slice(0,10),
    norms: Array.from(new Set(g.map(x=>x.norm))).slice(0,10),
    members: g.map(x=>({id:x.id,name:x.name,lat:x.lat,lon:x.lon}))
  }));

  const outPath = path.resolve('tmp','poi_duplicates_report.json');
  try { fs.mkdirSync(path.dirname(outPath),{recursive:true}); } catch(e){}
  fs.writeFileSync(outPath, JSON.stringify({ thresholdMeters, total: cleaned.length, groups: report }, null, 2));
  console.log(`Found ${report.length} duplicate-like clusters (wrote ${outPath})`);
  report.slice(0,20).forEach((r,idx)=>{
    console.log(`\nGroup ${idx+1} - ${r.count} POIs -> names: ${r.names.join(' | ')}`);
    r.members.slice(0,10).forEach(m=> console.log(`  - ${m.name} (${m.lat},${m.lon})`));
  });
}

main().catch(e=>{ console.error(e); process.exit(2); });
