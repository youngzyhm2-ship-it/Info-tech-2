const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Only Super Admin can view or manage the admin roster (section 17).
router.get('/', requireAdmin('super'), (_req, res) => {
  const rows = db.prepare('SELECT id, full_name, email, role, created_at FROM admins ORDER BY created_at ASC').all();
  res.json({ admins: rows.map(r => ({ id: r.id, fullName: r.full_name, email: r.email, role: r.role, createdAt: r.created_at })) });
});

router.post('/', requireAdmin('super'), async (req, res) => {
  const { fullName, email, password, role } = req.body || {};
  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: 'fullName, email, password and role are required.' });
  }
  if (!['super', 'manager', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'role must be super, manager or staff.' });
  }
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An admin with this email already exists.' });

  const id = `adm_${crypto.randomBytes(8).toString('hex')}`;
  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO admins (id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(id, fullName, email.toLowerCase(), passwordHash, role);
  res.status(201).json({ admin: { id, fullName, email, role } });
});

router.delete('/:id', requireAdmin('super'), (req, res) => {
  const target = db.prepare('SELECT role FROM admins WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Admin not found.' });
  if (target.role === 'super') {
    const superCount = db.prepare(`SELECT COUNT(*) AS n FROM admins WHERE role = 'super'`).get().n;
    if (superCount <= 1) return res.status(409).json({ error: 'Cannot remove the last Super Admin.' });
  }
  db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
