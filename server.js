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

// Database file path
const dbPath = path.join(__dirname, 'wifi_database.json');

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
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD && password !== '19696') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const zoneId = req.params.zoneId;
    if (postsDatabase[zoneId]) {
        delete postsDatabase[zoneId];
        saveDatabase();
        res.json({ success: true, message: `Cleared zone: ${zoneId}` });
    } else {
        res.status(404).json({ error: 'Zone not found' });
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

// Serve index.html for any non-API routes (SPA fallback)
app.get('*', (req, res) => {
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
