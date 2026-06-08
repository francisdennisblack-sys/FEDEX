const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

// Google Cloud Video Intelligence (for videos) - optional
let video = null;
try {
    video = require('@google-cloud/video-intelligence');
} catch (e) {
    console.warn('[server] Optional module @google-cloud/video-intelligence not installed:', e.message);
}

// Google Cloud Vision (for images/photos) - optional
let vision = null;
try {
    vision = require('@google-cloud/vision');
} catch (e) {
    console.warn('[server] Optional module @google-cloud/vision not installed:', e.message);
}

// ============================================
// SYSTEM PARAMETERS & CONSTANTS
// ============================================

const SYSTEM_PARAMS = {
  // USER VISIBILITY THRESHOLD
  EVERYONE_SEES_ALL_THRESHOLD: 200,  // At 0-200 users: everyone sees everything
                                      // At 200+ users: switch to curated grid
  
  // BADGE SYSTEM
  BADGE_TRIGGER: 1,                   // Badges appear on FIRST like (not 5, not 10)
  FIRST_LIKE_BADGE: true,             // Show badge immediately on first like
  
  // POST LIFESPAN
  POST_LIFESPAN_DAYS: 7,               // Posts live for 7 days, then archived
  POST_LIFESPAN_MS: 7 * 24 * 60 * 60 * 1000,  // In milliseconds
  
  // GRID CURATION (At 200+ users)
  CURATION_SPLIT: {
    local: 0.60,                        // 60% of grid: posts from user's zone
    nearby: 0.25,                       // 25% of grid: posts from nearby zones
    spotlight: 0.15                     // 15% of grid: out-of-town posts
  },
  
  // SPOTLIGHT REQUIREMENTS
  SPOTLIGHT_MIN_LIKES: 500,            // Out-of-town posts need 500+ likes to appear
  SPOTLIGHT_REFRESH_FREQ: 'twice-daily', // Refresh morning & evening
  
  // REALISTIC POST RATES
  AVG_POSTS_PER_USER_PER_DAY: 1,      // Average user posts 1x per day
  
  // CALCULATION: At Day 365 with 2K-5K users
  DAY_365_USERS_MIN: 2000,
  DAY_365_USERS_MAX: 5000,
  DAY_365_POSTS_IN_GRID: '14K-35K',   // 7-day window: 14K-35K posts (was 50K-150K)
  
  // ARCHIVES
  ARCHIVE_AFTER_7_DAYS: true,          // Move posts to user profile after 7 days
  KEEP_IN_DATABASE: true               // Keep in database for analytics
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Runtime flags for cleanup/perf
const VERBOSE_SERVER = false;      // Set true to re-enable server logs
const ENABLE_MODERATION = false;   // Set true to enable Cloud Vision/Video moderation

function sLog(...args){ if (VERBOSE_SERVER) console.log(...args); }
function sWarn(...args){ if (VERBOSE_SERVER) console.warn(...args); }
function sErr(...args){ console.error(...args); }

// Serve static files (index.html and assets)
app.use(express.static(path.join(__dirname, '.')));

// Explicitly serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Database file path (allow override via env for canary instances)
const dbPath = process.env.DB_PATH || path.join(__dirname, 'wifi_database.json');

// In-memory storage for posts (loaded from disk on startup)
let postsDatabase = {}; // { zoneId: [post1, post2, ...] }
let postIdCounter = 0;

// Load posts from disk on startup
function loadDatabase() {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            const parsedData = JSON.parse(data);
            postsDatabase = parsedData.posts || {};
            postIdCounter = parsedData.idCounter || 0;
            sLog(`[${new Date().toISOString()}] Loaded ${Object.keys(postsDatabase).length} zones from database`);
            
            // Log zone info (guarded)
            for (const zoneId in postsDatabase) {
                sLog(`  - ${zoneId}: ${postsDatabase[zoneId].length} posts`);
            }
        } else {
            sLog(`[${new Date().toISOString()}] No existing database found. Starting fresh.`);
        }
    } catch (error) {
        console.error(`Error loading database: ${error.message}`);
        postsDatabase = {};
        postIdCounter = 0;
    }
}

// Save posts to disk
function saveDatabase() {
    try {
        const data = {
            posts: postsDatabase,
            idCounter: postIdCounter,
            lastSaved: new Date().toISOString()
        };
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error saving database: ${error.message}`);
    }
}

// Load database on startup
loadDatabase();

// Get zone ID based on provided coordinates (lat/lon) or fallback to client IP
app.get('/api/zone-id', (req, res) => {
    const { lat, lon } = req.query;

    if (lat && lon) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        const zoneId = getTileKey(latitude, longitude);
        const county = getCountyFromCoordinates(latitude, longitude);
        return res.json({ zoneId, latitude, longitude, county });
    }

    // Fallback: derive a coarse zone from client IP (legacy support)
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress;

    let zoneId;
    if (clientIp && (clientIp.startsWith('192.168.') || clientIp.startsWith('10.') || clientIp.startsWith('172.'))) {
        const ipParts = clientIp.split('.');
        zoneId = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`;
    } else {
        zoneId = clientIp || 'unknown-ip';
    }

    res.json({ zoneId, ip: clientIp });
});

// Get all posts for a zone
app.get('/api/posts/:zoneId', (req, res) => {
    const zoneId = req.params.zoneId;
    const posts = postsDatabase[zoneId] || [];
    res.json({ posts });
});

// Create a new post (zone-based)
app.post('/api/posts', (req, res) => {
    // Support either explicit zoneId or lat/lon to compute zone
    let { zoneId, lat, lon, content, imageData, timestamp, clientId, postId: providedPostId } = req.body;

    if (!zoneId) {
        if (lat && lon) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            zoneId = getTileKey(latitude, longitude);
        }
    }

    if (!zoneId) {
        return res.status(400).json({ error: 'zoneId or lat/lon required' });
    }

    // Idempotency: if client provides a `clientId` or `postId`, return existing post instead of creating duplicates
    if (clientId) {
        for (const zid in postsDatabase) {
            const existing = postsDatabase[zid].find(p => p.clientId && p.clientId === clientId);
            if (existing) {
                sLog(`[idempotency] duplicate post attempt detected for clientId=${clientId}, returning existing post id=${existing.id}`);
                return res.json({ success: true, post: existing, duplicate: true });
            }
        }
    }

    if (providedPostId) {
        for (const zid in postsDatabase) {
            const existing = postsDatabase[zid].find(p => String(p.id) === String(providedPostId));
            if (existing) {
                sLog(`[idempotency] duplicate post attempt detected for postId=${providedPostId}, returning existing post`);
                return res.json({ success: true, post: existing, duplicate: true });
            }
        }
    }

    if (!postsDatabase[zoneId]) {
        postsDatabase[zoneId] = [];
    }

    // Use providedPostId when available so client-side generated ids are preserved
    const assignedId = providedPostId ? String(providedPostId) : String(postIdCounter++);
    const post = {
        id: assignedId,
        zoneId,
        clientId: clientId || null,
        content,
        imageData,
        timestamp: timestamp || Date.now(),
        likes: 0,
        dislikes: 0
    };

    // Preserve optional attribution and geo fields if provided by client fallback
    if (req.body.authId) post.authId = req.body.authId;
    if (req.body.userId) post.userId = req.body.userId;
    if (req.body.createdBy) post.createdBy = req.body.createdBy;
    if (req.body.zoneTag) post.zoneTag = req.body.zoneTag;
    if (req.body.latitude) post.latitude = req.body.latitude;
    if (req.body.longitude) post.longitude = req.body.longitude;

    postsDatabase[zoneId].push(post);
    saveDatabase(); // Save to disk immediately

    res.json({ success: true, post });
});

// Delete a post
app.delete('/api/posts/:postId', (req, res) => {
    const postId = req.params.postId;

    // Find and remove the post from all zones
    for (let zoneId in postsDatabase) {
        postsDatabase[zoneId] = postsDatabase[zoneId].filter(p => String(p.id) !== String(postId));
    }

    saveDatabase(); // Save to disk
    res.json({ success: true });
});

