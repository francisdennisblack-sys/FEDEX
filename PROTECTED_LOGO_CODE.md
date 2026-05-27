# 🛡️ PROTECTED CODE MANIFEST — Canvas 3D Globe Logo

## Status: **LOCKED — DO NOT MODIFY**

**Approval Required From:** User explicitly requested "protect at all costs"  
**Protected Since:** This session  
**Stability:** STABLE — users depend on current behavior  
**Risk Level:** CRITICAL — changes may break visual experience

---

## What is Protected?

The **Canvas 3D rotating earth globe** logo in the page header. This is a self-contained visual system that represents online user presence through motion and luminescence.

### Code Locations (DO NOT TOUCH):

1. **HTML Element** — `[index.html](index.html#L2447)` (line 2447)
   ```html
   <canvas id="brandGlobeCanvas" width="44" height="44" 
           style="display: inline-block; vertical-align: middle;" 
           title="wificontent.com"></canvas>
   ```

2. **CSS Animations** — `[index.html](index.html#L710-L730)` (lines ~710–730)
   - `#brandGlobeCanvas` — canvas styling (44×44, inline-block, vertical-middle)
   - `@keyframes brandPulse` — scale animation (1 → 1.25 → 1, 1.2s cycle)
   - `@keyframes brandGlow` — drop-shadow glow (green, 12px → 18px → 12px, 1.2s cycle)
   - `#brandGlobeCanvas.online` — activates both animations when users online

3. **JavaScript Engine** — `[index.html](index.html#L10920-L11025)` (lines 10920–11025)
   - `window.brandGlobeEngine` — IIFE providing globe rendering + animation control
   - `drawGlobe()` — renders ocean (dark blue), landmasses (green), grid lines
   - `animate()` — rotates globe at 1.5°/frame (~4s full rotation)
   - `start()` — begins animation, called when users online
   - `stop()` — stops animation but **keeps globe visible** (does not clearRect)

4. **Integration Point** — `[index.html](index.html#L11065-L11069)` (lines 11065–11069)
   - Called from `subscribeToOnlineUserCount()` function
   - Toggles `.online` class on canvas element
   - Calls `engine.start()` or `engine.stop()` based on user count

---

## How It Works (Technical Deep Dive)

### Rendering Pipeline:
```
Page Load
  ↓
brandGlobeEngine IIFE initializes
  ↓
drawGlobe() called immediately → canvas shows static globe
  ↓
subscribeToOnlineUserCount triggered
  ↓
If users online: canvas.classList.add('online') + engine.start()
     → @keyframes brandPulse + brandGlow activate
     → animate() rotates globe at 1.5°/frame
     → requestAnimationFrame loop continuous
If users offline: canvas.classList.remove('online') + engine.stop()
     → Animations pause
     → drawGlobe() called again to keep static globe visible
     → requestAnimationFrame loop stops
```

### Visual Timeline (1.2s cycle):
- **0ms–600ms:** Scale up (1 → 1.25), glow expand (12px → 18px)
- **600ms–1200ms:** Scale down (1.25 → 1), glow shrink (18px → 12px)
- **1200ms:** Repeat
- **Rotation:** Continuous at 1.5°/frame, completing ~4s per full spin

### Why Animation Timing Works:
- Pulse + glow synchronized to **same keyframe duration (1.2s)**
- Rotation independent of pulse (creates emergent "breathing globe" effect)
- 1.5° per frame chosen to be fast enough to feel lively but slow enough to be smooth at 60fps
- Globe rendered on **every frame** of animation (animate loop calls drawGlobe + requestAnimationFrame)

---

## Why This Code is Protected

### 1. **Emergent User Experience**
The globe is the first visual element users see. The combination of:
- Slow, constant rotation (showing the earth is alive)
- Synchronized pulse + glow (showing digital heartbeat)
- Green color (representing "go" / "online" / environmental theme)
- Responsive to online user count (showing community size)

This creates a **cohesive emotional narrative** that is not obvious from any single code line.

