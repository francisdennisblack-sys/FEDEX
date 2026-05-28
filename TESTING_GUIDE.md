# Testing the WiFi Grid System

## System Overview

Your WiFi Grid now has:
- ✅ Persistent database (JSON file-based)
- ✅ Network isolation (by IP subnet)
- ✅ Photo storage (base64 encoded)
- ✅ Real-time sync (1-second refresh)
- ✅ Auto-detection (IP-based WiFi identification)

## Quick Test

### 1. Start Server
```bash
cd /Users/francisblack/Downloads/Fedex
npm start
```
You should see:
```
[TIME] Server running on http://localhost:5001
[TIME] Loaded 0 WiFi networks from database
```

### 2. Test Network Detection
Open in browser:
```
http://localhost:5001/api/network-id
```
You should see:
```json
{
  "networkId": "192.168.x.0/24",
  "ip": "192.168.x.x"
}
```

### 3. Test Database Status
```
http://localhost:5001/api/status
```
You should see:
```json
{
  "status": "online",
  "networks": 0,
  "totalPosts": 0,
  "networks": []
}
```

### 4. Open the App
```
http://localhost:5001
```
You should see:
- WiFi connection detected
- Your network name displayed
- Empty 200-square grid

### 5. Add Your First Post
1. Click the "+" button (top-left square)
2. Enter text: "My first WiFi post!"
3. Optional: Upload a photo
4. Click "Post"
5. Your post appears in the grid

### 6. Verify Database Saved
Check the file was created:
```bash
ls -la wifi_database.json
cat wifi_database.json
```
You should see your post in JSON format

### 7. Test Persistence
1. Kill the server (Ctrl+C)
2. Restart: `npm start`
3. Refresh browser
4. Your post is still there! ✓

## Multi-Device Testing

### Test Cross-Device Sync

**Device 1 (Computer):**
```
http://localhost:5001
```

**Device 2 (Phone on same WiFi):**
```
http://[YOUR_COMPUTER_IP]:5001
```
Find your computer IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Look for 192.168.x.x
```

### Steps:
1. Open app on both devices
2. Both should show same grid
3. Post from Device 1
4. Device 2 auto-refreshes and shows it within 1 second

## API Testing with curl

### Get Network ID
```bash
curl http://localhost:5001/api/network-id
```

### Get Posts for Your Network
```bash
# First get your network ID from the above call
# Then replace NETWORK_ID with actual value
curl "http://localhost:5001/api/posts/192.168.1.0%2F24"
```

### Create a Post (via API)
```bash
curl -X POST http://localhost:5001/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "networkId": "192.168.1.0/24",
    "content": "Test post from API",
    "imageData": null,
    "timestamp": 1621234567890
  }'
```

### Get Status
```bash
curl http://localhost:5001/api/status
```

### Admin: Get All Networks
```bash
curl http://localhost:5001/api/admin/networks
```

## Database File Format

Expected structure in `wifi_database.json`:
```json
{
  "posts": {
    "192.168.1.0/24": [
      {
        "id": 0,
        "networkId": "192.168.1.0/24",
        "content": "Your post text",
        "imageData": null,
        "timestamp": 1621234567890,
        "likes": 0,
        "dislikes": 0
      }
    ]
  },
  "idCounter": 1,
  "lastSaved": "2026-05-21T10:30:45.123Z"
}
```

## Verification Checklist

- [ ] Server starts without errors
- [ ] `/api/network-id` returns your network ID
- [ ] App opens at `http://localhost:5001`
- [ ] Can add a post via UI
- [ ] Post appears in grid
- [ ] `wifi_database.json` created and contains post
- [ ] Server restart preserves posts
- [ ] Multiple devices see same grid
- [ ] `/api/status` shows correct post count
- [ ] Can like/dislike posts
- [ ] Votes persist after refresh

## Troubleshooting Tests

### Test 1: Server Connection
```bash
# Should return JSON, not connection refused
curl http://localhost:5001/api/status
```

### Test 2: Database File
```bash
# Should exist and be valid JSON
file wifi_database.json
cat wifi_database.json | python -m json.tool
```

### Test 3: Network Detection
```bash
# Should show your local network IP
curl http://localhost:5001/api/network-id | grep -o '"ip":"[^"]*"'
```

### Test 4: Auto-Refresh
1. Open app in browser
2. Post from another device on same WiFi
3. Wait max 1 second
4. New post should appear without refresh

### Test 5: Network Isolation
If you can access multiple networks:
1. Connect Device A to Network 1
2. Connect Device B to Network 2
3. Posts on Network 1 should NOT appear on Network 2
4. Posts are completely isolated by network

## Performance Metrics

### Expected Performance
- Post creation: < 500ms
- Database save: < 100ms
- Auto-refresh: 1 second interval
- Network detection: < 100ms
- Photo upload: Depends on size (up to 50MB)

### Testing Load
Create multiple posts and check:
- Server console for save logs
- `wifi_database.json` file size increases
- `/api/status` shows correct post count
- Performance remains responsive

## Network Isolation Testing

### Scenario: Multiple Networks on Same Server

If you have multiple subnets:
- **Network A**: 192.168.1.x
- **Network B**: 192.168.2.x

1. User on Network A posts: "Hello A"
2. User on Network B posts: "Hello B"
3. Verify posts are in separate arrays in JSON
4. Network A grid only shows "Hello A"
5. Network B grid only shows "Hello B"

## Cleanup and Reset

### Reset Everything
```bash
# Stop server (Ctrl+C)
# Delete database
rm wifi_database.json
# Restart server
npm start
# Database recreates fresh
```

### Backup Posts
```bash
# Make a backup
cp wifi_database.json wifi_database.backup.json
```

---

**Your system is working correctly when all checks pass! ✓**
