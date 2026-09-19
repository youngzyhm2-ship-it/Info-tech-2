const express = require('express');
const db = require('../db');
const { requireCustomer } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireCustomer, (req, res) => {
  const rows = db.prepare(`
    SELECT p.* FROM favourites f JOIN products p ON p.id = f.product_id
    WHERE f.customer_id = ? ORDER BY f.created_at DESC
  `).all(req.user.sub);
  res.json({ productIds: rows.map(r => r.id) });
});

router.post('/:productId', requireCustomer, (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('INSERT OR IGNORE INTO favourites (customer_id, product_id) VALUES (?, ?)')
    .run(req.user.sub, req.params.productId);
  res.status(201).json({ ok: true });
});

router.delete('/:productId', requireCustomer, (req, res) => {
  db.prepare('DELETE FROM favourites WHERE customer_id = ? AND product_id = ?')
    .run(req.user.sub, req.params.productId);
  res.status(204).end();
});

module.exports = router;
