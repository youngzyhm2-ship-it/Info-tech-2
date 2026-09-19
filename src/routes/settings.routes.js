const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public — the website and apps read this on load to know which numbers to use.
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    whatsappNumber: settings.whatsapp_number,
    emergencyNumber: settings.emergency_number,
  });
});

router.put('/', requireAdmin('super'), (req, res) => {
  const { whatsappNumber, emergencyNumber } = req.body || {};
  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  if (whatsappNumber) upsert.run('whatsapp_number', whatsappNumber);
  if (emergencyNumber) upsert.run('emergency_number', emergencyNumber);
  res.json({ ok: true });
});

module.exports = router;
