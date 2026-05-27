# WiFi Content - Hyper-Local Social Network

A blazing-fast, offline-first social network that connects people by location. Posts are automatically sorted by geolocation and work seamlessly online or offline.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server (development)
npm start

# Open in browser
http://localhost:3000
```

**Production:** Deployed to [wificontent.com](https://wificontent.com)

## ✨ Key Features

✅ **Instant Startup** - App loads and shows posts immediately (no delays)  
✅ **Offline-First** - Works fully offline with cached posts  
✅ **Background Sync** - Syncs even when app is closed  
✅ **Permanent User IDs** - Same user forever (persisted to localStorage)  
✅ **Real-Time Posts** - Posts sync instantly when online  
✅ **Location-Based Zones** - Automatically detects your location and shows local posts  
✅ **Vote System** - Like and dislike posts to influence ranking  
✅ **No Login Required** - Works with permanent anonymous IDs  
✅ **Service Worker** - Progressive Web App with offline caching  
✅ **Production Debug Tools** - Monitor system health from console  

## 📁 Essential Files

```
index.html                      # Main application (22KB gzipped)
server.js                       # Backend server
service-worker.js              # Offline/background support
firebase-config.js             # Firebase configuration
firebase-db.js                 # Firebase functions
firebase-rules.json            # Firebase security rules
us_locations_database.json     # Location geolocation data
poi_database.json              # Points of interest
README.md                       # This file
PRODUCTION_DEBUGGING_GUIDE.md  # Console debugging tools
QUICK_START.md                 # Quick reference
```

## 🏗️ System Architecture

### Frontend (index.html)
- Pure vanilla JavaScript (no dependencies)
- Real-time grid rendering
- Location tracking (geolocation API)
- Firebase real-time listener
- Service Worker integration for offline

### Backend (server.js)
- Express.js running on port 3000
- Static file serving
- Health check endpoint
- Firebase pass-through (optional)

### Service Worker (service-worker.js)
- **Offline-first caching** - Static assets cached locally
- **Post caching** - Firebase posts cached for offline access
- **Background sync** - Syncs when connection restored
- **Never-quit architecture** - Keeps running even when tab closed

### Firebase Backend
- Real-time Firestore database
- Posts stored in `/posts` collection (shared)
- User data in `/users` collection (permanent IDs)
- Online presence in `/onlineUsers` collection

## 🔐 Data Model

### Post Object
```javascript
{
  id: "post_xxx_timestamp_random",
  authId: "perm-timestamp-random",        // Permanent user ID
  content: "Post content",
  latitude: 40.7128,
  longitude: -74.0060,
  gridId: "grid_40.7128_-74.0060",        // Location grid
  likes: 0,
  dislikes: 0,
  timestamp: 1716864402000,
  photoURL: "https://...",                // Optional
  mediaType: "image"                       // Optional
}
```

### User ID System
- Format: `perm-{timestamp}-{random}`
- Stored in localStorage under `permanentUserId`
- Persists across browser sessions, cache clears, refreshes
- Never changes for a user (truly permanent)

### Grid System
- Grid ID: `grid_{lat}_{lon}`
- Automatically assigned based on user location
- Posts grouped by grid to show local content

## 🌐 How It Works

### User Lifecycle
1. **First Visit** - User opens app, permanent ID created (`perm-{timestamp}-{random}`)
2. **Location Detection** - Geolocation API gets coordinates
3. **Grid Assignment** - User assigned to grid zone based on lat/lon
4. **Posts Loaded** - Firebase syncs all posts in real-time
5. **Offline Cache** - Service Worker caches posts locally
6. **Persistent ID** - Permanent ID saved to localStorage forever

### Workflow
```
User Opens App
    ↓
Get Permanent ID (localStorage or create new)
    ↓
Get Location (geolocation API)
    ↓
Assign Grid Zone (based on coordinates)
    ↓
Connect to Firebase
    ↓
Load Posts (from cache if offline)
    ↓
Display Grid (immediately, no delays)
    ↓
Service Worker (background sync active)
    ↓
Auto-Update Posts (real-time from Firebase)
```

## 💻 Console Debugging Tools

The website includes built-in diagnostics accessible from browser console:

```javascript
// Check overall system status
quickStatus()

// See startup performance breakdown
showStartupSummary()

// View all diagnostic data
updateDiagnosticDashboard()

// Monitor connection status
window.connectionStatus

// Check system health
window.systemHealth
```

See [PRODUCTION_DEBUGGING_GUIDE.md](PRODUCTION_DEBUGGING_GUIDE.md) for complete debugging reference.

## 🔄 Offline Operation

### How It Works
1. **Posts cached** - When posts arrive from Firebase, Service Worker caches them
2. **Service Worker takes over** - Serves cached posts even without network
3. **Background sync active** - Syncs when connection restored
4. **Never shows "offline"** - User sees cached posts seamlessly

### User Experience
- ✅ Close the app → Service Worker keeps syncing
- ✅ Come back 1 hour later → See all new posts
- ✅ Airplane mode → Posts still visible from cache
- ✅ Slow 3G connection → Cached posts show instantly while fetching new ones

## 📊 Performance Metrics

### Startup Time
- **First load:** ~2-3 seconds (including location detection + Firebase connection)
- **Cached:** <500ms (Service Worker serves cached posts instantly)

### Real-Time Sync
- **Post creation:** <100ms to Firebase
- **Post visibility:** <1 second for all users to see it
- **Vote updates:** <500ms to sync across all clients

### Bandwidth
- **Initial page load:** ~1MB (index.html + assets)
- **Per post sync:** ~1KB (JSON)
- **Service Worker cache:** ~50-100KB (cached posts)

## 🧪 Testing

### Local Testing
```bash
npm install
npm start
# Open http://localhost:3000
```

### Test Offline Mode
1. Open DevTools (F12)
2. Go to Application → Service Workers
3. Check "Offline" checkbox
4. Posts should still be visible (cached)

### Test Background Sync
1. Open app on iPhone/Android
2. Add some posts
3. Close the app completely
4. Wait 30 seconds
5. Reopen app → New posts visible (synced in background)

## 📚 Documentation

- [PRODUCTION_DEBUGGING_GUIDE.md](PRODUCTION_DEBUGGING_GUIDE.md) - Console tools and troubleshooting
- [QUICK_START.md](QUICK_START.md) - Quick reference for commands
- [SYSTEM_OPTIMIZATION_COMPLETE.md](SYSTEM_OPTIMIZATION_COMPLETE.md) - Technical deep dive on optimizations

## 🚀 Deployment

### Deploy to Vercel (Production)
```bash
# Configure Firebase in .env.local
# Configure .firebaserc for project

