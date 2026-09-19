const express = require('express');
const db = require('../db');
const { attachUserIfPresent, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/** POST /api/enquiries — called the moment a customer taps "Enquire on WhatsApp",
 *  right before opening wa.me. Guests may enquire too (section 12 doesn't require
 *  an account); if a customer token is present it's attached for section 15's
 *  "which customers generate enquiries" view. */
router.post('/', attachUserIfPresent, (req, res) => {
  const { productId, source } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId is required.' });
  const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const customerId = req.user && req.user.type === 'customer' ? req.user.sub : null;
  db.prepare(`INSERT INTO enquiries (customer_id, product_id, product_name, source) VALUES (?, ?, ?, ?)`)
    .run(customerId, productId, product.name, source || 'website');
  res.status(201).json({ ok: true });
});

/** GET /api/enquiries — recent enquiries, newest first. Any admin tier can view
 *  (section 18/19 both list "view enquiries" in some form). */
router.get('/', requireAdmin(), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 200);
  const rows = db.prepare(`
    SELECT e.id, e.product_id, e.product_name, e.source, e.created_at,
           c.full_name AS customer_name, c.email AS customer_email
    FROM enquiries e LEFT JOIN customers c ON c.id = e.customer_id
    ORDER BY e.created_at DESC LIMIT ?
  `).all(limit);
  res.json({
    enquiries: rows.map(r => ({
      id: r.id, productId: r.product_id, productName: r.product_name, source: r.source,
      createdAt: r.created_at, customerName: r.customer_name || null, customerEmail: r.customer_email || null,
    })),
  });
});

module.exports = router;
