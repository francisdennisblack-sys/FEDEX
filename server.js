const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
