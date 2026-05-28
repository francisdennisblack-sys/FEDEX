# Implementation Checklist - Updated System Parameters

## ✅ COMPLETED (Just Committed)
- [x] Added SYSTEM_PARAMS constant to server.js
- [x] Updated GRID_EVOLUTION_1_TO_50K_USERS.md with 200-user threshold
- [x] Corrected Day 365 post calculations (14K-35K, not 50K-150K)
- [x] Documented badge system (first-like trigger)
- [x] Documented 7-day post lifespan
- [x] Created SYSTEM_PARAMETERS_UPDATED.md with full details
- [x] Added out-of-town spotlight feature specification
- [x] Documented grid curation split (60/25/15)

---

## 🔄 NEXT STEPS - Implementation in Index.html

### Phase 1: Badge System (Badge on First Like)
**Location**: `index.html` badge rendering logic

**Current State**: 
- Badges might appear after multiple likes
- Need to change to: appear on FIRST like

**Changes Needed**:
```javascript
// OLD: Badge appears after 5+ likes
if (post.likes >= 5) {
  showBadge(post);
}

// NEW: Badge appears on first like
if (post.likes >= 1) {  // SYSTEM_PARAMS.BADGE_TRIGGER = 1
  showBadge(post);
}
```

**Files to Edit**:
- index.html (search for badge rendering logic)
- Look for: `likes >= 5`, `likeCount >= 5`, `likes > 4`
- Change to: `likes >= 1`, `likeCount >= 1`

---

### Phase 2: 200-User Threshold Implementation
**Location**: Grid visibility/curation logic in index.html

**Current State**:
- All posts probably shown to all users (chronological)

**Changes Needed**:
```javascript
// Get current user count from backend
const userCount = await getActiveUserCount();

if (userCount < SYSTEM_PARAMS.EVERYONE_SEES_ALL_THRESHOLD) {
  // MODE 1: Everyone sees everything (0-200 users)
  displayAllPostsChronological();
} else {
  // MODE 2: Curated grid (200+ users)
  displayCuratedGrid();
}
```

**Implementation**:
1. Create `getActiveUserCount()` endpoint in server.js
2. Return count of unique users from last 24 hours
3. In index.html, check on page load
4. Switch grid display mode based on threshold

---

### Phase 3: Grid Curation System (60/25/15 Split)
**Location**: Grid filtering/sorting in index.html

**Current State**:
- Likely showing all posts from all zones

**Changes Needed**:
```javascript
// At 200+ users, split grid:
const LOCAL_PERCENTAGE = 0.60;      // 60% local posts
const NEARBY_PERCENTAGE = 0.25;     // 25% nearby posts
const SPOTLIGHT_PERCENTAGE = 0.15;  // 15% out-of-town posts

function getCuratedGrid(allPosts, userZone) {
  const localPosts = allPosts.filter(p => p.zone === userZone);
  const nearbyPosts = allPosts.filter(p => isNearby(p.zone, userZone));
  const spotlightPosts = allPosts.filter(p => 
    isOutOfTown(p.zone, userZone) && 
    p.likes >= SYSTEM_PARAMS.SPOTLIGHT_MIN_LIKES  // 500+ likes
  );
  
  // Combine in percentages
  const gridSize = 50; // Show 50 posts
  return [
    ...localPosts.slice(0, gridSize * 0.60),
    ...nearbyPosts.slice(0, gridSize * 0.25),
    ...spotlightPosts.slice(0, gridSize * 0.15)
  ];
}
```

**Files to Edit**:
- index.html (grid display logic)
- server.js (add zone detection endpoint)

---

### Phase 4: Out-of-Town Spotlight Feature
**Location**: Post filtering logic for spotlight section

**Current State**:
- Spotlight section (if exists) probably shows top posts globally

**Changes Needed**:
```javascript
// Spotlight: Only show posts from OTHER zones with 500+ likes
function getSpotlightPosts(allPosts, userZone) {
  return allPosts.filter(p => 
    p.zone !== userZone &&                    // Different zone
    p.likes >= SYSTEM_PARAMS.SPOTLIGHT_MIN_LIKES  // 500+ likes minimum
  ).sort((a, b) => b.likes - a.likes)         // Sort by engagement
   .slice(0, 10);                              // Show top 10
}
```

**Why This Matters**:
- Users see "Oh, this platform exists in other cities too"
- Creates sense of broader community
- Increases engagement (cross-zone discovery)
- Inspires travel/exploration
- Only shows EXCEPTIONAL posts (500+ likes = really good)

---

### Phase 5: 7-Day Post Archive System
**Location**: Post expiration/archive logic

**Current State**:
- Posts probably never expire (or wrong expiration time)

