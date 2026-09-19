const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { signToken, requireCustomer, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function newId(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

/* ---------------- Customers ---------------- */

router.post('/register', async (req, res) => {
  const { fullName, email, phone, password } = req.body || {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'fullName, email and password are required.' });
  }
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const id = newId('cus');
  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare(`INSERT INTO customers (id, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)`)
    .run(id, fullName, email.toLowerCase(), phone || null, passwordHash);

  const token = signToken({ sub: id, type: 'customer' });
  res.status(201).json({ token, customer: { id, fullName, email, phone } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare('SELECT * FROM customers WHERE email = ?').get((email || '').toLowerCase());
  if (!row || !(await bcrypt.compare(password || '', row.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = signToken({ sub: row.id, type: 'customer' });
  res.json({ token, customer: { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone } });
});

router.get('/me', requireCustomer, (req, res) => {
  const row = db.prepare('SELECT id, full_name, email, phone, created_at FROM customers WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(404).json({ error: 'Account not found.' });
  res.json({ id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, createdAt: row.created_at });
});

/* ---------------- Admins ----------------
 * There is no public admin self-registration route — Super Admin creates
 * accounts via POST /api/admins (see admins.routes.js). This route is
 * login only. */

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare('SELECT * FROM admins WHERE email = ?').get((email || '').toLowerCase());
  if (!row || !(await bcrypt.compare(password || '', row.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = signToken({ sub: row.id, type: 'admin', role: row.role });
  res.json({ token, admin: { id: row.id, fullName: row.full_name, email: row.email, role: row.role } });
});

router.get('/admin/me', requireAdmin(), (req, res) => {
  const row = db.prepare('SELECT id, full_name, email, role, created_at FROM admins WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(404).json({ error: 'Admin not found.' });
  res.json({ id: row.id, fullName: row.full_name, email: row.email, role: row.role, createdAt: row.created_at });
});

module.exports = router;
