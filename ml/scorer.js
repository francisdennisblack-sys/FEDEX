// Default ML scorer plugin (JS). Replace or extend with real model logic.
// Exports: score(post) -> numeric score to add to ranking.

module.exports = {
  score: function(post) {
    // Simple heuristic placeholder: favor posts with "featured" tag and penalize very old posts
    try {
      let s = 0;
      if (!post) return 0;
      if (post.tags && Array.isArray(post.tags) && post.tags.includes('featured')) s += 5;
      const now = Date.now();
      const ageMs = now - (post.timestamp || now);
      const ageDays = ageMs / (1000*60*60*24);
      if (ageDays < 1) s += 1; // small recency bonus
      return s;
    } catch (e) { return 0; }
  }
};