// Update post votes
app.put('/api/posts/:postId', (req, res) => {
    const postId = req.params.postId;
    const { likes, dislikes } = req.body;

    // Find and update the post across all zones
    for (let zoneId in postsDatabase) {
        const post = postsDatabase[zoneId].find(p => String(p.id) === String(postId));
        if (post) {
            if (likes !== undefined) post.likes = likes;
            if (dislikes !== undefined) post.dislikes = dislikes;
            saveDatabase(); // Save to disk
            return res.json({ success: true, post });
        }
    }

    res.status(404).json({ error: 'Post not found' });
});

// Get database status
app.get('/api/status', (req, res) => {
    const zoneCount = Object.keys(postsDatabase).length;
    const totalPosts = Object.values(postsDatabase).reduce((sum, posts) => sum + posts.length, 0);

    res.json({
        status: 'online',
        zoneCount: zoneCount,
        totalPosts: totalPosts,
        postIdCounter: postIdCounter,
        dbPath: dbPath,
        dbExists: fs.existsSync(dbPath),
        zones: Object.keys(postsDatabase).map(zoneId => ({
            zoneId,
            postCount: postsDatabase[zoneId].length
        }))
    });
});

// --------------------------
// Top-liked posts — production-ready
// - Persistent on-disk cache
// - Periodic recompute
// - Rate-limited endpoint
// - Admin refresh endpoint
// --------------------------

const TOP_LIKED_TTL_MS = parseInt(process.env.TOP_LIKED_TTL_MS || String(30 * 1000), 10); // default 30s
const TOP_LIKED_RECOMPUTE_MS = parseInt(process.env.TOP_LIKED_RECOMPUTE_MS || String(60 * 1000), 10); // default 60s
const TOP_LIKED_PERSIST_PATH = path.join(__dirname, 'top_liked_cache.json');

let topLikedCache = { ts: 0, ttl: TOP_LIKED_TTL_MS, data: [] };

function persistTopLikedCache() {
    try {
        const out = { ts: topLikedCache.ts, ttl: topLikedCache.ttl, data: topLikedCache.data };
        fs.writeFileSync(TOP_LIKED_PERSIST_PATH, JSON.stringify(out, null, 2));
    } catch (e) { console.warn('persistTopLikedCache failed', e && e.message); }
}

function loadTopLikedCacheFromDisk() {
    try {
        if (fs.existsSync(TOP_LIKED_PERSIST_PATH)) {
            const raw = fs.readFileSync(TOP_LIKED_PERSIST_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.data)) {
                topLikedCache = { ts: parsed.ts || Date.now(), ttl: parsed.ttl || TOP_LIKED_TTL_MS, data: parsed.data };
                sLog('Loaded top-liked cache from disk, items=', topLikedCache.data.length);
            }
        }
    } catch (e) { console.warn('loadTopLikedCacheFromDisk failed', e && e.message); }
}

async function computeTopLiked() {
    try {
        let allPosts = [];
        for (const zid in postsDatabase) {
            const arr = postsDatabase[zid] || [];
            allPosts = allPosts.concat(arr.map(p => ({ ...p, zoneId: zid })));
        }

        if (!allPosts.length) {
            // fallback to test-posts.json
            try {
                const testPath = path.join(__dirname, 'test-posts.json');
                if (fs.existsSync(testPath)) {
                    const raw = fs.readFileSync(testPath, 'utf8');
                    const parsed = JSON.parse(raw);
                    const arr = Array.isArray(parsed) ? parsed : (parsed.posts || []);
                    allPosts = arr.map((p, i) => ({ id: p.id || `tp-${i}`, title: p.title || p.body || 'POST', body: p.body || p.title || '', likes: p.likes || 0, area: p.area || null }));
                }
            } catch (e) { /* ignore */ }
        }

        if (!allPosts.length) {
            allPosts = [{ id: 'post-1', title: 'POST1', body: 'POST1', likes: 0, area: 'Test Neighborhood' }];
        }

        allPosts.sort((a,b) => {
            const la = (a.likes || 0); const lb = (b.likes || 0);
            if (lb !== la) return lb - la;
            const ta = a.timestamp || 0; const tb = b.timestamp || 0;
            return tb - ta;
        });

        topLikedCache = { ts: Date.now(), ttl: TOP_LIKED_TTL_MS, data: allPosts.slice(0, 100) };
        persistTopLikedCache();
        return topLikedCache;
    } catch (e) {
        console.error('computeTopLiked error', e);
        return topLikedCache;
    }
}

// Load persisted cache on startup
loadTopLikedCacheFromDisk();

// Periodic recompute (best-effort background job)
setInterval(() => { try { computeTopLiked(); } catch (e) { sWarn('Recompute top-liked failed', e); } }, TOP_LIKED_RECOMPUTE_MS);

// --------------------------
// Server-side: Best-post per zone (authoritative)
// - Compute a single "best" post for each zone using likes, boost, and recency
// - Persist to disk and expose via API endpoints for clients to fetch
// - Admin endpoint to force refresh
// --------------------------

const BEST_POSTS_TTL_MS = parseInt(process.env.BEST_POSTS_TTL_MS || String(30 * 1000), 10); // 30s
const BEST_POSTS_RECOMPUTE_MS = parseInt(process.env.BEST_POSTS_RECOMPUTE_MS || String(60 * 1000), 10); // 60s
const BEST_POSTS_PERSIST_PATH = path.join(__dirname, 'best_posts_cache.json');

let bestPostsCache = { ts: 0, ttl: BEST_POSTS_TTL_MS, data: {} };

function persistBestPostsCache() {
    try {
        const out = { ts: bestPostsCache.ts, ttl: bestPostsCache.ttl, data: bestPostsCache.data };
        fs.writeFileSync(BEST_POSTS_PERSIST_PATH, JSON.stringify(out, null, 2));
    } catch (e) { sWarn('persistBestPostsCache failed', e && e.message); }
}

function loadBestPostsCacheFromDisk() {
    try {
        if (fs.existsSync(BEST_POSTS_PERSIST_PATH)) {
            const raw = fs.readFileSync(BEST_POSTS_PERSIST_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.data) {
                bestPostsCache = { ts: parsed.ts || Date.now(), ttl: parsed.ttl || BEST_POSTS_TTL_MS, data: parsed.data };
                sLog('Loaded best-posts cache from disk, zones=', Object.keys(bestPostsCache.data).length);
            }
        }
    } catch (e) { sWarn('loadBestPostsCacheFromDisk failed', e && e.message); }
}

