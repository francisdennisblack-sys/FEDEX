// Clean minimal Cloud Functions for enforcement and Stripe
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Optional Express API mounting for lightweight POI endpoint
let expressAppMounted = false;
try {
  const express = require('express');
  const poisRouter = require('./pois');
  const app = express();
  app.use(express.json());
  app.use('/api', poisRouter);
  // Lightweight pricing endpoint so the client can fetch the authoritative boost/sell price
  app.get('/api/boost-price', async (req, res) => {
    try {
      const boostSnap = await admin.database().ref('pricing/boost').once('value');
      const sellSnap = await admin.database().ref('pricing/sell').once('value');
      const boost = boostSnap.exists() ? boostSnap.val() : null;
      const sell = sellSnap.exists() ? sellSnap.val() : null;
      const min = getMinForCurrency('usd');
      const out = {
        boost: {
          amountCents: Math.max(min + 1, boost && Number.isInteger(Number(boost.amountCents)) ? Number(boost.amountCents) : (boost && Number.isFinite(Number(boost.basePrice)) ? Math.round(Number(boost.basePrice)) : 75)),
          label: boost && boost.label ? String(boost.label) : null
        },
        sell: {
          amountCents: Math.max(min + 1, sell && Number.isInteger(Number(sell.amountCents)) ? Number(sell.amountCents) : (sell && Number.isFinite(Number(sell.basePrice)) ? Math.round(Number(sell.basePrice)) : 200)),
          label: sell && sell.label ? String(sell.label) : null
        }
      };
      return res.json(out);
    } catch (e) {
      console.error('boost-price error', e && e.message);
      return res.status(500).json({ error: 'internal' });
    }
  });
  // Export a combined express app as `api`
  exports.api = functions.https.onRequest(app);
  expressAppMounted = true;
} catch (e) {
  console.warn('Express API not mounted (optional). Ensure `express` and `pg` are installed and POIS_DB_URL is set.');
}

try { admin.initializeApp(); } catch (e) { }

const db = admin.database();
const MAX_POSTS_PER_USER = 20;
// Minimum charge per currency to satisfy Stripe / card network limits.
const MIN_CHARGE_CENTS = {
  usd: 50, // $0.50 minimum for USD
  eur: 50, // €0.50
  gbp: 50, // £0.50
};
function getMinForCurrency(curr){ curr = String(curr||'').toLowerCase(); return MIN_CHARGE_CENTS[curr]||50; }

// Stripe secrets are stored in Google Secret Manager (not the deprecated
// functions:config). They are injected as env vars at function runtime via
// the `secrets: [...]` option on each function below.
const { defineSecret } = require('firebase-functions/params');
const stripeSecretParam = defineSecret('STRIPE_SECRET');
const stripeWebhookSecretParam = defineSecret('STRIPE_WEBHOOK_SECRET');

