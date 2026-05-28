# WiFi Grid Database System

## Overview
The WiFi Grid application now includes a **persistent local database** that saves posts and photos to disk. Each WiFi network maintains its own isolated post collection, ensuring that only users on the same network can see the same posts.

## Architecture

### Server-Side Database
- **File**: `wifi_database.json` (created in the project root)
- **Storage**: JSON file-based persistence
- **Auto-save**: Database saves to disk immediately after any create/update/delete operation
- **Network Isolation**: Posts are automatically grouped by WiFi network ID

### How It Works

#### 1. **Network Identification**
- When a user connects, the server identifies their WiFi network using their IP address
- Local networks (192.168.x.x, 10.x.x.x, 172.16-31.x.x) are grouped by subnet (first 3 IP octets)
- Example: All users on `192.168.1.x` share the same grid

#### 2. **Data Persistence**
```json
{
  "posts": {
    "192.168.1.0/24": [
      {
        "id": 0,
        "networkId": "192.168.1.0/24",
        "content": "Post text here",
        "imageData": "base64_encoded_image_data",
        "timestamp": 1621234567890,
        "likes": 5,
        "dislikes": 2
      }
    ]
  },
  "idCounter": 1,
  "lastSaved": "2026-05-21T10:30:45.123Z"
}
```

#### 3. **Post Lifecycle**
1. User posts content → Sent to `/api/posts` endpoint
2. Server creates post object with unique ID
3. Post stored in memory under network ID
4. Database file updated on disk
5. Other users on same WiFi auto-refresh and see new post

## API Endpoints

### Public Endpoints

#### Get Network ID
```
GET /api/network-id
Response: { networkId: "192.168.1.0/24", ip: "192.168.1.100" }
```

#### Get All Posts for a Network
```
GET /api/posts/:networkId
Response: { posts: [...] }
```

#### Create a New Post
```
POST /api/posts
Body: {
  networkId: "192.168.1.0/24",
  content: "Post text",
  imageData: "base64_string",
  timestamp: 1621234567890
}
Response: { success: true, post: {...} }
```

#### Update Post Votes
```
PUT /api/posts/:postId
Body: { likes: 5, dislikes: 2 }
Response: { success: true, post: {...} }
```

#### Delete a Post
```
DELETE /api/posts/:postId
Response: { success: true }
```

### Admin Endpoints

#### Get Database Status
```
GET /api/status
Response: {
  status: "online",
  networks: 3,
  totalPosts: 45,
  networks: [
    { networkId: "192.168.1.0/24", postCount: 20 },
    { networkId: "192.168.2.0/24", postCount: 25 }
  ]
}
```

#### Get All Networks and Posts (Admin)
```
GET /api/admin/networks
Response: {
  networks: {
    "192.168.1.0/24": [
      { id: 0, content: "...", timestamp: "...", likes: 5, dislikes: 2, hasImage: true }
    ]
  }
}
```

#### Clear a Network (Admin - Protected)
```
DELETE /api/admin/network/:networkId
Headers: { "x-admin-password": "19696" }
Response: { success: true, message: "Cleared network..." }
```

## Client-Side Features

### Automatic Features
- ✅ Auto-detects WiFi network on page load
- ✅ Auto-loads posts from server every 1 second
- ✅ Automatically saves posts to backend on upload
- ✅ Auto-refresh displays new posts from other users

### Post Management
- Posts are fetched from server and refreshed periodically
- Posts are grouped by WiFi network - no cross-network visibility
- User can only make one post per WiFi network
- Posts persist even if user closes browser

## File System

```
Fedex/
├── index.html              (Client-side app)
├── server.js              (Express backend)
├── package.json           (Dependencies)
├── wifi_database.json     (Persistent database - created on first run)
└── DATABASE_GUIDE.md      (This file)
```

## Running the System

### Start the Server
```bash
npm start
```
This starts the server on `http://localhost:5001` and automatically loads the existing database.

### First Run
- Server creates `wifi_database.json` automatically
- Posts begin accumulating as users add content
- Database persists across server restarts

### Accessing the App
1. Open `http://localhost:5001` in a browser
2. The app auto-detects your WiFi network
3. Your grid loads with posts from users on your network
4. Add content to the grid via the "+" button

## Database Features

### Network Isolation
- Each WiFi network is completely isolated
- Users on `192.168.1.0/24` cannot see posts from `192.168.2.0/24`
- Prevents cross-network interference

### Persistence
- All posts saved to `wifi_database.json`
- Survives server restarts
- No external database needed
- Simple file-based system

### Auto-Sync
- Client refreshes posts every 1 second
- New posts visible instantly across all users on same network
- Like/dislike votes sync in real-time

## Troubleshooting

### Posts Not Appearing
1. Check `wifi_database.json` exists in project root
2. Verify network detection: Visit `/api/network-id` endpoint
3. Check server console for errors
4. Clear browser cache and reload

### Database Corruption
1. Delete `wifi_database.json`
2. Restart server
3. Fresh database will be created

### Network Detection Not Working
- Ensure you're on the same local network as the server
- Check your IP address matches the expected subnet
- Use the `/api/status` endpoint to verify network ID

## Future Enhancements
- [ ] Add SQLite for better performance with large datasets
- [ ] Implement image file upload (instead of base64)
- [ ] Add user authentication
- [ ] Implement post search and filtering
- [ ] Add automatic cleanup of old posts
- [ ] Implement backup/restore functionality

## Security Notes
- Admin password: `19696` (should be changed in production)
- Database file contains base64 images - secure the server
- Implement HTTPS in production
- Add rate limiting for API endpoints
- Validate all user input
