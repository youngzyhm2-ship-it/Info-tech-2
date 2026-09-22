const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { notifyAllSubscribers } = require('../push');

const router = express.Router();

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    icon: row.icon,
    condition: row.condition,
    availability: row.availability,
    price: row.price,
    warranty: row.warranty,
    description: row.description,
    specs: JSON.parse(row.specs_json || '[]'),
    images: JSON.parse(row.images_json || '[]'),
    featured: !!row.featured,
    newArrival: !!row.new_arrival,
    views: row.views_count,
    enquiries: row.enquiries_count,
    favourites: row.favourites_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/products
 * Query params (all optional, combine freely — section 9 & 10):
 *   q             free-text match on name / brand / product id
 *   category      category id
 *   condition     New | Used | Refurbished
 *   availability  In Stock | Limited Stock | Out of Stock | Pre-order | Available on Request
 *   sort          relevance (default) | newest | price_asc | price_desc | most_viewed | featured
 *   limit, offset pagination
 */
router.get('/', (req, res) => {
  const { q, category, condition, availability, sort, limit, offset } = req.query;
  const clauses = [];
  const params = {};

  if (q) { clauses.push(`(name LIKE @q OR brand LIKE @q OR id LIKE @q)`); params.q = `%${q}%`; }
  if (category) { clauses.push(`category_id = @category`); params.category = category; }
  if (condition) { clauses.push(`condition = @condition`); params.condition = condition; }
  if (availability) { clauses.push(`availability = @availability`); params.availability = availability; }

  const orderBy = {
    newest: 'created_at DESC',
    price_asc: 'price ASC',
    price_desc: 'price DESC',
    most_viewed: 'views_count DESC',
    featured: 'featured DESC, created_at DESC',
  }[sort] || 'name ASC';

  const lim = Math.min(Number(limit) || 60, 200);
  const off = Number(offset) || 0;

  const sql = `SELECT * FROM products
               ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
               ORDER BY ${orderBy}
               LIMIT @lim OFFSET @off`;
  const rows = db.prepare(sql).all({ ...params, lim, off });
  res.json({ products: rows.map(rowToProduct) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: rowToProduct(row) });
});

// Staff and above can add/edit products (section 17-19).
router.post('/', requireAdmin('super', 'manager', 'staff'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.categoryId) return res.status(400).json({ error: 'name and categoryId are required.' });

  const id = b.id || `ITZ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  db.prepare(`
    INSERT INTO products (id, name, brand, category_id, icon, condition, availability, price, warranty, description, specs_json, images_json, featured, new_arrival)
    VALUES (@id, @name, @brand, @categoryId, @icon, @condition, @availability, @price, @warranty, @description, @specs, @images, @featured, @newArrival)
  `).run({
    id, name: b.name, brand: b.brand || null, categoryId: b.categoryId, icon: b.icon || null,
    condition: b.condition || 'New', availability: b.availability || 'In Stock', price: b.price || 0,
    warranty: b.warranty || null, description: b.description || null,
    specs: JSON.stringify(b.specs || []), images: JSON.stringify(b.images || []),
    featured: b.featured ? 1 : 0, newArrival: b.newArrival ? 1 : 0,
  });
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.status(201).json({ product: rowToProduct(row) });

  // Fire-and-forget: don't make the admin wait for every push to send.
  notifyAllSubscribers({
    title: 'New product on Infotechzone',
    body: b.name,
    url: `/#product-${id}`,
  }).catch(err => console.warn('notifyAllSubscribers failed', err));
});

router.put('/:id', requireAdmin('super', 'manager', 'staff'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const b = req.body || {};

  db.prepare(`
    UPDATE products SET
      name = @name, brand = @brand, category_id = @categoryId, icon = @icon,
      condition = @condition, availability = @availability, price = @price,
      warranty = @warranty, description = @description, specs_json = @specs,
      images_json = @images, featured = @featured, new_arrival = @newArrival,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: req.params.id,
    name: b.name ?? existing.name,
    brand: b.brand ?? existing.brand,
    categoryId: b.categoryId ?? existing.category_id,
    icon: b.icon ?? existing.icon,
    condition: b.condition ?? existing.condition,
    availability: b.availability ?? existing.availability,
    price: b.price ?? existing.price,
    warranty: b.warranty ?? existing.warranty,
    description: b.description ?? existing.description,
    specs: JSON.stringify(b.specs ?? JSON.parse(existing.specs_json)),
    images: JSON.stringify(b.images ?? JSON.parse(existing.images_json)),
    featured: (b.featured ?? existing.featured) ? 1 : 0,
    newArrival: (b.newArrival ?? existing.new_arrival) ? 1 : 0,
  });
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json({ product: rowToProduct(row) });
});

// Only Super Admin and Admin/Manager may delete (section 17-19 leaves this out of Staff's list).
router.delete('/:id', requireAdmin('super', 'manager'), (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Product not found.' });
  res.status(204).end();
});

module.exports = router;