function computeBestPosts() {
    try {
        const now = Date.now();
        const BOOST_WEIGHT = 1000; // boost gives a big bump
        const RECENCY_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day for recency bonus

        const out = {};
        for (const zid in postsDatabase) {
            const arr = postsDatabase[zid] || [];
            if (!arr.length) continue;

            let best = null;
            let bestScore = -Infinity;
                for (const p of arr) {
                const likes = Number(p.likes || 0);
                const boost = (p.boostStatus === 'active' || (p.boostExpiresAt && Number(p.boostExpiresAt) > now)) ? 1 : 0;
                const ageMs = now - (p.timestamp || now);
                const recencyBonus = Math.max(0, (RECENCY_WINDOW_MS - Math.min(RECENCY_WINDOW_MS, ageMs)) / RECENCY_WINDOW_MS);
                    // ML scorer contribution (if enabled)
                    let mlScore = 0;
                    try {
                        if (isMlEnabledForZone(zid) && modelScorer && typeof modelScorer.model !== 'undefined') {
                            const loader = require('./ml/model_loader');
                            mlScore = Number(loader.scoreWithModel(modelScorer.model, p) || 0);
                        } else if (isMlEnabledForZone(zid) && mlScorer && typeof mlScorer.score === 'function') {
                            mlScore = Number(mlScorer.score(p) || 0);
                        }
                    } catch (e) { mlScore = 0; }
                    // Score = likes + boostWeight*boost + recencyBonus (0..1) + scaled mlScore
                    const score = likes + (BOOST_WEIGHT * boost) + recencyBonus + (mlScore * 10);
                if (score > bestScore) { bestScore = score; best = p; }
            }

            if (best) {
                out[zid] = { postId: best.id, score: bestScore, computedAt: now, zoneId: zid, snapshot: { id: best.id, likes: best.likes || 0, boostStatus: best.boostStatus || null, timestamp: best.timestamp || null, title: best.title || null } };
            }
        }

        const prev = bestPostsCache && bestPostsCache.data ? bestPostsCache.data : {};
        bestPostsCache = { ts: now, ttl: BEST_POSTS_TTL_MS, data: out };
        persistBestPostsCache();
        sLog('computeBestPosts: computed best posts for zones=', Object.keys(out).length);

        // Broadcast per-zone diffs to SSE clients subscribed to those zones
        try {
            const changedZones = [];
            for (const zid of Object.keys(out)) {
                const prevPostId = prev[zid] && prev[zid].postId ? String(prev[zid].postId) : null;
                const newPostId = out[zid] && out[zid].postId ? String(out[zid].postId) : null;
                if (prevPostId !== newPostId) changedZones.push(zid);
            }

            if (changedZones.length > 0 && Array.isArray(global.__sseClients) && global.__sseClients.length > 0) {
                for (const client of global.__sseClients.slice()) {
                    try {
                        // If client subscribed to a zone, only send if that zone changed
                        if (client.zoneId) {
                            if (!changedZones.includes(client.zoneId)) continue;
                            const payload = JSON.stringify({ zoneId: client.zoneId, best: out[client.zoneId] || null });
                            client.res.write(`event: best_post_update\n`);
                            client.res.write(`data: ${payload}\n\n`);
                        } else {
                            // Generic client: send summary of changed zones
                            const payload = JSON.stringify({ changed: changedZones, ts: now });
                            client.res.write(`event: best_posts_summary\n`);
                            client.res.write(`data: ${payload}\n\n`);
                        }
                    } catch (e) {
                        // ignore client write errors
                    }
                }
            }
        } catch (e) { sWarn('broadcast best-posts SSE failed', e && e.message); }

        // increment metric
        try { metricsCounters.best_recomputes = (metricsCounters.best_recomputes || 0) + 1; } catch (e) {}

        return bestPostsCache;
    } catch (e) {
        sErr('computeBestPosts error', e && e.message);
        return bestPostsCache;
    }
}

// Load persisted best-posts on startup
loadBestPostsCacheFromDisk();

// Periodic recompute
setInterval(() => { try { computeBestPosts(); } catch (e) { sWarn('Recompute best-posts failed', e); } }, BEST_POSTS_RECOMPUTE_MS);

// API: fetch best post for a zone
app.get('/api/posts/best/:zoneId', (req, res) => {
    try {
        const zoneId = req.params.zoneId;
        const cached = bestPostsCache.data && bestPostsCache.data[zoneId];
        if (cached) return res.json({ best: cached, cached: true, ageMs: Date.now() - bestPostsCache.ts });

        // Fallback: compute on-demand for this zone
        const arr = postsDatabase[zoneId] || [];
        if (!arr.length) return res.json({ best: null });
        let best = null; let bestScore = -Infinity; const now = Date.now();
        for (const p of arr) {
            const likes = Number(p.likes || 0);
            const boost = (p.boostStatus === 'active' || (p.boostExpiresAt && Number(p.boostExpiresAt) > now)) ? 1 : 0;
            const ageMs = now - (p.timestamp || now);
            const recencyBonus = Math.max(0, ((24*60*60*1000) - Math.min(24*60*60*1000, ageMs)) / (24*60*60*1000));
            const score = likes + (1000 * boost) + recencyBonus;
            if (score > bestScore) { bestScore = score; best = p; }
        }
        const out = { postId: best.id, score: bestScore, snapshot: { id: best.id, likes: best.likes || 0, boostStatus: best.boostStatus || null, timestamp: best.timestamp || null } };
        return res.json({ best: out, cached: false });
    } catch (e) { sErr('GET /api/posts/best/:zoneId error', e && e.message); return res.status(500).json({ error: 'internal' }); }
});

// API: fetch all best posts (rate-limited lightly)
app.get('/api/posts/best', (req, res) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(ip)) return res.status(429).json({ error: 'rate_limited' });
        return res.json({ best: bestPostsCache.data || {}, cached: true, ageMs: Date.now() - bestPostsCache.ts });
    } catch (e) { sErr('GET /api/posts/best error', e && e.message); return res.status(500).json({ error: 'internal' }); }
});

// Admin endpoint to recompute immediately
app.post('/api/admin/refresh-best', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        computeBestPosts();
        return res.json({ success: true, refreshedAt: bestPostsCache.ts });
    } catch (e) { sErr('POST /api/admin/refresh-best error', e && e.message); return res.status(500).json({ error: 'internal' }); }
});

// Admin: reload ML scorer plugin
app.post('/api/admin/reload-ml', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        loadMlScorer();
        return res.json({ success: true, loaded: !!mlScorer });
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
});

// Admin: load JSON model from disk
app.post('/api/admin/load-model', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        loadModelFromDisk();
        return res.json({ success: true, loaded: !!modelScorer });
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
});

// Admin: enable/disable ML scoring
app.post('/api/admin/enable-ml', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        mlEnabled = true; return res.json({ success: true, mlEnabled: true });
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
});
app.post('/api/admin/disable-ml', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        mlEnabled = false; return res.json({ success: true, mlEnabled: false });
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
});

// Admin: per-zone ML canary toggles
app.post('/api/admin/enable-ml-zone', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        const zone = req.body && req.body.zoneId;
        if (!zone) return res.status(400).json({ error: 'zoneId required' });
        mlEnabledZones[zone] = true;
        return res.json({ success: true, zone, enabled: true });
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
});
app.post('/api/admin/disable-ml-zone', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        const zone = req.body && req.body.zoneId;
        if (!zone) return res.status(400).json({ error: 'zoneId required' });
        delete mlEnabledZones[zone];
        return res.json({ success: true, zone, enabled: false });
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
});

// Server-Sent Events clients container (shared across module)
global.__sseClients = global.__sseClients || []; // array of { res, zoneId }

// SSE endpoint for best-post updates (supports per-zone subscription via ?zoneId=...)
app.get('/api/posts/best/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`: connected\n\n`);
    const zoneId = req.query.zoneId || null;
    const client = { res, zoneId };
    global.__sseClients.push(client);
    req.on('close', () => {
        const idx = global.__sseClients.indexOf(client);
        if (idx !== -1) global.__sseClients.splice(idx, 1);
    });
});

// Simple rate limiter per IP for the top-liked endpoint
const rateLimitMap = {}; // ip -> { count, windowStart }
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.TOP_LIKED_RATE_LIMIT || '60', 10); // 60 req/min per IP default

function checkRateLimit(ip) {
    try {
        const now = Date.now();
        const rec = rateLimitMap[ip] || { count: 0, windowStart: now };
        if (now - rec.windowStart > RATE_LIMIT_WINDOW_MS) {
            rec.count = 0; rec.windowStart = now;
        }
        rec.count += 1;
        rateLimitMap[ip] = rec;
        return rec.count <= RATE_LIMIT_MAX;
    } catch (e) { return true; }
}

// Basic in-memory metrics counters (exported via /metrics for Prometheus scraping)
const metricsCounters = {
    impressions: 0,
    clicks: 0,
    locations: 0,
    best_recomputes: 0,
    top_liked_recomputes: 0
};

// Admin authentication helper
function isAdminAuthenticated(req) {
    try {
        const password = req.headers['x-admin-password'] || (req.body && req.body.adminPassword) || (req.query && req.query.adminPassword);
        // If ADMIN_PASSWORD is configured, require it. Otherwise allow weak fallback only when explicitly permitted.
        if (process.env.ADMIN_PASSWORD && String(process.env.ADMIN_PASSWORD).length > 0) {
            if (password === process.env.ADMIN_PASSWORD) return true;
            // allow weak fallback only if explicitly enabled by ALLOW_WEAK_ADMIN env var
            if (process.env.ALLOW_WEAK_ADMIN === '1' && password === '19696') return true;
            return false;
        }
        // No ADMIN_PASSWORD set: allow only when ALLOW_WEAK_ADMIN is set to '1' and password matches legacy value
        if (process.env.ALLOW_WEAK_ADMIN === '1' && password === '19696') return true;
        return false;
    } catch (e) { return false; }
}

