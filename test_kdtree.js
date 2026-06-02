const fs = require('fs');
const path = require('path');

function toRad(v){return v*Math.PI/180}
function haversineMeters(lat1,lon1,lat2,lon2){
  const R=6371000; const dLat=toRad(lat2-lat1); const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}

function buildKD(points, depth = 0) {
  if (!points || points.length === 0) return null;
  const axis = depth % 2; // 0: lat, 1: lon
  points.sort((a,b) => (axis === 0 ? a[1] - b[1] : a[2] - b[2]));
  const mid = Math.floor(points.length / 2);
  const node = {
    point: points[mid],
    axis,
    left: buildKD(points.slice(0, mid), depth + 1),
    right: buildKD(points.slice(mid + 1), depth + 1)
  };
  return node;
}

function nearestN(root, qlat, qlon, n, maxMeters) {
  if (!root) return [];
  const best = [];
  function pushCandidate(pt, dist) {
    if (dist === Infinity) return;
    best.push({ pt, dist });
    best.sort((a,b)=>b.dist - a.dist);
    if (best.length > n) best.shift();
  }
  function search(node) {
    if (!node) return;
    const p = node.point;
    const plat = Number(p[1]);
    const plon = Number(p[2]);
    const d = haversineMeters(qlat, qlon, plat, plon);
    if (d <= maxMeters) pushCandidate(p, d);
    const axis = node.axis;
    const qv = axis === 0 ? qlat : qlon;
    const nv = axis === 0 ? plat : plon;
    const first = qv <= nv ? node.left : node.right;
    const second = qv <= nv ? node.right : node.left;
    if (first) search(first);
    const degDiff = Math.abs(qv - nv);
    const metersPerDeg = 111320;
    const planeMeters = degDiff * metersPerDeg;
    const worstDist = best.length === 0 ? Infinity : best[0].dist;
    if (planeMeters <= worstDist && second) search(second);
  }
  search(root);
  best.sort((a,b)=>a.dist - b.dist);
  return best.slice(0, n).map(b => ({ name: b.pt[0], lat: Number(b.pt[1]), lon: Number(b.pt[2]), distanceMeters: b.dist }));
}

const p = path.join(__dirname, 'pois', 'search-index.json');
if (!fs.existsSync(p)) { console.error('search-index.json missing'); process.exit(1); }
const si = JSON.parse(fs.readFileSync(p, 'utf8'));
const rows = si.rows.slice(0, si.rows.length).map(r => [r[0], Number(r[1]), Number(r[2]), r[3], r[4]]);
console.log('Rows loaded:', rows.length);
const t0 = Date.now();
const root = buildKD(rows);
console.log('Build time ms:', Date.now()-t0);
const qlat = 37.7749, qlon = -122.4194;
const t1 = Date.now();
const res = nearestN(root, qlat, qlon, 30, 25*1609.34);
console.log('Query time ms:', Date.now()-t1);
console.log('Results:', res.slice(0,5));