// Lazy Stripe client — built per-invocation so process.env.STRIPE_SECRET is
// already populated by the time we read it.
let _stripeCache = null;
let _stripeCacheKey = null;
function getStripe() {
  const key = process.env.STRIPE_SECRET
    || (functions.config && functions.config().stripe && functions.config().stripe.secret)
    || null;
  if (!key) return null;
  if (_stripeCache && _stripeCacheKey === key) return _stripeCache;
  try {
    _stripeCache = require('stripe')(key);
    _stripeCacheKey = key;
    return _stripeCache;
  } catch (e) {
    console.warn('Stripe init failed:', e && e.message);
    return null;
  }
}
function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET
    || (functions.config && functions.config().stripe && functions.config().stripe.webhook_secret)
    || null;
}

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
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');
  const normalized = normalizeCheckoutInput(payload);
  const { postId, kind, unit_amount, currency, okSuccess, okCancel, metaPostId, metaKind, metaUserId } = normalized;

  // Resolve server-side configured price for kinds we control (boost/sell).
  let final_unit_amount = unit_amount;
  try {
    if (kind === 'boost' || kind === 'sell' || kind === 'boost_sell') {
      const priceSnap = await db.ref(`pricing/${kind}`).once('value');
      if (priceSnap.exists()) {
        const data = priceSnap.val();
        if (data && Number.isInteger(Number(data.amountCents))) {
          final_unit_amount = Number(data.amountCents);
        } else if (data && Number.isFinite(Number(data.basePrice))) {
          final_unit_amount = Math.round(Number(data.basePrice));
        }
      }
    }
  } catch (e) { console.warn('Price lookup failed, using client amount', e && e.message); }

  if (!postId || !kind || !final_unit_amount) throw new Error('postId,kind,amount required');
  if (!Number.isInteger(final_unit_amount) || final_unit_amount <= 0) throw new Error('invalid amount; provide integer cents or decimal dollars');
  // Enforce minimum charge to avoid Stripe/Network rejections for tiny amounts
  const min = getMinForCurrency(currency);
  if (final_unit_amount < min) {
    console.warn(`Requested amount ${final_unit_amount} < min ${min} for ${currency}; using min+1`);
    final_unit_amount = min + 1;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types:['card'],
    mode:'payment',
    line_items:[{
      price_data:{
        currency,
        product_data:{name:`${kind} for post ${postId}`},
        unit_amount: final_unit_amount
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

// Consume a user's unconsumed badge record when they create a post so the
// badge is persisted on the post and visible to all users immediately.
exports.consumeUserBadgeOnPostCreate = functions.database.ref('/posts/{postId}').onCreate(async (snap, ctx) => {
  try {
    const postId = ctx.params.postId;
    const post = snap.val() || {};
    const authId = post.authId || post.userId || post.createdBy;
    if (!authId) return null;

    const badgesRef = db.ref(`users/${authId}/badges`);
    const badgesSnap = await badgesRef.once('value');
    if (!badgesSnap.exists()) return null;

    const badges = badgesSnap.val() || {};
    // Find oldest unconsumed badge
    const keys = Object.keys(badges).sort((a,b)=> (badges[a].purchasedAt||0) - (badges[b].purchasedAt||0));
    for (const k of keys) {
      const rec = badges[k];
      if (!rec || rec.consumed) continue;
      const updates = {};
      if (rec.type === 'boost') {
        updates[`posts/${postId}/boostPaidAt`] = admin.database.ServerValue.TIMESTAMP;
        updates[`posts/${postId}/boostExpiresAt`] = Date.now() + (24*60*60*1000);
        updates[`posts/${postId}/boostStatus`] = 'active';
        updates[`posts/${postId}/boostBadge`] = { label: rec.label || 'Boost', paymentId: rec.paymentId || k };
      } else if (rec.type === 'sell') {
        updates[`posts/${postId}/sellPaidAt`] = admin.database.ServerValue.TIMESTAMP;
        updates[`posts/${postId}/primaryBadge`] = 'sell';
        updates[`posts/${postId}/sellBadge`] = { label: rec.label || 'Buy', paymentId: rec.paymentId || k };
      } else {
        continue;
      }

      // Also write a structured denormalized badge entry under posts/{postId}/badges/{badgeId}
      try {
        const badgeId = rec.paymentId || k;
        updates[`posts/${postId}/badges/${badgeId}`] = {
          kind: rec.type || null,
          label: rec.label || (rec.type === 'sell' ? 'Buy' : (rec.type === 'boost' ? 'Boost' : null)),
          paymentId: badgeId,
          appliedAt: admin.database.ServerValue.TIMESTAMP,
          expiresAt: rec.type === 'boost' ? (Date.now() + (24*60*60*1000)) : null,
          userId: authId || null,
          amount: rec.amount || null,
          currency: rec.currency || null
        };
      } catch (e) {
        console.warn('Failed to denormalize badge into post on create', e && e.message);
      }

      // Atomically apply updates and mark badge consumed
      await db.ref().update(updates);
      await db.ref(`users/${authId}/badges/${k}`).update({ consumed: true, consumedAt: admin.database.ServerValue.TIMESTAMP, consumedOnPost: postId });
      console.log(`Consumed badge ${k} of type ${rec.type} for user ${authId} on post ${postId}`);
      break; // only one badge per post
    }
  } catch (e) {
    console.error('consumeUserBadgeOnPostCreate failed:', e && e.message ? e.message : e);
  }
  return null;
});

exports.createCheckoutSession = functions
  .runWith({ secrets: [stripeSecretParam] })
  .https.onRequest(async (req,res)=>{
    setDefaultCors(res); if(req.method==='OPTIONS'){res.status(204).send('');return;}
    if(!getStripe()) return res.status(500).json({error:'Stripe not configured'});
    try{
      const session = await createStripeCheckoutSession(req.body || {});
      return res.json(session);
    }catch(e){ console.error('createCheckoutSession error:', e && (e.message||e)); return res.status(500).json({error:e&&e.message}); }
});

exports.createCheckoutSessionCallable = functions
  .runWith({ secrets: [stripeSecretParam] })
  .https.onCall(async (data, context) => {
    if (!getStripe()) throw new functions.https.HttpsError('failed-precondition', 'Stripe not configured');
    try {
      const session = await createStripeCheckoutSession(data || {});
      return session;
    } catch (e) {
      console.error('createCheckoutSessionCallable error:', e && (e.message||e));
      throw new functions.https.HttpsError('invalid-argument', e && e.message ? e.message : 'Failed to create checkout session');
    }
});

exports.getCheckoutSessionResult = functions
  .runWith({ secrets: [stripeSecretParam] })
  .https.onCall(async (data, context) => {
    const stripe = getStripe();
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
    if (isPaid) {
      // If webhook hasn't yet recorded the payment, persist it now so the
      // client sees badges immediately after redirect. processSuccessfulPayment
      // is idempotent (it checks payments/{id} first), so this is safe.
      try {
        const meta = session.metadata || {};
        await processSuccessfulPayment({
          paymentId: session.id,
          type: 'checkout.session.completed (immediate-confirm)',
          postId: meta.postId || null,
          kind: (meta.kind || '').toLowerCase(),
          userId: meta.userId || null,
          amount: session.amount_total,
          currency: session.currency,
          raw: session
        });
      } catch (e) {
        console.error('Immediate processSuccessfulPayment failed:', e && e.message);
      }
    }

    return {
      paid: !!isPaid,
      kind: session && session.metadata ? (session.metadata.kind || null) : null,
      sessionId,
      amount: session ? session.amount_total : null,
      currency: session ? session.currency : null,
      source: 'stripe-session'
    };
});

exports.handleStripeWebhook = functions
  .runWith({ secrets: [stripeSecretParam, stripeWebhookSecretParam] })
  .https.onRequest(async (req,res)=>{
    setDefaultCors(res);
    const stripe = getStripe();
    if(!stripe) return res.status(500).send('Stripe not configured');
    const whSecret = getWebhookSecret();
    if(!whSecret) { console.error('STRIPE_WEBHOOK_SECRET not set'); return res.status(500).send('Webhook secret not configured'); }
    const sig = req.headers['stripe-signature']||req.headers['Stripe-Signature'];
    let event;
    try{ event = stripe.webhooks.constructEvent(req.rawBody,sig,whSecret); }catch(err){ console.error('webhook signature verification failed:', err&&err.message); return res.status(400).send(`Webhook Error: ${err&&err.message}`); }
  
  // Hosted Checkout completed (redirect-style flow)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    await processSuccessfulPayment({
      paymentId: session.id,
      type: 'checkout.session.completed',
      postId: meta.postId || null,
      kind: (meta.kind || '').toLowerCase(),
      userId: meta.userId || null,
      amount: session.amount_total,
      currency: session.currency,
      raw: session
    });
  }

  // Inline PaymentIntent succeeded (no-redirect flow)
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const meta = pi.metadata || {};
    await processSuccessfulPayment({
      paymentId: pi.id,
      type: 'payment_intent.succeeded',
      postId: meta.postId || null,
      kind: (meta.kind || '').toLowerCase(),
      userId: meta.userId || null,
      amount: pi.amount_received || pi.amount,
      currency: pi.currency,
      raw: pi
    });
  }

  return res.json({received: true});
});