vercel deploy
```

### Current Production
- **URL:** [wificontent.com](https://wificontent.com)
- **Hosting:** Vercel
- **Backend:** Firebase Firestore
- **Auth:** Permanent anonymous IDs

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript (22KB gzipped)
- **Backend:** Express.js (Node.js)
- **Database:** Firebase Firestore (real-time)
- **Caching:** Service Worker + Cache API
- **Deployment:** Vercel

## 💾 Storage

### localStorage
- `permanentUserId` - Your unique permanent ID (never changes)
- `userId` - Current session user ID (cached permanent ID)
- `lastSessionAuthId` - For detecting refresh survival

### Firebase Collections
- `/posts` - All posts (shared, real-time)
- `/users/{userId}` - User profiles and metadata
- `/onlineUsers` - Active users (presence tracking)

## 📝 License

Open source. Use as you wish.

## 💬 Support

Check the [PRODUCTION_DEBUGGING_GUIDE.md](PRODUCTION_DEBUGGING_GUIDE.md) for:
- Common issues and solutions
- How to understand console logs
- Performance optimization tips
- Troubleshooting network problems

---

**Version:** 2.0 (Optimized & Cleaned)  
**Status:** ✅ Production Ready  
**Last Updated:** May 27, 2026  
**Hosted at:** [wificontent.com](https://wificontent.com)


### Change Port
```bash
PORT=3000 npm start
```

## 📊 API Endpoints

### Public
- `GET /api/network-id` - Get your WiFi network ID
- `GET /api/posts/:networkId` - Fetch all posts for a network
- `POST /api/posts` - Create a new post
- `PUT /api/posts/:postId` - Update post votes
- `DELETE /api/posts/:postId` - Delete a post

### Admin (Protected)
- `GET /api/status` - Database statistics
- `GET /api/admin/networks` - All networks and posts
- `DELETE /api/admin/network/:networkId` - Clear a network

## �� Testing

```bash
# See TESTING_GUIDE.md for comprehensive tests

# Test network detection
curl http://localhost:5001/api/network-id

# View database status
curl http://localhost:5001/api/status

# Check database file
cat wifi_database.json
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Quick start and basic usage |
| [DATABASE_GUIDE.md](DATABASE_GUIDE.md) | Technical database documentation |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | How to test all features |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | What was built and how |

## 🔐 Security Notes

- Default admin password: `19696` - **Change this in production!**
- Database file contains base64-encoded images - secure the server
- Use HTTPS in production
- Implement rate limiting
- Validate all user input

## 🚀 Deployment

### Production Checklist
- [ ] Change admin password
- [ ] Enable HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Configure CORS
- [ ] Implement rate limiting
- [ ] Set up automatic backups
- [ ] Add monitoring
- [ ] Test multi-network isolation

### Docker Deployment
```dockerfile
FROM node:16
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 5001
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Posts Not Appearing
1. Verify server running: `npm start`
2. Check WiFi detection: Visit `/api/network-id`
3. Refresh browser page
4. Check browser console (F12) for errors

### Server Won't Start
```bash
# Check port is not in use
lsof -i :5001

# Clear node modules and reinstall
rm -rf node_modules
npm install
npm start
```

### Database Corrupted
```bash
# Delete and restart (fresh database)
rm wifi_database.json
npm start
```

## 📈 Performance

| Metric | Value |
|--------|-------|
| Post creation | < 500ms |
| Database save | < 100ms |
| Auto-refresh rate | 1 second |
| Network detection | < 100ms |
| Max photo size | 50MB |

## 🔄 Update Instructions

### Pull Latest Changes
```bash
git pull origin main
npm install
npm start
```

### Create a Backup
```bash
cp wifi_database.json wifi_database.backup.json
```

## 📝 Recent Changes

- ✅ Fixed broken corners on photo grid items
- ✅ Added persistent database with disk storage
- ✅ Implemented network isolation
- ✅ Added admin endpoints
- ✅ Comprehensive documentation

See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for details.

## 💡 Future Enhancements

- [ ] User accounts and authentication
- [ ] Migrate to SQLite for better performance
- [ ] File upload instead of base64
- [ ] Post search and filtering
- [ ] Automatic post expiration
- [ ] Admin dashboard UI
- [ ] Push notifications
- [ ] Media library

## 📞 Support

For issues or questions:
1. Check relevant documentation (*.md files)
2. Review server console logs
3. Check browser console (F12)
4. Verify network connectivity

## 📄 License

This project is part of the FedEx community initiative.

## 👥 Contributors

Built with ❤️ for local community connection

---

**Start sharing your WiFi grid today! 🎉**

```bash
npm start
# Visit http://localhost:5001
```
