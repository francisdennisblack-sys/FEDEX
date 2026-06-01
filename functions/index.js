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

exports.enforceUserPostLimit = functions.database.ref('/posts/{postId}').onCreate(async (snap, ctx)=>{
  const post = snap.val()||{}; const postId = ctx.params.postId; const userId = post.authId||post.userId||post.createdBy; if(!userId) return null;
  const ref = db.ref(`user-posts/${userId}`); const s = await ref.once('value'); const existing = s.exists()?s.val():{}; const count = Object.keys(existing).length;
  if(count>=MAX_POSTS_PER_USER){ await snap.ref.remove(); await db.ref(`post-deletions/${postId}`).set({postId,userId,reason:'post_limit_exceeded',ts:admin.database.ServerValue.TIMESTAMP}); return null; }
  await ref.child(postId).set({postId,authId:userId,timestamp:post.timestamp||admin.database.ServerValue.TIMESTAMP,createdAt:admin.database.ServerValue.TIMESTAMP});
  return null;
});

exports.postMetricsAggregator = functions.database.ref('/posts/{postId}').onCreate(async (snap, ctx)=>{ const post=snap.val()||{}; try{ await incrementCounter('metrics/global/postsTotal',1); const zone=post.zoneTag||post.county||'unknown'; await incrementCounter(`metrics/postsByZone/${encodeURIComponent(zone)}`,1);}catch(e){console.error(e);} return null; });

exports.createCheckoutSession = functions.https.onRequest(async (req,res)=>{
  setDefaultCors(res); if(req.method==='OPTIONS'){res.status(204).send('');return;} if(!stripe) return res.status(500).json({error:'Stripe not configured'});
  try{ const {postId,kind,amount,currency,success_url,cancel_url,metadata} = req.body||{}; if(!postId||!kind||!amount) return res.status(400).json({error:'postId,kind,amount required'});
    // Extract userId from metadata
    const userId = (metadata && metadata.clientUserId) || 'anonymous';
    
    // Normalize and validate amount: accept cents (integer) or dollars (decimal string)
    let unit_amount;
    const rawAmount = amount;
    if(typeof rawAmount === 'string' && rawAmount.indexOf('.')!==-1){
      const v = parseFloat(rawAmount.replace(/[^0-9.\-]/g,''));
      unit_amount = Number.isFinite(v) ? Math.round(v*100) : NaN;
    } else {
      unit_amount = Math.round(Number(String(rawAmount).replace(/[^0-9\-]/g,'')));
    }
    if(!Number.isInteger(unit_amount) || unit_amount <= 0) return res.status(400).json({error:'invalid amount; provide integer cents or decimal dollars'});
    // Validate URLs
    let okSuccess = success_url || 'https://example.com/success';
    let okCancel = cancel_url || 'https://example.com/cancel';
    try{ new URL(okSuccess); new URL(okCancel); }catch(e){ return res.status(400).json({error:'invalid success_url or cancel_url'}); }
    // Sanitize metadata values to avoid remote API pattern rejections
    const metaPostId = String(postId).replace(/[^a-zA-Z0-9_\-\.]/g,'_');
    const metaKind = String(kind).replace(/[^a-zA-Z0-9_\-]/g,'_');
    const metaUserId = String(userId).replace(/[^a-zA-Z0-9_\-\.]/g,'_');

    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      mode:'payment',
      line_items:[{
        price_data:{
          currency:(currency||'usd').toLowerCase(),
          product_data:{name:`${kind} for post ${postId}`},
          unit_amount:unit_amount
        },
        quantity:1
      }],
      success_url: okSuccess,
      cancel_url: okCancel,
      metadata:{postId:metaPostId,kind:metaKind,userId:metaUserId}
    });
    return res.json({id:session.id,url:session.url});
  }catch(e){ console.error(e); return res.status(500).json({error:e&&e.message}); }
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
        
        if (kind === 'boost') {
          // Apply BOOST badge to post + set expiration (30 days from now)
          updates[`posts/${postId}/boostPaidAt`] = admin.database.ServerValue.TIMESTAMP;
          updates[`posts/${postId}/boostExpiresAt`] = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
          updates[`posts/${postId}/boostStatus`] = 'active';
          console.log(`🚀 Applied BOOST badge to post ${postId}`);
        } else if (kind === 'sell') {
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