**Changes Needed**:
```javascript
// When displaying posts, check age
function shouldArchivePost(post) {
  const postAgeDays = (Date.now() - post.createdAt) / (24 * 60 * 60 * 1000);
  return postAgeDays > SYSTEM_PARAMS.POST_LIFESPAN_DAYS;  // 7 days
}

// On grid display:
const activePosts = allPosts.filter(p => !shouldArchivePost(p));
displayGrid(activePosts);

// Archived posts stay in:
// - User's profile (in "My Posts" section)
// - Database (for analytics)
// - Searchable (if search exists)
```

**Files to Edit**:
- index.html (post filtering logic)
- server.js (add post archive endpoint)

---

### Phase 6: Realistic Post Volume Calculations
**Location**: Any display of post statistics/projections

**Update References From**:
- "50K-150K posts by Day 365" → "14K-35K posts"
- "Users post 3-5x per day" → "Users post 1x per day average"
- "Day 365: 50K users" → "Day 365: 2K-5K users"

**Files to Update**:
- index.html (any stats/dashboard)
- Documentation files (already updated)

---

## 🎯 Priority Implementation Order

### Tier 1 (Critical, do first):
1. [ ] Badge on first like (simple boolean change)
2. [ ] 200-user threshold detection (add backend endpoint)
3. [ ] 7-day post expiration (simple date comparison)

### Tier 2 (Important, do second):
4. [ ] Grid curation split (60/25/15)
5. [ ] Out-of-town spotlight filtering
6. [ ] Zone-based post sorting

### Tier 3 (Nice to have, do later):
7. [ ] Archive UI (show archived posts in profile)
8. [ ] Post statistics dashboard
9. [ ] Analytics on grid performance

---

## 📊 Testing Checklist

### Badge System:
- [ ] Post 1st time → No badge initially
- [ ] User likes → Badge appears immediately
- [ ] Verify badge shows on first like (not at 0 likes)

### 200-User Threshold:
- [ ] Simulate with <200 users → All posts visible
- [ ] Simulate with >200 users → Only curated posts visible
- [ ] Check grid switches automatically at boundary

### Grid Curation:
- [ ] Local posts = 60% of grid
- [ ] Nearby posts = 25% of grid
- [ ] Spotlight posts = 15% of grid
- [ ] Verify total = 100%

### Spotlight Posts:
- [ ] Out-of-town posts with <500 likes → NOT shown
- [ ] Out-of-town posts with 500+ likes → Shown in spotlight
- [ ] Local posts → NOT shown in spotlight
- [ ] Nearby posts → NOT shown in spotlight (only out-of-town)

### 7-Day Archive:
- [ ] Post age 0-6 days → Visible in grid
- [ ] Post age 7+ days → Moved to archive
- [ ] Archived posts → Still in user profile
- [ ] Archived posts → Still searchable

---

## 💾 Code References

### In server.js:
- Line ~16-38: SYSTEM_PARAMS constant definition
- These values should be imported/used in index.html

### In SYSTEM_PARAMETERS_UPDATED.md:
- Complete specification of all parameters
- Implementation examples
- Algorithm descriptions

### In GRID_EVOLUTION_1_TO_50K_USERS.md:
- Line 8-25: 200-user threshold explanation
- Line 365+: Updated Day 365 calculations

---

## 🚀 Current Status

**Live at**: https://wificontent.com

**Recent Changes**:
- ✅ Commit 8a59ecd: Added SYSTEM_PARAMS to server.js
- ✅ Updated GRID_EVOLUTION documentation
- ✅ Created SYSTEM_PARAMETERS_UPDATED.md

**Ready for Implementation**:
- Badge system (index.html badge logic)
- 200-user threshold (index.html + server endpoint)
- 7-day archive (index.html post filtering)
- Grid curation (index.html grid display)
- Spotlight feature (index.html post filtering)

---

## 📝 Notes

**Important Definitions**:
- **Local**: Posts from user's current zone/network
- **Nearby**: Posts from adjacent zones (same WiFi network or neighboring)
- **Out-of-town**: Posts from different cities/zones (far away)
- **Spotlight**: Exceptional out-of-town posts (500+ likes)

**Timeline**:
- Day 1-199: Everyone sees all posts (authentic, simple)
- Day 200+: Curated grid (necessary for scale, prevents overwhelm)
- Day 365: 2K-5K users, 14K-35K posts in rolling 7-day window

**User Experience Goals**:
- Day 1-199: "Wow, I can see everything happening in my WiFi network!"
- Day 200+: "These are the best posts happening now in my neighborhood + some cool stuff from nearby + amazing posts from across the country"
- Day 365+: "This platform is nationwide, shows me my community + interesting discoveries from far away"
