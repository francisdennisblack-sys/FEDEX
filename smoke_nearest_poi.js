const fs = require('fs');
const path = require('path');

function toRad(v){return v*Math.PI/180}
function haversineMeters(lat1,lon1,lat2,lon2){
  const R=6371000; const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}

const siPath = path.join(__dirname,'pois','search-index.json');
if (!fs.existsSync(siPath)) { console.error('search-index.json missing'); process.exit(1); }
const si = JSON.parse(fs.readFileSync(siPath,'utf8'));
const rows = si.rows || [];
const stateCodes = si.stateCodes || [];
const pois = rows.map(r=>({name:r[0],lat:Number(r[1]),lon:Number(r[2]),state:stateCodes[r[3]]||null,type:r[4]}));

// Sample coordinate: San Francisco
const lat=37.7749, lon=-122.4194;
let best=null, bestD=Infinity;
for (const p of pois){
  const d=haversineMeters(lat,lon,p.lat,p.lon);
  if (d<bestD){ bestD=d; best=p; }
}
if (best){
  console.log('Nearest POI:', best.name, best.state, `distance=${(bestD/1000).toFixed(2)} km`, 'coords=',best.lat,best.lon);
} else console.log('No POIs found');
