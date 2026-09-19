const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
  res.json({ categories: rows.map(r => ({ id: r.id, name: r.name, icon: r.icon, sortOrder: r.sort_order })) });
});

router.post('/', requireAdmin('super', 'manager'), (req, res) => {
  const { id, name, icon, sortOrder } = req.body || {};
  if (!id || !name) return res.status(400).json({ error: 'id and name are required.' });
  db.prepare('INSERT INTO categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name, icon || 'laptop', sortOrder || 0);
  res.status(201).json({ category: { id, name, icon, sortOrder } });
});

router.put('/:id', requireAdmin('super', 'manager'), (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found.' });
  const b = req.body || {};
  db.prepare('UPDATE categories SET name = ?, icon = ?, sort_order = ? WHERE id = ?')
    .run(b.name ?? existing.name, b.icon ?? existing.icon, b.sortOrder ?? existing.sort_order, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin('super', 'manager'), (req, res) => {
  const inUse = db.prepare('SELECT COUNT(*) AS n FROM products WHERE category_id = ?').get(req.params.id).n;
  if (inUse > 0) return res.status(409).json({ error: `${inUse} product(s) still use this category. Reassign them first.` });
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Category not found.' });
  res.status(204).end();
});

module.exports = router;