// Shared post-payment processing: store record + apply badges + credit user.
// Called from both the hosted Checkout webhook AND the inline PaymentIntent
// webhook so badge/entitlement application is identical in both flows.
async function processSuccessfulPayment({ paymentId, type, postId, kind, userId, amount, currency, raw }) {
  console.log(`✅ Payment completed [${type}]: postId=${postId}, kind=${kind}, userId=${userId}`);
  try {
    const pRef = db.ref(`payments/${paymentId}`);
    const exists = await pRef.once('value');
    if (!exists.exists()) {
      await pRef.set({
        paymentId,
        type,
        kind,
        postId,
        userId,
        amount,
        currency,
        status: 'completed',
        completedAt: admin.database.ServerValue.TIMESTAMP,
        raw
      });
      console.log(`💾 Stored payment: ${paymentId}`);
    }

    if (postId && postId !== 'new_post' && postId !== 'new_post_boost' && postId !== 'new_post_sell') {
      const updates = {};
      if (kind === 'boost' || kind === 'boost_sell') {
        updates[`posts/${postId}/boostPaidAt`] = admin.database.ServerValue.TIMESTAMP;
        updates[`posts/${postId}/boostExpiresAt`] = Date.now() + (30 * 24 * 60 * 60 * 1000);
        updates[`posts/${postId}/boostStatus`] = 'active';
        console.log(`🚀 Applied BOOST badge to post ${postId}`);
      }
      if (kind === 'sell' || kind === 'boost_sell') {
        updates[`posts/${postId}/sellPaidAt`] = admin.database.ServerValue.TIMESTAMP;
        updates[`posts/${postId}/primaryBadge`] = 'sell';
        console.log(`💰 Applied SELL badge to post ${postId}`);
      }
      // Denormalize a structured badge record under posts/{postId}/badges/{paymentId}
      try {
        const badgeRecord = {
          kind: kind || null,
          label: (raw && raw.metadata && raw.metadata.badgeLabel) ? String(raw.metadata.badgeLabel) : (kind === 'sell' ? 'Buy' : (kind === 'boost' ? 'Boost' : null)),
          paymentId: paymentId,
          appliedAt: admin.database.ServerValue.TIMESTAMP,
          expiresAt: (kind === 'boost' || kind === 'boost_sell') ? (Date.now() + (30 * 24 * 60 * 60 * 1000)) : null,
          userId: userId || null,
          amount: amount || null,
          currency: currency || null
        };
        updates[`posts/${postId}/badges/${paymentId}`] = badgeRecord;
      } catch (e) {
        console.warn('Failed to add denormalized badge record for post update', e && e.message);
      }
      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
      }
    }

    if (userId && userId !== 'anonymous') {
      const userRef = db.ref(`users/${userId}/account`);
      const userSnapshot = await userRef.once('value');
      const account = userSnapshot.val() || { balance: 0, purchases: {} };
      if (!account.purchases) account.purchases = {};
        const badgeLabel = raw && raw.metadata && raw.metadata.badgeLabel ? String(raw.metadata.badgeLabel) : null;
        account.purchases[paymentId] = { kind, postId, amount, currency, purchasedAt: Date.now(), badgeLabel: badgeLabel || null };
      if (!account.entitlements) account.entitlements = {};
      if (kind === 'boost' || kind === 'boost_sell') {
        account.entitlements.boost = { paid: true, paymentId, purchasedAt: Date.now() };
      }
      if (kind === 'sell' || kind === 'boost_sell') {
        account.entitlements.sell = { paid: true, paymentId, purchasedAt: Date.now() };
      }
      await userRef.set(account);
      console.log(`👤 Credited user account: ${userId}, kind=${kind}`);
    }
      // Also create a user-level badge record (preserved until consumed by next post)
      try {
        if (userId && userId !== 'anonymous' && badgeLabel) {
          const badgeRef = db.ref(`users/${userId}/badges/${paymentId}`);
          await badgeRef.set({
            paymentId,
            type: kind,
            label: badgeLabel,
            purchasedAt: admin.database.ServerValue.TIMESTAMP,
            consumed: false,
            amount,
            currency
          });
          console.log(`🏷️ Saved user badge record for ${userId} / ${paymentId}`);
        }
      } catch (e) { console.error('Failed saving user badge record:', e); }
  } catch (e) {
    console.error('processSuccessfulPayment error:', e);
  }
}

