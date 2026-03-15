const express = require('express');
const router = express.Router();
const { query } = require('../models/db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM trading_journal ORDER BY entry_date DESC LIMIT 100');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { ticker, action, entry_price, quantity, entry_date, thesis, signal_at_entry, confidence_at_entry, evidence_at_entry, stop_loss, target_price, tags } = req.body;
    const { rows } = await query(
      `INSERT INTO trading_journal (ticker, action, entry_price, quantity, entry_date, thesis, signal_at_entry, confidence_at_entry, evidence_at_entry, stop_loss, target_price, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [ticker?.toUpperCase(), action, entry_price, quantity, entry_date || new Date().toISOString().split('T')[0], thesis, signal_at_entry, confidence_at_entry, evidence_at_entry ? JSON.stringify(evidence_at_entry) : null, stop_loss, target_price, tags || []]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { exit_price, exit_date, notes, outcome, pnl, pnl_pct } = req.body;
    const { rows } = await query(
      `UPDATE trading_journal SET exit_price=$1, exit_date=$2, notes=$3, outcome=$4, pnl=$5, pnl_pct=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [exit_price, exit_date, notes, outcome, pnl, pnl_pct, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM trading_journal WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
