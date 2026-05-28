# 🗺️ POI & Location Database Quick Reference

## Database Access in Code

### Global Variables
```javascript
// All 500K POIs across US
globalPOIDatabase[]          // Primary database, loaded at startup
  └─ Each POI: {name, lat, lon, category, type, state, subCategory, amenity}

// All 75K+ US locations  
globalLocationDatabase[]     // All US locations with coordinates
  └─ Each location: {name, state, lat, lon, type, ...}

// City density rankings
globalDensityData[]          // City rankings by population
```

---

## Accessing the Databases

### 1. Find Closest POI to User
```javascript
findClosestPOIInZone(userLat, userLon)
→ Returns: {poi, distance, influenceRadius, size, confidence}

// Example:
const result = findClosestPOIInZone(40.7128, -74.0060);
// Returns closest POI to coordinates
```

### 2. Find Closest Location to User
```javascript
findClosestLocation(userLat, userLon)
→ Returns: {location, distance}

// Uses proximity layers: 5km → 15km → 50km → global
```

### 3. Search for Location by Name
```javascript
// Via handleCustomZoneInput() → getAutocompleteSuggestions()
getAutocompleteSuggestions(searchTerm)
→ Returns: [{display, type, value, data, ...}, ...]

// Searches:
// - All 75K+ locations (prefix + contains)
// - All 500K POIs (smart ranking)
// - All cities (from globalDensityData)
// - Sub-areas and nearby areas
```

### 4. Find Nearby Locations (1-5 miles)
```javascript
populateNearbyLocations()
// Finds all locations within 1-5 miles of user
// Shows top 8 nearest
// UI element: #nearbyLocationsList
```

### 5. Find Nearby POIs (by distance)
```javascript
// From populateMLAreaDropdown():
const nearbyPOIs = globalPOIDatabase
  .filter(poi => calculateDistance(userLat, userLon, poi.lat, poi.lon) < 50)
  .sort((a, b) => distance(a) - distance(b))
  .slice(0, 15);
```

---

## Raw Database Files (if direct access needed)

### POI Files
```
pois/search-index.json      // ⭐ PRIMARY: 500K POIs, fastest load
pois/manifest.json          // Metadata for 50 states
pois/states/alabama.json    // State-specific: 18K POIs
pois/states/california.json // State-specific: 110K POIs
pois/states/*.json          // 50 total state files
pois/places.json            // 10,705 place names
poi_database_expanded.json  // FALLBACK: 38K POIs
```

### Location Files
```
us_locations_database.json  // ⭐ PRIMARY: 75K+ US locations
```

### City Density Files
```
city_density.json           // US cities ranked by population
global_density.json         // Worldwide cities ranked
```

---

## Database Statistics

| Database | Count | Load Time | Size | Coverage |
|----------|-------|-----------|------|----------|
| POI Search Index | 500K | 100-150ms | 57MB | All 50 states |
| Locations | 75K+ | ~50ms | varies | US only |
| POI by State | 500K | 1-5s | 180MB | All 50 states |
| City Density | 1000+ | ~20ms | ~500KB | Worldwide |

---

## Loading Process (On App Startup)

```
1. loadPOIData() called
   ├─ Try: Load pois/search-index.json (500K)
   │  └─ Success → Use comprehensive database
   │
   ├─ Fallback: Load pois/manifest.json + state files
   │  ├─ Priority 5 states loaded synchronously
   │  └─ Remaining 45 states loaded in background
   │
   └─ Fallback: Load poi_database_expanded.json (38K)

2. loadLocationData() called (implicit)
   └─ Loads us_locations_database.json into globalLocationDatabase

3. loadDensityData() called
   └─ Loads city density rankings
```

---

## Performance Tips

### For Large Database Queries
```javascript
// ✅ Good: Early exit when very close POI found
if (closestDistance < 0.05) break;  // 50m is very close

// ✅ Good: Use proximity layers for location search
[5, 15, 50, Infinity].forEach(radius => {
  // Search within radius, stop when found
});

// ✅ Good: Limit UI display (show 100, indicate more available)
const displayed = database.slice(0, 100);
const moreCount = database.length - 100;
```

### For Slow Devices
```javascript
// Deferred loading for non-critical state files
Promise.all(deferredStates).then(results => {
  globalPOIDatabase = [...globalPOIDatabase, ...additionalPOIs];
});
```

---

## Testing Database Access

### Check if databases are loaded
```javascript
console.log(globalPOIDatabase.length);         // Should be ~500K
console.log(globalLocationDatabase.length);    // Should be ~75K
```

### Test POI search
```javascript
const nearestPOI = findClosestPOIInZone(40.7128, -74.0060);
console.log(nearestPOI);  // Should return nearby NYC POI
```

### Test location search
```javascript
const suggestions = getAutocompleteSuggestions("New York");
console.log(suggestions.length);  // Should be many results
```

### Check dropdown population
```javascript
populateMLAreaDropdown();
// Check #mlAreaDropdown element for content
```

---

## Integration Status

✅ **Auto-Generated Area Tags** - Uses full databases
✅ **Manual Area/POI Selection** - Searches full databases  
✅ **ML Recommendations Dropdown** - Shows 500K POIs + 75K locations
✅ **Nearby Locations** - Shows 75K location database
✅ **Search/Autocomplete** - Comprehensive 1000-result search

**Total Integrated**: 500K POIs + 75K locations + 1000+ cities
**Access Points**: 5 major UI systems
**Performance**: Optimized with proximity search + background loading