// Inline checkout: create a PaymentIntent the browser confirms with
// stripe.confirmCardPayment() — no Stripe-hosted redirect page.
exports.createPaymentIntent = functions
  .runWith({ secrets: [stripeSecretParam] })
  .https.onCall(async (data, context) => {
    const stripe = getStripe();
    if (!stripe) throw new functions.https.HttpsError('failed-precondition', 'Stripe not configured');
    // Determine amount (cents). Prefer server-side configured price for controlled kinds.
    let amount = data && data.amount ? Math.round(Number(data.amount)) : 0;
    const currency = String((data && data.currency) || 'usd').toLowerCase();
    const kind = String((data && data.kind) || '').toLowerCase();
    const postId = data && data.postId ? String(data.postId) : 'new_post';
    const userId = (data && data.userId) || (context && context.auth && context.auth.uid) || 'anonymous';
    // If this is a server-controlled kind (boost/sell), attempt to fetch authoritative price
    try {
      if (['boost','sell','boost_sell'].includes(kind)) {
        const priceSnap = await db.ref(`pricing/${kind}`).once('value');
        if (priceSnap.exists()) {
          const p = priceSnap.val();
          if (p && Number.isInteger(Number(p.amountCents))) amount = Number(p.amountCents);
          else if (p && Number.isFinite(Number(p.basePrice))) amount = Math.round(Number(p.basePrice));
        }
      }
    } catch (e) { console.warn('Price lookup failed for createPaymentIntent', e && e.message); }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'amount (positive integer cents) required');
    }
    // Enforce minimum per-currency to prevent Stripe errors on tiny charges
    try {
      const min = getMinForCurrency(currency);
      if (amount < min) {
        console.warn(`createPaymentIntent: amount ${amount} < min ${min} for ${currency}; using min+1`);
        amount = min + 1;
      }
    } catch (e) { /* ignore */ }
    if (!['boost', 'sell', 'boost_sell'].includes(kind)) {
      throw new functions.https.HttpsError('invalid-argument', 'kind must be boost, sell, or boost_sell');
    }
    const badgeLabel = data && data.badgeLabel ? String(data.badgeLabel).slice(0,128) : null;
    try {
      const pi = await stripe.paymentIntents.create({
        amount,
        currency,
        // Cards + wallets (Apple/Google Pay tokens arrive as card PaymentMethods).
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: {
          postId: String(postId).replace(/[^a-zA-Z0-9_\-\.]/g, '_'),
          kind: kind.replace(/[^a-zA-Z0-9_\-]/g, '_'),
          userId: String(userId).replace(/[^a-zA-Z0-9_\-\.]/g, '_'),
          source: (data && data.source) || 'inline',
          badgeLabel: badgeLabel || ''
        }
      });
      return { clientSecret: pi.client_secret, paymentIntentId: pi.id };
    } catch (e) {
      console.error('createPaymentIntent error:', e && (e.message || e));
      throw new functions.https.HttpsError('internal', e && e.message ? e.message : 'Stripe error');
    }
});

