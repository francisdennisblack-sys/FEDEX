const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// Google Cloud Video Intelligence (for videos)
const video = require('@google-cloud/video-intelligence');

// Google Cloud Vision (for images/photos)
const vision = require('@google-cloud/vision');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Serve static files (index.html and assets)
app.use(express.static(path.join(__dirname, '.')));

// Explicitly serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Database file path
const dbPath = path.join(__dirname, 'wifi_database.json');

// In-memory storage for posts (loaded from disk on startup)
let postsDatabase = {}; // { networkId: [post1, post2, ...] }
let postIdCounter = 0;

// Load posts from disk on startup
function loadDatabase() {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            const parsedData = JSON.parse(data);
            postsDatabase = parsedData.posts || {};
            postIdCounter = parsedData.idCounter || 0;
            console.log(`[${new Date().toISOString()}] Loaded ${Object.keys(postsDatabase).length} WiFi networks from database`);
            
            // Log network info
            for (const networkId in postsDatabase) {
                console.log(`  - ${networkId}: ${postsDatabase[networkId].length} posts`);
            }
        } else {
            console.log(`[${new Date().toISOString()}] No existing database found. Starting fresh.`);
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

// Get network ID based on client IP
app.get('/api/network-id', (req, res) => {
    // Get client IP from request headers
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress;

    // For local networks, use the first 3 octets (e.g., 192.168.1.x)
    // For public networks, use full IP
    let networkId;
    
    if (clientIp && (clientIp.startsWith('192.168.') || 
                     clientIp.startsWith('10.') || 
                     clientIp.startsWith('172.'))) {
        // Local network - use subnet
        const ipParts = clientIp.split('.');
        networkId = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`;
    } else {
        // Public network - use full IP
        networkId = clientIp;
    }

    res.json({ 
        networkId: networkId,
        ip: clientIp 
    });
});

// Get all posts for a network
app.get('/api/posts/:networkId', (req, res) => {
    const networkId = req.params.networkId;
    const posts = postsDatabase[networkId] || [];
    res.json({ posts });
});

// Create a new post
app.post('/api/posts', (req, res) => {
    const { networkId, content, imageData, timestamp } = req.body;
    
    if (!networkId) {
        return res.status(400).json({ error: 'networkId required' });
    }
    
    if (!postsDatabase[networkId]) {
        postsDatabase[networkId] = [];
    }
    
    const post = {
        id: postIdCounter++,
        networkId,
        content,
        imageData,
        timestamp: timestamp || Date.now(),
        likes: 0,
        dislikes: 0
    };
    
    postsDatabase[networkId].push(post);
    saveDatabase(); // Save to disk immediately
    
    res.json({ success: true, post });
});

// Delete a post
app.delete('/api/posts/:postId', (req, res) => {
    const postId = parseInt(req.params.postId);
    
    // Find and remove the post from all networks
    for (let networkId in postsDatabase) {
        postsDatabase[networkId] = postsDatabase[networkId].filter(p => p.id !== postId);
    }
    
    saveDatabase(); // Save to disk
    res.json({ success: true });
});

// Update post votes
app.put('/api/posts/:postId', (req, res) => {
    const postId = parseInt(req.params.postId);
    const { likes, dislikes } = req.body;
    
    // Find and update the post
    for (let networkId in postsDatabase) {
        const post = postsDatabase[networkId].find(p => p.id === postId);
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
    const networkCount = Object.keys(postsDatabase).length;
    const totalPosts = Object.values(postsDatabase).reduce((sum, posts) => sum + posts.length, 0);
    
    res.json({
        status: 'online',
        networks: networkCount,
        totalPosts: totalPosts,
        postIdCounter: postIdCounter,
        dbPath: dbPath,
        dbExists: fs.existsSync(dbPath),
        networks: Object.keys(postsDatabase).map(networkId => ({
            networkId,
            postCount: postsDatabase[networkId].length
        }))
    });
});

// Admin: Get all networks and posts
app.get('/api/admin/networks', (req, res) => {
    const networks = {};
    for (const networkId in postsDatabase) {
        networks[networkId] = postsDatabase[networkId].map(post => ({
            id: post.id,
            content: post.content ? post.content.substring(0, 50) + '...' : 'No text',
            timestamp: new Date(post.timestamp).toISOString(),
            likes: post.likes,
            dislikes: post.dislikes,
            hasImage: !!post.imageData
        }));
    }
    res.json({ networks });
});

// Admin: Clear a network's posts (protected)
app.delete('/api/admin/network/:networkId', (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD && password !== '19696') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const networkId = req.params.networkId;
    if (postsDatabase[networkId]) {
        delete postsDatabase[networkId];
        saveDatabase();
        res.json({ success: true, message: `Cleared network: ${networkId}` });
    } else {
        res.status(404).json({ error: 'Network not found' });
    }
});

// Video Moderation Endpoint
app.post('/api/moderate-video', async (req, res) => {
    try {
        const { videoUrl, postId, networkId } = req.body;
        
        console.log('🎥 Starting video moderation:', videoUrl);
        
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
        console.log('📡 Sending to Google Cloud Vision...');
        const [operation] = await client.annotateVideo(request);
        console.log('⏳ Waiting for analysis (this may take 30-60 seconds)...');
        const [response] = await operation.promise();
        
        console.log('✅ Analysis complete');
        
        // Extract results
        const annotationResult = response.annotationResults[0] || {};
        const explicitAnnotation = annotationResult.explicitAnnotation || {};
        const violenceAnnotations = annotationResult.violenceAnnotations || [];
        
        // Check for explicit content
        let isFlagged = false;
        let moderationReason = '';
        let explicitConfidence = 0;
        let violenceConfidence = 0;
        
        // Explicit Content Detection
        // Likelihood: UNKNOWN=0, VERY_UNLIKELY=1, UNLIKELY=2, POSSIBLE=3, LIKELY=4, VERY_LIKELY=5
        if (explicitAnnotation.frames && explicitAnnotation.frames.length > 0) {
            const confidenceValues = explicitAnnotation.frames.map(f => f.pornographyLikelihood || 0);
            explicitConfidence = Math.max(...confidenceValues);
            console.log('📊 Explicit content confidence:', explicitConfidence, '(5=VERY_LIKELY, 3=POSSIBLE)');
            
            if (explicitConfidence >= 3) {
                isFlagged = true;
                moderationReason = 'Explicit/Nudity content detected';
            }
        }
        
        // Violence Detection
        if (!isFlagged && violenceAnnotations && violenceAnnotations.length > 0) {
            const violenceScores = violenceAnnotations.map(v => v.confidence || 0);
            violenceConfidence = Math.max(...violenceScores);
            console.log('📊 Violence confidence:', violenceConfidence, '(0.7+ = flagged)');
            
            if (violenceConfidence >= 0.7) {
                isFlagged = true;
                moderationReason = 'Violence detected';
            }
        }
        
        console.log(`✅ Moderation complete - Flagged: ${isFlagged}, Reason: ${moderationReason}`);
        
        res.json({
            success: true,
            isFlagged,
            moderationReason,
            explicitConfidence,
            violenceConfidence,
            postId,
            networkId
        });
        
    } catch (error) {
        console.error('❌ Moderation error:', error.message);
        console.error('Full error:', error);
        
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
        const { imageUrl, postId, networkId } = req.body;
        
        console.log('📸 Starting photo moderation:', imageUrl);
        
        // Initialize Vision client
        const visionClient = new vision.ImageAnnotatorClient();
        
        // Request safe search detection (explicit content, violence, etc.)
        const request = {
            image: {
                source: { imageUri: imageUrl }
            }
        };
        
        console.log('📡 Sending to Google Cloud Vision...');
        const [result] = await visionClient.safeSearchDetection(request);
        const safeSearchResult = result.safeSearchAnnotation;
        
        console.log('✅ Analysis complete');
        
        let isFlagged = false;
        let moderationReason = '';
        let confidenceDetails = {
            adult: safeSearchResult.adult || 'UNKNOWN',
            violence: safeSearchResult.violence || 'UNKNOWN',
            racy: safeSearchResult.racy || 'UNKNOWN'
        };
        
        // Likelihood scale: UNKNOWN=0, VERY_UNLIKELY=1, UNLIKELY=2, POSSIBLE=3, LIKELY=4, VERY_LIKELY=5
        // Flag if adult (explicit/nudity) or violence is POSSIBLE or higher
        
        if (safeSearchResult.adult >= 3) { // POSSIBLE or higher
            isFlagged = true;
            moderationReason = 'Explicit/Nudity content detected in photo';
            console.log('🚫 Flagged for adult content:', safeSearchResult.adult);
        }
        
        if (!isFlagged && safeSearchResult.violence >= 3) { // POSSIBLE or higher
            isFlagged = true;
            moderationReason = 'Violence detected in photo';
            console.log('🚫 Flagged for violence:', safeSearchResult.violence);
        }
        
        if (!isFlagged && safeSearchResult.racy >= 4) { // LIKELY or VERY_LIKELY
            isFlagged = true;
            moderationReason = 'Racy/Suggestive content detected in photo';
            console.log('🚫 Flagged for racy content:', safeSearchResult.racy);
        }
        
        console.log(`✅ Photo moderation complete - Flagged: ${isFlagged}, Reason: ${moderationReason}`);
        
        res.json({
            success: true,
            isFlagged,
            moderationReason,
            confidenceDetails,
            postId,
            networkId
        });
        
    } catch (error) {
        console.error('❌ Photo moderation error:', error.message);
        console.error('Full error:', error);
        
        // Fail-open: allow upload if moderation service is down
        res.status(500).json({ 
            success: false, 
            error: error.message,
            failOpen: true // Allow upload on error
        });
    }
});

// Serve index.html for any non-API routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
