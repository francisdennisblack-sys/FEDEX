# WiFi Grid Setup & Operation Guide

## What Was Built

You now have a **complete local WiFi-based photo sharing grid** with:

✅ **Persistent Database** - Posts survive server restarts
✅ **Network Isolation** - Each WiFi network has its own grid  
✅ **Photo Support** - Posts with images stored in base64
✅ **Real-time Sync** - Posts appear automatically for connected users
✅ **Auto-detection** - Users automatically join their WiFi network's grid

## Quick Start

### 1. Start the Server
```bash
npm start
```
The server runs on `http://localhost:5001`

### 2. Open the App
- Visit `http://localhost:5001/` in your browser
- The app automatically detects your WiFi and loads the grid
- Connect any devices on the same WiFi network

### 3. Add Content
- Click the "+" button in the top-left grid square
- Add text and/or upload a photo
- Your post appears instantly for all users on your WiFi

## How It Works

### Network Detection
The server detects your WiFi network by analyzing your IP address:
- `192.168.1.x` → Group ID: `192.168.1.0/24`
- `192.168.2.x` → Group ID: `192.168.2.0/24`
- Different networks = completely separate grids

### Data Storage
```
wifi_database.json (created automatically)
└── Networks
    ├── 192.168.1.0/24
    │   ├── Post 1 (with photo)
    │   ├── Post 2 (text only)
    │   └── Post 3 (with photo)
    └── 192.168.2.0/24
        └── Post 4 (with photo)
```

### Auto-Refresh
- Client refreshes posts every 1 second
- New posts visible immediately across all devices
- Likes/dislikes sync in real-time

## Features

### For Users
- **Post Once Per Network** - One post per WiFi network per user
- **Add Photos** - Include photos with text posts
- **Vote on Posts** - Like/dislike posts from others
- **Hide Posts** - Hide posts you don't want to see

### For Admins
- **Database Status** - `/api/status` shows network stats
- **Monitor Networks** - `/api/admin/networks` lists all posts
- **Clear Networks** - Remove all posts from a network
- **Password Protected** - Use password `19696`

## Troubleshooting

### "Connect to WiFi first"
- Make sure you're on a local network (not public WiFi)
- Refresh the page
- Check that server is running on `localhost:5001`

### Posts Not Appearing
1. Verify server is running: `npm start`
2. Check `wifi_database.json` was created
3. Open browser console (F12) and check for errors
4. Visit `/api/status` to verify network detection

### Database Issues
- **Clear everything**: Delete `wifi_database.json` and restart server
- **Check corruption**: Look at wifi_database.json in a text editor
- **Backup data**: Copy wifi_database.json before making changes

## File Structure
```
Fedex/
├── index.html                 # Client app (open in browser)
├── server.js                  # Express backend
├── package.json               # Dependencies
├── wifi_database.json         # Database (auto-created)
├── DATABASE_GUIDE.md          # Full database documentation
├── SETUP_GUIDE.md             # This file
└── node_modules/              # Dependencies
```

## Development Notes

### Adding Features
See `DATABASE_GUIDE.md` for API endpoint documentation

### Network Testing
- Use different local network subnets to simulate multiple networks
- Or use VPN/network interfaces to test isolation

### Production Deployment
1. Change admin password from `19696` to something secure
2. Consider using SQLite instead of JSON for large deployments
3. Implement user authentication
4. Add HTTPS/SSL
5. Set up automatic backups

## Support

For issues:
1. Check `DATABASE_GUIDE.md` for technical details
2. Review server console logs
3. Verify network connectivity
4. Check browser console (F12) for errors

---

**Your WiFi grid is now ready to use! 🚀**
