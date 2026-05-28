# System Parameters & Knowledge Update
## Real-World Adjustments (Day 1 → 50K Users)

---

## KEY PARAMETERS (Updated)

### User Visibility Threshold
```
PHASE 1 (Users 0-200): EVERYONE SEES EVERYTHING
├─ All posts visible to all users
├─ Chronological ordering
├─ No curation/filtering
├─ Direct post discovery
└─ Simple, authentic grid

PHASE 2 (Users 200+): CURATED EXPERIENCE
├─ Top Posts (curated by engagement)
├─ Spotlight Posts (out-of-town posts)
├─ Personal network posts
├─ Algorithmic recommendations
└─ Content sent TO users (not browsed)
```

### Badge System
```
BADGES APPEAR ON: FIRST LIKE (immediate visibility)

Not:
├─ After 5 likes ❌
├─ After 10 likes ❌
├─ After reaching threshold ❌

But:
├─ First like = badge appears ✅
├─ Shows immediately in UI
├─ Motivates users (visible feedback)
└─ Creates achievement moment
```

### Post Lifespan
```
POSTS LIVE FOR: 7 DAYS (not 10-15 minutes)

Implications:
├─ Post visible: 7 calendar days
├─ Then archived/removed from grid
├─ Popular posts don't get extended lifespan
├─ Fairness: Old post can't permanently dominate
├─ User can view own posts in profile after 7d
└─ Lower churn rate (slower grid refresh)
```

---

## REALISTIC POST CALCULATIONS

### Day 365 Actual Numbers

**Assumption: 1 post per user per day average**

```
Day 365 Parameters:
├─ Users: 2,000-5,000
├─ Avg posts/user/day: 1 (realistic)
├─ Posts per day: 2,000-5,000
├─ Posts per 7 days: 14,000-35,000
└─ Total posts in grid at once: ~14,000-35,000

Reality Check:
├─ I said: "50K-150K posts" (WRONG)
├─ You said: "Much less, 1 post/day average" (CORRECT)
├─ New estimate: 14K-35K posts in grid
├─ NOT 50K-150K (that's annual, not snapshot)
```

**Revised Table:**

| Day | Users | Posts/Day | Total in Grid (7d) | Grid Size |
|-----|-------|-----------|-------------------|-----------|
| 1 | 1-5 | 1-5 | 7-35 | Tiny |
| 10 | 20-50 | 20-50 | 140-350 | Small |
| 30 | 100-300 | 100-300 | 700-2,100 | Medium |
| 100 | 500-1,500 | 500-1,500 | 3.5K-10.5K | Large |
| 365 | 2K-5K | 2K-5K | 14K-35K | Huge |
| 50K | 50,000 | 50,000 | 350K-400K | Massive |

---

## OUT-OF-TOWN SPOTLIGHT FEATURE ⭐
### (Save This Concept - It's Valuable)

**What It Is:**
```
"Out of town" posts = posts from far away zones (outside user's area)
└─ Show users interesting content from other regions
   └─ Makes platform feel broader/more connected
      └─ Increases discovery across zones
```

**How It Works:**

```
User Location: Brooklyn
└─ Primary posts shown: Brooklyn posts (local)
   └─ 60% of grid: Local content (most relevant)
   
   └─ Secondary posts shown: Nearby zones
      └─ 25% of grid: Manhattan, Queens, Bronx (nearby)
      
      └─ Spotlight posts shown: Far away posts
         └─ 15% of grid: Special posts from other cities
            └─ SF, LA, Chicago posts (if those exist)
            └─ Only REALLY GOOD posts (500+ likes)
            └─ Shows user the broader platform

Curation Logic:
├─ User's zone: Every post visible
├─ Nearby zones: Posts with 20+ likes
├─ Out-of-town: Posts with 500+ likes (only exceptional)
└─ Spotlight spot reserved for best cross-zone content
```

**Why It Works:**

```
Problem: If everyone only sees local posts
├─ Platform feels regional/divided
├─ No sense of broader community
├─ Users don't realize it's multi-city
└─ Limits growth appeal

Solution: Spotlight out-of-town posts
├─ Show amazing posts from other cities
├─ Users see "Oh cool, this exists in SF too"
├─ Creates awareness of other zones
├─ Inspires travel/exploration
├─ Makes platform feel global
└─ Increases engagement (cross-zone discovery)
```

