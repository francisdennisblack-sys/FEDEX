const { handleOptions, setCommonHeaders, safeReadJson } = require('../../_utils');

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  const cache = safeReadJson('best_posts_cache.json');
  const data = cache && cache.data && typeof cache.data === 'object' ? cache.data : {};
  const ageMs = cache && Number.isFinite(Number(cache.ts)) ? Math.max(0, Date.now() - Number(cache.ts)) : null;

  return res.status(200).json({
    best: data,
    cached: true,
    ageMs,
  });
};
