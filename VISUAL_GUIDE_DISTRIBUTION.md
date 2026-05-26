# Visual Guide: Adaptive Content Distribution Algorithm

## Visual Flow Chart

```
┌────────────────────────────────────────────────────┐
│  User opens FedEx in a specific location           │
│  Example: "Capitol Hill, Seattle"                  │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  System gathers:                                   │
│  - User's location: "Capitol Hill Seattle"         │
│  - Current online users: 145                       │
│  - Posts in user's area: 42                        │
│  - Posts in nearby areas: 150+                     │
│  - Posts in other cities: 1000+                    │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  ALGORITHM STEP 1: CALCULATE PHASE                 │
│  ────────────────────────────────────────────      │
│  145 users → falls in GROWTH phase (101-5K)        │
│                                                     │
│  Why GROWTH?                                       │
│  • Too many for EARLY (100 user limit)             │
│  • Too few for SCALE (5K user threshold)           │
│  • Perfect for balanced local/external             │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  ALGORITHM STEP 2: DETERMINE CONTENT MIX           │
│  ────────────────────────────────────────────      │
│  For GROWTH phase (145 users):                     │
│  • LOCAL CONTENT: 75%                              │
│  • EXTERNAL CONTENT: 25%                           │
│                                                     │
│  For a 12-slot grid:                               │
│  • Local slots needed: 9 (75% of 12)               │
│  • External slots needed: 3 (25% of 12)            │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  ALGORITHM STEP 3: GET LOCAL POSTS                 │
│  ────────────────────────────────────────────      │
│  From "Capitol Hill Seattle":                      │
│  □ Get 9 posts (all types accepted)                │
│  □ All marked: contentSource = "LOCAL"             │
│  □ Display area tag: "Capitol Hill Seattle"        │
│                                                     │
│  Example posts:                                    │
│  ✓ "New coffee shop opening!" (3 likes, 0 dislikes)
│  ✓ "Sunset photo" (12 likes, 1 dislike)           │
│  ✓ "Local event this weekend" (5 likes, 0 dislikes)
│  ... (9 total)                                     │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  ALGORITHM STEP 4: GET TOP-TIER EXTERNAL           │
│  ────────────────────────────────────────────      │
│  From ALL other areas, filter for TOP-TIER ONLY:   │
│                                                     │
│  Check EACH external post:                         │
│  ┌─────────────────────────────────────────────┐  │
│  │ POST: "Pike Place Market photo"             │  │
│  │ Location: Pike Place Market, Seattle        │  │
│  │ Likes: 45, Dislikes: 3                      │  │
│  │ Badge: hot 🔥                                │  │
│  │ ──────────────────────────────────────────  │  │
│  │ ✓ HAS BADGE? Yes (hot)                      │  │
│  │ ✓ POSITIVE ENGAGEMENT? Yes (45 > 3)        │  │
│  │ ✓ QUALIFIES? YES - INCLUDE                  │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ POST: "Local news update"                   │  │
│  │ Location: Ballard, Seattle                  │  │
│  │ Likes: 2, Dislikes: 1                       │  │
│  │ Badge: none                                 │  │
│  │ ──────────────────────────────────────────  │  │
│  │ ✗ HAS BADGE? No                             │  │
│  │ ✗ QUALIFIES? NO - FILTER OUT                │  │
│  └─────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐  │
│  │ POST: "Sunset over city"                    │  │
│  │ Location: Downtown, Seattle                 │  │
│  │ Likes: 89, Dislikes: 45                     │  │
│  │ Badge: trending 📈                          │  │
│  │ ──────────────────────────────────────────  │  │
│  │ ✓ HAS BADGE? Yes (trending)                 │  │
│  │ ✓ POSITIVE ENGAGEMENT? Yes (89 > 45)       │  │
│  │ ✓ QUALIFIES? YES - INCLUDE                  │  │
│  └─────────────────────────────────────────────┘  │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  ALGORITHM STEP 5: SCORE & RANK TOP-TIER           │
│  ────────────────────────────────────────────      │
│  Calculate QUALITY SCORE for each:                 │
│                                                     │
│  Post 1: "Pike Place photo"                        │
│  • Engagement score: (45-3) × 10 = 420             │
│  • Hot badge bonus: +100                           │
│  • Age bonus: 1.0 (fresh post)                     │
│  • TOTAL SCORE: 520                                │
│                                                     │
│  Post 2: "Sunset over city"                        │
│  • Engagement score: (89-45) × 10 = 440            │
│  • Trending badge bonus: +75                       │
│  • Age bonus: 1.0 (fresh post)                     │
│  • TOTAL SCORE: 515                                │
│                                                     │
│  Post 3: "Cute dogs at park"                       │
│  • Engagement score: (67-8) × 10 = 590             │
│  • Featured badge bonus: +60                       │
│  • Negative→Positive shift: +50                    │
│  • Age bonus: 0.8 (slightly older)                 │
│  • TOTAL SCORE: 744 (HIGHEST)                      │
│                                                     │
│  RANKING:                                          │
│  1. "Cute dogs at park" (744)                      │
│  2. "Pike Place photo" (520)                       │
│  3. "Sunset over city" (515)                       │
│  4. "Street art mural" (380)                       │
│  ... (many more)                                   │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  ALGORITHM STEP 6: REBADGE AT CITY LEVEL           │
│  ────────────────────────────────────────────      │
│  For external posts, change location to city:      │
│                                                     │
│  Before rebadging:                                 │
│  □ "Cute dogs at park" - Ballard, Seattle         │
│  □ "Pike Place photo" - Pike Place Market         │
│  □ "Sunset over city" - Downtown, Seattle         │
│                                                     │
│  After rebadging:                                  │
│  □ "Cute dogs at park" - Seattle                  │
│  □ "Pike Place photo" - Seattle                   │
│  □ "Sunset over city" - Seattle                   │
│                                                     │
│  Purpose: Encourage cross-area discovery           │
│  while maintaining locality focus                  │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  ALGORITHM STEP 7: COMBINE & ARRANGE               │
│  ────────────────────────────────────────────      │
│  FINAL GRID (12 boxes):                            │
│                                                     │
│  BOX 1: "New coffee shop" [LOCAL]                  │
│  BOX 2: "Sunset photo" [LOCAL]                     │
│  BOX 3: "Cute dogs" [EXTERNAL, from Seattle]       │
│  BOX 4: "Local event" [LOCAL]                      │
│  BOX 5: "Park walkway" [LOCAL]                     │
│  BOX 6: "Pike Place photo" [EXTERNAL, from Seattle]
│  BOX 7: "Community news" [LOCAL]                   │
│  BOX 8: "Street view" [LOCAL]                      │
│  BOX 9: "Sunset over city" [EXTERNAL, from Seattle]
│  BOX 10: "Festival photo" [LOCAL]                  │
│  BOX 11: "Tips & tricks" [LOCAL]                   │
│  BOX 12: [Empty or from rotation]                  │
│                                                     │
│  USER SEES:                                        │
│  9 local posts + 3 top-tier external               │
│  Mix feels natural, not forced                     │
│  All posts are quality (top-tier verified)         │
└───────────────┬────────────────────────────────────┘
                │
                ↓
┌────────────────────────────────────────────────────┐
│  RESULT: User sees intelligent content mix          │
│                                                     │
│  ✓ Grid is full (not empty)                        │
│  ✓ Local community visible (9/12 posts)            │
│  ✓ Discovers quality external content (3/12)       │
│  ✓ All posts are highly engaged                    │
│  ✓ External posts rebadged as "Seattle"            │
│  ✓ Next rotation in 60 seconds                     │
│                                                     │
│  IF more external posts become top-tier:           │
│  ✓ They'll appear in next 60-second rotation       │
│  ✓ Lowest-scoring external posts rotate out        │
│  ✓ Fresh content without server load               │
└────────────────────────────────────────────────────┘
```

