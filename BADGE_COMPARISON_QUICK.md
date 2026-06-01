# Quick Badge Comparison

## Visual Difference at a Glance

### When Button is NOT Armed (Default State)

```
🚀 boost              💠 sell badge
$0.99                 $1.49

(small icon, no glow) (small icon, no glow)
```

### When Button IS Armed (After Purchase + Composer Open)

```
🚀 BOOSTED            💠 SELL BADGE
✨ GOLDEN GLOW ✨    ✨ BLUE GLOW ✨
(Ready to post)       (Ready to post)
```

## Technical Difference

### Boost
```javascript
// Storage
window.pendingBoost.armed = true  ← Single flag

// Button Update
background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
color: '#111827'
boxShadow: '0 6px 20px rgba(251,191,36,0.55)'

// Label
boostBtnLabel.textContent = 'boosted'
```

### Sell
```javascript
// Storage
window.pendingSell.armed = true              ← Flag
window.selectedBadges.push('sell')           ← Array
window.primaryBadge = 'sell'                 ← Primary marker

// Button Update
background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)'
color: '#fff'
boxShadow: '0 6px 20px rgba(59,130,246,0.35)'

// Label
(no label change in current code)
```

## Purchase Flow Summary

### Boost Purchase
```
User clicks "boost" 
  ↓
Pays $0.99
  ↓
_showBoostPaid() called
  window.lastPurchaseType = 'boost'
  ↓
User clicks to compose
  ↓
applyPendingPurchaseToNextPost() called
  Sets pendingBoost.armed = true
  Button glows GOLD
  ↓
User publishes
  ↓
Post shows 🚀 BOOSTED
```

### Sell Purchase
```
User clicks "sell"
  ↓
Pays $1.49
  ↓
_showSellPaid() called
  window.lastPurchaseType = 'sell'
  ↓
User clicks to compose
  ↓
applyPendingPurchaseToNextPost() called
  Sets pendingSell.armed = true
  Button glows BLUE
  ↓
User publishes
  ↓
Post shows 💠 SELL
```

## What Auto-Arms?

✅ **Auto-Arms** when you click the textarea to compose
✅ **Auto-Arms** when form clears after posting
❌ **Does NOT auto-arm** unless you purchased first

## How to Tell It's Armed

### Boost Armed
- Button glows with golden light
- Label says "boosted"
- Background is bright gold

### Sell Armed
- Button glows with blue light
- Background is bright blue
- Text is white

## Real-World Usage

### Boost Use Case
"I want my post to be seen by lots of people nearby"
→ Click Boost → Pay $0.99 → Badge auto-arms → Post with 🚀

### Sell Use Case
"I'm selling a bike and want to mark it clearly"
→ Click Sell → Pay $1.49 → Badge auto-arms → Post with 💠

## State After Publishing

### Before Publishing Post
```
window.pendingBoost = { armed: true, paid: true, ... }
window.lastPurchaseType = null (cleared)
localStorage has no pending purchase
```

### After Publishing Post
```
window.pendingBoost = { armed: true, paid: true, ... }  ← Stays true (badge stays on post)
window.lastPurchaseType = null (cleared)
Post has 🚀 or 💠 badge visible
Ready for next post WITHOUT badge (unless purchased again)
```

## Key Point: ONE Badge Per Purchase

- You purchase → Badge arms on NEXT post
- You post with badge → Badge appears on that post
- You compose next post (no purchase) → Badge does NOT auto-arm
- Must purchase again to get next badge

## Console Logs to Watch For

When payment succeeds:
```
💰 Boost payment paid! Setting pending...
Purchase type tracked: boost
```

When badge auto-arms:
```
💰 Applying pending boost purchase to next post...
  ✅ Boost badge auto-armed for next post
```

If no purchase pending:
```
(no logs - function returns early)
```

## File Locations

- Function: `index.html` line ~22870
- Called on focus: `index.html` line ~2248
- Called on reset: `index.html` line ~14111
- Boost payment: `index.html` line ~24439
- Sell payment: `index.html` line ~24624

## Testing Shortcuts

```javascript
// Check current state
window.lastPurchaseType          // null or 'boost' or 'sell'

// Check if boosted
window.pendingBoost.armed        // true or false

// Check if selling
window.pendingSell.armed         // true or false

// Manually clear purchases
localStorage.clear()

// Manually trigger auto-arm
applyPendingPurchaseToNextPost()
```

## Cost Summary

| Badge | Price | Effect |
|-------|-------|--------|
| 🚀 Boost | $0.99 | Reach |
| 💠 Sell | $1.49 | Commerce |

Purchase once → Badge arms automatically on next post ✅
