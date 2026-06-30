/**
 * WiFiContent Location & Area Tag Validation Experiment - DIAGNOSTIC VERSION
 * 
 * This console experiment proves:
 * 1. Users are changing their locations (tracking lat/lon changes)
 * 2. Posts are being created with area tags
 * 3. Posts are being delivered based on area tags
 * 4. API calls show location-based filtering
 * 
 * Usage: Copy this entire script into browser console and run
 * Then make a post and watch for console output!
 */

console.clear();
console.log('%c🧪 WiFiContent Area Tag Validation Experiment - DIAGNOSTIC', 'color: #2563eb; font-size: 16px; font-weight: bold;');
console.log('%c📊 Monitoring: POST creation, Location changes, and Post fetches', 'color: #059669; font-size: 12px;');

// ============================================================================
// PART 1: LOCATION TRACKING
// ============================================================================
class LocationTracker {
  constructor() {
    this.locations = [];
    this.currentLocation = this.getCurrentLocation();
    this.startTime = Date.now();
    this.trackLocationChanges();
  }

  getCurrentLocation() {
    try {
      const manualLat = localStorage.getItem('userManualLat');
      const manualLon = localStorage.getItem('userManualLon');
      if (manualLat && manualLon) {
        return { lat: parseFloat(manualLat), lon: parseFloat(manualLon), source: 'manual' };
      }

      const gpsLat = localStorage.getItem('userGPSLat');
      const gpsLon = localStorage.getItem('userGPSLon');
      if (gpsLat && gpsLon) {
        return { lat: parseFloat(gpsLat), lon: parseFloat(gpsLon), source: 'gps' };
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  trackLocationChanges() {
    setInterval(() => {
      const newLocation = this.getCurrentLocation();
      const prevLocation = this.locations[this.locations.length - 1] || this.currentLocation;

      if (newLocation && (!prevLocation || 
          newLocation.lat !== prevLocation.lat || 
          newLocation.lon !== prevLocation.lon)) {
        const event = {
          timestamp: new Date().toLocaleTimeString(),
          elapsed: ((Date.now() - this.startTime) / 1000).toFixed(1),
          lat: newLocation.lat,
          lon: newLocation.lon,
          source: newLocation.source,
          changed: prevLocation ? true : false
        };
        this.locations.push(event);

        if (event.changed) {
          console.log('%c📍 LOCATION CHANGED:', 'color: #dc2626; font-weight: bold;', {
            'Old': `${prevLocation.lat.toFixed(4)}, ${prevLocation.lon.toFixed(4)}`,
            'New': `${newLocation.lat.toFixed(4)}, ${newLocation.lon.toFixed(4)}`,
            'Source': newLocation.source,
            'Time': event.timestamp,
            'Elapsed': `${event.elapsed}s`
          });
        }
      }
    }, 500);
  }

  showHistory() {
    console.log('%c📍 LOCATION HISTORY:', 'color: #2563eb; font-weight: bold;');
    if (this.locations.length === 0) {
      console.log('No location changes detected yet.');
    } else {
      console.table(this.locations);
    }
  }
}

// ============================================================================
// PART 2: POST CREATION MONITOR
// ============================================================================
class PostCreationMonitor {
  constructor() {
    this.postsCreated = [];
    this.monitorPostCreation();
  }

  monitorPostCreation() {
    const originalFetch = window.fetch;
    
    window.fetch = (...args) => {
      const [resource, config] = args;
      const resourceStr = typeof resource === 'string' ? resource : resource.url;
      const method = (config?.method || 'GET').toUpperCase();

      // Monitor POST requests (creating new posts)
      if (method === 'POST' && resourceStr.toLowerCase().includes('post')) {
        console.log('%c🚀 POST REQUEST DETECTED:', 'color: #f59e0b; font-weight: bold;', {
          'Endpoint': resourceStr,
          'Time': new Date().toLocaleTimeString(),
          'Body Preview': config?.body ? config.body.substring(0, 200) : 'No body'
        });

        // Try to parse the body to extract post data
        if (config?.body) {
          try {
            const postData = JSON.parse(config.body);
            console.log('%c📝 POST DATA CAPTURED:', 'color: #f59e0b;', postData);
            
            // Store created post
            const post = {
              timestamp: new Date().toLocaleTimeString(),
              endpoint: resourceStr,
              data: postData,
              areaTag: postData.areaTag || postData.displayAreaTag || postData.poiName || 'Unknown',
              coordinates: `${postData.lat?.toFixed(4)}, ${postData.lon?.toFixed(4)}` || 'No coordinates'
            };
            this.postsCreated.push(post);
          } catch (e) {
            // Body might be FormData, try to read it another way
            console.log('%c⚠️ Could not parse POST body as JSON', 'color: #f59e0b;');
          }
        }
      }

      return originalFetch.apply(window, args)
        .then(response => response)
        .catch(err => {
          console.error('Fetch error:', err);
          throw err;
        });
    };
  }

  showCreatedPosts() {
    console.log('%c📮 POSTS CREATED DURING SESSION:', 'color: #f59e0b; font-weight: bold;');
    if (this.postsCreated.length === 0) {
      console.log('No posts created yet.');
    } else {
      console.table(this.postsCreated.map(p => ({
        'Time': p.timestamp,
        'Area Tag': p.areaTag,
        'Coordinates': p.coordinates
      })));
    }
  }
}

// ============================================================================
// PART 3: NETWORK DIAGNOSTIC MONITOR
// ============================================================================
class NetworkDiagnostics {
  constructor() {
    this.networkCalls = [];
    this.startMonitoring();
  }

  startMonitoring() {
    const originalFetch = window.fetch;
    
    window.fetch = (...args) => {
      const [resource, config] = args;
      const resourceStr = typeof resource === 'string' ? resource : resource.url;
      const method = (config?.method || 'GET').toUpperCase();
      
      // Log EVERY network call for diagnostics
      const callLog = {
        time: new Date().toLocaleTimeString(),
        method: method,
        endpoint: resourceStr
      };
      this.networkCalls.push(callLog);
      
      // Only log every 5th call to avoid spam, but log POST/PUT/DELETE always
      if (this.networkCalls.length % 5 === 0 || method !== 'GET') {
        console.log(`%c🌐 ${method}`, method === 'POST' ? 'color: #f59e0b; font-weight: bold;' : 'color: #6b7280;', resourceStr);
      }

      return originalFetch.apply(window, args);
    };
  }

  getNetworkSummary() {
    const summary = {};
    this.networkCalls.forEach(call => {
      const key = `${call.method}: ${call.endpoint}`;
      summary[key] = (summary[key] || 0) + 1;
    });
    return summary;
  }

  showNetworkSummary() {
    console.log('%c🌐 NETWORK ACTIVITY SUMMARY:', 'color: #6b7280; font-weight: bold;');
    const summary = this.getNetworkSummary();
    if (Object.keys(summary).length === 0) {
      console.log('No network calls recorded.');
    } else {
      console.table(summary);
    }
  }
}

// ============================================================================
// PART 4: POST FETCHING & AREA TAG VALIDATION
// ============================================================================
class PostFetchMonitor {
  constructor() {
    this.posts = [];
    this.apiCalls = [];
    this.areaTagCounts = {};
    this.interceptFetches();
  }

  interceptFetches() {
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      const [resource, config] = args;
      const resourceStr = typeof resource === 'string' ? resource : resource.url;

      // Monitor post-related API calls (GET requests)
      if ((resourceStr.includes('post') || resourceStr.includes('feed') || 
          resourceStr.includes('grid') || resourceStr.includes('area')) && 
          (!config || config.method !== 'POST')) {
        const callEvent = {
          timestamp: new Date().toLocaleTimeString(),
          method: (config?.method || 'GET'),
          endpoint: resourceStr,
          status: '⏳ Pending'
        };
        this.apiCalls.push(callEvent);
      }

      return originalFetch.apply(window, args).then(response => {
        // Clone the response to read it
        const clonedResponse = response.clone();
        clonedResponse.json().then(data => {
          this.processPostData(data, resourceStr);
        }).catch(() => {
          // Not JSON or error reading
        });
        return response;
      }).catch(err => {
        console.error('Fetch error:', err);
        throw err;
      });
    };
  }

  processPostData(data, endpoint) {
    try {
      const posts = Array.isArray(data) ? data : data.posts || data.data || [];
      
      posts.forEach(post => {
        if (post.id && (post.displayAreaTag || post.areaTag || post.poiName)) {
          const areaTag = post.displayAreaTag || post.areaTag || post.poiName || 'Unknown';
          
          // Track posts with area tags
          this.posts.push({
            id: post.id,
            areaTag: areaTag,
            lat: post.lat || post.latitude,
            lon: post.lon || post.longitude,
            author: post.author || post.username || 'Unknown',
            timestamp: new Date().toLocaleTimeString()
          });

          // Count area tags
          this.areaTagCounts[areaTag] = (this.areaTagCounts[areaTag] || 0) + 1;
        }
      });
    } catch (e) {
      // Silently ignore parse errors
    }
  }

  showStats() {
    console.log('%c📊 POSTS RECEIVED WITH AREA TAGS:', 'color: #7c3aed; font-weight: bold;');
    if (Object.keys(this.areaTagCounts).length === 0) {
      console.log('No area-tagged posts received yet.');
    } else {
      console.table(this.areaTagCounts);
    }
  }

  showRecentPosts(limit = 10) {
    console.log(`%c📮 RECENT ${limit} POSTS (with coordinates & area tags):`, 'color: #059669; font-weight: bold;');
    const recent = this.posts.slice(-limit);
    if (recent.length === 0) {
      console.log('No posts with area tags received yet.');
    } else {
      console.table(recent.map(p => ({
        'Area Tag': p.areaTag,
        'Latitude': p.lat ? p.lat.toFixed(4) : 'N/A',
        'Longitude': p.lon ? p.lon.toFixed(4) : 'N/A',
        'Author': p.author,
        'Time': p.timestamp
      })));
    }
  }
}

// ============================================================================
// PART 5: LOCATION-POST CORRELATION
// ============================================================================
class CorrelationAnalyzer {
  constructor(locationTracker, postMonitor, postCreationMonitor) {
    this.locationTracker = locationTracker;
    this.postMonitor = postMonitor;
    this.postCreationMonitor = postCreationMonitor;
  }

  analyzeCorrelation() {
    console.log('%c🔗 LOCATION ↔ POST AREA TAG CORRELATION:', 'color: #db2777; font-weight: bold;');
    
    const locations = this.locationTracker.locations;
    const posts = this.postMonitor.posts;
    const created = this.postCreationMonitor.postsCreated;

    console.log(`\n✅ Data Summary:`);
    console.log(`   • Location changes: ${locations.length}`);
    console.log(`   • Posts received (fetched): ${posts.length}`);
    console.log(`   • Posts created: ${created.length}`);
    console.log(`   • Unique area tags in feed: ${Object.keys(this.postMonitor.areaTagCounts).length}`);
    
    if (locations.length === 0) {
      console.log('\n❌ No location changes recorded yet. Try changing your location in the app.');
    }

    if (created.length === 0) {
      console.log('\n❌ No posts created yet. Make a post in the app and watch this console!');
    } else {
      console.log('\n✅ POSTS CREATED:');
      created.forEach((p, i) => {
        console.log(`   ${i + 1}. Area: "${p.areaTag}" | Coordinates: ${p.coordinates} | Time: ${p.timestamp}`);
      });
    }

    if (posts.length === 0) {
      console.log('\n⚠️ No posts fetched yet. Posts received by the client will show up here.');
    } else {
      // Show last location change
      const lastLocation = locations[locations.length - 1];
      console.log(`\n📍 Current User Location: ${lastLocation.lat.toFixed(4)}, ${lastLocation.lon.toFixed(4)} (${lastLocation.source})`);

      // Show most common area tags for recent posts
      console.log(`\n📌 Top Area Tags in Feed:`);
      const sorted = Object.entries(this.postMonitor.areaTagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      sorted.forEach(([tag, count]) => {
        console.log(`   • "${tag}": ${count} posts`);
      });

      // Show actual post examples with coordinates
      console.log(`\n📮 Sample Posts & Their Locations:`);
      this.postMonitor.showRecentPosts(5);
    }
  }
}

// ============================================================================
// PART 6: REAL-TIME DASHBOARD
// ============================================================================
class RealtimeDashboard {
  constructor(locationTracker, postMonitor, postCreationMonitor, networkDiagnostics, analyzer) {
    this.locationTracker = locationTracker;
    this.postMonitor = postMonitor;
    this.postCreationMonitor = postCreationMonitor;
    this.networkDiagnostics = networkDiagnostics;
    this.analyzer = analyzer;
  }

  displayDashboard() {
    console.clear();
    console.log('%c╔════════════════════════════════════════════════════════════════╗', 'color: #2563eb;');
    console.log('%c║      WiFiContent Area Tag Validation - Real-time Dashboard     ║', 'color: #2563eb; font-weight: bold;');
    console.log('%c╚════════════════════════════════════════════════════════════════╝', 'color: #2563eb;');

    // Current Status
    const currentLoc = this.locationTracker.getCurrentLocation();
    if (currentLoc) {
      console.log(`\n%c📍 Current Location:`, 'color: #2563eb; font-weight: bold;');
      console.log(`   Latitude:  ${currentLoc.lat.toFixed(6)}`);
      console.log(`   Longitude: ${currentLoc.lon.toFixed(6)}`);
      console.log(`   Source:    ${currentLoc.source}`);
    }

    // Statistics
    console.log(`\n%c📊 Session Statistics:`, 'color: #7c3aed; font-weight: bold;');
    console.log(`   Location changes: ${this.locationTracker.locations.length}`);
    console.log(`   Posts created: ${this.postCreationMonitor.postsCreated.length}`);
    console.log(`   Posts received: ${this.postMonitor.posts.length}`);
    console.log(`   Unique area tags: ${Object.keys(this.postMonitor.areaTagCounts).length}`);
    console.log(`   Total network calls: ${this.networkDiagnostics.networkCalls.length}`);

    // Posts created
    if (this.postCreationMonitor.postsCreated.length > 0) {
      console.log(`\n%c📝 Posts Created This Session:`, 'color: #f59e0b; font-weight: bold;');
      this.postCreationMonitor.postsCreated.forEach((p, i) => {
        console.log(`   ${i + 1}. Area: "${p.areaTag}" | Coords: ${p.coordinates} | ${p.timestamp}`);
      });
    }

    // Top area tags
    if (Object.keys(this.postMonitor.areaTagCounts).length > 0) {
      console.log(`\n%c🏷️  Top Area Tags in Feed:`, 'color: #059669; font-weight: bold;');
      const sorted = Object.entries(this.postMonitor.areaTagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      sorted.forEach(([tag, count]) => {
        console.log(`   • ${tag}: ${count} posts`);
      });
    }

    console.log(`\n%c💡 Commands to run:`, 'color: #ea580c; font-weight: bold;');
    console.log(`   wifiExperiment.showLocationHistory()      - Show all location changes`);
    console.log(`   wifiExperiment.showCreatedPosts()         - Show posts YOU created`);
    console.log(`   wifiExperiment.showRecentPosts()          - Show last 10 posts received`);
    console.log(`   wifiExperiment.analyzeCorrelation()       - Detailed correlation analysis`);
    console.log(`   wifiExperiment.showNetworkActivity()      - Show all network calls`);
    console.log(`   wifiExperiment.dashboard()                - Refresh this dashboard`);
  }
}

// ============================================================================
// PART 7: INITIALIZE & EXPOSE API
// ============================================================================
const locationTracker = new LocationTracker();
const postCreationMonitor = new PostCreationMonitor();
const postMonitor = new PostFetchMonitor();
const networkDiagnostics = new NetworkDiagnostics();
const analyzer = new CorrelationAnalyzer(locationTracker, postMonitor, postCreationMonitor);
const dashboard = new RealtimeDashboard(locationTracker, postMonitor, postCreationMonitor, networkDiagnostics, analyzer);

window.wifiExperiment = {
  // Show location history
  showLocationHistory() {
    locationTracker.showHistory();
  },

  // Show posts created by this user
  showCreatedPosts() {
    postCreationMonitor.showCreatedPosts();
  },

  // Show recent posts
  showRecentPosts(limit = 10) {
    postMonitor.showRecentPosts(limit);
  },

  // Show area tag statistics
  showAreaTagStats() {
    postMonitor.showStats();
  },

  // Show network activity summary
  showNetworkActivity() {
    networkDiagnostics.showNetworkSummary();
  },

  // Analyze correlation
  analyzeCorrelation() {
    analyzer.analyzeCorrelation();
  },

  // Refresh dashboard
  dashboard() {
    dashboard.displayDashboard();
  },

  // Raw data access
  getData() {
    return {
      locations: locationTracker.locations,
      createdPosts: postCreationMonitor.postsCreated,
      receivedPosts: postMonitor.posts,
      areaTagCounts: postMonitor.areaTagCounts,
      apiCalls: postMonitor.apiCalls,
      networkCalls: networkDiagnostics.networkCalls
    };
  }
};

// Display initial dashboard
dashboard.displayDashboard();

console.log(`\n%c✨ Experiment ready! Make a post or change location and run:`, 'color: #059669; font-weight: bold; font-size: 12px;');
console.log(`%c   wifiExperiment.dashboard()  to see live stats`, 'color: #059669; font-size: 12px;');
