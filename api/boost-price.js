const { handleOptions, setCommonHeaders } = require('./_utils');

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);

  return res.status(200).json({
    basePrice: 299,
    currentPrice: 299,
    priceMultiplier: 1.0,
    source: 'vercel-fallback'
  });
};
