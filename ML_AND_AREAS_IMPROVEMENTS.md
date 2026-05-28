# ML Distribution & User Area Specificity Improvements

## Overview
Implemented two major improvements to increase content diversity and allow users to define specific areas for their posts.

---

## 1. ML Distribution Enhancements

### Geographic Split Update (Commit 01fe0e0)
**Location**: Lines 12073-12090 in index.html

**Old Distribution**:
- Local posts: 80%
- Regional posts: 15%
- Distant posts: 5%
- **Total external: 20%**

**New Distribution**:
- Local posts: 65%
- Regional posts: 25%
- Distant posts: 10%
- **Total external: 35% (+75% increase)**

**Impact**:
- Users see much more diverse content from other areas
- Regional content increased by 67% (15% → 25%)
- Distant content quadrupled (5% → 10%)
- 1.75x more external posts now reach user grids

---

## 2. Spotlight Injection Acceleration (Commit 01fe0e0)

**Location**: Lines 13790-13880 in index.html

### Performance Improvements

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Injection Interval | 1000ms | 500ms | **2x faster** |
| Posts per Cycle | 1 | 2-3 | **2-3x more** |
| Posts per Minute | 60 | 240-360 | **4-6x increase** |

### How It Works
```javascript
// Calculates spotlight count based on available external posts
const spotlightCount = Math.min(3, Math.max(2, Math.floor(otherAreaPosts.length / 50)));

// Injects 2-3 spotlight posts every 500ms
for (let i = 0; i < spotlightCount; i++) {
    // Each post filtered: userId !== currentUserId && county !== userLocation.county
}

// Runs every 500ms (was 1000ms)
setInterval(..., 500);
```

### Real-World Example
- If grid has 150 external posts available:
  - Spotlightcount = Math.min(3, Math.max(2, Math.floor(150/50))) = Math.min(3, 3) = **3 posts**
  - Every 500ms, 3 new posts injected
  - Over 1 minute: 120 new external posts injected
  - Users see constant stream of fresh content from other areas

---

## 3. User-Generated Area Specificity (Commit a66c1fc)

### New Feature: Custom Area Names

**Location**: Upload Modal & Zone Tag Rendering

#### Upload Form Enhancement
Added new input field in upload modal (after auto-detected zone):
```html
<input id="customZoneTag" 
       placeholder="Specify area (optional): e.g., 'Downtown', 'Westside', 'By the Park'"
       style="padding: 12px 16px; border-radius: 8px; ..."/>
```

**Benefits**:
- Users can specify exact neighborhood names
- Examples: "Downtown LA", "Westside", "Arts District", "Tech Hub"
- Stored in post data as `customTag` field
- Can be longer/more specific than auto-detected location

#### Zone Tag Display
**For Custom Areas**: Amber highlight with ✨ emoji
```
✨ Downtown LA
✨ By the Park
✨ Arts District
```
- Font: Bold, 13px
- Background: Amber gradient (amber-500)
- Text color: Black (#000)
- Makes custom areas stand out visually

**For Auto-Detected Areas**: Original white display
```
🌍 Downtown Los Angeles
🌍 Venice Beach
```

### How to Use
1. User opens upload modal
2. Auto-detected zone shows (e.g., "📍 Downtown")
3. User can optionally enter custom area name in input field
4. When post is created, custom area is saved in `customTag` field
5. Zone tag displays with ✨ emoji and amber color

### Data Storage
Post data structure:
```javascript
const postData = {
    id: postId,
    networkId: currentUserId,
    content: postText,
    county: autoDetectedArea,    // Auto POI/Location
    customTag: userSpecifiedArea, // User custom area (new)
    neighborhood: autoDetectedArea,
    // ... other fields
};
```

---

## 4. Combined Impact

### Before These Changes
- Users saw mostly local posts (80%)
- Limited diversity from other areas
- Spotlight injected slowly (1 post/second)
- No way to specify custom neighborhood names

### After These Changes
- Users see 35% external content (65% local + 35% regional/distant)
- Spotlight injects 4-6x more posts per minute
- Users can specify custom area names like "By the Park" or "Downtown"
- Custom areas display with distinctive amber highlighting
- Fresh diverse content constantly cycling through user grids

---

## 5. Technical Details

### ML Algorithm Changes
**File**: index.html, `renderGrid()` function

**Geographic Tier Calculation**:
```javascript
const geoScore = calculateGeographicGravity(userLocation, post.geolocation);
// Tier classification:
// geoScore >= 0.7 → LOCAL (65% of grid)
// 0.3 <= geoScore < 0.7 → REGIONAL (25% of grid)
// geoScore < 0.3 → DISTANT (10% of grid)
```

**Spotlight Injection Filter**:
```javascript
// Only inject posts from OTHER areas
const isExternal = userId !== currentUserId && county !== userLocation.county;
if (isExternal) {
    // Render spotlight post
}
```

### Performance Considerations
- Spotlight interval reduced from 1000ms → 500ms
- More efficient filtering with county-based comparison
- No additional database queries (uses existing post data)
- Negligible CPU impact (simple array filtering)

---

## 6. Testing Checklist

- [ ] Load app and verify custom area input appears in upload modal
- [ ] Enter custom area name and post content
- [ ] Confirm zone tag shows with ✨ emoji and amber color
- [ ] Check grid shows 35% external posts (65% local minimum)
- [ ] Watch for spotlight posts every ~500ms
- [ ] Verify 2-3 spotlight posts injected per cycle
- [ ] Test on mobile - custom area input responsive
- [ ] Test on desktop - amber highlighting visible
- [ ] Verify Firebase stores `customTag` field
- [ ] Check console logs show "65/25/10 ratio - INCREASED EXTERNAL"

---

## 7. Commit History

| Commit | Date | Changes |
|--------|------|---------|
| 01fe0e0 | Current | ML: 65/25/10 split + Spotlight 500ms/2-3 posts |
| a66c1fc | Current | Areas: Custom area names + ✨ amber zone tags |

---

## 8. Next Steps (Optional Enhancements)

1. **Area Autocomplete**: Suggest common neighborhood names as user types
2. **Area Trending**: Show which custom areas are most active
3. **Area Filtering**: Let users filter posts by specific areas
4. **Area Analytics**: Show user stats for each custom area they post to
5. **Area Network**: Build community around specific neighborhoods

---

## Summary

✅ **ML Distribution**: External posts increased 75% (20% → 35%)
✅ **Spotlight Performance**: 4-6x more posts per minute (500ms/2-3)
✅ **User Areas**: Custom neighborhood naming with visual distinction
✅ **All changes committed** to main branch

The system now sends much more diverse content to user grids while allowing users to specify exactly which neighborhood/area their post is for.
