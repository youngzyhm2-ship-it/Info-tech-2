const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

/** GET /api/analytics/products — product-level analytics (section 15A).
 *  Available to any admin tier; the sensitive per-viewer breakdown below
 *  is Super Admin only. */
router.get('/products', requireAdmin(), (_req, res) => {
  const rows = db.prepare(`
    SELECT id, name, views_count, enquiries_count, favourites_count,
           (SELECT COUNT(DISTINCT customer_id) FROM product_views WHERE product_id = products.id) AS unique_viewers
    FROM products ORDER BY views_count DESC
  `).all();
  res.json({
    products: rows.map(r => ({
      id: r.id, name: r.name, views: r.views_count, uniqueViewers: r.unique_viewers,
      enquiries: r.enquiries_count, favourites: r.favourites_count,
    })),
  });
});

/** GET /api/analytics/products/:id/viewers — individual viewer list (section 15B).
 *  Restricted to Super Admin, matching section 19's explicit carve-out. */
router.get('/products/:id/viewers', requireAdmin('super'), (req, res) => {
  const rows = db.prepare(`
    SELECT v.viewed_at, c.id AS customer_id, c.full_name, c.email
    FROM product_views v JOIN customers c ON c.id = v.customer_id
    WHERE v.product_id = ? ORDER BY v.viewed_at DESC LIMIT 200
  `).all(req.params.id);
  res.json({
    viewers: rows.map(r => ({
      customerId: r.customer_id, name: r.full_name, email: r.email, viewedAt: r.viewed_at,
    })),
  });
});

module.exports = router;
