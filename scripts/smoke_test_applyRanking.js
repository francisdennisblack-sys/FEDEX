const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const startMarker = 'function applyUnifiedRanking(displayPosts) {';
const start = html.indexOf(startMarker);
if (start === -1) {
  console.error('applyUnifiedRanking not found');
  process.exit(2);
}

let i = start + startMarker.length;
let braceCount = 1; // we've already consumed the opening '{' in the marker
let end = -1;
for (; i < html.length; i++) {
  const ch = html[i];
  if (ch === '{') braceCount++;
  else if (ch === '}') braceCount--;
  if (braceCount === 0) { end = i; break; }
}

if (end === -1) {
  console.error('Failed to find end of function');
  process.exit(3);
}

const funcSrc = html.slice(start, end + 1);

// Prepare a minimal environment for the function
const sandbox = {
  console: console,
  // stubbed helpers used by applyUnifiedRanking
  generateUnifiedPostRank: (post, userId) => {
    // simple deterministic rank: prefer more netLikes
    return ((post.likes || 0) - (post.dislikes || 0)) + (post.createdAt || 0) * 0.000001;
  },
  getCurrentUserArea: () => 'County',
  currentUserId: 'me',
  window: {}
};

// Evaluate function in sandbox
const vm = require('vm');
const context = vm.createContext(sandbox);
try {
  vm.runInContext(funcSrc + '\n\nthis.applyUnifiedRanking = applyUnifiedRanking;', context, { timeout: 2000 });
} catch (e) {
  console.error('Error evaluating function:', e);
  process.exit(4);
}

const applyUnifiedRanking = context.applyUnifiedRanking;
if (typeof applyUnifiedRanking !== 'function') {
  console.error('applyUnifiedRanking not loaded');
  process.exit(5);
}

// Create test posts
const posts = [
  { id: 'A', likes: 0, dislikes: 1, county: 'Other', createdAt: 1000 }, // disliked
  { id: 'B', likes: 5, dislikes: 0, county: 'Other', createdAt: 1001 }, // liked
  { id: 'C', likes: 0, dislikes: 0, county: 'Other', createdAt: 1002 }, // zero
  { id: 'D', likes: 2, dislikes: 3, county: 'Other', createdAt: 1003 }, // disliked
  { id: 'E', likes: 1, dislikes: 0, county: 'Other', createdAt: 1004 }  // normal
];

console.log('Input order:', posts.map(p => `${p.id}(l${p.likes},d${p.dislikes})`).join(', '));

const out = applyUnifiedRanking(posts);
console.log('Output length:', out.length);
console.log('Output order:');
out.forEach((p, idx) => console.log(`${idx+1}. ${p.id} (likes=${p.likes}, dislikes=${p.dislikes})`));

// Verify disliked posts are last
const firstDislikedIndex = out.findIndex(p => (Number(p.dislikes)||0) > (Number(p.likes)||0));
if (firstDislikedIndex === -1) {
  console.log('No disliked posts in output — OK');
  process.exit(0);
}

const tail = out.slice(firstDislikedIndex);
const anyNonDislikedInTail = tail.some(p => (Number(p.dislikes)||0) <= (Number(p.likes)||0));
if (anyNonDislikedInTail) {
  console.error('Smoke test FAILED: found non-disliked posts after a disliked post');
  process.exit(6);
}

console.log('Smoke test PASSED: all disliked posts are at the end (relative order preserved).');
process.exit(0);