---

## Phase Transition Visualization

```
Users:     1 ──── 10 ──── 100 ──── 1K ──── 5K ──── 50K ──── 500K ──── 1M

Phase:     🥾     │      🌱    │    📈    │    🏛️    │    🏙️    │    🌐
           BOOT   │     EARLY  │  GROWTH  │  SCALE  │ MATURE  │ MASSIVE

Local%:    30     ↗      45     ↗    65    ↗   75   ↗   85   ↗   92   ↗   97

External%: 70     ↘      55     ↘    35    ↘   25   ↘   15   ↘    8   ↘    3

External
Filter:   All    →  Top-Tier  →  Hot/Trend  → Featured→Crowned→Crowned+
           Posts     Only       Only        Only     Only   Exceptional

Result:    🔥     👥      ⚖️       ↙️      🏠      🏘️      🌍
          Flood  Build   Balance  Local   Local+  Hyper-  Pure
          Grid   Cmty    Mix      Lean   Rare    Local   Local
```

---

## Content Mix at Different Scales

### BOOTSTRAP (1-10 users)
```
Grid (12 slots):  ████████████
Content:          [EEE] [EEE] [EEE] [LLL] [LLL]
                  E=External, L=Local

Pattern:  70% External (Desperate for content)
          30% Local (Fill grid)

User sees:  "Wow! So much activity from other cities!"
Result:     Grid never looks empty
```

