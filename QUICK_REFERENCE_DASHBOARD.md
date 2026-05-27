# 🚀 Quick Reference - Diagnostic Dashboard

**Latest Session:** May 27, 2026  
**Status:** ✅ Production Ready  
**Commits:** 3 (05d9067, 8847f08, 183600f)

## One-Command View

```javascript
// View entire system status
window.showDashboard()
```

**Output:**
```
╔════════════════════════════════════════════╗
║   UNIFIED DIAGNOSTIC DASHBOARD             ║
╚════════════════════════════════════════════╝

📊 SYSTEM STATUS
   Posts Live: 47 posts in shared collection

🔐 AUTHENTICATION
   Auth ID: ✓ perm-1716864000123-abc...

📍 ZONE TRACKING
   Grid ID: ✓ Santa Ana, CA

📝 POST MANAGEMENT
   Post ID: ✓ CREATED

🔄 PERSISTENCE
   Survived Refresh: ✓ PERSISTENT

📡 LOCATION SERVICES
   Tracking: ✓ ACTIVE (USER MOVED - 2.3km moved)
   Last Update: 40.7128, -74.0060 (2s ago)
```

---

## Status Meanings

| Symbol | Meaning | What to Do |
|--------|---------|-----------|
| ✅ ✓ | Working | Nothing needed |
| ❌ ✗ | Failed/Missing | Check troubleshooting |
| ⏳ | Pending | Wait 2-3 seconds |

---

## Key Values to Check

```javascript
// Total posts loaded
window.diagnosticState.totalPostsLive

// Your permanent auth ID
window.diagnosticState.authIdValue

// Current zone name
window.diagnosticState.gridIdValue

// Last post created
window.diagnosticState.postIdValue

// Distance you've moved (km)
window.diagnosticState.totalDistanceMoved

// Current coordinates
window.diagnosticState.lastLocation  // { lat, lon }
```

---

## Location Tracking Control

```javascript
// Start tracking movement every 1 second
window.startLocationTracking()

// Stop tracking
window.stopLocationTracking()

// View all locations visited
window.diagnosticState.locationHistory

// Check if you moved
window.diagnosticState.userHasMoved  // true/false
```

---

## Troubleshooting Quick Links

**Auth ID Not Saving?**
```javascript
// Wait for Firebase init
setTimeout(() => window.showDashboard(), 3000)
```

**Zone Not Detected?**
```javascript
// Give geolocation time to activate
// Watch for gridId to change from ✗ to ✓ in dashboard
```

**Posts Not Showing?**
```javascript
// Check if posts are in Firebase
window.diagnosticState.totalPostsLive

// If 0, create a test post first
```

**Location Tracking Not Working?**
```javascript
// Start it manually if needed
window.startLocationTracking()

// Check if permission was granted to browser
```

---

## Dashboard Automatic Events

- **On App Load:** Dashboard displays 500ms after bootstrap
- **On Zone Change:** Dashboard state updates automatically
- **On Post Create:** Dashboard state updates automatically
- **Every 1 Second:** Location tracking updates automatically
- **On Firebase Update:** Post count updates automatically

---

## System Health Status

```javascript
// All green = fully operational
window.showDashboard()

// If red items appear:
// 1. Check troubleshooting guide
// 2. Wait 2-3 seconds for init
// 3. Refresh page if needed
// 4. Check console for errors (F12)
```

---

## Most Common Commands

```javascript
// View status
window.showDashboard()

// Check posts count
window.diagnosticState.totalPostsLive

// Check auth ID
window.diagnosticState.authIdValue

// Enable location tracking
window.startLocationTracking()

// See location history
window.diagnosticState.locationHistory

// Full state object
window.diagnosticState
```

---

## Color Legend

- **🟢 Green:** Working perfectly
- **🔴 Red:** Not working, needs attention
- **🟡 Yellow:** Loading, wait a moment

---

## When to Worry / Not Worry

### ✅ Don't Worry:
- Auth ID shows `⏳ PENDING TEST` on first load
- Grid ID shows `✗ NOT ASSIGNED` while loading location
- Location Tracking shows `✗ INACTIVE` if permission not granted yet
- IDs show `⏳ PENDING TEST` before first refresh

### ⚠️ Should Investigate:
- Posts Live = 0 after creating a post
- Auth ID shows `✗ NOT SAVED` after 5 seconds
- Grid ID shows `✗ NOT ASSIGNED` after 10 seconds
- Location Tracking shows `✗ INACTIVE` after granting permission

---

## Documentation Files

| File | Purpose | Read When |
|------|---------|-----------|
| DIAGNOSTIC_DASHBOARD_GUIDE.md | Complete reference | Need detailed info |
| SESSION_DIAGNOSTIC_SUMMARY.md | Implementation details | Want full technical overview |
| This file | Quick commands | Need fast answers |

---

## Related Systems

- **Auth:** Permanent User ID System (stored in localStorage)
- **Zone:** POI-based Grid System (location detection)
- **Firebase:** Real-time post sync (shared collection)
- **Location:** Browser Geolocation API (1s tracking)

---

## Example Usage Scenarios

### Scenario 1: Checking if App is Ready
```javascript
window.showDashboard()
// If all green: ✓ ready to use
// If red items: ⏳ wait or troubleshoot
```

### Scenario 2: Verifying Post Was Saved
```javascript
window.diagnosticState.postIdValue      // Has ID?
window.diagnosticState.totalPostsLive   // Count increased?
```

### Scenario 3: Testing Location Tracking
```javascript
window.startLocationTracking()
// Walk around for 30 seconds
window.showDashboard()
// Check: userHasMoved = true? totalDistanceMoved > 0?
```

### Scenario 4: Debug Session After Refresh
```javascript
window.showDashboard()
// Check idsSurvivedRefresh = ✓ PERSISTENT
```

---

## Pro Tips

💡 **Tip 1:** Call `window.showDashboard()` anytime console gets cluttered

💡 **Tip 2:** Watch `totalPostsLive` count when other users post (live updates)

💡 **Tip 3:** `locationHistory` shows all places you've been this session

💡 **Tip 4:** `totalDistanceMoved` tells you how far you've traveled (in km)

💡 **Tip 5:** Copy diagnostic state to JSON: `JSON.stringify(window.diagnosticState)`

---

**Last Updated:** May 27, 2026  
**Status:** ✅ Ready to Use  
**Version:** 1.0

For more details, see DIAGNOSTIC_DASHBOARD_GUIDE.md