// Prometheus-style metrics endpoint
app.get('/metrics', (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/plain; version=0.0.4');
        const lines = [];
        lines.push(`# HELP fedex_impressions_total Number of post impressions recorded`);
        lines.push(`# TYPE fedex_impressions_total counter`);
        lines.push(`fedex_impressions_total ${metricsCounters.impressions}`);
        lines.push(`# HELP fedex_clicks_total Number of post clicks recorded`);
        lines.push(`# TYPE fedex_clicks_total counter`);
        lines.push(`fedex_clicks_total ${metricsCounters.clicks}`);
        lines.push(`# HELP fedex_location_snapshots_total Number of location snapshots received`);
        lines.push(`# TYPE fedex_location_snapshots_total counter`);
        lines.push(`fedex_location_snapshots_total ${metricsCounters.locations}`);
        lines.push(`# HELP fedex_best_recomputes_total Number of best-post recomputes`);
        lines.push(`# TYPE fedex_best_recomputes_total counter`);
        lines.push(`fedex_best_recomputes_total ${metricsCounters.best_recomputes}`);
        lines.push(`# HELP fedex_top_liked_recomputes_total Number of top-liked recomputes`);
        lines.push(`# TYPE fedex_top_liked_recomputes_total counter`);
        lines.push(`fedex_top_liked_recomputes_total ${metricsCounters.top_liked_recomputes}`);
        res.send(lines.join('\n') + '\n');
    } catch (e) { res.status(500).send('error'); }
});

app.get('/api/posts/top-liked', (req, res) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(ip)) return res.status(429).json({ error: 'rate_limited' });

        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '100', 10)));

        // If cache fresh, return it
        if (Date.now() - topLikedCache.ts < topLikedCache.ttl && topLikedCache.data && topLikedCache.data.length) {
            return res.json({ posts: topLikedCache.data.slice(0, limit), cached: true, ttl: topLikedCache.ttl, ageMs: Date.now() - topLikedCache.ts });
        }

        // Otherwise compute on-demand but keep it guarded
        computeTopLiked().then(cache => {
            return res.json({ posts: cache.data.slice(0, limit), cached: false, ttl: cache.ttl });
        }).catch(err => {
            console.error('/api/posts/top-liked compute failed', err);
            return res.status(500).json({ error: 'compute_failed' });
        });
    } catch (error) {
        console.error('/api/posts/top-liked error', error);
        res.status(500).json({ error: String(error) });
    }
});

// (metrics endpoints implemented below with file-backed logs and counters)

// Admin endpoint: force refresh of top-liked cache (protected by ADMIN_PASSWORD or env)
app.post('/api/admin/refresh-top-liked', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
    computeTopLiked().then(cache => res.json({ success: true, items: cache.data.length })).catch(e => res.status(500).json({ success: false, error: String(e) }));
});

// --------------------------
// Metrics endpoints (lightweight)
// --------------------------
const metricsDir = path.join(__dirname, 'metrics');
if (!fs.existsSync(metricsDir)) try { fs.mkdirSync(metricsDir); } catch(e) {}

// ML data dir for training event collection and optional JS scorer hook
const ML_DATA_DIR = path.join(__dirname, 'ml', 'data');
if (!fs.existsSync(ML_DATA_DIR)) try { fs.mkdirSync(ML_DATA_DIR, { recursive: true }); } catch(e) {}

// Optional JS-based scorer plugin: exports.score(post) -> numeric
let mlScorer = null;
function loadMlScorer() {
    try {
        delete require.cache[require.resolve('./ml/scorer')];
        mlScorer = require('./ml/scorer');
        sLog('ML scorer loaded');
    } catch (e) { mlScorer = null; sWarn('No ML scorer available', e && e.message); }
}
loadMlScorer();

// Runtime JSON model loader (trained model) and toggle
let modelScorer = null;
let mlEnabled = (process.env.ML_ENABLED === '1');
// per-zone ML canary toggles
const mlEnabledZones = {}; // zoneId -> true
function loadModelFromDisk() {
    try {
        const p = path.join(__dirname, 'ml', 'model.json');
        if (!fs.existsSync(p)) { modelScorer = null; sWarn('No ml/model.json found'); return; }
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        // parsed expected to have coef (2d), intercept (1d)
        modelScorer = { model: parsed };
        sLog('ML model loaded from disk');
    } catch (e) { modelScorer = null; sWarn('Failed loading model.json', e && e.message); }
}
loadModelFromDisk();

function isMlEnabledForZone(zoneId) {
    try { return mlEnabled || (zoneId && !!mlEnabledZones[zoneId]); } catch (e) { return !!mlEnabled; }
}

app.post('/api/metrics/impression', (req, res) => {
    try {
        const payload = req.body || {};
        payload.ts = Date.now();
        const line = JSON.stringify({ type: 'impression', ...payload }) + '\n';
        fs.appendFile(path.join(metricsDir, 'impressions.log'), line, () => {});
        try { metricsCounters.impressions = (metricsCounters.impressions || 0) + 1; } catch(e){}
        // also store lightweight event for ML training
        try {
            const ev = { kind: 'impression', ts: Date.now(), postId: payload.postId || null, zoneId: payload.zoneId || null };
            fs.appendFile(path.join(ML_DATA_DIR, 'events.jsonl'), JSON.stringify(ev) + '\n', () => {});
        } catch(e) {}
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, error: String(e) });
    }
});

app.post('/api/metrics/click', (req, res) => {
    try {
        const payload = req.body || {};
        payload.ts = Date.now();
        const line = JSON.stringify({ type: 'click', ...payload }) + '\n';
        fs.appendFile(path.join(metricsDir, 'clicks.log'), line, () => {});
        try { metricsCounters.clicks = (metricsCounters.clicks || 0) + 1; } catch(e){}
        try {
            const ev = { kind: 'click', ts: Date.now(), postId: payload.postId || null, zoneId: payload.zoneId || null }; 
            fs.appendFile(path.join(ML_DATA_DIR, 'events.jsonl'), JSON.stringify(ev) + '\n', () => {});
        } catch(e) {}
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, error: String(e) });
    }
});

// Ingest batched location snapshots
// Lightweight rate limiting for location uploads (per IP)
const locationRateLimitMap = {};
const LOCATION_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const LOCATION_RATE_LIMIT_MAX = parseInt(process.env.LOCATION_RATE_LIMIT || '120', 10); // 120 req/min per IP default

function checkLocationRateLimit(ip) {
    try {
        const now = Date.now();
        const rec = locationRateLimitMap[ip] || { count: 0, windowStart: now };
        if (now - rec.windowStart > LOCATION_RATE_LIMIT_WINDOW_MS) {
            rec.count = 0; rec.windowStart = now;
        }
        rec.count += 1;
        locationRateLimitMap[ip] = rec;
        return rec.count <= LOCATION_RATE_LIMIT_MAX;
    } catch (e) { return true; }
}

app.post('/api/metrics/location', (req, res) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        if (!checkLocationRateLimit(ip)) return res.status(429).json({ error: 'rate_limited' });

        const payload = req.body || {};
        const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [payload];

        if (!snapshots.length) return res.status(400).json({ error: 'no_snapshots' });
        if (snapshots.length > 500) return res.status(400).json({ error: 'too_many_snapshots', max: 500 });

        const sanitized = snapshots.map(s => {
            const out = {};
            if (s && typeof s === 'object') {
                out.userId = s.userId || null;
                out.ts = Number(s.ts) || Date.now();
                out.areaTag = (s.areaTag && String(s.areaTag)) || null;

                // Only accept numeric lat/lon in reasonable ranges; otherwise null
                const lat = (s.lat !== undefined && s.lat !== null) ? Number(s.lat) : null;
                const lon = (s.lon !== undefined && s.lon !== null) ? Number(s.lon) : null;
                if (lat !== null && !Number.isFinite(lat)) out.lat = null; else out.lat = lat;
                if (lon !== null && !Number.isFinite(lon)) out.lon = null; else out.lon = lon;

                out.accuracy = (s.accuracy !== undefined && s.accuracy !== null) ? Number(s.accuracy) : null;
            } else {
                out.ts = Date.now();
            }
            return out;
        });

        const lines = sanitized.map(item => JSON.stringify({ type: 'location', ...item }) + '\n').join('');
        fs.appendFile(path.join(metricsDir, 'locations.log'), lines, () => {});
        try { metricsCounters.locations = (metricsCounters.locations || 0) + sanitized.length; } catch(e){}
        try {
            const evs = sanitized.map(item => ({ kind: 'location', ts: Date.now(), lat: item.lat || null, lon: item.lon || null, userId: item.userId || null }));
            const out = evs.map(e => JSON.stringify(e)).join('\n') + '\n';
            fs.appendFile(path.join(ML_DATA_DIR, 'events.jsonl'), out, () => {});
        } catch(e) {}
        return res.json({ success: true, written: sanitized.length });
    } catch (e) {
        return res.status(500).json({ success: false, error: String(e) });
    }
});

