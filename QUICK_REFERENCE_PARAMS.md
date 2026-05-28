# ⚡ Quick Reference - System Parameters

## 🔢 THE NUMBERS

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Everyone-sees-all** | 0-200 users | Switch to curated at 200+ |
| **Badge trigger** | 1st like | Immediate, not 5-10 |
| **Post lifespan** | 7 days | Then archived |
| **Posts per user** | 1/day average | Realistic rate |
| **Grid local split** | 60% | User's zone posts |
| **Grid nearby split** | 25% | Surrounding zones |
| **Grid spotlight split** | 15% | Out-of-town posts |
| **Spotlight min engagement** | 500+ likes | Only exceptional posts |
| **Day 365 users** | 2K-5K | Mid-scale platform |
| **Day 365 posts in grid** | 14K-35K | 7-day rolling window |

---

## 🎯 CRITICAL THRESHOLD: 200 USERS

```
Users 0-200: EVERYONE SEES ALL
├─ Chronological order
├─ All posts visible
├─ Direct discovery
└─ Authentic experience

Users 200+: CURATED GRID
├─ 60% local posts
├─ 25% nearby posts
├─ 15% out-of-town spotlight
└─ Posts sent to users
```

---

## 📍 GRID CURATION SPLIT (At 200+ Users)

```
LOCAL (60%)
  Posts from user's current zone/network
  Every post from your area visible
  Most relevant to you
  
NEARBY (25%)
  Posts from surrounding zones
  Other neighborhoods/cities nearby
  Some filtered (min 20 likes)
  Promotes local discovery
  
SPOTLIGHT (15%)
  Posts from far away (other cities)
  MINIMUM 500+ LIKES required
  Only exceptional content
  Creates cross-zone discovery
  Makes platform feel nationwide
```

---

## ⭐ OUT-OF-TOWN SPOTLIGHT FEATURE

**What**: 15% of grid shows amazing posts from other cities

**Why**: Users realize "This platform exists everywhere!"

**How**: Only posts with 500+ likes from other zones

**Effect**: 
- Cross-zone discovery ↑
- Engagement ↑
- Community feeling ↑
- Platform awareness ↑

**Example**:
```
You're in Brooklyn, see:
├─ Local: "Best coffee on 5th Ave" [89 likes]
├─ Nearby: "Times Square energy" [123 likes]
└─ Spotlight: "Golden Gate sunrise" [1,200 likes] ← From SF
               "LA beach sunset" [890 likes] ← From LA
```

---

## 🔔 BADGE SYSTEM

**Trigger**: FIRST LIKE

Not:
- ❌ After 5 likes
- ❌ After 10 likes
- ❌ After reaching threshold

But:
- ✅ 0 likes → 1 like = BADGE APPEARS
- ✅ Immediate visibility
- ✅ Shows validation instantly
- ✅ Motivates poster

---

## 📅 7-DAY POST LIFECYCLE

```
Day 1-6: Active in grid
  ├─ Visible to all users
  ├─ Can accumulate likes
  └─ Can trend up/down

Day 7: Last day visible
  ├─ Still in grid
  ├─ Can still get engagement
  └─ Archiving starts at midnight

Day 8+: Archived
  ├─ Removed from main grid
  ├─ Still in user's profile ("My Posts")
  ├─ Still in database (analytics)
  ├─ Still searchable (if search exists)
  └─ Spot freed up for new post
```

