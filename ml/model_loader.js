const fs = require('fs');

// Very small model loader that expects model.json with 'coef' and 'intercept'
// and exposes score(post) which builds simple features from a post.

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function buildFeatures(post) {
  const likes = Number(post.likes || 0);
  const boost = (post.boostStatus === 'active' || (post.boostExpiresAt && Number(post.boostExpiresAt) > Date.now())) ? 1 : 0;
  const ageMs = Date.now() - (post.timestamp || Date.now());
  const recent = ageMs < (24*60*60*1000) ? 1 : 0;
  // normalize likes roughly
  const likesNorm = Math.log10(1 + likes);
  return [likesNorm, recent];
}

module.exports = {
  load: function(modelPath) {
    try {
      const raw = fs.readFileSync(modelPath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) { return null; }
  },
  scoreWithModel: function(model, post) {
    try {
      if (!model) return 0;
      if (model.type === 'ctr_map' && model.ctr) {
        const pid = post && post.id ? String(post.id) : null;
        if (!pid) return 0;
        return Number(model.ctr[pid] || 0);
      }
      if (model.type === 'logreg' && model.coef) {
        const features = buildFeatures(post);
        const coefs = model.coef[0] || model.coef;
        let dot = 0;
        for (let i = 0; i < Math.min(coefs.length, features.length); i++) dot += coefs[i] * features[i];
        const intercept = (model.intercept && model.intercept[0]) ? model.intercept[0] : (model.intercept || 0);
        const val = dot + intercept;
        return sigmoid(val);
      }
      return 0;
    } catch (e) { return 0; }
  }
};