**Implementation:**

```javascript
const SPOTLIGHT_RULES = {
  local_zone: {
    percentage: 60,
    min_likes: 0,           // Show all local posts
    refresh: 'every_post'   // Every new post appears
  },
  nearby_zones: {
    percentage: 25,
    min_likes: 20,          // Need some engagement
    refresh: 'every_hour'   // Refresh periodically
  },
  out_of_town_spotlight: {
    percentage: 15,
    min_likes: 500,         // Only exceptional posts
    refresh: 'twice_daily'  // Morning & evening
  }
};
```

**Examples:**

```
User in Brooklyn sees:
├─ Brooklyn posts (60%): "Great bagel spot on 5th Ave"
├─ Manhattan posts (15%): "Times Square energy"
├─ Queens posts (10%): "Forest Hills sunset"
└─ SF Spotlight (15%): "Golden Gate Bridge epic shot" [3,200 likes]
   └─ User thinks: "Wow, this app is in SF too! Cool"
```

---

## BADGE BEHAVIOR (Updated)

### Current System
```
Badges appear on: FIRST LIKE ✅

Timeline:
├─ Post created: No badge
├─ User 1 likes it: BADGE APPEARS
└─ Other users see badge immediately

Why This Works:
├─ Immediate feedback
├─ Motivates poster (validation instant)
├─ Shows other users "this is good" (social proof)
├─ Lower bar (not waiting for 5-10 likes)
└─ Creates engagement flywheel
```

### Badge Types
```
IMMEDIATE (on first like):
├─ NEW ✅ (just posted, fresh content)
├─ BALANCED ⚖️ (equal likes/dislikes - controversial)
└─ Can appear alone or combined

PROGRESSIVE (more likes):
├─ HOT 🔥 (trending, 20+ likes)
├─ RISING 🏃 (rapid engagement increase)
├─ RUNNER-UP 🥈 (second place, 100-200 likes)
├─ PODIUM ⭐ (top tier, 200-500 likes)
├─ CROWNED 👑 (most liked in zone)
└─ SPOTLIGHT 💥 (viral, multi-zone)
```

---

## SYSTEM PARAMETERS SUMMARY

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Everyone-sees-all threshold** | 200 users | After this, curated only |
| **Badge trigger** | 1st like | Immediate visibility |
| **Post lifespan** | 7 days | Then archived |
| **Daily posts/user average** | 1 post/day | Realistic average |
| **Grid refresh rate (0-200u)** | Every post | Chronological |
| **Grid refresh rate (200u+)** | Every hour | Curated refresh |
| **Spotlight percentage** | 15% of grid | Out-of-town posts |
| **Spotlight min engagement** | 500+ likes | Only exceptional |
| **Local posts percentage** | 60% of grid | User's zone priority |
| **Nearby posts percentage** | 25% of grid | Surrounding zones |

---

## WORKING KNOWLEDGE UPDATE

### What I Now Know

1. **Scale Threshold: 200 Users**
   - This is THE pivotal moment
   - Before: Simple grid (everyone sees everything)
   - After: Need curation (too much content)
   - Action: Implement filtering at 200 user mark

2. **Post Lifespan: 7 Days**
   - Not 10-15 minutes (I was wrong)
   - Not 1 hour (engagement cycles differently)
   - Posts live for full week
   - Implications:
     - Slower grid churn
     - More posts in grid simultaneously
     - Posts peak earlier, then decline
     - Fairness: old posts don't permanently dominate
     - Archive system needed after 7d

3. **Posts Per Day: Realistic Math**
   - 1 post/user/day average (not 3-5)
   - Day 365 = 2K-5K users = 2K-5K posts/day
   - Total in grid = 14K-35K posts (not 50K-150K)
   - Impacts grid size calculations
   - Affects storage, query optimization

4. **Badges on First Like**
   - Immediate visibility motivates posting
   - Creates fast feedback loop
   - Shows "this is good" to other users
   - Lower barrier than "5 likes to badge"

