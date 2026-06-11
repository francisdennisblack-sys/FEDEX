#!/usr/bin/env node
/*
  Playwright demo recorder
  - Serves the repository root on localhost:5000
  - Launches chromium and records a video of the demo
  - Saves video files under ./recordings/

  Usage:
    npm install -D playwright
    npx playwright install chromium
    node scripts/record_demo_playwright.js

  Notes:
  - For best results, ensure `index.html` exposes demo-driving helpers
    (e.g. window.startDemoSequence()) so the recorder can trigger animations.
  - Adjust RECORD_TIME_MS and VIEWPORT as needed.
*/

const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const RECORDINGS_DIR = path.join(ROOT, 'recordings');
const RECORD_TIME_MS = process.env.RECORD_TIME_MS ? Number(process.env.RECORD_TIME_MS) : 15000; // 15s
const VIEWPORT = { width: 1280, height: 800 };

if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

function serveRoot(port) {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);
      if (!filePath.startsWith(ROOT)) return res.writeHead(403).end('Forbidden');
      if (!fs.existsSync(filePath)) {
        res.writeHead(404).end('Not found');
        return;
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      const ext = path.extname(filePath).toLowerCase();
      const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500).end('Server error');
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

(async () => {
  const server = await serveRoot(PORT);
  console.log(`Serving ${ROOT} at http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: RECORDINGS_DIR, size: VIEWPORT }
  });

  const page = await context.newPage();
  const DEMO_PATH = process.env.DEMO_PATH || '/veo_wificontent_tablet_reference.html';
  const url = `http://localhost:${PORT}${DEMO_PATH}`;
  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // If the page exposes a demo helper, call it to drive animations.
  try {
    const hasDemo = await page.evaluate(() => typeof window.startDemoSequence === 'function');
    if (hasDemo) {
      console.log('Triggering page-provided demo helper: window.startDemoSequence()');
      await page.evaluate(() => window.startDemoSequence());
    } else {
      console.log('No demo helper found. Recording an idle session; consider adding window.startDemoSequence() to index.html to drive animations.');
    }
  } catch (e) { console.warn('Demo helper check failed:', e && e.message); }

  console.log(`Recording for ${RECORD_TIME_MS}ms...`);
  await page.waitForTimeout(RECORD_TIME_MS);

  // Close page/context to flush video
  await page.close();
  await context.close();
  await browser.close();

  // find latest video file
  const files = fs.readdirSync(RECORDINGS_DIR).map(f => ({ f, t: fs.statSync(path.join(RECORDINGS_DIR,f)).mtimeMs })).sort((a,b)=>b.t-a.t);
  const latest = files.length ? path.join(RECORDINGS_DIR, files[0].f) : null;
  console.log('Recording complete. Video file:', latest || 'none');

  server.close();
  process.exit(latest ? 0 : 1);
})().catch(err => { console.error(err); process.exit(2); });
