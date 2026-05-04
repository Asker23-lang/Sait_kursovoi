const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDatabase } = require('../database/init');

// Helper: hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Helper: generate token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware: check user auth
function requireUserAuth(req, res, next) {
  const token = req.headers['x-user-token'];
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const db = getDatabase();
  try {
    const session = db.prepare(`
      SELECT s.*, u.email, u.name, u.phone
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);

    if (!session) {
      return res.status(401).json({ error: 'Сессия истекла' });
    }

    req.user = session;
    next();
  } finally {
    db.close();
  }
}

// POST /api/users/register
router.post('/register', (req, res) => {
  const { email, password, name, phone } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  const db = getDatabase();
  try {
    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Create user
    const hashedPassword = hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (email, password, name, phone) VALUES (?, ?, ?, ?)'
    ).run(email, hashedPassword, name || '', phone || '');

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    db.prepare(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, token, expiresAt);

    res.json({
      success: true,
      token,
      user: { id: result.lastInsertRowid, email, name: name || '', phone: phone || '' }
    });
  } finally {
    db.close();
  }
});

// POST /api/users/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const db = getDatabase();
  try {
    const hashedPassword = hashPassword(password);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, hashedPassword);

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone }
    });
  } finally {
    db.close();
  }
});

// GET /api/users/check
router.get('/check', (req, res) => {
  const token = req.headers['x-user-token'];

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  const db = getDatabase();
  try {
    const session = db.prepare(`
      SELECT s.*, u.email, u.name, u.phone
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);

    if (!session) {
      return res.status(401).json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: { id: session.user_id, email: session.email, name: session.name, phone: session.phone }
    });
  } finally {
    db.close();
  }
});

// POST /api/users/logout
router.post('/logout', (req, res) => {
  const token = req.headers['x-user-token'];

  if (token) {
    const db = getDatabase();
    try {
      db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
    } finally {
      db.close();
    }
  }

  res.json({ success: true });
});

// GET /api/users/profile
router.get('/profile', requireUserAuth, (req, res) => {
  const db = getDatabase();
  try {
    const user = db.prepare('SELECT id, email, name, phone, created_at, last_login FROM users WHERE id = ?').get(req.user.user_id);
    res.json(user);
  } finally {
    db.close();
  }
});

// PUT /api/users/profile
router.put('/profile', requireUserAuth, (req, res) => {
  const { name, phone } = req.body;

  const db = getDatabase();
  try {
    db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name || '', phone || '', req.user.user_id);

    const updated = db.prepare('SELECT id, email, name, phone FROM users WHERE id = ?').get(req.user.user_id);
    res.json(updated);
  } finally {
    db.close();
  }
});

// POST /api/users/favorites/:productId
router.post('/favorites/:productId', requireUserAuth, (req, res) => {
  const productId = parseInt(req.params.productId);

  const db = getDatabase();
  try {
    // Check if product exists
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // Add to favorites
    try {
      db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)').run(req.user.user_id, productId);
      res.json({ success: true, action: 'added' });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        // Already in favorites, remove it
        db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.user.user_id, productId);
        res.json({ success: true, action: 'removed' });
      } else {
        throw err;
      }
    }
  } finally {
    db.close();
  }
});

