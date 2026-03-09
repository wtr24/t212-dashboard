const express = require('express');
const router = express.Router();
const t212 = require('../services/t212');

router.get('/', async (req, res) => {
  try {
    const pies = await t212.getPies();
    res.json(pies);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