// ============================================================================
// Media moderation (Google Cloud Vision + Video Intelligence)
//
// Project layout note: Firebase app lives in `wificontent-143da` but the
// service account that has Vision/Video API access lives in a separate
// GCP project called `wificontent`. The SA key is stored in a Firebase
// Functions secret named VISION_SA_KEY (JSON contents of the key file).
//
// To set the secret once locally before deploying:
//   firebase functions:secrets:set VISION_SA_KEY < ~/secrets/fedex-vision-key.json
//
// Client passes base64 (data URL stripped) plus mediaType: 'image' | 'video'.
// Function returns { safe: bool, reason: string, scores: {...} }.
// ============================================================================
const VISION_SA_KEY = functions.params
  ? null
  : null; // placeholder so editors don't complain
const visionSecret = require('firebase-functions/params').defineSecret('VISION_SA_KEY');

let _visionClient = null;
let _videoClient = null;
function _getVisionCreds() {
  const raw = process.env.VISION_SA_KEY || visionSecret.value();
  if (!raw) throw new Error('VISION_SA_KEY secret not set');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { throw new Error('VISION_SA_KEY is not valid JSON'); }
  return {
    projectId: parsed.project_id,
    credentials: {
      client_email: parsed.client_email,
      private_key: parsed.private_key
    }
  };
}
function _getVisionClient() {
  if (_visionClient) return _visionClient;
  const { ImageAnnotatorClient } = require('@google-cloud/vision');
  _visionClient = new ImageAnnotatorClient(_getVisionCreds());
  return _visionClient;
}
function _getVideoClient() {
  if (_videoClient) return _videoClient;
  const { VideoIntelligenceServiceClient } = require('@google-cloud/video-intelligence');
  _videoClient = new VideoIntelligenceServiceClient(_getVisionCreds());
  return _videoClient;
}

// Likelihood map: VERY_UNLIKELY=1 ... VERY_LIKELY=5
const _LIKELIHOOD_RANK = { VERY_UNLIKELY: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, VERY_LIKELY: 5 };
function _rank(v) {
  if (typeof v === 'number') return v;
  return _LIKELIHOOD_RANK[String(v).toUpperCase()] || 0;
}