### 2. **Subtle Interdependencies**
- `drawGlobe()` must be called **on page load** (not just during animation) or canvas is blank
- `drawGlobe()` must be called in `stop()` or canvas becomes invisible when offline
- Canvas size must stay 44×44 or text labels misalign
- Animations must stay in-sync (pulse + glow both 1.2s) or effect feels jarring
- Rotation rate must stay ~1.5°/frame or globe feels sluggish or jittery
- Green color (#00FF00 for glow) matches environmental theme

### 3. **Common Failure Modes**
If modified incorrectly, these things will break:
- **Change animation duration (e.g., 2s):** Pulse and glow desync, looks weird
- **Add `clearRect()` to `stop()`:** Globe disappears when users go offline (bad UX)
- **Increase rotation rate (e.g., 3°/frame):** Looks frantic, hard to see continents
- **Remove `drawGlobe()` call on page load:** Canvas blank until first user joins
- **Change canvas size:** Header layout breaks, logo doesn't fit
- **Change green color:** Breaks theme consistency
- **Disable animation loop:** Globe stops moving entirely

### 4. **User Request**
During the most recent session, the user explicitly said:

> "it's really cool... never change it... keep it the same... protect it at all costs"

This is a **direct lock-in** from the user. The logo is considered complete and acceptable as-is.

---

## Approval Process for Future Changes

If a change to the logo code is absolutely necessary:

### Step 1: **Get Explicit Approval**
Ask the user: *"I need to modify the protected canvas globe engine [describe specific change]. This may affect [list specific risks]. Proceed?"*

Do not proceed without explicit "yes" from user.

### Step 2: **Create a Separate Test File**
- Copy `index.html` to `index.html.logo-test`
- Make the change
- Open in browser, test thoroughly:
  - Logo renders on page load ✓
  - Logo animates when users online ✓
  - Logo stops (but stays visible) when users offline ✓
  - Animations are smooth (no jitter, no desync) ✓
  - All header labels still aligned ✓
  - Works in Chrome, Firefox, Safari, Mobile Safari ✓

### Step 3: **Document the Change**
Add a comment explaining:
- What changed
- Why it was necessary
- What was tested
- Any risks that remain

Example:
```javascript
// PROTECTED CODE CHANGE [Date]: Modified rotation rate from 1.5°/frame to 2°/frame
// Reason: Performance improvement on mobile devices
// Tested: Chrome, Firefox, Safari, Mobile Safari — no jitter observed
// Risk: May feel too fast on some displays; can revert if users complain
```

### Step 4: **Git Tag**
```bash
git tag -a "LOGO_CHANGE_$(date +%Y%m%d)" -m "Protected logo modified: [description]"
git push origin --tags
```

### Step 5: **Monitor Feedback**
Watch for user complaints about logo appearance, animation, or alignment.

---

## What NOT to Do

❌ **DO NOT** modify rotation rate without user approval  
❌ **DO NOT** add `clearRect()` to `stop()`  
❌ **DO NOT** change animation durations  
❌ **DO NOT** change canvas size  
❌ **DO NOT** disable animation loop  
❌ **DO NOT** change green color  
❌ **DO NOT** move the canvas element (breaks layout)  
❌ **DO NOT** add/remove `drawGlobe()` calls without understanding implications  
❌ **DO NOT** merge unrelated feature changes into this code section  

---

## Reference Implementation

### Current (Stable) Version:
- **Rotation:** 1.5°/frame (continuous)
- **Pulse Scale:** 1.0 → 1.25 → 1.0 (1.2s)
- **Glow:** drop-shadow green, 12px → 18px → 12px (1.2s)
- **Glows Active:** Only when `.online` class present
- **Canvas Size:** 44×44 px
- **Green Color:** #00FF00 (CSS filter: brightness 1.2)

### Testing Checklist:
- [ ] Page load: globe visible and static
- [ ] First user joins: globe starts rotating, pulse + glow activate
- [ ] Last user leaves: globe stops rotating but stays visible
- [ ] 10 full rotations: no stuttering, no jitter
- [ ] Animation frame rate: consistent 60fps (use DevTools > Performance)
- [ ] Multiple tabs open: animations stay in sync
- [ ] Mobile Safari: animations work (may need -webkit- prefixes)
- [ ] Accessibility: canvas has title="wificontent.com"

---

## Emergency Rollback

If changes break the logo, revert to the last git commit before the modification:

```bash
git log --oneline | grep -i logo
# Find the commit hash just before your change
git revert [commit-hash]
git push origin main
```

Or restore from this document's reference version.

---

## Contact

If you need to modify this code but are unsure, ask the user explicitly:

**"The protected canvas globe logo needs a change [describe]. This affects [list]. Should I proceed? (Y/N)"**

Do not proceed without explicit approval.

---

**PROTECTION VERIFIED:** [index.html](index.html) lines 10920–11025 (engine), ~710–730 (CSS), 2447–2449 (HTML)  
**STATUS:** LOCKED  
**LAST REVIEW:** Current session  
**NEXT REVIEW:** Only when user explicitly requests logo change
