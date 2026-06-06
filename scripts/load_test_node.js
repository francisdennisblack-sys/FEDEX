const http = require('http');
const url = require('url');

const BASE = process.env.BASE_URL || 'http://localhost:5001';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '20', 10);
const DURATION = parseInt(process.env.DURATION || '10', 10) * 1000;
let running = true;

function makeRequest(path) {
  return new Promise((resolve) => {
    const u = new url.URL(path, BASE);
    const opts = { method: 'GET', hostname: u.hostname, port: u.port, path: u.pathname + u.search };
    const req = http.request(opts, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

async function worker(id) {
  while (running) {
    await makeRequest('/api/posts/top-liked?limit=5');
    await makeRequest('/api/posts/best/test-zone');
    await new Promise(r => setTimeout(r, 100));
  }
}

async function main() {
  console.log('Starting load test', { BASE, CONCURRENCY, DURATION });
  const workers = [];
  for (let i=0;i<CONCURRENCY;i++) workers.push(worker(i));
  setTimeout(() => { running = false; }, DURATION);
  await Promise.all(workers.map(w => Promise.resolve()));
  console.log('Load test finished');
}

main().catch(e => console.error(e));
