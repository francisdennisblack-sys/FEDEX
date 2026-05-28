# 🚀 QUICK REFERENCE - POI & POST TRACKING SYSTEMS

**For use in browser console (F12)**

---

## POI Management System

### Add a POI
```javascript
window.poiManagementSystem.addPOI('Cafe Name', 33.7456, -117.8677, 'Santa Ana', 'Cafe')
```

### Find Nearby POIs (within 5km)
```javascript
window.poiManagementSystem.getNearbyPOIs(33.7456, -117.8677, 5)
```

### Find Cafes Near You (within 2km)
```javascript
window.poiManagementSystem.getNearbyPOIs(33.7456, -117.8677, 2, 'Cafe')
```

### Remove a POI
```javascript
window.poiManagementSystem.removePOI('poi_id_123')
```

### Sync POIs from Firebase
```javascript
await window.poiManagementSystem.syncPOIsFromFirebase()
```

---

## Area Names Database

### Initialize Areas (Auto-runs on page load)
```javascript
window.areaNameDatabase.initialize()
```

### Add New Area
```javascript
window.areaNameDatabase.addArea('Venice Beach, CA', 33.9850, -118.4695, 'neighborhood', 'CA', 'Los Angeles')
```

### Find Nearest Area
```javascript
window.areaNameDatabase.findNearestArea(33.7456, -117.8677)
```

### Get All California Areas
```javascript
window.areaNameDatabase.getAreasByState('CA')
```

### Get All Area Names (for dropdown)
```javascript
window.areaNameDatabase.getAllAreaNames()
```

### Export All Areas
```javascript
window.areaNameDatabase.export()
```

---

## Post Tracking System

### Track Post Creation (auto-runs, but manual call):
```javascript
await window.postTrackingSystem.trackPostCreation(currentUserId, 'post_123', postData, 'shared-network-1')
```

### Get My Posts
```javascript
await window.postTrackingSystem.getUserPosts(currentUserId)
```

### Get My Posts in Specific Network
```javascript
await window.postTrackingSystem.getUserPosts(currentUserId, 'shared-network-1')
```

### Get Post Engagement Metrics
```javascript
await window.postTrackingSystem.getPostMetrics('shared-network-1', 'post_123')
```

### Track Post View
```javascript
await window.postTrackingSystem.trackPostView('shared-network-1', 'post_123')
```

### Delete a Post
```javascript
await window.postTrackingSystem.deletePost(currentUserId, 'shared-network-1', 'post_123')
```

### Get All Network Posts
```javascript
await window.postTrackingSystem.getNetworkPosts('shared-network-1', 100)
```

### Get My Engagement Summary
```javascript
await window.postTrackingSystem.getUserEngagementSummary(currentUserId)
```

---

## Common Tasks

### See How Many Posts You've Created
```javascript
const posts = await window.postTrackingSystem.getUserPosts(currentUserId);
console.log(`You have ${Object.values(posts).length} posts`);
```

### Get Your Total Likes
```javascript
const summary = await window.postTrackingSystem.getUserEngagementSummary(currentUserId);
console.log(`Total likes: ${summary.totalLikes}`);
```

### Find All Cafes Near You
```javascript
const cafes = window.poiManagementSystem.getNearbyPOIs(userLocation.lat, userLocation.lon, 5, 'Cafe');
cafes.forEach(c => console.log(c.name));
```

### List All Available Areas
```javascript
const areas = window.areaNameDatabase.getAllAreaNames();
console.table(areas);
```

---

## Debugging

### Check POI Database Status
```javascript
console.log('Total POIs:', poiDatabase.length);
console.log('Sample POI:', poiDatabase[0]);
```

### Check Area Database
```javascript
console.log('Total areas:', window.areaNameDatabase.areas.size);
```

### Check Current User
```javascript
console.log('User ID:', currentUserId);
console.log('Network:', currentWiFiNetwork);
```

### Check Firebase Connection
```javascript
console.log('Database:', database);
console.log('Connected:', isConnected);
```

---

## Variables You Can Use

```javascript
currentUserId          // Your Firebase UID
currentWiFiNetwork     // Network ID ('shared-network-1')
userLocation           // { lat, lon } your current location
poiDatabase            // Array of all POIs
gridContent            // Posts in grid: gridContent['shared-network-1']
userVotes              // Your votes/likes/dislikes
```

---

## Examples

### Example 1: Add 3 Cafes
```javascript
window.poiManagementSystem.addPOI('Cafe A', 33.74, -117.86, 'Santa Ana', 'Cafe');
window.poiManagementSystem.addPOI('Cafe B', 33.75, -117.85, 'Santa Ana', 'Cafe');
window.poiManagementSystem.addPOI('Cafe C', 33.76, -117.84, 'Santa Ana', 'Cafe');
```

### Example 2: Find Your Location's Area
```javascript
const area = window.areaNameDatabase.findNearestArea(userLocation.lat, userLocation.lon);
alert(`You're in: ${area.name}`);
```

### Example 3: See All Your Post Stats
```javascript
const stats = await window.postTrackingSystem.getUserEngagementSummary(currentUserId);
console.table(stats);
```

### Example 4: Delete Your First Post
```javascript
const posts = await window.postTrackingSystem.getUserPosts(currentUserId);
const firstPostId = Object.keys(posts)[0];
await window.postTrackingSystem.deletePost(currentUserId, 'shared-network-1', firstPostId);
```

---

## Status Indicators

✅ **Green light:** Command executed successfully
❌ **Red light:** Command failed, check error
⏳ **Loading:** Await command (use `await`)

---

**Last Updated:** May 25, 2026
**Status:** Ready for use
