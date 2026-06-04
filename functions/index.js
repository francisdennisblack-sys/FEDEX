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
  // Export a combined express app as `api`
  exports.api = functions.https.onRequest(app);
  expressAppMounted = true;
} catch (e) {
  console.warn('Express API not mounted (optional). Ensure `express` and `pg` are installed and POIS_DB_URL is set.');
}

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

// Best-effort hate speech detector. Word-boundary regex against a small set
// of unambiguous slurs. This is intentionally conservative to avoid false
// positives (e.g., 'spook' as a noun for ghost). It will NOT catch coded
// language, leetspeak, or non-English slurs — that requires a real model.
const _HATE_SLUR_PATTERNS = [
  /\bn[i1!|]gg(?:e|3)rs?\b/i,
  /\bn[i1!|]gg(?:a|4)s?\b/i,
  /\bf[a@]gg?(?:o|0)ts?\b/i,
  /\bk[i1!|]kes?\b/i,
  /\bch[i1!|]nks?\b/i,
  /\bsp[i1!|]cs?\b/i,
  /\bw[e3]tb[a@]cks?\b/i,
  /\btr[a@]nn(?:y|ie)s?\b/i,
  /\bret[a@]rds?\b/i,
  /\bheil hitler\b/i,
  /\bwhite power\b/i,
  /\b1488\b/,
  /\b14\/88\b/
];
function _containsHateSpeech(text) {
  if (!text) return false;
  for (const re of _HATE_SLUR_PATTERNS) { if (re.test(text)) return true; }
  return false;
}

exports.moderateMedia = functions
  .runWith({ secrets: [visionSecret], timeoutSeconds: 120, memory: '512MB' })
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
        const [result] = await client.safeSearchDetection({ image: { content: bytes } });
        const ss = (result && result.safeSearchAnnotation) || {};
        const scores = {
          adult: _rank(ss.adult),
          violence: _rank(ss.violence),
          racy: _rank(ss.racy),
          medical: _rank(ss.medical),
          spoof: _rank(ss.spoof)
        };
        // Strict thresholds: no nudity, no violence.
        // - adult >= LIKELY catches toplessness, nudity, sex acts.
        // - violence >= LIKELY catches fights, weapons, blood, gore.
        // - racy >= VERY_LIKELY catches extreme suggestive content
        //   (full-body lingerie shots, etc.); bikinis usually score POSSIBLE.
        // NOTE: Vision SafeSearch does NOT detect racism/hate symbols.
        // We run text OCR below and block on hate slurs as a best-effort
        // check for text-in-image racism (swastikas etc. would need a
        // custom label model — not covered here).
        let safe = true;
        let reason = '';
        if (scores.adult >= 4) { safe = false; reason = 'nudity or sexual content detected'; }
        else if (scores.violence >= 4) { safe = false; reason = 'violent content detected'; }
        else if (scores.racy >= 5) { safe = false; reason = 'explicit content detected'; }

        // Best-effort hate-speech / racism check via text OCR
        if (safe) {
          try {
            const [textResult] = await client.textDetection({ image: { content: bytes } });
            const fullText = (textResult && textResult.fullTextAnnotation && textResult.fullTextAnnotation.text) || '';
            if (fullText && _containsHateSpeech(fullText)) {
              safe = false;
              reason = 'hate speech or slurs detected in image text';
            }
          } catch (e) {
            // OCR failure shouldn't block uploads
            console.warn('text OCR failed:', e && e.message);
          }
        }

        return { safe, reason, scores, mediaType };
      }

      if (mediaType === 'video') {
        const client = _getVideoClient();
        const [operation] = await client.annotateVideo({
          inputContent: bytes.toString('base64'),
          features: ['EXPLICIT_CONTENT_DETECTION']
        });
        const [opResult] = await operation.promise();
        const annotations = (opResult && opResult.annotationResults && opResult.annotationResults[0]) || {};
        const frames = (annotations.explicitAnnotation && annotations.explicitAnnotation.frames) || [];
        // Compute worst frame
        let worst = 0;
        for (const f of frames) {
          const r = _rank(f.pornographyLikelihood);
          if (r > worst) worst = r;
        }
        const safe = worst < 4; // Strict: block LIKELY or VERY_LIKELY pornography/nudity
        return {
          safe,
          reason: safe ? '' : 'nudity or sexual content detected in video',
          scores: { pornography: worst, frameCount: frames.length },
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

