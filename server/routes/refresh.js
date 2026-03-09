const express = require('express');
const router = express.Router();
const cache = require('../services/cache');

router.post('/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const keyMap = {
      portfolio: ['t212:portfolio', 't212:cash', 't212:info'],
      market: ['yahoo:*'],
      community: ['community:*'],
      analysis: ['ai:*'],
      all: ['t212:portfolio', 't212:cash', 't212:info', 't212:orders', 't212:dividends', 't212:transactions'],
    };
    const keys = keyMap[source] || keyMap.all;
    await Promise.all(keys.map(k => cache.del(k)));
    res.json({ ok: true, source, cleared: keys });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
