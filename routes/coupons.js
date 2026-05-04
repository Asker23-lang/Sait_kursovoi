const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// POST /api/coupons/validate
router.post('/validate', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Введите код купона' });

  const db = getDatabase();
  try {
    const coupon = db.prepare(`
      SELECT * FROM coupons
      WHERE code = ? AND is_active = 1
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND (usage_limit IS NULL OR used_count < usage_limit)
    `).get(code.toUpperCase());

    if (!coupon) return res.json({ valid: false, error: 'Купон не найден или истёк' });

    const description = coupon.discount_type === 'percent'
      ? `Скидка ${coupon.discount_value}%`
      : `Скидка ${coupon.discount_value} ₸`;

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.discount_type,
        value: coupon.discount_value,
        min_order: coupon.min_order_amount,
        description
      }
    });
  } finally {
    db.close();
  }
});

module.exports = router;