// GET /api/users/favorites
router.get('/favorites', requireUserAuth, (req, res) => {
  const db = getDatabase();
  try {
    const favorites = db.prepare(`
      SELECT p.*, f.created_at as favorited_at
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(req.user.user_id);

    const parsed = favorites.map(p => ({
      ...p,
      sizes: JSON.parse(p.sizes),
      tags: JSON.parse(p.tags),
    }));

    res.json(parsed);
  } finally {
    db.close();
  }
});

// GET /api/users/orders
router.get('/orders', requireUserAuth, (req, res) => {
  const db = getDatabase();
  try {
    const orders = db.prepare(`
      SELECT o.*, COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_email = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all(req.user.email);

    res.json(orders);
  } finally {
    db.close();
  }
});

// POST /api/users/reviews
router.post('/reviews', requireUserAuth, (req, res) => {
  const { product_id, rating, title, comment } = req.body;

  if (!product_id || !rating || !comment) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Рейтинг должен быть от 1 до 5' });
  }

  const db = getDatabase();
  try {
    // Check if product exists
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // Check if user already reviewed this product
    const existing = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND product_id = ?').get(req.user.user_id, product_id);
    if (existing) {
      return res.status(400).json({ error: 'Вы уже оставили отзыв на этот товар' });
    }

    // Create review
    const result = db.prepare(`
      INSERT INTO reviews (user_id, product_id, rating, title, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.user_id, product_id, rating, title || '', comment);

    res.json({ success: true, id: result.lastInsertRowid });
  } finally {
    db.close();
  }
});

// GET /api/users/reviews/:productId
router.get('/reviews/:productId', (req, res) => {
  const productId = parseInt(req.params.productId);

  const db = getDatabase();
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.name as user_name
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND r.is_moderated = 1
      ORDER BY r.created_at DESC
    `).all(productId);

    // Calculate average rating
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1
      FROM reviews
      WHERE product_id = ? AND is_moderated = 1
    `).get(productId);

    res.json({
      reviews,
      stats: {
        total: stats.total_reviews,
        average: Math.round((stats.avg_rating || 0) * 10) / 10,
        distribution: {
          5: stats.rating_5,
          4: stats.rating_4,
          3: stats.rating_3,
          2: stats.rating_2,
          1: stats.rating_1
        }
      }
    });
  } finally {
    db.close();
  }
});

// GET /api/users/reviews
router.get('/reviews', requireUserAuth, (req, res) => {
  const db = getDatabase();
  try {
    const reviews = db.prepare(`
      SELECT r.*, p.name as product_name, p.image as product_image
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.user_id);

    res.json(reviews);
  } finally {
    db.close();
  }
});

// ===================== CART PERSISTENCE =====================

// POST /api/users/cart
router.post('/cart', requireUserAuth, (req, res) => {
  const { cart } = req.body;

  if (!Array.isArray(cart)) {
    return res.status(400).json({ error: 'Корзина должна быть массивом' });
  }

  const db = getDatabase();
  try {
    // Delete existing cart
    db.prepare('DELETE FROM user_carts WHERE user_id = ?').run(req.user.user_id);

    // Save new cart
    const insert = db.prepare(`
      INSERT INTO user_carts (user_id, product_id, size, quantity, price, product_name, stock_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of cart) {
      insert.run(
        req.user.user_id,
        item.product_id,
        item.size,
        item.quantity,
        item.price,
        item.product_name,
        item.stock_quantity
      );
    }

    res.json({ success: true });
  } finally {
    db.close();
  }
});

// GET /api/users/cart
router.get('/cart', requireUserAuth, (req, res) => {
  const db = getDatabase();
  try {
    const cart = db.prepare(`
      SELECT product_id, size, quantity, price, product_name, stock_quantity
      FROM user_carts
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.user_id);

    res.json({ cart });
  } finally {
    db.close();
  }
});

// ===================== ADDRESSES =====================

// GET /api/users/addresses
router.get('/addresses', requireUserAuth, (req, res) => {
  const db = getDatabase();
  try {
    const addresses = db.prepare(`
      SELECT address, created_at
      FROM user_addresses
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(req.user.user_id);

    res.json(addresses);
  } finally {
    db.close();
  }
});

// POST /api/users/addresses
router.post('/addresses', requireUserAuth, (req, res) => {
  const { address } = req.body;

  if (!address || !address.trim()) {
    return res.status(400).json({ error: 'Адрес обязателен' });
  }

  const db = getDatabase();
  try {
    // Check if address already exists
    const existing = db.prepare('SELECT id FROM user_addresses WHERE user_id = ? AND address = ?')
      .get(req.user.user_id, address.trim());

    if (existing) {
      return res.json({ success: true }); // Already exists, no error
    }

    // Add new address
    db.prepare('INSERT INTO user_addresses (user_id, address) VALUES (?, ?)').run(
      req.user.user_id,
      address.trim()
    );

    res.json({ success: true });
  } finally {
    db.close();
  }
});

// ===================== ORDERS EXTENDED =====================

// POST /api/orders/:id/reorder
router.post('/:id/reorder', (req, res) => {
  const orderId = parseInt(req.params.id);

  const db = getDatabase();
  try {
    const order = db.prepare(`
      SELECT oi.product_id, oi.size, oi.quantity, oi.price, p.name as product_name, p.stock_quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `).all(orderId);

    if (order.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    res.json({ success: true, items: order });
  } finally {
    db.close();
  }
});

module.exports = router;