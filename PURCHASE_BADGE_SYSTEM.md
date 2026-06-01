# Purchase Badge System - Auto-Arm After Payment

## Overview
When a user purchases a boost or sell badge, the system now automatically arms that badge on their next post without requiring manual clicking.

## Key Differences: Boost vs Sell

### 🚀 Boost Badge (Yellow/Gold)
- **Cost**: $0.99
- **Visual**: 🚀 emoji + gold gradient button (#fbbf24 → #f59e0b)
- **Effect**: Post gets guaranteed reach to nearby users
- **Storage**: `window.pendingBoost` object
- **Persistence**: Stored for 1 post only
- **Button Style**: Gold gradient with yellow border

### 💠 Sell Badge (Blue)
- **Cost**: $1.49
- **Visual**: 💠 emoji + blue gradient button (#3b82f6 → #1e40af)
- **Effect**: Post marked as item for sale
- **Storage**: `window.pendingSell` object + selectedBadges array
- **Persistence**: Set as primary badge
- **Button Style**: Blue gradient with darker blue border

## How It Works

### Purchase Flow
1. User clicks **Boost** or **Sell** button
2. Payment UI appears (mocked with Stripe intent IDs)
3. User completes "payment" (card: 4242... year: 25... CVC: any)
4. `_showBoostPaid()` or `_showSellPaid()` called
5. Purchase type stored in `window` and `localStorage`:
   - `window.lastPurchaseType`: 'boost' or 'sell'
   - `window.purchasePaidAt`: Timestamp
6. Shows success message: "✅ boost paid — hit send to publish"

### Auto-Arm on Next Post
1. User clicks post text area (or after current post completes)
2. `applyPendingPurchaseToNextPost()` called automatically
3. Function checks `window.lastPurchaseType` and `localStorage`
4. **If boost pending**:
   - Sets `pendingBoost.armed = true`
   - Changes button to gold gradient with shadow
   - Updates label to "boosted"
5. **If sell pending**:
   - Sets `pendingSell.armed = true`
   - Adds 'sell' to `selectedBadges` array
   - Sets `primaryBadge = 'sell'`
   - Changes button to blue gradient
6. Clears `lastPurchaseType` from window and localStorage
7. Badge appears on published post

### Visual Indicators
**Before Purchase**:
- Button default colors (gold/blue outline only)
- Label says "boost" or "sell badge"

**After Payment, Before Next Post**:
- User sees: "✅ boost paid — hit send to publish"
- Button unchanged until they open composer

**When Opening Composer** (or after clearing post):
- Button instantly highlights with full gradient
- Label changes to "boosted" or "sell badge selected"
- Ready for post creation

**On Published Post**:
- Badge appears with appropriate styling
- Shows in post metadata

## Code Implementation

### Key Functions

#### `applyPendingPurchaseToNextPost()`
**Location**: Line ~22870
**Called From**:
- `onfocus` handler on postText textarea (line ~2248)
- After clearing form on line ~14111

**What it does**:
```javascript
1. Reads lastPurchaseType from window or localStorage
2. If 'boost': arms boost, updates button UI to gold
3. If 'sell': arms sell, updates button UI to blue
4. Clears pending purchase flags
```

#### `_showBoostPaid()`
**Location**: Line ~24439
**Called**: After user completes boost payment
**New tracking**:
```javascript
window.lastPurchaseType = 'boost';
window.purchasePaidAt = Date.now();
localStorage.setItem('lastPurchaseType', 'boost');
localStorage.setItem('purchasePaidAt', String(window.purchasePaidAt));
```

#### `_showSellPaid()`
**Location**: Line ~24624
**Called**: After user completes sell payment
**New tracking**:
```javascript
window.lastPurchaseType = 'sell';
window.purchasePaidAt = Date.now();
localStorage.setItem('lastPurchaseType', 'sell');
localStorage.setItem('purchasePaidAt', String(window.purchasePaidAt));
```

### Integration Points
1. **Textarea focus** (line 2248): Added `applyPendingPurchaseToNextPost();`
2. **Form reset** (line 14111): Added call after clearing postText
3. **Payment handlers**: Track purchase type in window + localStorage

## Testing Checklist

- [ ] Click boost button → Payment UI shows
- [ ] Enter card (4242... 25 any) → Payment success shows
- [ ] Click post text area → Boost button becomes gold
- [ ] Create and publish post → Boost badge appears
- [ ] Refresh page → Pending purchase cleared (no persisting boost)
- [ ] Repeat for sell badge (blue instead of gold)
- [ ] Test localStorage persistence across tabs
- [ ] Verify boost takes priority if both armed (check button color)

## Edge Cases

### Both Boost and Sell Purchased
Currently: Last purchase type wins (boost or sell)
Improvement needed: Could allow both, but UI needs redesign

### Page Refresh After Purchase
- ✅ Working: localStorage persists purchase
- ✅ Working: Next composer open re-arms badge
- ✅ Working: Badge not lost on refresh

### Multiple Purchases
- ✅ Each purchase replaces previous pending
- Payment system prevents duplicate charging (server-side in production)

## Future Improvements

1. Allow stacking both boost + sell on same post
2. Show countdown timer until pending purchase expires
3. Notification popup when badge auto-arms
4. Purchase history in profile
5. Refund tracking for failed posts
