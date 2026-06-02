// Clean minimal Cloud Functions for enforcement and Stripe
const functions = require('firebase-functions');
const admin = require('firebase-admin');

try { admin.initializeApp(); } catch (e) { }

const db = admin.database();
const MAX_POSTS_PER_USER = 20;

const STRIPE_SECRET = (functions.config && functions.config().stripe && functions.config().stripe.secret) || process.env.STRIPE_SECRET;
const STRIPE_WEBHOOK_SECRET = (functions.config && functions.config().stripe && functions.config().stripe.webhook_secret) || process.env.STRIPE_WEBHOOK_SECRET;
let stripe = null;
try { if (STRIPE_SECRET) stripe = require('stripe')(STRIPE_SECRET); } catch (e) { console.warn('Stripe not available'); }

function setDefaultCors(res){ res.set('Access-Control-Allow-Origin','*'); res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS'); res.set('Access-Control-Allow-Headers','Content-Type,Stripe-Signature'); }
async function incrementCounter(path, delta=1){ const ref=db.ref(path); try{ await ref.transaction(cur => (Number(cur)||0)+delta); }catch(e){console.error('inc',path,e);} }

function normalizeCheckoutInput(input) {
  const body = input || {};
  const postId = body.postId || body.clientPostId || null;
  const kind = (body.kind || body.type || '').toLowerCase();
  const currency = (body.currency || 'usd').toLowerCase();
  const metadata = body.metadata || {};
  const userId = metadata.clientUserId || body.userId || 'anonymous';

  let unit_amount;
  const rawAmount = body.amount;
  if (typeof rawAmount === 'string' && rawAmount.indexOf('.') !== -1) {
    const v = parseFloat(rawAmount.replace(/[^0-9.\-]/g, ''));
    unit_amount = Number.isFinite(v) ? Math.round(v * 100) : NaN;
  } else {
    unit_amount = Math.round(Number(String(rawAmount).replace(/[^0-9\-]/g, '')));
  }

  let okSuccess = body.success_url || body.successUrl || 'https://example.com/success';
  let okCancel = body.cancel_url || body.cancelUrl || 'https://example.com/cancel';
  try { new URL(okSuccess); new URL(okCancel); } catch (e) { throw new Error('invalid success_url or cancel_url'); }

  const url = new URL(okSuccess);
  url.searchParams.set('fedex_checkout', 'success');
  url.searchParams.set('kind', kind || 'unknown');
  // Stripe template var is replaced at redirect-time.
  url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  okSuccess = url.toString();

  const metaPostId = String(postId || 'new_post').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const metaKind = String(kind || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const metaUserId = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  return { postId, kind, unit_amount, currency, okSuccess, okCancel, metaPostId, metaKind, metaUserId };
}

async function createStripeCheckoutSession(payload) {
  if (!stripe) throw new Error('Stripe not configured');
  const normalized = normalizeCheckoutInput(payload);
  const { postId, kind, unit_amount, currency, okSuccess, okCancel, metaPostId, metaKind, metaUserId } = normalized;

  if (!postId || !kind || !unit_amount) throw new Error('postId,kind,amount required');
  if (!Number.isInteger(unit_amount) || unit_amount <= 0) throw new Error('invalid amount; provide integer cents or decimal dollars');

  const session = await stripe.checkout.sessions.create({
    payment_method_types:['card'],
    mode:'payment',
    line_items:[{
      price_data:{
        currency,
        product_data:{name:`${kind} for post ${postId}`},
        unit_amount
      },
      quantity:1
    }],
    success_url: okSuccess,
    cancel_url: okCancel,
    metadata:{postId:metaPostId,kind:metaKind,userId:metaUserId}
  });

  return { id: session.id, url: session.url };
}

exports.enforceUserPostLimit = functions.database.ref('/posts/{postId}').onCreate(async (snap, ctx)=>{
  const post = snap.val()||{}; const postId = ctx.params.postId; const userId = post.authId||post.userId||post.createdBy; if(!userId) return null;
  const ref = db.ref(`user-posts/${userId}`); const s = await ref.once('value'); const existing = s.exists()?s.val():{}; const count = Object.keys(existing).length;
  if(count>=MAX_POSTS_PER_USER){
    // Do NOT auto-delete the new post. Instead mark it as blocked/hidden and notify the user
    try {
      await snap.ref.update({ limitBlocked: true, visible: false, limitBlockedAt: admin.database.ServerValue.TIMESTAMP });
      await db.ref(`post-limit-notices/${userId}/${postId}`).set({ postId, userId, reason: 'post_limit_exceeded', ts: admin.database.ServerValue.TIMESTAMP });
      // Add a lightweight user notification so the client can surface guidance
      await db.ref(`users/${userId}/notifications/${postId}`).set({ type: 'post_limit', message: 'You have reached the per-user post limit. Delete older posts to publish this one.', postId, ts: admin.database.ServerValue.TIMESTAMP, read: false });
    } catch (e) { console.error('Failed to mark post as limit-blocked', e); }
    return null;
  }
  await ref.child(postId).set({postId,authId:userId,timestamp:post.timestamp||admin.database.ServerValue.TIMESTAMP,createdAt:admin.database.ServerValue.TIMESTAMP});
  return null;
});

exports.postMetricsAggregator = functions.database.ref('/posts/{postId}').onCreate(async (snap, ctx)=>{ const post=snap.val()||{}; try{ await incrementCounter('metrics/global/postsTotal',1); const zone=post.zoneTag||post.county||'unknown'; await incrementCounter(`metrics/postsByZone/${encodeURIComponent(zone)}`,1);}catch(e){console.error(e);} return null; });

exports.createCheckoutSession = functions.https.onRequest(async (req,res)=>{
  setDefaultCors(res); if(req.method==='OPTIONS'){res.status(204).send('');return;} if(!stripe) return res.status(500).json({error:'Stripe not configured'});
  try{
    const session = await createStripeCheckoutSession(req.body || {});
    return res.json(session);
  }catch(e){ console.error(e); return res.status(500).json({error:e&&e.message}); }
});

exports.createCheckoutSessionCallable = functions.https.onCall(async (data, context) => {
  if (!stripe) throw new functions.https.HttpsError('failed-precondition', 'Stripe not configured');
  try {
    const session = await createStripeCheckoutSession(data || {});
    return session;
  } catch (e) {
    throw new functions.https.HttpsError('invalid-argument', e && e.message ? e.message : 'Failed to create checkout session');
  }
});

exports.getCheckoutSessionResult = functions.https.onCall(async (data, context) => {
  if (!stripe) throw new functions.https.HttpsError('failed-precondition', 'Stripe not configured');
  const sessionId = data && data.sessionId ? String(data.sessionId) : '';
  if (!sessionId) throw new functions.https.HttpsError('invalid-argument', 'sessionId required');

  // First: check canonical processed payment record from webhook.
  const paymentSnap = await db.ref(`payments/${sessionId}`).once('value');
  if (paymentSnap.exists()) {
    const p = paymentSnap.val() || {};
    return {
      paid: true,
      kind: p.kind || null,
      sessionId,
      amount: p.amount || null,
      currency: p.currency || null,
      source: 'payments-db'
    };
  }

  // Fallback: query Stripe directly (covers webhook lag).
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const isPaid = session && (session.payment_status === 'paid' || session.status === 'complete');
  return {
    paid: !!isPaid,
    kind: session && session.metadata ? (session.metadata.kind || null) : null,
    sessionId,
    amount: session ? session.amount_total : null,
    currency: session ? session.currency : null,
    source: 'stripe-session'
  };
});

exports.handleStripeWebhook = functions.https.onRequest(async (req,res)=>{
  setDefaultCors(res); if(!stripe) return res.status(500).send('Stripe not configured'); const sig = req.headers['stripe-signature']||req.headers['Stripe-Signature']; let event;
  try{ event = stripe.webhooks.constructEvent(req.rawBody,sig,STRIPE_WEBHOOK_SECRET); }catch(err){ console.error('sig',err&&err.message); return res.status(400).send(`Webhook Error: ${err&&err.message}`); }
  
  // 🔥 CRITICAL: Only process successful checkout sessions
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const postId = meta.postId || null;
    const kind = (meta.kind || '').toLowerCase();
    const userId = meta.userId || null;
    const paymentId = session.id;
    
    console.log(`✅ Payment completed: postId=${postId}, kind=${kind}, userId=${userId}`);
    
    try {
      // 💾 Store payment record
      const pRef = db.ref(`payments/${paymentId}`);
      const exists = await pRef.once('value');
      if (!exists.exists()) {
        await pRef.set({
          paymentId,
          type: 'checkout.session.completed',
          kind,
          postId,
          userId,
          amount: session.amount_total,
          currency: session.currency,
          status: 'completed',
          completedAt: admin.database.ServerValue.TIMESTAMP,
          raw: session
        });
        console.log(`💾 Stored payment: ${paymentId}`);
      }
      
      // 🏅 Apply badge to post
      if (postId) {
        const updates = {};
        
        if (kind === 'boost' || kind === 'boost_sell') {
          // Apply BOOST badge to post + set expiration (30 days from now)
          updates[`posts/${postId}/boostPaidAt`] = admin.database.ServerValue.TIMESTAMP;
          updates[`posts/${postId}/boostExpiresAt`] = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
          updates[`posts/${postId}/boostStatus`] = 'active';
          console.log(`🚀 Applied BOOST badge to post ${postId}`);
        }
        if (kind === 'sell' || kind === 'boost_sell') {
          // Apply SELL badge to post
          updates[`posts/${postId}/sellPaidAt`] = admin.database.ServerValue.TIMESTAMP;
          updates[`posts/${postId}/primaryBadge`] = 'sell';
          console.log(`💰 Applied SELL badge to post ${postId}`);
        }
        
        if (Object.keys(updates).length > 0) {
          await db.ref().update(updates);
          console.log(`✅ Updated post with badge updates`);
        }
      }
      
      // 👤 Credit user account if userId provided
      if (userId) {
        const userRef = db.ref(`users/${userId}/account`);
        const userSnapshot = await userRef.once('value');
        const account = userSnapshot.val() || { balance: 0, purchases: {} };
        
        // Add purchase record
        if (!account.purchases) account.purchases = {};
        account.purchases[paymentId] = {
          kind,
          postId,
          amount: session.amount_total,
          currency: session.currency,
          purchasedAt: Date.now()
        };

        // Materialize current entitlements so clients can safely apply paid flags after verified checkout.
        if (!account.entitlements) account.entitlements = {};
        if (kind === 'boost' || kind === 'boost_sell') {
          account.entitlements.boost = {
            paid: true,
            paymentId,
            purchasedAt: Date.now()
          };
        }
        if (kind === 'sell' || kind === 'boost_sell') {
          account.entitlements.sell = {
            paid: true,
            paymentId,
            purchasedAt: Date.now()
          };
        }
        
        // Update user account
        await userRef.set(account);
        console.log(`👤 Credited user account: ${userId}, kind=${kind}`);
      }
      
    } catch (e) {
      console.error('webhook processing error:', e);
    }
  }
  
  return res.json({received: true});
});
