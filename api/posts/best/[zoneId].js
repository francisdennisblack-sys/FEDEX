const { handleOptions, setCommonHeaders, safeReadJson } = require('../../_utils');

function getBestForZone(zoneId) {
  const cache = safeReadJson('best_posts_cache.json');
  const data = cache && cache.data && typeof cache.data === 'object' ? cache.data : {};
  if (zoneId && data[zoneId]) return data[zoneId];
  if (data.global) return data.global;

  const topLiked = safeReadJson('top_liked_cache.json')
    || safeReadJson('best_posts_cache.json')
    || [];

  const arr = Array.isArray(topLiked)
    ? topLiked
    : (topLiked && Array.isArray(topLiked.posts) ? topLiked.posts : []);

  if (!arr.length) return null;
  const first = arr[0];
  return {
    postId: String(first.id || first.postId || 'unknown'),
    score: Number(first.likes || 0),
    zoneId: zoneId || 'global',
    snapshot: first,
  };
}

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  const zoneId = String((req.query && req.query.zoneId) || (req.query && req.query.zone) || 'global');
  const best = getBestForZone(zoneId);

  return res.status(200).json({
    best: best || null,
    cached: true,
    zoneId,
  });
};
