// Simple POI worker: holds rows and answers nearest-N queries off the main thread
let rows = []; // each row: [name, lat, lon, stateIndex, typeChar]
let kdRoot = null;
let dirty = false;

function toRad(v){return v*Math.PI/180}
function haversineMeters(lat1,lon1,lat2,lon2){
  if (lat1==null||lon1==null||lat2==null||lon2==null) return Infinity;
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
  const best = []; // max-heap simulated by array sorted desc by distance

  function pushCandidate(pt, dist) {
    if (dist === Infinity) return;
    best.push({ pt, dist });
    best.sort((a,b)=>b.dist - a.dist);
    if (best.length > n) best.shift(); // remove farthest
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

    // plane distance in meters approximation: convert degree diff to meters roughly
    const degDiff = Math.abs(qv - nv);
    const metersPerDeg = 111320; // approx degrees to meters
    const planeMeters = degDiff * metersPerDeg;
    const worstDist = best.length === 0 ? Infinity : best[0].dist;
    if (planeMeters <= worstDist && second) search(second);
  }

  search(root);
  best.sort((a,b)=>a.dist - b.dist);
  return best.slice(0, n).map(b => ({ name: b.pt[0], lat: Number(b.pt[1]), lon: Number(b.pt[2]), stateIndex: b.pt[3], type: b.pt[4], distanceMeters: b.dist }));
}

onmessage = function(e) {
  const msg = e.data;
  try {
    if (!msg || !msg.type) return;
    if (msg.type === 'init') {
      if (Array.isArray(msg.rows)) rows = msg.rows.slice();
      // build KD-tree
      kdRoot = buildKD(rows.slice());
      dirty = false;
      postMessage({ type: 'inited', count: rows.length });
    } else if (msg.type === 'add') {
      if (Array.isArray(msg.rows)) {
        rows.push(...msg.rows);
        dirty = true;
      }
      postMessage({ type: 'added', count: rows.length });
    } else if (msg.type === 'query') {
      const { id, lat, lon, n = 30, maxMiles = 25 } = msg;
      const maxMeters = (maxMiles || 25) * 1609.34;
      if (dirty) {
        kdRoot = buildKD(rows.slice());
        dirty = false;
      }
      const results = nearestN(kdRoot, lat, lon, n, maxMeters);
      postMessage({ type: 'result', id, results });
    } else if (msg.type === 'clear') {
      rows = [];
      kdRoot = null;
      dirty = false;
      postMessage({ type: 'cleared' });
    }
  } catch (err) {
    postMessage({ type: 'error', error: String(err && err.message) });
  }
};