// Admin: list available metric log files
app.get('/api/admin/metrics/list', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        const files = fs.readdirSync(metricsDir).filter(f => f.endsWith('.log') || f.includes('.log.'));
        res.json({ success: true, files });
    } catch (e) { res.status(500).json({ success: false, error: String(e) }); }
});

// Admin: download a metric file (protected)
app.get('/api/admin/metrics/download', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
    const file = req.query.file;
    if (!file || typeof file !== 'string') return res.status(400).json({ error: 'missing_file' });
    // Prevent path traversal
    if (file.includes('..') || file.includes('/') || file.includes('\\')) return res.status(400).json({ error: 'invalid_file' });
    const full = path.join(metricsDir, file);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'not_found' });
    res.download(full);
    } catch (e) { return res.status(500).json({ success: false, error: String(e) }); }
});

// Admin: rotate metric logs (move to timestamped archive)
app.post('/api/admin/metrics/rotate', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        const baseFiles = ['impressions.log', 'clicks.log', 'locations.log'];
        const rotated = [];
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        for (const f of baseFiles) {
            const src = path.join(metricsDir, f);
            if (fs.existsSync(src)) {
                const dest = path.join(metricsDir, `${f}.${ts}`);
                try { fs.renameSync(src, dest); fs.writeFileSync(src, ''); rotated.push({ from: f, to: path.basename(dest) }); } catch (e) { rotated.push({ from: f, error: String(e) }); }
            }
        }
        return res.json({ success: true, rotated });
    } catch (e) {
        return res.status(500).json({ success: false, error: String(e) });
    }
});

// Daily retention cleanup for archived metric logs
const METRICS_RETENTION_DAYS = parseInt(process.env.METRICS_RETENTION_DAYS || '30', 10);
setInterval(() => {
    try {
        const files = fs.readdirSync(metricsDir);
        const now = Date.now();
        for (const f of files) {
            // Only remove rotated files which include .log.
            if (!f.includes('.log.')) continue;
            const full = path.join(metricsDir, f);
            try {
                const st = fs.statSync(full);
                const ageDays = (now - st.mtimeMs) / (1000 * 60 * 60 * 24);
                if (ageDays > METRICS_RETENTION_DAYS) {
                    fs.unlinkSync(full);
                }
            } catch (e) { /* ignore per-file errors */ }
        }
    } catch (e) { sWarn('metrics cleanup failed', e && e.message); }
}, 24 * 60 * 60 * 1000);

// Admin: Get all zones and posts
app.get('/api/admin/zones', (req, res) => {
    const zones = {};
    for (const zoneId in postsDatabase) {
        zones[zoneId] = postsDatabase[zoneId].map(post => ({
            id: post.id,
            content: post.content ? post.content.substring(0, 50) + '...' : 'No text',
            timestamp: new Date(post.timestamp).toISOString(),
            likes: post.likes,
            dislikes: post.dislikes,
            hasImage: !!post.imageData
        }));
    }
    res.json({ zones });
});

// Admin: Clear a zone's posts (protected)
app.delete('/api/admin/zone/:zoneId', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'Unauthorized' });
    } catch (e) { return res.status(500).json({ error: String(e) }); }
    
    const zoneId = req.params.zoneId;
    if (postsDatabase[zoneId]) {
        delete postsDatabase[zoneId];
        saveDatabase();
        res.json({ success: true, message: `Cleared zone: ${zoneId}` });
    } else {
        res.status(404).json({ error: 'Zone not found' });
    }
});

// Admin: retag a post (change `zoneTag` and optionally move to a new `zoneId`) - protected
app.post('/api/admin/retag', (req, res) => {
    try {
        if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'unauthorized' });
        const { postId, newZoneTag, newZoneId } = req.body || {};
        if (!postId || (!newZoneTag && !newZoneId)) return res.status(400).json({ error: 'postId and newZoneTag or newZoneId required' });

        for (const zid of Object.keys(postsDatabase)) {
            const idx = postsDatabase[zid].findIndex(p => String(p.id) === String(postId));
            if (idx !== -1) {
                const post = postsDatabase[zid][idx];
                const before = { zoneTag: post.zoneTag || null, zoneId: zid };
                if (newZoneTag) post.zoneTag = newZoneTag;
                // If newZoneId provided and different, move the post between zone arrays
                if (newZoneId && String(newZoneId) !== String(zid)) {
                    // remove from old zone
                    postsDatabase[zid].splice(idx, 1);
                    if (!postsDatabase[newZoneId]) postsDatabase[newZoneId] = [];
                    // set zoneId property on post for consistency
                    post.zoneId = newZoneId;
                    postsDatabase[newZoneId].push(post);
                }
                saveDatabase();
                sLog(`[admin retag] post=${postId} before=${JSON.stringify(before)} after=${JSON.stringify({ zoneTag: post.zoneTag || null, zoneId: post.zoneId || newZoneId || zid })}`);
                return res.json({ success: true, post });
            }
        }

        return res.status(404).json({ error: 'Post not found' });
    } catch (e) {
        sErr('POST /api/admin/retag error', e && e.message);
        return res.status(500).json({ success: false, error: String(e) });
    }
});

// Video Moderation Endpoint
app.post('/api/moderate-video', async (req, res) => {
    try {
        const { videoUrl, postId, zoneId } = req.body;
        
        sLog('🎥 Video moderation check:', videoUrl);

        if (!ENABLE_MODERATION) {
            sLog('[moderation] Video moderation disabled by ENABLE_MODERATION flag; allowing by default', videoUrl);
            return res.json({ success: true, isFlagged: false, moderationReason: 'moderation-disabled', explicitConfidence: 0, violenceConfidence: 0, postId, zoneId });
        }
        
        // IMPORTANT: Moderation is set to ALLOW ALL for now
        // Google Cloud Vision was too strict and blocking legitimate content
        // To enable moderation, change isFlagged logic below
        
        // Initialize client with service account
        const client = new video.VideoIntelligenceServiceClient();
        
        const request = {
            inputUri: videoUrl,
            features: ['EXPLICIT_CONTENT_DETECTION', 'VIOLENCE_DETECTION'],
            videoContext: {
                explicitContentDetectionConfig: {
                    model: 'builtin/default'
                }
            }
        };
        
        // Run moderation analysis
        sLog('📡 Sending to Google Cloud Vision...');
        const [operation] = await client.annotateVideo(request);
        sLog('⏳ Waiting for analysis (this may take 30-60 seconds)...');
        const [response] = await operation.promise();
        sLog('✅ Analysis complete');
        
        // Extract results
        const annotationResult = response.annotationResults[0] || {};
        const explicitAnnotation = annotationResult.explicitAnnotation || {};
        const violenceAnnotations = annotationResult.violenceAnnotations || [];
        
        // Check for explicit content
        let isFlagged = false;
        let moderationReason = '';
        let explicitConfidence = 0;
        let violenceConfidence = 0;
        
        // ⚠️ MODERATION CURRENTLY DISABLED FOR USER TESTING
        // Threshold set to impossible level (6) so nothing is flagged
        // This prevents legitimate content from being rejected
        // To re-enable: change >= 6 to >= 4 for explicit, >= 0.85 for violence
        
        const MODERATION_ENABLED = false; // Set to true to enable
        
        // Explicit Content Detection
        // Likelihood: UNKNOWN=0, VERY_UNLIKELY=1, UNLIKELY=2, POSSIBLE=3, LIKELY=4, VERY_LIKELY=5
        if (MODERATION_ENABLED && explicitAnnotation.frames && explicitAnnotation.frames.length > 0) {
            const confidenceValues = explicitAnnotation.frames.map(f => f.pornographyLikelihood || 0);
            explicitConfidence = Math.max(...confidenceValues);
            sLog('📊 Explicit content confidence:', explicitConfidence, '(5=VERY_LIKELY, 4=LIKELY)');
            
            if (explicitConfidence >= 4) {
                isFlagged = true;
                moderationReason = 'Explicit/Nudity content detected';
            }
        }
        
        // Violence Detection
        if (MODERATION_ENABLED && !isFlagged && violenceAnnotations && violenceAnnotations.length > 0) {
            const violenceScores = violenceAnnotations.map(v => v.confidence || 0);
            violenceConfidence = Math.max(...violenceScores);
            sLog('📊 Violence confidence:', violenceConfidence, '(0.85+ = flagged, reduced from 0.7)');
            
            if (violenceConfidence >= 0.85) {
                isFlagged = true;
                moderationReason = 'Violence detected';
            }
        }
        
        sLog(`✅ Moderation complete - Flagged: ${isFlagged}, Allowed: ${!isFlagged}`);
        
        res.json({
            success: true,
            isFlagged,
            moderationReason,
            explicitConfidence,
            violenceConfidence,
            postId,
            zoneId
        });
        
    } catch (error) {
        sErr('❌ Moderation error:', error.message);
        sErr('Full error:', error);
        
        // Fail-open: allow upload if moderation service is down
        res.status(500).json({ 
            success: false, 
            error: error.message,
            failOpen: true // Allow upload on error
        });
    }
});

