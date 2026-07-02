const { handleOptions, setCommonHeaders, safeReadJson } = require('../_utils');

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  const zoneId = String(req.query.zoneId || 'global');

  const topLiked = safeReadJson('top_liked_cache.json')
    || safeReadJson('best_posts_cache.json')
    || [];

  const arr = Array.isArray(topLiked)
    ? topLiked
    : (topLiked && Array.isArray(topLiked.posts) ? topLiked.posts : []);

  return res.status(200).json({ zoneId, posts: arr.slice(0, 100) });
};
