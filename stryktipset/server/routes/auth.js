const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware - attaches user to req if valid token present, but doesn't block
function attachUser(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    } catch (_) {}
  }
  next();
}

// Middleware - blocks if not admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  if (code === process.env.ADMIN_CODE) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, role: 'admin' });
  }

  res.status(401).json({ error: 'Invalid code' });
});

// GET /api/auth/me - check current token
router.get('/me', attachUser, (req, res) => {
  if (!req.user) return res.json({ role: 'viewer' });
  res.json({ role: req.user.role });
});

module.exports = { router, attachUser, requireAdmin };
