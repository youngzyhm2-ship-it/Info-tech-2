const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET is not set — copy .env.example to .env and set a real secret before starting the server.');
}

function signToken(payload) {
  // payload: { sub, type: 'customer'|'admin', role? }
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

/** Reads a Bearer token if present and attaches req.user; never rejects by itself.
 *  Use this on routes that behave differently for guests vs logged-in users
 *  (e.g. logging an enquiry, where guests are still allowed). */
function attachUserIfPresent(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch (_e) { /* ignore bad/expired token */ }
  }
  next();
}

/** Rejects unless a valid customer token is present. */
function requireCustomer(req, res, next) {
  attachUserIfPresent(req, res, () => {
    if (!req.user || req.user.type !== 'customer') {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    next();
  });
}

/** Rejects unless a valid admin token is present, optionally restricted to specific roles.
 *  requireAdmin() alone = any admin tier. requireAdmin('super') = Super Admin only.
 *  requireAdmin('super','manager') = Super Admin or Admin/Manager. */
function requireAdmin(...allowedRoles) {
  return (req, res, next) => {
    attachUserIfPresent(req, res, () => {
      if (!req.user || req.user.type !== 'admin') {
        return res.status(401).json({ error: 'Admin sign-in required.' });
      }
      if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Your admin role does not have access to this.' });
      }
      next();
    });
  };
}

module.exports = { signToken, attachUserIfPresent, requireCustomer, requireAdmin };
