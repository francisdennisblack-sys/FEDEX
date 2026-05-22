# WiFi Grid - Local Community Photo Sharing

A decentralized photo sharing grid application that works on local WiFi networks. Posts are automatically isolated by WiFi network and persisted to disk.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
http://localhost:5001
```

## ✨ Features

- **WiFi-Based Isolation** - Each WiFi network has its own separate grid
- **Photo Sharing** - Upload and share photos on your local network  
- **Persistent Storage** - Posts survive server restarts
- **Real-Time Sync** - Auto-refresh every 1 second
- **Auto-Detection** - Automatically joins your WiFi network
- **Voting System** - Like and dislike posts
- **Admin Panel** - Manage networks and view stats

## 📁 Project Structure

```
Fedex/
├── index.html                 # Frontend app
├── server.js                  # Express backend with database
├── package.json              # Dependencies
├── wifi_database.json        # Auto-created database
├── README.md                 # This file
├── SETUP_GUIDE.md            # Quick start guide
├── DATABASE_GUIDE.md         # Technical database docs
├── TESTING_GUIDE.md          # How to test the system
└── IMPLEMENTATION_SUMMARY.md # What was built
```

## 🏗️ System Architecture

### Backend
- Express.js server on port 5001
- JSON file-based database (`wifi_database.json`)
- Network detection via IP subnet analysis
- Auto-save to disk on every operation

### Frontend
- Single-page HTML/CSS/JavaScript app
- Auto-detects WiFi network on load
- Auto-refreshes posts every 1 second
- Real-time vote sync with backend

### Database
- File: `wifi_database.json`
- Isolated by WiFi network
- Stores posts with photos (base64)
- Persists across restarts

## 🌐 How It Works

1. **User connects to WiFi network** (e.g., `192.168.1.x`)
2. **App auto-detects network ID** based on IP subnet
3. **User posts content** with optional photo
4. **Post saved to backend** and immediately to disk
5. **All users on same network** see the post within 1 second
6. **Posts persist** even if server restarts

## 📱 Multi-Device Usage

Connect multiple devices to the same WiFi:

**Device 1:** `http://localhost:5001` (computer)
**Device 2:** `http://[COMPUTER-IP]:5001` (phone/tablet)

Both devices show the same grid and auto-sync in real-time.

## 🔧 Configuration

### Change Admin Password
Edit `server.js`:
```javascript
const password = req.headers['x-admin-password'];
if (password !== process.env.ADMIN_PASSWORD && password !== '19696') { // Change this
```

### Adjust Auto-Refresh Rate
Edit `index.html`:
```javascript
refreshInterval = setInterval(() => {
    // ...
}, 1000); // Change 1000 to desired milliseconds
```

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
