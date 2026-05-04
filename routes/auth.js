const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDatabase } = require('../database/init');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const db = getDatabase();
  try {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const admin = db.prepare('SELECT * FROM admins WHERE email = ? AND password = ?').get(email, hash);

    if (!admin) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO admin_sessions (admin_id, token) VALUES (?, ?)').run(admin.id, token);

    res.json({ success: true, token });
  } finally {
    db.close();
  }
});

// GET /api/auth/check
router.get('/check', (req, res) => {
  const token = req.headers['x-admin-token'];

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  const db = getDatabase();
  try {
    const session = db.prepare(
      "SELECT s.*, a.email FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token = ? AND s.created_at > datetime('now', '-24 hours')"
    ).get(token);

    if (!session) {
      return res.status(401).json({ authenticated: false });
    }

    res.json({ authenticated: true, email: session.email });
  } finally {
    db.close();
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.headers['x-admin-token'];

  if (token) {
    const db = getDatabase();
    try {
      db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    } finally {
      db.close();
    }
  }

  res.json({ success: true });
});

module.exports = router;
