const express = require('express');
const router = express.Router();
const { getQuotaStatus } = require('../services/rateLimitManager');

router.get('/quota-status', async (req, res) => {
  try {
    const status = await getQuotaStatus();
    res.json(status);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