5. **Out-of-Town Spotlight (Critical Feature)**
   - Send 15% of grid as "interesting far-away posts"
   - Only show posts with 500+ likes from other zones
   - Creates discovery across geographic regions
   - Makes platform feel global/connected
   - Increases engagement (people explore other zones)
   - Inspires travel/community building across zones

### Decision Points for Implementation

**At 200 Users (Threshold Event):**
```
1. Enable curated grid
2. Split posts: 60% local, 25% nearby, 15% spotlight
3. Add spotlight selection logic (500+ likes from out-of-town)
4. Switch from "everyone sees all" to "send top posts"
5. Implement filtering UI
```

**Archive System (Post 7 Days):**
```
1. At 7 days exactly: Remove post from main grid
2. Keep in user's profile (archived section)
3. Keep in database (analytics)
4. Still searchable (if search exists)
5. Spot available for new post
```

**Engagement-Based Visibility:**
```
Within 7-day window:
├─ Days 1-2: High visibility (fresh + badges)
├─ Days 3-4: Medium visibility (if engagement good)
├─ Days 5-7: Low visibility (unless 500+ likes)
├─ After 7: Archived only
└─ Popular posts can get extended visibility (optional)
```

---

## NEXT IMPLEMENTATION PHASES

### Phase 1: NOW (Pre-launch)
- [x] Build 5 WiFi network system
- [x] Build zone detection
- [x] Build basic grid (everyone sees everything)
- [ ] Build badge system (first-like trigger)
- [ ] Build 7-day archive system

### Phase 2: At 200 Users
- [ ] Implement 200-user threshold detection
- [ ] Switch to curated grid
- [ ] Implement local/nearby/spotlight split
- [ ] Add out-of-town spotlight logic
- [ ] Monitor user retention (does curation help or hurt?)

### Phase 3: Day 100+
- [ ] Build recommendation engine (if needed)
- [ ] Optimize for 1K+ users
- [ ] Monitor post lifespan (adjust 7 days if needed)
- [ ] Analyze engagement patterns

### Phase 4: Day 365+
- [ ] Creator analytics dashboard
- [ ] Zone-based communities
- [ ] Better sorting algorithms
- [ ] Cross-zone recommendations

---

## POTENTIAL ADJUSTMENTS (Future)

```
Post Lifespan:
├─ Currently: 7 days (fixed)
├─ Could adjust based on:
│  ├─ Engagement rate (popular posts extend to 10d?)
│  ├─ Zone activity (quiet zones: 14d, busy: 3d?)
│  ├─ Day of week (weekend posts different from weekday?)
│  └─ Seasonal (winter vs summer patterns?)
└─ Monitor and adjust in Phase 2+

Spotlight Threshold:
├─ Currently: 500+ likes for out-of-town
├─ Could adjust based on:
│  ├─ Zone size (small zones: lower threshold)
│  ├─ Engagement rate (increase threshold as platform matures)
│  └─ User preferences (some users want more discovery)
└─ Start at 500, adjust after data

Grid Curation Percentage:
├─ Currently: 60% local, 25% nearby, 15% spotlight
├─ Could adjust based on:
│  ├─ User feedback (do they want more out-of-town?)
│  ├─ Engagement rates (if spotlight underperforms, adjust)
│  ├─ Growth data (different percentages for different zones?)
│  └─ Time of day (morning: more local, evening: more discovery?)
└─ A/B test different splits
```

---

## Summary: What Changed

### I Was Wrong About:
- Post lifespan (said 10-15 min, actually 7 days)
- Total posts by day 365 (said 50K-150K, actually 14K-35K)
- Posts per day calculation (didn't account for realistic 1 post/user/day)

### You Clarified:
- 200 users is the "everyone sees all" threshold
- 7 days is the post lifespan (balanced between freshness and fairness)
- Badges appear on FIRST like (immediate)
- Out-of-town spotlight (brilliant feature for discovery)
- Users post ~1x per day (more realistic than my overestimates)

### Now Building:
- Threshold-based visibility (everyone 0-200, curated 200+)
- Spotlight out-of-town feature (15% of grid, 500+ likes minimum)
- Badge-on-first-like system
- 7-day post lifecycle with archive
- Realistic post volume calculations
