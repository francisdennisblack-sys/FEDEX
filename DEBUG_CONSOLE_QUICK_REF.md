# Quick Mobile Debug Console Reference

## TL;DR - Check Console For This

When page loads on mobile (≤599px width), browser console will show:

```
📱 VIEWPORT:         ← Device width, height, type
📏 GRID CONTAINER:   ← CSS grid actual values
📦 GRID BOX ITEMS:   ← Box sizes and styling  
🎯 RENDERING CONTEXT: ← Zone tags and location data

📊 CONTENT BREAKDOWN: ← How many posts found/rendered
✅ IMMEDIATE RENDERING COMPLETE: ← Confirmation posts filled boxes
```

## What Each Line Means

| Log | What to Look For |
|-----|-----------------|
| `Width: 375px \| Device: MOBILE ≤599px` | Confirm mobile detected |
| `gridTemplateColumns: "repeat(2, 1fr)"` | 2-column grid (✓ correct) |
| `gap: "3px 1px"` | Small gaps for mobile (✓ correct) |
| `Width: 187px \| Height: 30px` | Box size ~187×30px (✓ correct) |
| `minHeight: "30px"` | Mobile sizing (✓ correct) |
| `Total posts retrieved: 47` | Firebase has posts |
| `Rendered 25 posts into grid boxes` | Posts actually showing |

## Common Issues & Fixes

| Problem | Check For | Solution |
|---------|-----------|----------|
| Only 1 column showing | `gridTemplateColumns: "repeat(1, 1fr)"` | Hard refresh: Cmd+Shift+R |
| Boxes too large | `Height: 150px` instead of 30px | Hard refresh browser cache |
| No posts visible | `Total posts retrieved: 0` | Check WiFi connection |
| Grid empty | `isConnected: false` | Reconnect to network |
| Wrong gaps | `gap: "60px 20px"` instead of "3px 1px" | Clear cache, hard refresh |

## How to Check (30 seconds)

1. **Open DevTools:** F12 on Windows, Cmd+Opt+I on Mac
2. **Go to Console tab**
3. **Make window narrow:** ≤375px wide
4. **Refresh page:** F5 or Cmd+R  
5. **Look for logs with 📱 📏 📊 ✅** - Read what they say

## Quick Test Commands

Copy/paste in console to verify:

```javascript
// Check grid columns
window.getComputedStyle(document.getElementById('grid')).gridTemplateColumns

// Check grid gap  
window.getComputedStyle(document.getElementById('grid')).gap

// Check box height
window.getComputedStyle(document.getElementById('box-1')).minHeight

// Count rendered posts
document.querySelectorAll('.grid-box.filled').length

// Check viewport width
window.innerWidth
```

## Expected Values

**Mobile (≤599px width):**
- Viewport width: 320-599px
- Grid columns: `repeat(2, 1fr)` (2 columns)
- Grid gap: `3px 1px`
- Box dimensions: ~180-200px wide, 30px high
- Device type: `MOBILE ≤599px`

**Desktop (>599px width):**
- Viewport width: 600px+
- Grid columns: `repeat(4, 1fr)` (4 columns)
- Grid gap: larger (varies)
- Box dimensions: larger
- Device type: `TABLET/DESKTOP >599px`

## When Logs Appear

- **On page load** - First render of grid
- **When new post added** - Grid updates to show new post
- **When zone changes** - Grid re-filters by location
- **When posts deleted** - Grid re-renders without deleted post
- **Approximately every 2-5 seconds** - Firebase syncing new posts from other users

## If Logs Don't Show At All

1. Check console is not filtered - look for "Debug" filter dropdown
2. Check page fully loaded (no spinning wheel)
3. Verify viewport actually ≤599px (check browser width)
4. Refresh page (F5) - logs show on load
5. Check if console has errors (red text)

## File Changes Made

**Modified:** [index.html](index.html)
- Lines 7916-7945: Initial viewport/grid/box debug
- Lines 8050-8058: Content breakdown before rendering
- Lines 8165-8175: Render completion confirmation

**Created:** [MOBILE_DEBUG_LOG_GUIDE.md](MOBILE_DEBUG_LOG_GUIDE.md) - Full documentation
**Created:** [MOBILE_DEBUG_CHANGES.md](MOBILE_DEBUG_CHANGES.md) - Implementation details

## Share These Logs With Support

When reporting issues, copy:
1. The `📏 GRID CONTAINER` section (CSS values)
2. The `📦 GRID BOX ITEMS` section (actual dimensions)
3. Any red error text in console
4. Screenshot of DevTools with logs visible

This info helps identify if:
- ✗ CSS not applied
- ✗ CSS applied wrong values
- ✗ JavaScript overriding CSS
- ✓ Everything correct but viewport too wide
