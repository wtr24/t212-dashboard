const express = require('express');
const router = express.Router();
const { getFearGreed } = require('../services/marketData');

router.get('/feargreed', async (req, res) => {
  try {
    const data = await getFearGreed();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