// ----- Hate / racism keyword & slur lists (English, conservative) -----
// Word-boundary regex avoids false positives ("classic" containing "ass").
// Intentionally simple; coded language and non-English are NOT covered.
const _HATE_SLUR_PATTERNS = [
  /\bn[i1!|]gg(?:e|3)rs?\b/i,
  /\bn[i1!|]gg(?:a|4)s?\b/i,
  // Google sometimes returns censored slurs even when filterProfanity=false.
  // Catch the masked forms: n****, n----, n___, n##, etc. (3+ mask chars after 'n').
  /\bn[*#_\-]{3,}\b/i,
  /\bn[i1!|]g{1,2}[*#_\-]+\b/i,
  /\bf[a@]gg?(?:o|0)ts?\b/i,
  /\bf[a@]g{1,2}[*#_\-]+\b/i,
  /\bk[i1!|]kes?\b/i,
  /\bch[i1!|]nks?\b/i,
  /\bsp[i1!|]cs?\b/i,
  /\bw[e3]tb[a@]cks?\b/i,
  /\btr[a@]nn(?:y|ie)s?\b/i,
  /\bret[a@]rds?\b/i,
  /\bgooks?\b/i,
  /\btowel ?heads?\b/i,
  /\bsand ?n[i1!|]gg?(?:e|3|a|4)rs?\b/i,
  /\bcoons?\b/i,
  /\bsh(?:e|3)males?\b/i,
  /\bdykes?\b/i
];
const _HATE_PHRASE_PATTERNS = [
  /\bheil hitler\b/i,
  /\bsieg heil\b/i,
  /\bwhite power\b/i,
  /\bwhite pride\b/i,
  /\bwhite nationalis[mt]\b/i,
  /\bwhite supremac/i,
  /\bgo back to (?:africa|mexico|china|india|your country)\b/i,
  /\ball lives matter\s+(?:not|over)\b/i,
  /\bkill all (?:jews|blacks|whites|muslims|gays|trans|asians|mexicans)\b/i,
  /\b(?:f[\*\W]?ck|kill|hang|lynch|gas|burn|nuke|murder|exterminate)\s+(?:the\s+)?(?:jews|blacks|whites|muslims|gays|trans|asians|mexicans|n[i1!|]gg(?:e|3|a|4)rs?)\b/i,
  /\b1488\b/,
  /\b14\/88\b/,
  /\b\bhh ?88\b/i
];

// Labels returned by Cloud Vision LABEL_DETECTION or OBJECT_LOCALIZATION
// that indicate weapons, gore, or hate imagery. We require a score >= 0.7
// (high confidence) to block, to keep false positives down.
// IMPORTANT: keep entries here distinctive enough that a word-boundary match
// won't blow up on benign content. Generic terms like "blood", "death",
// "knife", "blade", "bullet", "magazine", "injury", "wound" were removed
// because they false-positive on kitchen videos, sports highlights, food
// (blood orange, bloody mary), trains (bullet train), nature (death valley,
// blade of grass), reading (magazine), etc.
const _WEAPON_LABELS = [
  'handgun','pistol','revolver','rifle','shotgun','firearm','assault rifle',
  'machine gun','submachine gun','sniper rifle','ak-47','ar-15','glock','uzi',
  'machete','katana'
];
const _GORE_LABELS = [
  'gore','corpse','dead body','dismemberment','decapitation','severed head',
  'mutilation','massacre','disembowelment'
];
const _HATE_SYMBOL_LABELS = [
  'swastika','nazi','nazism','third reich','hitler','ss insignia','ss runes',
  'ku klux klan','kkk','klan','burning cross','confederate flag','rebel flag',
  'sonnenrad','black sun','celtic cross (white supremacist)',
  'noose','lynching'
];
const _ALL_BLOCKED_LABELS = new Set([
  ..._WEAPON_LABELS.map(s => s.toLowerCase()),
  ..._GORE_LABELS.map(s => s.toLowerCase()),
  ..._HATE_SYMBOL_LABELS.map(s => s.toLowerCase())
]);
// Word-boundary regex per blocked label, so "magazine (firearms)" only
// matches the literal phrase, "ku klux klan" matches even inside a longer
// description, but "blade" never matches "blade of grass".
const _BLOCKED_LABEL_REGEXES = Array.from(_ALL_BLOCKED_LABELS).map(label => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { label, re: new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i') };
});

function _containsHateText(text) {
  if (!text) return false;
  for (const re of _HATE_SLUR_PATTERNS) { if (re.test(text)) return { kind: 'slur' }; }
  for (const re of _HATE_PHRASE_PATTERNS) { if (re.test(text)) return { kind: 'hate_phrase' }; }
  return false;
}
function _findBadLabel(labelAnnotations) {
  if (!Array.isArray(labelAnnotations)) return null;
  for (const lab of labelAnnotations) {
    const desc = (lab.description || '').toLowerCase().trim();
    const score = typeof lab.score === 'number' ? lab.score : 0;
    if (score < 0.75) continue;
    if (_ALL_BLOCKED_LABELS.has(desc)) {
      return { label: desc, score, category: _WEAPON_LABELS.includes(desc) ? 'weapon' : _GORE_LABELS.includes(desc) ? 'gore' : 'hate_symbol' };
    }
    // Word-boundary match for compound descriptions like "assault rifle in hands"
    for (const { label, re } of _BLOCKED_LABEL_REGEXES) {
      if (re.test(desc)) {
        const cat = _WEAPON_LABELS.includes(label) ? 'weapon'
                  : _GORE_LABELS.includes(label) ? 'gore'
                  : 'hate_symbol';
        return { label: desc, matched: label, score, category: cat };
      }
    }
  }
  return null;
}
function _findBadObject(objectAnnotations) {
  if (!Array.isArray(objectAnnotations)) return null;
  for (const obj of objectAnnotations) {
    const name = (obj.name || '').toLowerCase().trim();
    const score = typeof obj.score === 'number' ? obj.score : 0;
    if (score < 0.7) continue;
    if (_ALL_BLOCKED_LABELS.has(name)) return { object: name, score };
    for (const { label, re } of _BLOCKED_LABEL_REGEXES) {
      if (re.test(name)) return { object: name, matched: label, score };
    }
  }
  return null;
}

exports.moderateMedia = functions
  .runWith({ secrets: [visionSecret], timeoutSeconds: 180, memory: '512MB' })
  .https.onCall(async (data, context) => {
    const mediaType = (data && data.mediaType) || 'image';
    const base64 = data && data.base64;
    if (!base64 || typeof base64 !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'base64 (string) required');
    }
    // Strip data URL prefix if present
    const cleanB64 = base64.indexOf(',') !== -1 ? base64.split(',')[1] : base64;
    const bytes = Buffer.from(cleanB64, 'base64');

    // Size guard (Vision: 20MB inline; Video: 10MB inline)
    const maxBytes = mediaType === 'video' ? 9 * 1024 * 1024 : 19 * 1024 * 1024;
    if (bytes.length > maxBytes) {
      throw new functions.https.HttpsError('invalid-argument', `media too large for inline moderation (${bytes.length} bytes)`);
    }

    try {
      if (mediaType === 'image') {
        const client = _getVisionClient();
        // ONE batched call: SafeSearch + Labels + Objects + OCR text + Web.
        // Cheaper and faster than 5 separate calls.
        const [result] = await client.annotateImage({
          image: { content: bytes },
          features: [
            { type: 'SAFE_SEARCH_DETECTION' },
            { type: 'LABEL_DETECTION', maxResults: 30 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 20 },
            { type: 'TEXT_DETECTION' },
            { type: 'WEB_DETECTION', maxResults: 10 }
          ]
        });

        // Pass 1: SafeSearch (nudity / violence / racy)
        const ss = (result && result.safeSearchAnnotation) || {};
        const scores = {
          adult: _rank(ss.adult),
          violence: _rank(ss.violence),
          racy: _rank(ss.racy),
          medical: _rank(ss.medical),
          spoof: _rank(ss.spoof)
        };
        let safe = true;
        let reason = '';
        const checks = [];
        if (scores.adult >= 4) { safe = false; reason = 'nudity or sexual content detected'; checks.push('safesearch:adult'); }
        else if (scores.violence >= 4) { safe = false; reason = 'violent content detected'; checks.push('safesearch:violence'); }
        else if (scores.racy >= 5) { safe = false; reason = 'explicit content detected'; checks.push('safesearch:racy'); }

        // Pass 2: Labels (weapons, gore, hate symbols by name)
        if (safe) {
          const badLabel = _findBadLabel(result.labelAnnotations);
          if (badLabel) {
            safe = false;
            const cat = badLabel.category === 'weapon' ? 'weapon'
                      : badLabel.category === 'gore' ? 'graphic violence'
                      : badLabel.category === 'hate_symbol' ? 'hate symbol'
                      : 'prohibited content';
            reason = `${cat} detected (${badLabel.label})`;
            checks.push(`label:${badLabel.label}`);
          }
        }

        // Pass 3: Object localization (e.g., a clearly-visible gun in scene)
        if (safe) {
          const badObj = _findBadObject(result.localizedObjectAnnotations);
          if (badObj) {
            safe = false;
            reason = `prohibited object detected (${badObj.object})`;
            checks.push(`object:${badObj.object}`);
          }
        }

        // Pass 4: OCR text → hate speech / slurs
        if (safe) {
          const fullText = (result.fullTextAnnotation && result.fullTextAnnotation.text) || '';
          const hateHit = _containsHateText(fullText);
          if (hateHit) {
            safe = false;
            reason = hateHit.kind === 'slur'
              ? 'racial slur or hate speech detected in image text'
              : 'hate speech detected in image text';
            checks.push(`ocr:${hateHit.kind}`);
          }
        }

        // Pass 5: Web detection — best-titles & best-guess often reveal
        // context (e.g., images cropped from porn sites, hate-group memes).
        if (safe && result.webDetection) {
          const wd = result.webDetection;
          const webText = [
            ...(wd.bestGuessLabels || []).map(x => x.label || ''),
            ...(wd.webEntities || []).map(x => x.description || ''),
            ...(wd.pagesWithMatchingImages || []).map(x => (x.pageTitle || '') + ' ' + (x.url || ''))
          ].join(' \n ').toLowerCase();
          const webHateHit = _containsHateText(webText);
          const webPornHit = /\b(porn|xxx|nud(?:e|ity)|onlyfans|hentai|pornhub|xvideos|xhamster|brazzers)\b/i.test(webText);
          const webGoreHit = /\b(gore|beheading|isis execution|liveleak|bestgore|nsfl)\b/i.test(webText);
          if (webPornHit) { safe = false; reason = 'image matches known pornographic content on web'; checks.push('web:porn'); }
          else if (webGoreHit) { safe = false; reason = 'image matches known graphic violence content on web'; checks.push('web:gore'); }
          else if (webHateHit) { safe = false; reason = 'image matches known hate content on web'; checks.push('web:hate'); }
        }

        return { safe, reason, scores, checks, mediaType };
      }

      if (mediaType === 'video') {
        const client = _getVideoClient();
        const [operation] = await client.annotateVideo({
          inputContent: bytes.toString('base64'),
          features: ['EXPLICIT_CONTENT_DETECTION', 'LABEL_DETECTION', 'TEXT_DETECTION', 'SPEECH_TRANSCRIPTION'],
          videoContext: {
            speechTranscriptionConfig: {
              languageCode: 'en-US',
              enableAutomaticPunctuation: true,
              filterProfanity: false, // we want to see the words so our slur regex can match
              maxAlternatives: 1
            }
          }
        });
        const [opResult] = await operation.promise();
        const annotations = (opResult && opResult.annotationResults && opResult.annotationResults[0]) || {};

        // Pass 1: explicit content per-frame.
        // Video Intelligence likelihoods: 1=VERY_UNLIKELY ... 5=VERY_LIKELY.
        // To avoid blocking benign videos where a single frame is mis-scored
        // (swimwear, dancing, low light), we require EITHER one VERY_LIKELY
        // frame OR at least 3 LIKELY frames.
        const expFrames = (annotations.explicitAnnotation && annotations.explicitAnnotation.frames) || [];
        let worstExplicit = 0;
        let likelyCount = 0;
        let veryLikelyCount = 0;
        for (const f of expFrames) {
          const r = _rank(f.pornographyLikelihood);
          if (r > worstExplicit) worstExplicit = r;
          if (r >= 4) likelyCount++;
          if (r >= 5) veryLikelyCount++;
        }
        const checks = [];
        let safe = true;
        let reason = '';
        if (veryLikelyCount >= 1 || likelyCount >= 3) {
          safe = false;
          reason = 'nudity or sexual content detected in video';
          checks.push(`video:explicit(vl=${veryLikelyCount},l=${likelyCount})`);
        }

        // Pass 2: shot-level + segment labels → weapons, gore, hate symbols
        if (safe) {
          const allLabels = [
            ...((annotations.shotLabelAnnotations) || []),
            ...((annotations.segmentLabelAnnotations) || [])
          ];
          const flat = allLabels.map(la => ({
            description: la.entity && la.entity.description,
            score: Math.max(0, ...((la.segments || la.frames || []).map(s => (s.confidence || 0))))
          }));
          const badLabel = _findBadLabel(flat);
          if (badLabel) {
            safe = false;
            const cat = badLabel.category === 'weapon' ? 'weapon'
                      : badLabel.category === 'gore' ? 'graphic violence'
                      : badLabel.category === 'hate_symbol' ? 'hate symbol'
                      : 'prohibited content';
            reason = `${cat} detected in video (${badLabel.label})`;
            checks.push(`video:label:${badLabel.label}`);
          }
        }

        // Pass 3: text-on-screen OCR → hate speech
        if (safe) {
          const textAnns = annotations.textAnnotations || [];
          const fullText = textAnns.map(t => (t.text || '')).join(' \n ');
          console.log('🎬 video OCR text (first 500 chars):', JSON.stringify(fullText.slice(0, 500)));
          const hateHit = _containsHateText(fullText);
          if (hateHit) {
            safe = false;
            reason = hateHit.kind === 'slur'
              ? 'racial slur or hate speech detected in video text'
              : 'hate speech detected in video text';
            checks.push(`video:ocr:${hateHit.kind}`);
          }
        }

        // Pass 4: spoken audio transcription → hate speech
        // Uses Video Intelligence's built-in SPEECH_TRANSCRIPTION (no separate API).
        let transcript = '';
        if (safe) {
          const speechAnns = annotations.speechTranscriptions || [];
          transcript = speechAnns
            .map(st => (st.alternatives && st.alternatives[0] && st.alternatives[0].transcript) || '')
            .join(' \n ');
          console.log('🎙️ video transcript length:', transcript.length, '| first 500 chars:', JSON.stringify(transcript.slice(0, 500)));
          const audioHateHit = _containsHateText(transcript);
          if (audioHateHit) {
            safe = false;
            reason = audioHateHit.kind === 'slur'
              ? 'racial slur or hate speech detected in video audio'
              : 'hate speech detected in video audio';
            checks.push(`video:audio:${audioHateHit.kind}`);
          }
        }

        return {
          safe,
          reason,
          scores: { pornography: worstExplicit, frameCount: expFrames.length, transcriptLength: transcript.length },
          checks,
          mediaType
        };
      }

      throw new functions.https.HttpsError('invalid-argument', `unknown mediaType: ${mediaType}`);
    } catch (e) {
      if (e && e.code && typeof e.code === 'string' && e.code.startsWith('functions/')) throw e;
      console.error('moderateMedia error', e && e.message, e && e.stack);
      // Fail-open: return safe=true so uploads aren't blocked by infra errors,
      // but include the error reason so the client can log it.
      return { safe: true, reason: 'moderation_unavailable: ' + (e && e.message), scores: {}, mediaType, failOpen: true };
    }
  });