// Photo/Image Moderation Endpoint
app.post('/api/moderate-photo', async (req, res) => {
    try {
        const { imageUrl, postId, zoneId } = req.body;
        
        sLog('📸 Photo moderation check:', imageUrl);

        if (!ENABLE_MODERATION) {
            sLog('[moderation] Photo moderation disabled by ENABLE_MODERATION flag; allowing by default', imageUrl);
            return res.json({ success: true, isFlagged: false, moderationReason: 'moderation-disabled', confidenceDetails: {}, postId, zoneId });
        }
        
        // IMPORTANT: Moderation is set to ALLOW ALL for now
        // Google Cloud Vision was too strict and blocking legitimate content
        // To enable moderation, change isFlagged logic below
        
        // Initialize Vision client
        const visionClient = new vision.ImageAnnotatorClient();
        
        // Request safe search detection (explicit content, violence, etc.)
        const request = {
            image: {
                source: { imageUri: imageUrl }
            }
        };
        
        sLog('📡 Checking with Google Cloud Vision...');
        const [result] = await visionClient.safeSearchDetection(request);
        const safeSearchResult = result.safeSearchAnnotation;
        
        sLog('✅ Analysis complete');
        sLog('  Adult likelihood:', safeSearchResult.adult);
        sLog('  Violence likelihood:', safeSearchResult.violence);
        sLog('  Racy likelihood:', safeSearchResult.racy);
        
        let isFlagged = false;
        let moderationReason = '';
        let confidenceDetails = {
            adult: safeSearchResult.adult || 'UNKNOWN',
            violence: safeSearchResult.violence || 'UNKNOWN',
            racy: safeSearchResult.racy || 'UNKNOWN'
        };
        
        // ⚠️ MODERATION CURRENTLY DISABLED FOR USER TESTING
        // Threshold set to impossible level (6) so nothing is flagged
        // This prevents legitimate content from being rejected
        // To re-enable: change >= 6 to >= 4 for adult, >= 4 for violence, >= 5 for racy
        
        const MODERATION_ENABLED = false; // Set to true to enable
        
        if (MODERATION_ENABLED && safeSearchResult.adult >= 4) {
            isFlagged = true;
            moderationReason = 'Explicit/Nudity content detected in photo';
            sLog('🚫 Flagged for adult content:', safeSearchResult.adult);
        }
        
        if (MODERATION_ENABLED && !isFlagged && safeSearchResult.violence >= 4) {
            isFlagged = true;
            moderationReason = 'Violence detected in photo';
            sLog('🚫 Flagged for violence:', safeSearchResult.violence);
        }
        
        if (MODERATION_ENABLED && !isFlagged && safeSearchResult.racy >= 5) {
            isFlagged = true;
            moderationReason = 'Racy/Suggestive content detected in photo';
            sLog('🚫 Flagged for racy content:', safeSearchResult.racy);
        }
        
        sLog(`✅ Photo moderation complete - Flagged: ${isFlagged}, Allowed: ${!isFlagged}`);
        
        res.json({
            success: true,
            isFlagged,
            moderationReason,
            confidenceDetails,
            postId,
            zoneId
        });
        
    } catch (error) {
        sErr('❌ Photo moderation error:', error.message);
        sErr('Full error:', error);
        
        // Fail-open: allow upload if moderation service is down
        res.status(500).json({ 
            success: false, 
            error: error.message,
            failOpen: true // Allow upload on error
        });
    }
});

// ============================================
// WiGLE API Integration with Regional Caching
// ============================================

const WIGLE_API_NAME = 'AIDe97cba68ed56029bcaac4988042aa344';
const WIGLE_API_TOKEN = 'c501422fd5374ad95b59890b1f33de81';

// Regional cache: stores WiFi networks by geographic tile
// Tile key format: "lat_lon" (rounded to 0.1 degree = ~7 miles)
let regionCache = {};
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Get regional tile key from coordinates
function getTileKey(lat, lon) {
    const tileLat = Math.round(lat * 10) / 10;
    const tileLon = Math.round(lon * 10) / 10;
    return `${tileLat}_${tileLon}`;
}

// Reverse geocode: get county/region name from lat/lon (simplified)
// In production, use Google Maps Geocoding API or similar
function getCountyFromCoordinates(lat, lon) {
    // Placeholder: we'll use a simple approach
    // In real implementation, would call reverse geocode service
    // For now, return general region based on coordinates
    
    // Rough US regions for demo
    if (lat > 40 && lat < 41 && lon > -74 && lon < -73) return 'New York County';
    if (lat > 37 && lat < 38 && lon > -122 && lon < -121) return 'San Francisco County';
    if (lat > 34 && lat < 35 && lon > -118 && lon < -117) return 'Los Angeles County';
    if (lat > 41 && lat < 42 && lon > -87 && lon < -86) return 'Cook County';
    if (lat > 39 && lat < 40 && lon > -104 && lon < -103) return 'Denver County';
    
    return 'Unknown County';
}

