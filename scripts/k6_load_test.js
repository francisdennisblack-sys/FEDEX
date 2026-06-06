import http from 'k6/http';
import { sleep, check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<500']
  }
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const zone = 'test-zone';
  const r1 = http.get(`${BASE}/api/posts/top-liked?limit=20`);
  check(r1, { 'top-liked 200': (r) => r.status === 200 });
  const r2 = http.get(`${BASE}/api/posts/best/${encodeURIComponent(zone)}`);
  check(r2, { 'best 200': (r) => r.status === 200 });
  // simulate impression
  http.post(`${BASE}/api/metrics/impression`, JSON.stringify({ postId: 'post-1' }), { headers: { 'Content-Type': 'application/json' } });
  sleep(1);
}
