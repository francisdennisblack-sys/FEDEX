const { handleOptions, setCommonHeaders } = require('../_utils');

module.exports = function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCommonHeaders(res);
  return res.status(204).end();
};