// Fetch WiFi networks from WiGLE API (with regional caching)
app.get('/api/fetch-wifi', async (req, res) => {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
        return res.status(400).json({ 
            error: 'lat and lon query parameters required' 
        });
    }
    
    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    const tileKey = getTileKey(userLat, userLon);
    
    sLog(`[${new Date().toISOString()}] 📍 WiFi request for tile: ${tileKey} (${userLat}, ${userLon})`);
    
    // Check cache first
    if (regionCache[tileKey] && regionCache[tileKey].timestamp > Date.now() - CACHE_EXPIRY) {
        sLog(`[${new Date().toISOString()}] ✅ Cache HIT for tile: ${tileKey}`);
        const county = getCountyFromCoordinates(userLat, userLon);
        return res.json({
            success: true,
            source: 'cache',
            networks: regionCache[tileKey].networks || [],
            county: county,
            cacheAge: Date.now() - regionCache[tileKey].timestamp
        });
    }
    
    sLog(`[${new Date().toISOString()}] 🔄 Cache MISS for tile: ${tileKey}`);
    
    try {
        // For now, return county without calling WiGLE (testing phase)
        // TODO: Activate WiGLE API when needed
        const county = getCountyFromCoordinates(userLat, userLon);
        
        // Initialize empty cache entry
        regionCache[tileKey] = {
            networks: [],
            timestamp: Date.now()
        };
        
        sLog(`[${new Date().toISOString()}] 📍 Returning county: ${county}`);
        
        res.json({
            success: true,
            source: 'coordinate-based',
            networks: [],
            county: county,
            resultsCount: 0
        });
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error:`, error.message);
        
        const county = getCountyFromCoordinates(userLat, userLon);
        
        res.json({
            success: false,
            error: error.message,
            county: county,
            fallback: true
        });
    }
});

// ============================================
// REVERSE GEOCODING API
// Converts lat/lon to real city/neighborhood names
// Uses OpenStreetMap Nominatim (free, no API key needed)
// ============================================

// In-memory cache for geocoding results (24 hour expiry)
let geocodeCache = {};
let geocodeSearchCache = new Map();
const GEOCODE_SEARCH_CACHE_TTL_MS = Number(process.env.GEOCODE_SEARCH_CACHE_TTL_MS || 10 * 60 * 1000);
const GEOCODE_SEARCH_CACHE_MAX = Number(process.env.GEOCODE_SEARCH_CACHE_MAX || 500);

function getGeocodeCache(lat, lon) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = geocodeCache[key];
    
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return cached.data;
    }
    return null;
}

function setGeocodeCache(lat, lon, data) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    geocodeCache[key] = {
        data: data,
        timestamp: Date.now()
    };
}

function getGeocodeSearchCache(cacheKey) {
    const cached = geocodeSearchCache.get(cacheKey);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > GEOCODE_SEARCH_CACHE_TTL_MS) {
        geocodeSearchCache.delete(cacheKey);
        return null;
    }
    return cached.results;
}

function setGeocodeSearchCache(cacheKey, results) {
    geocodeSearchCache.set(cacheKey, {
        timestamp: Date.now(),
        results
    });

    if (geocodeSearchCache.size > GEOCODE_SEARCH_CACHE_MAX) {
        const oldestKey = geocodeSearchCache.keys().next().value;
        geocodeSearchCache.delete(oldestKey);
    }
}

function httpsGetJson(requestUrl, headers = {}, timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
        const req = https.get(requestUrl, { headers }, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }

                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error('Geocoding request timed out'));
        });
    });
}

function normalizeSearchResult(item) {
    if (!item || typeof item !== 'object') return null;

    const address = item.address || {};
    const city = address.city || address.town || address.village || address.hamlet || address.municipality || address.county || '';
    const stateOrProvince = address.state || address.province || address.region || address.state_district || '';
    const country = address.country || '';

    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const displayName = item.display_name || item.name || [city, stateOrProvince, country].filter(Boolean).join(', ') || 'Unknown';
    const shortName = item.name || city || displayName;
    const locationId = item.place_id != null
        ? `nominatim:${item.place_id}`
        : `${String(item.osm_type || 'osm')}:${String(item.osm_id || shortName)}`;

    return {
        locationId,
        displayName,
        name: shortName,
        city,
        stateOrProvince,
        country,
        latitude: lat,
        longitude: lon,
        osmType: item.osm_type || null,
        osmId: item.osm_id || null,
        class: item.class || null,
        type: item.type || null
    };
}

app.get('/api/geocode/search', async (req, res) => {
    try {
        const rawQuery = String(req.query.q || '').trim();
        const query = rawQuery.replace(/\s+/g, ' ');
        const minChars = Math.max(2, Number(req.query.minChars || 2));

        if (query.length < minChars) {
            return res.status(400).json({
                success: false,
                error: `Query must be at least ${minChars} characters`,
                minChars,
                query
            });
        }

        const limit = Math.min(20, Math.max(1, Number(req.query.limit || 12)));
        const lang = String(req.query.lang || 'en').trim();
        const endpoint = process.env.GEOCODE_SEARCH_URL || 'https://nominatim.openstreetmap.org/search';
        const cacheKey = `${query.toLowerCase()}|${limit}|${lang}`;

        const cachedResults = getGeocodeSearchCache(cacheKey);
        if (cachedResults) {
            return res.json({
                success: true,
                source: 'cache',
                query,
                count: cachedResults.length,
                results: cachedResults,
                timestamp: Date.now()
            });
        }

        const searchUrl = `${endpoint}?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`;
        const payload = await httpsGetJson(searchUrl, {
            'User-Agent': process.env.GEOCODE_USER_AGENT || 'FEDEX-WiFi-App/1.0',
            'Accept-Language': lang
        }, Number(process.env.GEOCODE_SEARCH_TIMEOUT_MS || 7000));

        const rows = Array.isArray(payload) ? payload : [];
        const normalized = rows
            .map(normalizeSearchResult)
            .filter(Boolean)
            .slice(0, limit);

        setGeocodeSearchCache(cacheKey, normalized);

        return res.json({
            success: true,
            source: 'nominatim',
            query,
            count: normalized.length,
            results: normalized,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('[Geocode Search Error]', error.message);
        return res.status(502).json({
            success: false,
            error: error.message,
            source: 'error'
        });
    }
});

app.get('/api/reverse-geocode', (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing lat or lon' });
        }
        
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        
        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }
        
        // Check cache first
        const cachedResult = getGeocodeCache(latitude, longitude);
        if (cachedResult) {
            sLog(`[Geocode Cache] HIT: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
            return res.json({
                ...cachedResult,
                source: 'cache'
            });
        }
        
        // Call OpenStreetMap Nominatim API (free reverse geocoding)
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
        
        sLog(`[Geocode Request] Fetching: ${url}`);
        
        https.get(url, {
            headers: {
                'User-Agent': 'FEDEX-WiFi-App/1.0'
            }
        }, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    if (response.statusCode !== 200) {
                        throw new Error(`Nominatim API error: ${response.statusCode}`);
                    }
                    
                    const nominatimData = JSON.parse(data);
                    
                    // Extract useful location information
                    const address = nominatimData.address || {};
                    const city = address.city || address.town || address.village || address.county || 'Unknown';
                    const state = address.state || '';
                    const country = address.country || '';
                    
                    const prettyName = city && state ? `${city}, ${state}` : (city || 'Unknown');
                    const result = {
                        name: prettyName,
                        city: city,
                        state: state,
                        country: country,
                        displayName: nominatimData.display_name || prettyName,
                        neighborhood: address.neighbourhood || address.suburb || null,
                        latitude: latitude,
                        longitude: longitude,
                        success: true
                    };
                    
                    // Cache the result
                    setGeocodeCache(latitude, longitude, result);
                    
                    sLog(`[Geocode Success] ${prettyName} (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`);
                    
                    res.json({
                        ...result,
                        source: 'nominatim',
                        timestamp: Date.now()
                    });
                    
                } catch (parseError) {
                    console.error('[Geocode Parse Error]', parseError.message);
                    res.status(500).json({
                        name: `Region (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
                        success: false,
                        error: parseError.message,
                        source: 'error'
                    });
                }
            });
        }).on('error', (error) => {
            console.error('[Geocode Network Error]', error.message);
            res.status(500).json({
                name: `Region (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
                success: false,
                error: error.message,
                source: 'error'
            });
        });
        
    } catch (error) {
        console.error('[Reverse Geocoding Error]', error.message);
        
        // Fallback: return generic region name
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        
        res.status(500).json({
            name: `Region (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
            displayName: `Region (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
            city: 'Unknown',
            state: 'Unknown',
            country: 'Unknown',
            success: false,
            error: error.message,
            source: 'fallback'
        });
    }
});

// ============================================================================
// 🚀 BOOST PAYMENT ENDPOINTS (Stripe)
// ----------------------------------------------------------------------------
// /api/boost/tiers        → returns price catalog (client uses for label/PR amount)
// /api/boost/create-intent→ creates a PaymentIntent; returns clientSecret
//                           Apple Pay / Google Pay confirm with this clientSecret
//                           inline — no redirects, no popups.
// /api/boost/confirm      → (optional) server-side audit: post.id + paymentIntentId
//                           so backend can flip post.boost.active=true on its side.
// Requires env: STRIPE_SECRET_KEY  (sk_test_... for dev, sk_live_... in prod)
// ============================================================================
const BOOST_TIERS = {
    standard: { amountCents: 299, currency: 'usd', label: '$2.99', durationHours: 24 }
};
// SELL BADGE - Fixed price product for composer 'Sell' badge
const SELL_PRICE = { amountCents: 200, currency: 'usd', label: '$2.00' };
let _stripeClient = null;
function getStripeClient() {
    if (_stripeClient) return _stripeClient;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    try {
        const Stripe = require('stripe');
        _stripeClient = Stripe(key);
        return _stripeClient;
    } catch (e) {
        console.warn('[boost] stripe SDK not installed yet — run `npm i stripe` once. err:', e.message);
        return null;
    }
}
app.get('/api/boost/tiers', (req, res) => {
    res.json({ tiers: BOOST_TIERS });
});

