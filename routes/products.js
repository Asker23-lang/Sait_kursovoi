const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// GET /api/products/slides — public slides
router.get('/slides', (req, res) => {
  const db = getDatabase();
  try {
    const slides = db.prepare('SELECT * FROM slides ORDER BY sort_order ASC, id ASC').all();
    res.json(slides);
  } finally {
    db.close();
  }
});

// GET /api/products — list all products
router.get('/', (req, res) => {
  const db = getDatabase();
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    const parsed = products.map(p => ({
      ...p,
      sizes: JSON.parse(p.sizes),
      tags: JSON.parse(p.tags),
    }));
    res.json(parsed);
  } finally {
    db.close();
  }
});

// GET /api/products/:id — get single product
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Неверный ID' });

  const db = getDatabase();
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    res.json({
      ...product,
      sizes: JSON.parse(product.sizes),
      tags: JSON.parse(product.tags),
    });
  } finally {
    db.close();
  }
});

module.exports = router;
