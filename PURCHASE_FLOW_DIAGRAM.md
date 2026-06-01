# Purchase Badge Auto-Arm Flow Diagram

## Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER PURCHASES BOOST BADGE                       │
└─────────────────────────────────────────────────────────────────────┘

1. USER CLICKS "BOOST" BUTTON
   └─► toggleBoostOnNewPost()
       └─► Shows payment UI with Stripe card form
   
2. USER ENTERS FAKE CARD (4242 4242 4242 4242)
   └─► Click "Pay $0.99"
   
3. PAYMENT SUCCESS
   └─► _showBoostPaid() called
       ├─► Set window.lastPurchaseType = 'boost'
       ├─► Set window.purchasePaidAt = Date.now()
       ├─► Save to localStorage for persistence
       └─► Show message: "✅ boost paid — hit send to publish"
       
4. USER CLICKS TO WRITE NEW POST
   └─► postText textarea gets focus
       └─► onfocus handler calls: applyPendingPurchaseToNextPost()
           ├─► Reads window.lastPurchaseType = 'boost'
           ├─► Sets pendingBoost.armed = true
           ├─► Updates button UI:
           │   ├─► Background: gold gradient (#fbbf24 → #f59e0b)
           │   ├─► Shadow: golden glow
           │   └─► Label: "boosted" ✓
           ├─► Clears lastPurchaseType from window + localStorage
           └─► User sees button is now armed ✓

5. USER COMPOSES & PUBLISHES POST
   └─► uploadPost() called
       ├─► Post created with pendingBoost.armed = true
       ├─► Badge rendered on post: 🚀 Boosted
       └─► Post appears in nearby users' grids

6. AFTER POST PUBLISHED
   └─► resetComposer() called
       ├─► Clears postText value
       ├─► Calls applyPendingPurchaseToNextPost() again
       │   └─► No-op (lastPurchaseType already cleared)
       └─► Ready for next post

┌─────────────────────────────────────────────────────────────────────┐
│          KEY DIFFERENCE: BOOST vs SELL (Visually)                    │
└─────────────────────────────────────────────────────────────────────┘

BOOST (Yellow/Gold)
┌─────────────────────────────┐
│ 🚀 boosted                  │  ← Gold gradient background
│ linear-gradient(135deg,     │
│   #fbbf24, #f59e0b)         │  
│ Box-shadow: rgba(251,191,36,0.55)
│ Color: #111827 (dark text)
└─────────────────────────────┘

SELL (Blue)
┌─────────────────────────────┐
│ 💠 sell badge               │  ← Blue gradient background
│ linear-gradient(135deg,     │
│   #3b82f6, #1e40af)         │
│ Box-shadow: rgba(59,130,246,0.35)
│ Color: #fff (light text)
└─────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    STATE TRANSITIONS                                 │
└─────────────────────────────────────────────────────────────────────┘

BEFORE PURCHASE:
┌─────────────┐
│ Button OFF  │─ pendingBoost.armed = false
│ Regular UI  │─ lastPurchaseType = null
└─────────────┘

        ↓ [User clicks Boost button]
        ↓ [User pays $0.99]
        
AFTER PAYMENT:
┌─────────────────────────┐
│ Button OFF              │─ pendingBoost.armed = false (until next composer open)
│ Message shows payment OK│─ lastPurchaseType = 'boost' (in window + localStorage)
└─────────────────────────┘

        ↓ [User clicks to compose]
        ↓ [applyPendingPurchaseToNextPost() called]

WHEN COMPOSER OPENS:
┌─────────────────────────┐
│ Button GLOWING GOLD     │─ pendingBoost.armed = true
│ Label: "boosted"        │─ lastPurchaseType = null (cleared)
│ Ready to publish        │
└─────────────────────────┘

        ↓ [User publishes post]

ON PUBLISHED POST:
┌─────────────────────────┐
│ 🚀 Boosted              │─ Badge visible in grid
│ Guaranteed reach        │─ Goes to nearby users
│ Appears in feed         │
└─────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    CODE EXECUTION PATH                               │
└─────────────────────────────────────────────────────────────────────┘

Payment System Flow:
  toggleBoostOnNewPost()
  └─► _initBoostPaymentRequest()
      └─► Stripe payment modal
          └─► User confirms payment
              └─► _showBoostPaid() ← STORES purchase type here
                  ├─► window.lastPurchaseType = 'boost'
                  └─► localStorage persistence

Auto-Arm Flow:
  1) postText.onfocus
     └─► applyPendingPurchaseToNextPost() ← Called here
         ├─► Checks window.lastPurchaseType
         ├─► Arms pending badge
         └─► Clears flag
         
  2) resetComposer() (after post published)
     └─► applyPendingPurchaseToNextPost() ← Called here too
         └─► No-op if already cleared

Post Rendering:
  renderGridItemFull()
  └─► if (pendingBoost.armed && pendingBoost.paid)
      └─► Show 🚀 Boosted badge with gold styling

┌─────────────────────────────────────────────────────────────────────┐
│                 PERSISTENCE ACROSS PAGE RELOAD                       │
└─────────────────────────────────────────────────────────────────────┘

Scenario: User purchases boost, then refreshes page before composing

1. Payment success → lastPurchaseType stored to localStorage
2. Page reload → localStorage persists
3. applyPendingPurchaseToNextPost() called on page load (via focus listener)
4. ✅ Badge still armed on next post

No persistence needed for:
- After badge is armed (purchase type cleared)
- After post is published (pendingBoost flags cleared)

┌─────────────────────────────────────────────────────────────────────┐
│              TEST SCENARIOS & VERIFICATION                           │
└─────────────────────────────────────────────────────────────────────┘

✅ Test 1: Purchase Boost
  1. Click boost → pay 4242 card → "✅ paid" shows
  2. Click post text → button glows gold ← AUTO-ARM ✓
  3. Type message → click post
  4. 🚀 Badge appears on post ✓

✅ Test 2: Purchase Sell
  1. Click sell → pay 4242 card → "✅ paid" shows
  2. Click post text → button glows blue ← AUTO-ARM ✓
  3. Type message → click post
  4. 💠 Badge appears on post ✓

✅ Test 3: Persistence
  1. Purchase boost
  2. Refresh page (before composing)
  3. Click post text → button still gold ✓

✅ Test 4: Multiple Purchases
  1. Purchase boost → button glows gold
  2. Click refresh or new post
  3. Purchase sell → button glows blue (replaces boost) ✓

┌─────────────────────────────────────────────────────────────────────┐
│              CONSOLE DEBUGGING MESSAGES                              │
└─────────────────────────────────────────────────────────────────────┘

When purchase payment succeeds:
  [Payment Handler]
  console.log('💰 Boost payment paid! Setting pending...')
  console.log('Purchase type tracked: boost')

When auto-arm is triggered:
  [Composer Open]
  console.log('💰 Applying pending boost purchase to next post...')
  console.log('  ✅ Boost badge auto-armed for next post')

Check in browser DevTools:
  window.lastPurchaseType  // Should be null after opening composer
  window.pendingBoost      // Should show { armed: true, paid: true, ... }
  localStorage.getItem('lastPurchaseType')  // Should be null after arming
