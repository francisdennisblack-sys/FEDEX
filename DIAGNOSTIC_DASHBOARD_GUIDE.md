# 📊 Unified Diagnostic Dashboard Guide

## Overview

The Unified Diagnostic Dashboard is a real-time monitoring system that replaces verbose console.logs with a single, color-coded status display. It shows the health of all critical systems at a glance.

**Latest Commit:** `05d9067` - Unified Diagnostic Dashboard + Console.log Cleanup

## Quick Start

### View the Dashboard

Open your browser console and run:

```javascript
window.showDashboard()
```

This displays the current system status in color-coded format.

### Automatic Display

The dashboard automatically displays:
- **On app launch:** After bootstrap completes (500ms delay)
- **Manually:** Call `window.showDashboard()` anytime in console

## Dashboard Status Indicators

### 📊 System Status
- **Posts Live:** Count of posts in the shared Firebase collection
  - Green: Posts are being loaded
  - Updates in real-time as Firebase posts arrive

### 🔐 Authentication
- **Auth ID:** Permanent user identifier (format: `perm-{timestamp}-{random}`)
  - ✓ SAVED: Auth ID is persisted in localStorage
  - ✗ NOT SAVED: Auth not fully initialized (rare)
  - Display shows first 16 characters for brevity

### 📍 Zone Tracking
- **Grid ID:** Current location-based zone for post targeting
  - ✓ ASSIGNED: Zone detected via geolocation
  - ✗ NOT ASSIGNED: Still detecting location (wait 1-2s)
  - Shows zone name (e.g., "Santa Ana, CA")

### 📝 Post Management
- **Post ID:** Current draft post identifier
  - ✓ ASSIGNED: Post created and ready to save
  - ✗ NOT CREATED: No post in progress

### 🔄 Persistence
- **Survived Refresh:** IDs remain constant across page refresh
  - ✓ PERSISTENT: Auth ID survived page reload
  - ⏳ PENDING TEST: Haven't refreshed yet (normal on first load)

### 📡 Location Services
- **Tracking:** Real-time geolocation monitoring
  - ✓ ACTIVE (USER MOVED): Detected movement > 10m
  - ✓ ACTIVE (stationary): Tracking enabled, no movement yet
  - ✗ INACTIVE: Geolocation disabled or no permission
  - Shows distance moved and last update time

## Understanding Color Coding

```
🟢 GREEN: Success - System operational
  ✓ SAVED, ✓ ASSIGNED, ✓ ACTIVE, ✓ PERSISTENT

🔴 RED: Failure - System issue
  ✗ NOT SAVED, ✗ NOT ASSIGNED, ✗ INACTIVE

🟡 YELLOW: Pending - Waiting for data
  ⏳ PENDING TEST, ⏳ LOADING
```

## Advanced Commands

### Location Tracking

```javascript
// Start 1-second interval tracking
window.startLocationTracking()

// Stop location tracking
window.stopLocationTracking()

// View tracking data
window.diagnosticState.locationHistory  // Array of location changes
window.diagnosticState.totalDistanceMoved  // Total distance in km
window.diagnosticState.lastLocation  // Current location { lat, lon }
```

### Direct State Access

```javascript
// Access all diagnostic state
window.diagnosticState

// Check specific values
console.log(window.diagnosticState.authIdSaved)  // true/false
console.log(window.diagnosticState.gridIdValue)  // Zone name
console.log(window.diagnosticState.totalPostsLive)  // Number of posts
```

### Post Tracking

```javascript
// View all post IDs assigned in this session
window.diagnosticState.postIdValue  // Last created post ID

// Check post creation time
console.log(new Date(window.diagnosticState.postIdValue.split('-')[1]))
```

## Troubleshooting

### Auth ID Not Saved
**Problem:** `Auth ID: ✗ NOT SAVED`
- **Cause:** Authentication not fully initialized
- **Solution:** Wait 2-3 seconds for Firebase to initialize
- **Check:** Refresh page, should show ✓ SAVED within 1 second

### Grid ID Not Assigned
**Problem:** `Grid ID: ✗ NOT ASSIGNED`
- **Cause:** Geolocation still being detected
- **Solution:** Allow location permission when browser asks
- **Check:** Wait 2-3 seconds, should update to zone name
- **Fallback:** Uses coordinates if no location database match

### Posts Live = 0
**Problem:** `Posts Live: 0 posts`
- **Cause:** No posts yet in shared collection
- **Solution:** Normal on first load - create a post to test
- **Check:** After creating post, count should increase

### Location Tracking Inactive
**Problem:** `Location Tracking: ✗ INACTIVE`
- **Cause:** Browser location permission denied
- **Solution:** 
  1. Check browser location settings
  2. Grant permission to this site
  3. Refresh page
  4. Click "Allow" when location prompt appears
- **Check:** Should show ✓ ACTIVE (stationary) within 5 seconds

### IDs Not Surviving Refresh
**Problem:** `IDs Survived Refresh: ⏳ PENDING TEST`
- **Cause:** Page hasn't been refreshed yet
- **Solution:** Refresh page (Cmd+R or Ctrl+R)
- **Expected:** After refresh, should show ✓ PERSISTENT

## System Architecture

### Diagnostic State Variables (10 total)

```javascript
{
  totalPostsLive: 0,              // Count of posts in Firebase
  
  authIdSaved: false,             // Is auth ID persisted?
  authIdValue: null,              // The actual auth ID
  
  gridIdAssigned: false,          // Is zone detected?
  gridIdValue: null,              // Zone name
  
  postIdAssigned: false,          // Is post created?
  postIdValue: null,              // Post ID
  
  idsSurvivedRefresh: false,      // Did IDs persist on refresh?
  
  locationTrackingActive: false,  // Is tracking enabled?
  lastLocationUpdate: null,       // Timestamp of last update
  lastLocation: { lat, lon },     // Current coordinates
  
  userHasMoved: false,            // Movement detected > 10m?
  locationHistory: [],            // Array of location changes
  totalDistanceMoved: 0           // Total km moved
}
```

### Update Points

| Event | Updates |
|-------|---------|
| Auth initialized | `authIdSaved`, `authIdValue` |
| Zone detected | `gridIdAssigned`, `gridIdValue` |
| Post created | `postIdAssigned`, `postIdValue` |
| Firebase posts arrive | `totalPostsLive` |
| Page refreshed | `idsSurvivedRefresh` |
| Location updated (1s) | `lastLocationUpdate`, `lastLocation`, `userHasMoved`, `totalDistanceMoved` |

## Console Output Format

```
╔═══════════════════════════════════════════════════════════╗
║                  UNIFIED DIAGNOSTIC DASHBOARD              ║
╚═══════════════════════════════════════════════════════════╝

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

╔═══════════════════════════════════════════════════════════╗
║ Call window.showDashboard() to refresh this info anytime  ║
╚═══════════════════════════════════════════════════════════╝
```

## Performance Notes

- **Refresh rate:** Manual (call `window.showDashboard()`)
- **Auto-display:** Once on app launch (500ms after bootstrap)
- **Location tracking:** 1-second intervals (started automatically)
- **Memory impact:** Minimal - diagnosticState is ~2KB
- **Network impact:** None - all local data

## Related Systems

- **Auth System:** Permanent User ID System (survives browser restart)
- **Zone System:** POI-based Grid System (location-based content routing)
- **Location Tracking:** Real-time geolocation with movement detection
- **Firebase Integration:** Real-time post synchronization

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-27 | Initial unified dashboard with 10 tracking variables |

---

**Session:** May 27, 2026  
**Commit:** `05d9067`  
**Status:** ✅ Production Ready
