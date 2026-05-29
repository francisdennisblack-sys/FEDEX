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
  try{ const {postId,kind,amount,currency,success_url,cancel_url} = req.body||{}; if(!postId||!kind||!amount) return res.status(400).json({error:'postId,kind,amount required'});
    const session = await stripe.checkout.sessions.create({ payment_method_types:['card'], mode:'payment', line_items:[{price_data:{currency:currency||'usd',product_data:{name:`${kind} for post ${postId}`},unit_amount:Math.round(Number(amount))},quantity:1}], success_url:success_url||'https://example.com/success', cancel_url:cancel_url||'https://example.com/cancel', metadata:{postId:String(postId),kind:String(kind)} });
    return res.json({id:session.id,url:session.url});
  }catch(e){ console.error(e); return res.status(500).json({error:e&&e.message}); }
});

exports.handleStripeWebhook = functions.https.onRequest(async (req,res)=>{
  setDefaultCors(res); if(!stripe) return res.status(500).send('Stripe not configured'); const sig = req.headers['stripe-signature']||req.headers['Stripe-Signature']; let event;
  try{ event = stripe.webhooks.constructEvent(req.rawBody,sig,STRIPE_WEBHOOK_SECRET); }catch(err){ console.error('sig',err&&err.message); return res.status(400).send(`Webhook Error: ${err&&err.message}`); }
  const obj = event.data&&event.data.object?event.data.object:{}; const meta = obj.metadata||{}; const postId = meta.postId||null; const kind=(meta.kind||'').toLowerCase(); const paymentId = obj.id||`evt_${Date.now()}`;
  try{ const pRef=db.ref(`payments/${paymentId}`); const exists=await pRef.once('value'); if(!exists.exists()) await pRef.set({paymentId,type:event.type,kind,postId,receivedAt:admin.database.ServerValue.TIMESTAMP,raw:obj}); if(postId){ const updates={}; if(kind==='boost') updates[`posts/${postId}/boostPaidAt`]=admin.database.ServerValue.TIMESTAMP; if(kind==='sell'){ updates[`posts/${postId}/sellPaidAt`]=admin.database.ServerValue.TIMESTAMP; updates[`posts/${postId}/primaryBadge`]='sell'; } if(Object.keys(updates).length) await db.ref().update(updates); } }catch(e){console.error('webhook',e);} return res.json({received:true}); });