### EARLY (11-100 users)
```
Grid (12 slots):  ████████████
Content:          [EEEE] [EEEE] [LLLL] [LLLL]
                  E=External (top-tier), L=Local

Pattern:  50% External (Balanced)
          50% Local (Building community)

User sees:  "Our city is growing + I discover cool stuff"
Result:     Community forming with discovery
```

### GROWTH (101-5K users)
```
Grid (12 slots):  ████████████
Content:          [LLLLLL] [LLL] [EEE]
                  E=External (top-tier), L=Local

Pattern:  75% Local (Lean local)
          25% External (Quality only)

User sees:  "Our neighborhood is real + rare highlights"
Result:     Identity established
```

### SCALE (5K-50K users)
```
Grid (12 slots):  ████████████
Content:          [LLLLLLLLLL] [EE]
                  E=External (featured only), L=Local

Pattern:  85% Local (Strong local)
          15% External (Rare)

User sees:  "This is OUR place + exceptional posts featured"
Result:     Hyperlocal community
```

### MATURE (50K-500K users)
```
Grid (12 slots):  ████████████
Content:          [LLLLLLLLLLL] [E]
                  E=External (crowned only), L=Local

Pattern:  92% Local (Nearly pure)
          8% External (Exceptional only)

User sees:  "Almost all local + occasional viral post"
Result:     Community sovereignty
```

### MASSIVE (500K+ users)
```
Grid (12 slots):  ████████████
Content:          [LLLLLLLLLLLL]
                  E=External (crowned+), L=Local

Pattern:  97% Local (Pure)
          3% External (Exceptional only)

User sees:  "Essentially pure neighborhood content"
Result:     Hyperlocal at scale
```

---

## Top-Tier Qualification Decision Tree

```
Post from different area?
├─ NO → Always show (it's local)
└─ YES → Check top-tier qualification
   │
   ├─ Has badge? (hot 🔥, trending 📈, featured ⭐, crowned 👑)
   │  ├─ NO → FILTER OUT (don't show)
   │  └─ YES → Continue
   │
   ├─ Positive engagement? (likes > dislikes)
   │  ├─ NO → FILTER OUT (don't show)
   │  └─ YES → Continue
   │
   └─ QUALIFIED! → Score and add to external pool
      │
      Score calculation:
      ├─ Engagement: (likes - dislikes) × 10
      ├─ Badge bonus: hot=+100, trending=+75, featured=+60
      ├─ Sentiment shift: +50 if negative→positive
      └─ Age decay: multiplier based on post age
         │
         └─ SCORED → Ready for display
            (rotates every 60 seconds)
```

---

## Grid Evolution Over Time

### Day 1 (1 user)
```
BEFORE Algorithm:
□ □ □
□ □ □
□ □ □
(Empty grid - discouraging)

AFTER Algorithm:
🔥 😊 🌅
🎤 👍 📸
🌟 ❤️ 🎨
(Full of external content - encouraging)
```

### Week 1 (10 users)
```
🎉 🌳 🎭 [local]
🔥 😊 🌅 [local + external]
📸 🎪 🌟 [local + external]
(Growing local + external mix)
```

### Month 1 (100 users)
```
🌳 🎭 ❤️ [local]
🎉 🔥 📸 [local + external]
🎪 😊 🌅 [local + local + external]
(Mostly local + some external)
```

