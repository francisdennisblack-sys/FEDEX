/**
 * 🚀 PHASE 3: WEB WORKER SEARCH
 * Runs search in background thread, keeps UI responsive
 * Handles 500K+ items without blocking main thread
 */

let locationDatabase = [];
let poiDatabase = [];

/**
 * Main worker message handler
 */
self.onmessage = function(event) {
    const { type, query, locations, pois, userLat, userLon } = event.data;
    
    if (type === 'LOAD_DATA') {
        // Load databases once
        locationDatabase = locations || [];
        poiDatabase = pois || [];
        console.log(`✅ Worker: Loaded ${locationDatabase.length} locations + ${poiDatabase.length} POIs`);
        return;
    }
    
    if (type === 'SEARCH') {
        const results = performSearch(query, userLat, userLon);
        self.postMessage({
            type: 'SEARCH_RESULTS',
            query: query,
            results: results,
            count: results.length,
            timestamp: Date.now()
        });
        return;
    }
};

/**
 * Perform search across locations and POIs
 * Returns sorted, ranked results
 */
function performSearch(query, userLat, userLon) {
    if (!query || query.trim().length === 0) return [];
    
    const queryLower = query.toLowerCase().trim();
    const results = [];
    
    // Calculate distance helper
    const haversineDistance = (lat1, lon1, lat2, lon2) => {
        const toRad = v => v * Math.PI / 180;
        const R = 3959; // miles
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };
    
    // Search locations
    for (let i = 0; i < locationDatabase.length; i++) {
        const loc = locationDatabase[i];
        const fullName = `${loc.name}${loc.state ? ', ' + loc.state : ''}`;
        const searchStr = `${loc.name}${loc.state || ''}`.toLowerCase();
        
        if (searchStr.includes(queryLower)) {
            let dist = null;
            if (userLat && userLon && loc.lat && loc.lon) {
                dist = haversineDistance(userLat, userLon, loc.lat, loc.lon);
            }
            
            results.push({
                type: 'location',
                name: fullName,
                emoji: '📍',
                distance: dist,
                rank: searchStr === queryLower ? 0 : (searchStr.startsWith(queryLower) ? 1 : 2)
            });
        }
    }
    
    // Search POIs (limit to 50K for performance)
    const poiLimit = Math.min(poiDatabase.length, 50000);
    for (let i = 0; i < poiLimit; i++) {
        const poi = poiDatabase[i];
        const poiName = String(poi.name || '').toLowerCase();
        
        if (poiName.includes(queryLower)) {
            let dist = null;
            if (userLat && userLon && poi.lat && poi.lon) {
                dist = haversineDistance(userLat, userLon, poi.lat, poi.lon);
            }
            
            results.push({
                type: 'poi',
                name: poi.name,
                emoji: poi.emoji || '🏢',
                distance: dist,
                rank: poiName === queryLower ? 0 : (poiName.startsWith(queryLower) ? 1 : 2)
            });
        }
    }
    
    // Sort by rank, then distance
    results.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.distance && b.distance) return a.distance - b.distance;
        return 0;
    });
    
    // Limit to 300 results
    return results.slice(0, 300);
}
