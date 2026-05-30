const fs = require('fs');
const path = require('path');

// Combine small JSON files in repo root into one canonical file for easier review.
// Criteria: files in repo root with .json extension and size <= 200KB (configurable).

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data');
const ARCHIVE_DIR = path.join(OUT_DIR, 'archives');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

const MAX_BYTES = 200 * 1024; // 200KB

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.json'));
const combined = {};
const moved = [];

for (const f of files) {
  const fp = path.join(ROOT, f);
  try {
    const stat = fs.statSync(fp);
    if (!stat.isFile()) continue;
    if (stat.size > MAX_BYTES) continue; // skip large files
    // Read and parse
    const raw = fs.readFileSync(fp, 'utf8');
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
    const key = path.basename(f, '.json');
    combined[key] = parsed;
    // move original to archives to reduce repo file count
    const dest = path.join(ARCHIVE_DIR, f);
    try {
      fs.renameSync(fp, dest);
      moved.push(f);
    } catch (e) {
      // fallback to copy+unlink
      try { fs.copyFileSync(fp, dest); fs.unlinkSync(fp); moved.push(f); } catch(e2){}
    }
  } catch (e) {
    // ignore
  }
}

if (Object.keys(combined).length === 0) {
  console.log('No small JSON files found to combine.');
  process.exit(0);
}

const outPath = path.join(OUT_DIR, 'combined_small.json');
fs.writeFileSync(outPath, JSON.stringify(combined, null, 2));
console.log('Wrote', outPath, 'with keys:', Object.keys(combined));
if (moved.length) console.log('Moved originals to', ARCHIVE_DIR, ':', moved.join(', '));

process.exit(0);