### Month 6 (5K users)
```
🎉 🌳 🎭 [local]
❤️ 🎪 😊 [local]
🌟 🎨 📸 [local]
(Nearly all local)
```

### Year 1 (100K users)
```
🎭 ❤️ 🎉 [local]
🌳 🎪 🌟 [local]
🌅 🎨 😊 [local]
(Pure local + rare exceptional)
```

---

## Algorithm Efficiency

```
OPERATION                      TIME        MEMORY
────────────────────────────────────────────────────
Organize posts by area        <1ms        1MB
Calculate content mix         <1ms        0.1MB
Get local posts              <5ms        1MB
Score external posts         <15ms       2MB
Select top-tier              <10ms       0.5MB
Rebadge locations            <5ms        0.5MB
────────────────────────────────────────────────────
TOTAL per renderGrid()        <50ms       5MB

Rotation (60-second intervals): Background process
Performance impact: Negligible
```

---

## Quality Score Examples

### Excellent Post ⭐
```
Title: "Sunset at Pike Place Market"
Location: Pike Place Market, Seattle
Likes: 89
Dislikes: 2
Badge: featured 📌
Age: 2 hours old
Sentiment: positive
────────────────────────────
Engagement: (89-2) × 10 = 870
Badge bonus: +60 (featured)
Sentiment: +0 (already positive)
Age decay: 1.0 (fresh)
────────────────────────────
TOTAL SCORE: 930 (EXCELLENT)
```

### Good Post ✓
```
Title: "New coffee shop opened!"
Location: Capitol Hill, Seattle
Likes: 45
Dislikes: 3
Badge: trending 📈
Age: 6 hours old
Sentiment: positive
────────────────────────────
Engagement: (45-3) × 10 = 420
Badge bonus: +75 (trending)
Sentiment: +0 (already positive)
Age decay: 0.95 (slightly aged)
────────────────────────────
TOTAL SCORE: 475 (GOOD)
```

### Poor Post ✗
```
Title: "Coffee is bad"
Location: Ballard, Seattle
Likes: 2
Dislikes: 8
Badge: none
Age: 24 hours old
Sentiment: negative
────────────────────────────
Engagement: (2-8) × 10 = -60
Badge bonus: +0 (no badge)
Sentiment: +0 (external is local only)
Age decay: 0.5 (older)
────────────────────────────
TOTAL SCORE: -30 (POOR - FILTERED)
```

---

## User Experience Journey

```
NEW USER (Phase: BOOTSTRAP)
Day 1:  Grid full → "Wow, so much activity!"
Day 2:  Grid full → Starting to explore
Day 7:  Grid full → Beginning to post

GROWING COMMUNITY (Phase: EARLY)
Month 1:  Sees local + external → "Cool discoveries"
Month 2:  More local, less external → "Our community"
Month 3:  Balanced mix → Perfect blend

ESTABLISHED COMMUNITY (Phase: GROWTH)
Year 1:    Mostly local → "This is OUR place"
Year 1+:   Rare external → "Exceptional content"
Mature:    Pure local → Hyperlocal identity

MASSIVE COMMUNITY (Phase: MATURE/MASSIVE)
Year 5+:   99% local → Perfect neighborhood platform
           Rare viral → "Once in a lifetime posts"
           Scale:     Infinite users possible
```

---

## Content Rotation Visualization

```
MINUTE 0: External posts in grid
┌──┐┌──┐┌──┐
│E1││E2││E3│
└──┘└──┘└──┘

MINUTE 0-59: Same external posts show
User scrolls, votes, engages

MINUTE 60: Rotation occurs
New top-tier posts selected:
┌──┐┌──┐┌──┐
│E4││E5││E6│  (Different posts, same quality)
└──┘└──┘└──┘

Why rotate?
✓ Fresh content for users
✓ Fair visibility for all quality posts
✓ Prevents "stickiness" of same external
✓ Server-efficient (batch process)
✓ Encourages return visits
```

---

**Visual Guide Complete** ✅

This guide provides visual understanding of the Adaptive Content Distribution Algorithm
across all scales, phases, and operations.

See other docs for technical details:
- ADAPTIVE_CONTENT_DISTRIBUTION.md - Complete specification
- ADAPTIVE_DISTRIBUTION_QUICK_REF.md - Quick reference
- INTEGRATION_GUIDE.md - Technical integration