**Why 7 days?**
- Balances freshness (posts don't stay forever)
- Fairness (old posts don't permanently dominate)
- Cycle length matches usage patterns
- Good for all users (gives posts time to be discovered)

---

## 📊 REALISTIC CALCULATIONS

### Day 365 Numbers:
```
Users: 2,000-5,000
Avg posts/user/day: 1
Posts per day: 2,000-5,000
Posts in 7-day window: 14,000-35,000

NOT 50,000-150,000 (that was overestimate)
```

### Why 1 post/day average?
- Most users post 0-2 times per week
- Some regular users post daily
- Some super users post 2-3x per day
- Average smooths to ~1 post/user/day

---

## 🚀 IMPLEMENTATION ORDER

### Do First (Tier 1):
1. Badge on first like (2 hours)
2. 200-user threshold (4 hours)
3. 7-day archive (2 hours)

### Do Next (Tier 2):
4. Grid curation split (6 hours)
5. Out-of-town spotlight (4 hours)
6. Zone detection (3 hours)

### Do Later (Tier 3):
7. Archive UI (3 hours)
8. Stats dashboard (4 hours)
9. Analytics (5 hours)

---

## 🔧 CODE REFERENCE

### In server.js (Lines 16-38):
```javascript
const SYSTEM_PARAMS = {
  EVERYONE_SEES_ALL_THRESHOLD: 200,
  BADGE_TRIGGER: 1,
  POST_LIFESPAN_DAYS: 7,
  AVG_POSTS_PER_USER_PER_DAY: 1,
  CURATION_SPLIT: {
    local: 0.60,
    nearby: 0.25,
    spotlight: 0.15
  },
  SPOTLIGHT_MIN_LIKES: 500,
};
```

### Use in index.html:
```javascript
// Import or fetch SYSTEM_PARAMS
if (post.likes >= SYSTEM_PARAMS.BADGE_TRIGGER) {
  showBadge(post);
}

if (userCount < SYSTEM_PARAMS.EVERYONE_SEES_ALL_THRESHOLD) {
  showAllPosts();
} else {
  showCuratedGrid();
}

if (postAgeDays > SYSTEM_PARAMS.POST_LIFESPAN_DAYS) {
  archivePost(post);
}
```

---

## 📚 FILES TO REFERENCE

| File | Purpose | Key Sections |
|------|---------|--------------|
| [SYSTEM_PARAMETERS_UPDATED.md](SYSTEM_PARAMETERS_UPDATED.md) | Full specification | All parameters explained |
| [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) | Coding tasks | Step-by-step with code examples |
| [GRID_EVOLUTION_1_TO_50K_USERS.md](GRID_EVOLUTION_1_TO_50K_USERS.md#L8-L25) | Threshold explanation | 200-user logic |
| [server.js](server.js#L16-L38) | Backend constants | SYSTEM_PARAMS definition |
| [SESSION_UPDATE_SUMMARY.md](SESSION_UPDATE_SUMMARY.md) | What changed | Summary of all updates |

---

## 💾 Where It's Deployed

**GitHub**: Commits 527c7f1 (latest)

**Live**: https://wificontent.com (will update when index.html changes)

**Status**: Ready for feature implementation

---

## 🎮 USER EXPERIENCE AT EACH STAGE

### Day 1-50 (1-50 users)
- **Grid**: Everyone sees all posts
- **Feel**: Empty but intimate (early adopters)
- **Posts**: 7-350 (huge variation)
- **Action**: Encourage invites

### Day 100 (500-1500 users)
- **Grid**: Still everyone sees all (under 200 threshold)
- **Feel**: Diverse, growing fast
- **Posts**: 3,500-10,500 posts in rolling window
- **Action**: Start planning curation

### Day 200 (at threshold, switch!)
- **Grid**: SWITCH to curated (60/25/15)
- **Feel**: Grid becomes manageable again
- **Change**: 3 types of posts now
- **Impact**: Retention improves

### Day 365 (2K-5K users)
- **Grid**: Full curation in effect
- **Feel**: Smart, personalized, yet discovers
- **Posts**: 14K-35K in rolling window
- **Communities**: Forming organically

---

## ✨ The Out-of-Town Spotlight Idea

**Credit**: Your innovation this session

**Why It's Valuable**:
- Shows users platform is bigger than their zone
- 500+ like minimum ensures quality
- 15% is enough to matter without overwhelming
- Creates incentive for posts to go viral

**Real-World Example**:
```
You scroll NYC posts...
Then see this: "Golden Gate Bridge at sunrise" [1.2K likes]
You think: "Wait, they're showing me SF posts? This app 
           must be big! I should share more. Maybe I'll 
           travel and post from there too."
```

**Growth Impact**:
- More sharing (want posts to reach other zones)
- More engagement (want to see what's elsewhere)
- More invites (tell friends in other cities)
- More posting (inspiration from other zones)

---

## 🔄 Remember

- **200 users** = Critical threshold (everything changes)
- **First like** = Badge appears (immediate validation)
- **7 days** = Post lifespan (then archived)
- **1/day** = Realistic post rate (affects grid size)
- **60/25/15** = Curation split (balances local + discovery)
- **500+ likes** = Spotlight minimum (only exceptional)
- **14K-35K** = Grid size at Day 365 (realistic scale)

These are now **in code** (server.js) and **documented** (multiple files).

Ready to implement! 🚀
