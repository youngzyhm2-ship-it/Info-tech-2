const express = require('express');
const db = require('../db');
const { requireCustomer } = require('../middleware/auth');

const router = express.Router();

/** POST /api/views — logs a product view. Section 14: only registered
 *  (logged-in) customers are tracked, so this route requires a customer
 *  token; the frontend simply skips calling it for guest visitors. */
router.post('/', requireCustomer, (req, res) => {
  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId is required.' });
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('INSERT INTO product_views (customer_id, product_id) VALUES (?, ?)')
    .run(req.user.sub, productId);
  res.status(201).json({ ok: true });
});

module.exports = router;
