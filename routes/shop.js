const express = require('express');
const router = express.Router();
const { runQuery, getOne, getAll } = require('../database/init');

// Get all products
router.get('/products', (req, res) => {
  const category = req.query.category;
  let products;
  
  if (category && category !== 'all') {
    products = getAll('SELECT * FROM products WHERE active = 1 AND category = ? ORDER BY name', [category]);
  } else {
    products = getAll('SELECT * FROM products WHERE active = 1 ORDER BY category, name');
  }
  
  res.json({ products });
});

// Get categories
router.get('/categories', (req, res) => {
  const categories = getAll('SELECT * FROM categories WHERE active = 1 ORDER BY display_order');
  res.json({ categories });
});

// Get settings
router.get('/settings', (req, res) => {
  const settings = getAll('SELECT * FROM settings');
  const settingsObj = {};
  settings.forEach(s => settingsObj[s.key] = s.value);
  // Don't expose webhook to frontend
  delete settingsObj.discord_webhook;
  res.json({ settings: settingsObj });
});

// Get stats (top supporter, recent purchases, payment goal)
router.get('/stats', (req, res) => {
  // Top supporter this month
  const topSupporter = getOne(`
    SELECT u.username, u.player_type, SUM(o.total_price) as total
    FROM orders o
    JOIN users u ON o.user_id = u.id
    WHERE o.status = 'completed' 
    AND o.created_at >= date('now', 'start of month')
    GROUP BY o.user_id
    ORDER BY total DESC
    LIMIT 1
  `);

  // Recent 5 purchases
  const recentPurchases = getAll(`
    SELECT o.*, u.username, u.player_type, p.name as product_name
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN products p ON o.product_id = p.id
    WHERE o.status = 'completed'
    ORDER BY o.created_at DESC
    LIMIT 5
  `);

  // Payment goal
  const goalSetting = getOne("SELECT value FROM settings WHERE key = 'payment_goal'");
  const currentSetting = getOne("SELECT value FROM settings WHERE key = 'payment_goal_current'");
  const goalTextSetting = getOne("SELECT value FROM settings WHERE key = 'payment_goal_text'");

  res.json({
    topSupporter: topSupporter || null,
    recentPurchases,
    paymentGoal: {
      goal: parseFloat(goalSetting?.value || 100),
      current: parseFloat(currentSetting?.value || 0),
      text: goalTextSetting?.value || 'Monthly Goal'
    }
  });
});

// Add to cart
router.post('/cart/add', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please login first' });
  }

  const { productId, quantity = 1 } = req.body;
  const userId = req.session.user.id;

  const product = getOne('SELECT * FROM products WHERE id = ? AND active = 1', [productId]);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const existing = getOne('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId]);
  
  if (existing) {
    runQuery('UPDATE cart SET quantity = quantity + ? WHERE id = ?', [quantity, existing.id]);
  } else {
    runQuery('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity]);
  }

  res.json({ success: true });
});

// Get cart
router.get('/cart', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please login first' });
  }

  const items = getAll(`
    SELECT c.id, c.quantity, c.product_id, p.name, p.price, p.original_price, p.on_sale, p.image_url
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `, [req.session.user.id]);

  let total = 0;
  items.forEach(item => {
    total += item.price * item.quantity;
  });

  res.json({ items, total });
});

// Update cart quantity
router.post('/cart/update', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please login first' });
  }

  const { cartId, quantity } = req.body;
  
  if (quantity <= 0) {
    runQuery('DELETE FROM cart WHERE id = ? AND user_id = ?', [cartId, req.session.user.id]);
  } else {
    runQuery('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, cartId, req.session.user.id]);
  }

  res.json({ success: true });
});

// Remove from cart
router.post('/cart/remove', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please login first' });
  }

  const { cartId } = req.body;
  runQuery('DELETE FROM cart WHERE id = ? AND user_id = ?', [cartId, req.session.user.id]);
  res.json({ success: true });
});

