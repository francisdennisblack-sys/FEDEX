const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// In-memory storage for posts
let postsDatabase = {}; // { networkId: [post1, post2, ...] }
let postIdCounter = 0;

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
    res.json({ success: true, post });
});

// Delete a post
app.delete('/api/posts/:postId', (req, res) => {
    const postId = parseInt(req.params.postId);
    
    // Find and remove the post from all networks
    for (let networkId in postsDatabase) {
        postsDatabase[networkId] = postsDatabase[networkId].filter(p => p.id !== postId);
    }
    
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
            return res.json({ success: true, post });
        }
    }
    
    res.status(404).json({ error: 'Post not found' });
});

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
