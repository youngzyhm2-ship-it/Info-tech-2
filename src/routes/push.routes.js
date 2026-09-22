const express = require('express');
const db = require('../db');
const { attachUserIfPresent } = require('../middleware/auth');
const { enabled, VAPID_PUBLIC_KEY } = require('../push');

const router = express.Router();

router.get('/vapid-public-key', (_req, res) => {
  if (!enabled) return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/** POST /api/push/subscribe — called once the browser grants notification
 *  permission and creates a PushSubscription. Works for guests too (no
 *  account needed to opt into "new product" alerts), but attaches the
 *  customer id when the visitor happens to be logged in. */
router.post('/subscribe', attachUserIfPresent, (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'A valid push subscription object is required.' });
  }
  const customerId = req.user && req.user.type === 'customer' ? req.user.sub : null;
  db.prepare(`
    INSERT INTO push_subscriptions (customer_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET customer_id = excluded.customer_id, p256dh = excluded.p256dh, auth = excluded.auth
  `).run(customerId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
  res.status(201).json({ ok: true });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint is required.' });
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.status(204).end();
});

module.exports = router;