// Validate promo code
router.post('/promo/validate', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please login first' });
  }

  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Promo code required' });
  }

  const promo = getOne('SELECT * FROM promo_codes WHERE code = ? AND active = 1', [code.toUpperCase()]);
  
  if (!promo) {
    return res.status(400).json({ error: 'Invalid promo code' });
  }

  // Check if expired
  if (promo.expires_at) {
    const expiresAt = new Date(promo.expires_at);
    if (new Date() > expiresAt) {
      return res.status(400).json({ error: 'This promo code has expired' });
    }
  }

  // Check max uses
  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
    return res.status(400).json({ error: 'This promo code has reached its usage limit' });
  }

  res.json({ 
    success: true, 
    discount: promo.discount_percent,
    code: promo.code
  });
});

// Checkout
router.post('/checkout', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please login first' });
  }

  const userId = req.session.user.id;
  const user = getOne('SELECT * FROM users WHERE id = ?', [userId]);
  const { promoCode } = req.body;
  
  const items = getAll(`
    SELECT c.id, c.quantity, c.product_id, p.name, p.price, p.original_price, p.on_sale, p.minecraft_command
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `, [userId]);

  if (items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.price * item.quantity;
  });

  let total = subtotal;
  let discount = 0;
  let appliedPromo = null;

  // Apply promo code if provided
  if (promoCode) {
    const promo = getOne('SELECT * FROM promo_codes WHERE code = ? AND active = 1', [promoCode.toUpperCase()]);
    if (promo) {
      // Check if expired
      if (promo.expires_at) {
        const expiresAt = new Date(promo.expires_at);
        if (new Date() > expiresAt) {
          return res.status(400).json({ error: 'Promo code has expired' });
        }
      }
      // Check max uses
      if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
        return res.status(400).json({ error: 'Promo code usage limit reached' });
      }
      // Apply discount
      discount = subtotal * (promo.discount_percent / 100);
      total = subtotal - discount;
      appliedPromo = promo;
    }
  }

  // Check balance
  if (user.balance < total) {
    const discordLink = getOne("SELECT value FROM settings WHERE key = 'discord_link'");
    return res.status(400).json({ 
      error: 'insufficient_balance',
      message: 'Insufficient balance',
      required: total,
      current: user.balance,
      discordLink: discordLink?.value || 'https://discord.gg/3BhxMG4P4n'
    });
  }

  // Process order
  items.forEach(item => {
    const itemTotal = item.price * item.quantity;
    runQuery(`
      INSERT INTO orders (user_id, product_id, quantity, total_price, status)
      VALUES (?, ?, ?, ?, 'completed')
    `, [userId, item.product_id, item.quantity, itemTotal]);
  });

  // Increment promo code usage
  if (appliedPromo) {
    runQuery('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?', [appliedPromo.id]);
  }

  // Deduct balance and update total spent
  runQuery('UPDATE users SET balance = balance - ?, total_spent = total_spent + ? WHERE id = ?', [total, total, userId]);
  
  // Update payment goal
  runQuery("UPDATE settings SET value = CAST(CAST(value AS REAL) + ? AS TEXT) WHERE key = 'payment_goal_current'", [total]);
  
  // Clear cart
  runQuery('DELETE FROM cart WHERE user_id = ?', [userId]);

  req.session.user.balance = user.balance - total;

  // Send Discord webhook
  try {
    await sendDiscordWebhook(user.username, total, items);
  } catch (err) {
    console.error('Discord webhook error:', err);
  }

  res.json({ 
    success: true, 
    message: 'Purchase successful!',
    newBalance: req.session.user.balance
  });
});

// Discord webhook function
async function sendDiscordWebhook(username, total, items) {
  const webhookSetting = getOne("SELECT value FROM settings WHERE key = 'discord_webhook'");
  const webhookUrl = webhookSetting?.value;
  
  if (!webhookUrl) return;

  const itemsList = items.map(i => `${i.name} ${i.quantity}x`).join(', ');
  
  const payload = {
    content: `SkyBattle has received a payment from ${username} worth $${total.toFixed(2)}! Product: ${itemsList}`
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

module.exports = router;
