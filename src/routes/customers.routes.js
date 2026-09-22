const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin(), (_req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.full_name, c.email, c.phone, c.created_at,
           (SELECT COUNT(*) FROM favourites f WHERE f.customer_id = c.id) AS favourites_count,
           (SELECT COUNT(*) FROM enquiries e WHERE e.customer_id = c.id) AS enquiries_count
    FROM customers c
    ORDER BY c.created_at DESC
  `).all();
  res.json({
    customers: rows.map(r => ({
      id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, createdAt: r.created_at,
      favourites: r.favourites_count, enquiries: r.enquiries_count,
    })),
  });
});

module.exports = router;
