const { handleOptions, setCommonHeaders, safeReadJson } = require('../_utils');

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));

  const topLiked = safeReadJson('top_liked_cache.json')
    || safeReadJson('best_posts_cache.json')
    || [];

  const arr = Array.isArray(topLiked)
    ? topLiked
    : (topLiked && Array.isArray(topLiked.posts) ? topLiked.posts : []);

  const out = arr.slice(0, limit);
  return res.status(200).json({ posts: out, count: out.length });
};
