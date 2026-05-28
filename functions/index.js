const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin SDK (uses functions' service account)
try {
  admin.initializeApp();
} catch (e) {
  // already initialized
}

const db = admin.database();

// Cloud Function: maintain authoritative onlineCount under counters/onlineCount
// Triggered on writes to /onlineUsers/{uid}
exports.syncOnlineCount = functions.database.ref('/onlineUsers/{uid}').onWrite(async (change, context) => {
  const beforeExists = change.before.exists();
  const afterExists = change.after.exists();

  // If nothing changed in existence, do nothing
  if (beforeExists === afterExists) {
    // but lastSeen updates do not change existence; skip
    return null;
  }

  const delta = (!beforeExists && afterExists) ? 1 : ((beforeExists && !afterExists) ? -1 : 0);
  if (delta === 0) return null;

  const counterRef = db.ref('counters/onlineCount');

  // Use a transaction to avoid races
  try {
    await counterRef.transaction((current) => {
      const curr = Number(current) || 0;
      const next = Math.max(0, curr + delta);
      return next;
    }, (err, committed, snapshot) => {
      if (err) {
        console.error('syncOnlineCount transaction error:', err);
      } else if (!committed) {
        console.warn('syncOnlineCount transaction not committed');
      } else {
        console.log('syncOnlineCount updated:', snapshot.val());
      }
    });
  } catch (e) {
    console.error('syncOnlineCount failed', e);
  }

  return null;
});
