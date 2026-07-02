const { handleOptions, setCommonHeaders, safeReadJson } = require('../../_utils');

function readBest(zoneId) {
  const cache = safeReadJson('best_posts_cache.json');
  const data = cache && cache.data && typeof cache.data === 'object' ? cache.data : {};
  if (zoneId && data[zoneId]) return data[zoneId];
  if (data.global) return data.global;
  return null;
}

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;

  // One-shot SSE response for Vercel/serverless compatibility.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');

  const zoneId = String((req.query && req.query.zoneId) || 'global');
  const best = readBest(zoneId);

  res.write('retry: 15000\n');
  res.write('event: best_post_update\n');
  res.write(`data: ${JSON.stringify({ zoneId, best: best || null })}\n\n`);
  res.end();
};
