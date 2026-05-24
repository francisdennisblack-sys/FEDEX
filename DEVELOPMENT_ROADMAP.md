# FEDEX-ZONES-v2 Development Roadmap
**Project Status:** Core zone system working, polishing phase  
**Target:** Complete user vote limiting & zone-based content delivery

---

## ✅ Completed Features

### Core Infrastructure
- ✅ Firebase Realtime Database integration
- ✅ Firebase Authentication (anonymous)
- ✅ Firebase Storage (photo/video uploads)
- ✅ Zone detection (geolocation + nearby WiFi networks)
- ✅ Real-time post synchronization

### User Interface
- ✅ Modern "Send" button (gradient, hover effects)
- ✅ Clean modal (no header, no X button)
- ✅ Responsive grid layout (phone/tablet/desktop)
- ✅ Zone tags on posts (18px, bold, positioned)
- ✅ Vote badges (like/dislike counts)

### Content Management
- ✅ Photo uploads with moderation
- ✅ Video uploads with moderation
- ✅ Post deletion
- ✅ Post reporting system
- ✅ 72-hour auto-cleanup of old posts

---

## 🔄 In Progress

### 1. Ghost Posts / Duplicate Post IDs
**Issue:** Same post ID appearing 26 times with different zones  
**Status:** De-duplication logic added, awaiting testing  
**Next:** Verify console logs show proper de-duplication

**Related Code:**
- `subscribeToFirebasePosts()` line 2620
- `subscribeToFirebasePostsWithReconnect()` line 3815
- `renderGrid()` line 3965

---

## 🎯 High Priority (Next Sprint)

### 2. Vote Limiting System (Critical for MVP)
**Objective:** Each user can only vote ONCE per post (like OR dislike)

**Implementation Plan:**
```javascript
// Store votes by: userID_postID
const voteKey = `${currentUserId}_${postId}`;
userVotes[voteKey] = 'like' | 'dislike' | null;

// Rules:
// - First vote: save as 'like' or 'dislike'
// - Click same button: remove vote (set to null)
// - Click other button: switch vote
// - Max 1 vote per post per user
```

**Files to Update:**
- `toggleLike()` (line ~3222)
- `toggleDislike()` (line ~3255)
- `voteOnPost()` (line ~5082)

**Testing:**
- [ ] Like a post
- [ ] Try to like again (should toggle off)
- [ ] Click dislike (should switch)
- [ ] Verify Firebase `likes` and `dislikes` counts are correct
- [ ] Reload page, votes should persist

---

### 3. Zone-Based Content Delivery (Critical for UX)
**Objective:** Posts only show if user is in same zone as post was created in

**Current Status:**
- Zone detection: ✅ Working
- Zone storage: ⚠️ Needs verification (county field)
- Zone filtering: ⚠️ Working but needs testing

**Filtering Logic (renderGrid):**
```javascript
// Line 3976-3981
const zonePosts = allPosts.filter(post => {
    const postZone = post.county || 'Unknown County';
    const currentZone = currentZoneTag || 'Unknown County';
    return postZone === currentZone;
});
```

**Testing Plan:**
1. [ ] Create post in Zone A
2. [ ] Switch to Zone B (simulate movement)
3. [ ] Verify post NOT visible in Zone B
4. [ ] Switch back to Zone A
5. [ ] Verify post visible again

---

## 📋 Medium Priority (Polish Phase)

### 4. User Identity Persistence
**Objective:** Store user preferences/voting history across sessions

**Current State:**
- Anonymous auth working ✅
- UID persists across sessions ✅
- Votes stored in localStorage ✅

**Enhancement:**
- Sync votes to Firebase under user UID
- Store user preferences (theme, zone, etc.)

---

### 5. Admin Dashboard Enhancement
**Current Features:**
- [ ] View reported posts
- [ ] Ban/mute users
- [ ] Manage zones
- [ ] View statistics

**Missing:**
- [ ] Delete posts from dashboard
- [ ] Edit zone mapping
- [ ] View user activity logs

---

## 🔧 Low Priority (Future Versions)

### 6. Performance Optimization
- [ ] Lazy-load images
- [ ] Infinite scroll pagination
- [ ] Cache posts locally
- [ ] Compress video before upload
- [ ] Implement CDN for storage

### 7. Advanced Features
- [ ] Post scheduling
- [ ] Hashtag system
- [ ] User mentions
- [ ] Direct messaging
- [ ] Post collections/bookmarks
- [ ] Custom zone creation

---

## 🐛 Known Issues

| Issue | Status | Priority | Notes |
|-------|--------|----------|-------|
| Reverse geocoding API | ✅ FIXED | - | Now uses Nominatim |
| Ghost posts duplicate IDs | 🔄 IN PROGRESS | HIGH | De-duplication added |
| Zone tags not bold/large | ✅ FIXED | - | Updated to 18px, weight 900 |
| Zone filter not working | 🔄 IN PROGRESS | HIGH | De-dup may fix this |
| Vote limiting missing | ⚠️ TODO | HIGH | Next sprint |
| Post retrieval by zone | ⚠️ TODO | HIGH | After vote limiting |

---

## 📊 Testing Checklist

### Before Deployment
- [ ] Geolocation works (check console for coordinates)
- [ ] Reverse geocoding returns location name
- [ ] Zone detection shows correct WiFi network or location
- [ ] Posts save with `county` field populated
- [ ] De-duplication removes duplicate post IDs
- [ ] Vote limiting prevents multiple votes
- [ ] Zone filtering shows only posts from current zone

### After Deployment
- [ ] Test on real devices (iOS, Android, desktop)
- [ ] Verify CORS works for Nominatim API
- [ ] Check Firebase real-time updates
- [ ] Monitor for errors in console

---

## 💾 File Structure

```
/Users/francisblack/Downloads/Fedex/
├── index.html (5200+ lines, main app)
├── firebase-db.js (Firebase operations)
├── firebase-config.js (API keys)
├── server.js (Express backend)
├── package.json (dependencies)
├── SESSION_DEBUG_LOG.md (this session's logs)
├── FEDEX_ZONES_v2.md (project overview)
└── Documentation/
    ├── FIREBASE_IMPLEMENTATION.md
    ├── FIREBASE_TESTING_GUIDE.md
    ├── DATABASE_GUIDE.md
    └── ...
```

---

## 🚀 Deployment Strategy

1. **Test Locally**
   - Hard refresh, check console logs
   - Create test posts across zones
   - Verify de-duplication working

2. **Deploy to Vercel**
   - `git add .`
   - `git commit -m "Fix reverse geocoding, add de-duplication"`
   - `git push`
   - Monitor logs: `vercel logs`

3. **Monitor Production**
   - Check Firebase console for post count
   - Monitor for duplicate post IDs
   - Track user feedback

---

## 📞 Reference Materials

**Console Logs to Watch For:**
- `✅ Firebase loaded in time` - Good sign
- `⚠️ De-duplicated post` - De-duplication working
- `📍 Zone Filter: User in "X", Showing Y/Z posts` - Zone filtering active
- `❌ Reverse geocoding failed` - API issue

**Firebase Paths:**
- Posts: `networks/shared-network-1/posts/{postId}`
- Votes: `networks/shared-network-1/votes/{userId_postId}`
- Users: `users/{userId}`

**APIs Used:**
- Nominatim: `https://nominatim.openstreetmap.org/reverse?format=json`
- Firebase Realtime: Real-time listener on `/posts`
- Firebase Storage: `gs://wificontent-73ca3.appspot.com/`

---

**Created:** May 24, 2026  
**Last Updated:** Session start  
**Next Review:** After deployment