// 🚀 DYNAMIC PRICING ENDPOINT — Returns current boost prices
// Can be updated on server without redeploying
app.get('/api/boost-prices', (req, res) => {
    // Try to load dynamic prices from file (created by admin)
    const pricesFile = path.join(__dirname, 'boost-prices.json');
    let basePrices = null;
    let priceMultipliers = null;
    
    try {
        if (fs.existsSync(pricesFile)) {
            const data = fs.readFileSync(pricesFile, 'utf8');
            const parsed = JSON.parse(data);
            basePrices = parsed.basePrices;
            priceMultipliers = parsed.priceMultipliers;
            sLog('📊 Loaded dynamic boost prices from file');
        }
    } catch (e) {
        console.warn('⚠️ Could not load dynamic prices:', e.message);
    }
    
    // Return dynamic prices if available, otherwise return defaults
    res.json({
        basePrices: basePrices || {
            standard: 299,
            premium: 799,
            elite: 1999
        },
        priceMultipliers: priceMultipliers || {
            standard: 1.0,
            premium: 1.0,
            elite: 1.0
        },
        lastUpdated: Date.now()
    });
});

// 🚀 ADMIN: Update boost prices
// POST /api/boost-prices with { basePrices: {...}, priceMultipliers: {...} }
app.post('/api/boost-prices', (req, res) => {
    const { basePrices, priceMultipliers } = req.body;
    
    if (!basePrices || !priceMultipliers) {
        return res.status(400).json({ error: 'Missing basePrices or priceMultipliers' });
    }
    
    const pricesFile = path.join(__dirname, 'boost-prices.json');
    
    try {
        fs.writeFileSync(pricesFile, JSON.stringify({
            basePrices,
            priceMultipliers,
            lastUpdated: Date.now()
        }, null, 2));
        
        sLog('💰 Updated boost prices:', basePrices);
        res.json({ success: true, basePrices, priceMultipliers });
    } catch (e) {
        console.error('Error saving prices:', e);
        res.status(500).json({ error: 'Failed to save prices' });
    }
});

app.post('/api/boost/create-intent', async (req, res) => {
    try {
        const { priceCents = 499, userId = 'anon' } = req.body || {};
        const stripe = getStripeClient();
        if (!stripe) {
            return res.status(503).json({
                error: 'Stripe not configured. Set STRIPE_SECRET_KEY env var and `npm i stripe`.'
            });
        }
        const intent = await stripe.paymentIntents.create({
            amount: priceCents,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: { kind: 'post_boost', priceCents, userId }
        });
        res.json({
            clientSecret: intent.client_secret,
            paymentIntentId: intent.id,
            amountCents: priceCents,
            currency: intent.currency || 'usd',
            label: BOOST_TIERS.standard && BOOST_TIERS.standard.label ? BOOST_TIERS.standard.label : '$?'
        });
    } catch (e) {
        console.error('[boost] create-intent failed', e);
        res.status(500).json({ error: e.message || 'create-intent failed' });
    }
});
app.post('/api/boost/confirm', async (req, res) => {
    try {
        const { paymentIntentId, postId } = req.body || {};
        const stripe = getStripeClient();
        if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const ok = intent && intent.status === 'succeeded' && intent.metadata && intent.metadata.kind === 'post_boost';
        res.json({ ok, status: intent && intent.status, postId, tier: intent && intent.metadata && intent.metadata.tier });
    } catch (e) {
        console.error('[boost] confirm failed', e);
        res.status(500).json({ error: e.message || 'confirm failed' });
    }
});

// 🚀 SELL BADGE ENDPOINTS (Stripe PaymentIntent flow similar to boost)
// /api/sell/create-intent -> creates a PaymentIntent for $2.00
// /api/sell/confirm       -> retrieves and validates the PaymentIntent
app.post('/api/sell/create-intent', async (req, res) => {
    try {
        const { priceCents = SELL_PRICE.amountCents, userId = 'anon' } = req.body || {};
        const stripe = getStripeClient();
        if (!stripe) {
            return res.status(503).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY env var and `npm i stripe`.' });
        }
        const intent = await stripe.paymentIntents.create({
            amount: priceCents,
            currency: SELL_PRICE.currency,
            automatic_payment_methods: { enabled: true },
            metadata: { kind: 'post_sell', priceCents, userId }
        });
        res.json({
            clientSecret: intent.client_secret,
            paymentIntentId: intent.id,
            amountCents: priceCents,
            currency: intent.currency || SELL_PRICE.currency,
            label: SELL_PRICE.label
        });
    } catch (e) {
        console.error('[sell] create-intent failed', e);
        res.status(500).json({ error: e.message || 'create-intent failed' });
    }
});

app.post('/api/sell/confirm', async (req, res) => {
    try {
        const { paymentIntentId, postId } = req.body || {};
        const stripe = getStripeClient();
        if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const ok = intent && intent.status === 'succeeded' && intent.metadata && intent.metadata.kind === 'post_sell';
        res.json({ ok, status: intent && intent.status, postId, amountCents: intent && intent.amount });
    } catch (e) {
        console.error('[sell] confirm failed', e);
        res.status(500).json({ error: e.message || 'confirm failed' });
    }
});

// ============================================================================
// COMBINED CHECKOUT ENDPOINT
// Creates a single PaymentIntent for multiple items (e.g. boost + sell)
// POST /api/checkout/create-intent { items: [{ kind: 'boost'|'sell', priceCents }], userId }
// Returns: { clientSecret, paymentIntentId, amountCents, currency, label }
app.post('/api/checkout/create-intent', async (req, res) => {
    try {
        const { items, totalCents, userId = 'anon' } = req.body || {};
        let amount = 0;
        const metadataItems = [];

        if (Array.isArray(items) && items.length) {
            for (const it of items) {
                const pc = parseInt((it && it.priceCents) || 0, 10) || 0;
                amount += pc;
                metadataItems.push({ kind: (it && it.kind) || 'item', priceCents: pc });
            }
        } else if (totalCents) {
            amount = parseInt(totalCents, 10) || 0;
            metadataItems.push({ kind: 'total', priceCents: amount });
        } else {
            // Fallback: combine default boost (standard) + sell
            const boostDefault = (BOOST_TIERS && BOOST_TIERS.standard && BOOST_TIERS.standard.amountCents) ? BOOST_TIERS.standard.amountCents : 299;
            amount = boostDefault + (SELL_PRICE && SELL_PRICE.amountCents ? SELL_PRICE.amountCents : 200);
            metadataItems.push({ kind: 'boost', priceCents: boostDefault });
            metadataItems.push({ kind: 'sell', priceCents: (SELL_PRICE && SELL_PRICE.amountCents) ? SELL_PRICE.amountCents : 200 });
        }

        const stripe = getStripeClient();
        if (!stripe) {
            return res.status(503).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY env var and `npm i stripe`.' });
        }

        const intent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: { kind: 'combined_checkout', items: JSON.stringify(metadataItems), userId }
        });

        res.json({
            clientSecret: intent.client_secret,
            paymentIntentId: intent.id,
            amountCents: amount,
            currency: intent.currency || 'usd',
            label: 'Combined purchase'
        });
    } catch (e) {
        console.error('[checkout] create-intent failed', e);
        res.status(500).json({ error: e.message || 'create-intent failed' });
    }
});

// Serve index.html for any non-API routes (SPA fallback)
// Use a regex route to avoid path-to-regexp parsing issues for '*' on some versions
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
    sLog(`[${new Date().toISOString()}] Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
    sErr('Server error:', err);
    // Keep process alive for transient server errors; allow operator to investigate.
});
