const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');
const { signToken, requireCustomer, requireAdmin } = require('../middleware/auth');
const { sendVerificationEmail } = require('../email');

const router = express.Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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
  const verifyToken = crypto.randomBytes(24).toString('hex');
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO customers (id, full_name, email, phone, password_hash, verify_token, verify_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, fullName, email.toLowerCase(), phone || null, passwordHash, verifyToken, verifyExpires);

  sendVerificationEmail(email, fullName, verifyToken).catch(err => console.warn('verification email failed', err.message));

  const token = signToken({ sub: id, type: 'customer' });
  res.status(201).json({ token, customer: { id, fullName, email, phone, emailVerified: false } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare('SELECT * FROM customers WHERE email = ?').get((email || '').toLowerCase());
  if (!row) return res.status(401).json({ error: 'Incorrect email or password.' });
  if (!row.password_hash) {
    return res.status(401).json({ error: 'This account was created with Google Sign-In — use the Google button instead.' });
  }
  if (!(await bcrypt.compare(password || '', row.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const token = signToken({ sub: row.id, type: 'customer' });
  res.json({ token, customer: { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, emailVerified: !!row.email_verified } });
});

router.get('/me', requireCustomer, (req, res) => {
  const row = db.prepare('SELECT id, full_name, email, phone, email_verified, created_at FROM customers WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(404).json({ error: 'Account not found.' });
  res.json({ id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, emailVerified: !!row.email_verified, createdAt: row.created_at });
});

router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token is required.' });
  const row = db.prepare('SELECT * FROM customers WHERE verify_token = ?').get(token);
  if (!row) return res.status(400).json({ error: 'That verification link is invalid or has already been used.' });
  if (row.verify_expires_at && new Date(row.verify_expires_at) < new Date()) {
    return res.status(400).json({ error: 'That verification link has expired. Request a new one from your account page.' });
  }
  db.prepare('UPDATE customers SET email_verified = 1, verify_token = NULL, verify_expires_at = NULL WHERE id = ?').run(row.id);
  res.json({ ok: true, email: row.email });
});

router.post('/resend-verification', requireCustomer, async (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.user.sub);
  if (!row) return res.status(404).json({ error: 'Account not found.' });
  if (row.email_verified) return res.status(400).json({ error: 'This email is already verified.' });

  const verifyToken = crypto.randomBytes(24).toString('hex');
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE customers SET verify_token = ?, verify_expires_at = ? WHERE id = ?').run(verifyToken, verifyExpires, row.id);

  try {
    const result = await sendVerificationEmail(row.email, row.full_name, verifyToken);
    if (result.skipped) {
      return res.status(503).json({ error: 'Email sending isn\'t set up on this server yet — ask your developer to add a Resend API key.' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ error: 'Could not send the verification email right now. Please try again shortly.' });
  }
});

/** POST /api/auth/google — verifies the Google ID token client-side
 *  received from Google Identity Services, then finds or creates a
 *  matching customer account. Google has already confirmed the email
 *  address, so these accounts are marked verified immediately. */
router.post('/google', async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'Google Sign-In is not configured on this server.' });
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'credential is required.' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    return res.status(401).json({ error: 'Could not verify that Google sign-in — please try again.' });
  }
  if (!payload || !payload.email) return res.status(401).json({ error: 'Google did not return an email address.' });

  const email = payload.email.toLowerCase();
  let row = db.prepare('SELECT * FROM customers WHERE google_id = ? OR email = ?').get(payload.sub, email);

  if (!row) {
    const id = newId('cus');
    db.prepare(`
      INSERT INTO customers (id, full_name, email, google_id, email_verified)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, payload.name || email.split('@')[0], email, payload.sub);
    row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  } else if (!row.google_id) {
    // An account with this email already existed (password-based) — link
    // the Google identity to it and mark it verified rather than making
    // a confusing duplicate account.
    db.prepare('UPDATE customers SET google_id = ?, email_verified = 1 WHERE id = ?').run(payload.sub, row.id);
    row.email_verified = 1;
  }

  const token = signToken({ sub: row.id, type: 'customer' });
  res.json({ token, customer: { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, emailVerified: true } });
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
