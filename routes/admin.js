const express = require('express');
const router = express.Router();
const { runQuery, getOne, getAll } = require('../database/init');

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(401).json({ error: 'Admin access required' });
  }
  next();
}

router.get('/login', (req, res) => {
  res.sendFile('admin-login.html', { root: './public' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.get('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin/login');
});

router.get('/', requireAdmin, (req, res) => {
  res.sendFile('admin.html', { root: './public' });
});

// Categories
router.get('/categories', requireAdmin, (req, res) => {
  const categories = getAll('SELECT * FROM categories ORDER BY display_order');
  res.json({ categories });
});

router.post('/categories', requireAdmin, (req, res) => {
  const { name, slug, display_order } = req.body;
  const result = runQuery('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', 
    [name, slug.toLowerCase().replace(/\s+/g, '-'), display_order || 0]);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, slug, display_order, active } = req.body;
  runQuery('UPDATE categories SET name = ?, slug = ?, display_order = ?, active = ? WHERE id = ?',
    [name, slug.toLowerCase().replace(/\s+/g, '-'), display_order || 0, active ? 1 : 0, id]);
  res.json({ success: true });
});

router.delete('/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  runQuery('DELETE FROM categories WHERE id = ?', [id]);
  res.json({ success: true });
});

// Products
router.get('/products', requireAdmin, (req, res) => {
  const products = getAll('SELECT * FROM products ORDER BY category, name');
  res.json({ products });
});

router.post('/products', requireAdmin, (req, res) => {
  const { name, description, category, price, original_price, on_sale, image_url, minecraft_command } = req.body;
  const result = runQuery(`
    INSERT INTO products (name, description, category, price, original_price, on_sale, image_url, minecraft_command)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [name, description, category, price, original_price || null, on_sale ? 1 : 0, image_url, minecraft_command]);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, category, price, original_price, on_sale, image_url, minecraft_command, active } = req.body;
  runQuery(`
    UPDATE products 
    SET name = ?, description = ?, category = ?, price = ?, original_price = ?, 
        on_sale = ?, image_url = ?, minecraft_command = ?, active = ?
    WHERE id = ?
  `, [name, description, category, price, original_price || null, on_sale ? 1 : 0, image_url, minecraft_command, active ? 1 : 0, id]);
  res.json({ success: true });
});

router.delete('/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  runQuery('DELETE FROM products WHERE id = ?', [id]);
  res.json({ success: true });
});

// Users
router.get('/users', requireAdmin, (req, res) => {
  const users = getAll('SELECT id, email, username, player_type, balance, total_spent, created_at FROM users ORDER BY username');
  res.json({ users });
});

router.post('/users/:id/add-balance', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  runQuery('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, id]);
  const user = getOne('SELECT * FROM users WHERE id = ?', [id]);
  res.json({ success: true, newBalance: user.balance });
});

// Orders
router.get('/orders', requireAdmin, (req, res) => {
  const orders = getAll(`
    SELECT o.*, u.username, u.player_type, p.name as product_name, p.minecraft_command
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN products p ON o.product_id = p.id
    ORDER BY o.created_at DESC
  `);
  res.json({ orders });
});

router.post('/orders/:id/executed', requireAdmin, (req, res) => {
  const { id } = req.params;
  runQuery('UPDATE orders SET command_executed = 1 WHERE id = ?', [id]);
  res.json({ success: true });
});

// Settings
router.get('/settings', requireAdmin, (req, res) => {
  const settings = getAll('SELECT * FROM settings');
  const settingsObj = {};
  settings.forEach(s => settingsObj[s.key] = s.value);
  res.json({ settings: settingsObj });
});

router.put('/settings', requireAdmin, (req, res) => {
  const settings = req.body;
  Object.entries(settings).forEach(([key, value]) => {
    runQuery('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  });
  res.json({ success: true });
});

// Sales
router.post('/apply-sale', requireAdmin, (req, res) => {
  const { percentage } = req.body;
  const products = getAll('SELECT * FROM products');
  products.forEach(product => {
    const originalPrice = product.original_price || product.price;
    const salePrice = originalPrice * (1 - percentage / 100);
    runQuery(`UPDATE products SET original_price = ?, price = ?, on_sale = 1 WHERE id = ?`, 
      [originalPrice, Math.round(salePrice * 100) / 100, product.id]);
  });
  res.json({ success: true });
});

router.post('/remove-sales', requireAdmin, (req, res) => {
  const products = getAll('SELECT * FROM products WHERE on_sale = 1');
  products.forEach(product => {
    const originalPrice = product.original_price || product.price;
    runQuery('UPDATE products SET price = ?, on_sale = 0 WHERE id = ?', [originalPrice, product.id]);
  });
  res.json({ success: true });
});

router.post('/reset-payment-goal', requireAdmin, (req, res) => {
  runQuery("UPDATE settings SET value = '0' WHERE key = 'payment_goal_current'");
  res.json({ success: true });
});

// Promo Codes
router.get('/promo-codes', requireAdmin, (req, res) => {
  const promoCodes = getAll('SELECT * FROM promo_codes ORDER BY created_at DESC');
  res.json({ promoCodes });
});

router.post('/promo-codes', requireAdmin, (req, res) => {
  const { code, discount_percent, max_uses, expires_at } = req.body;
  const result = runQuery(
    'INSERT INTO promo_codes (code, discount_percent, max_uses, expires_at) VALUES (?, ?, ?, ?)',
    [code.toUpperCase(), discount_percent, max_uses || 0, expires_at || null]
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/promo-codes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { code, discount_percent, max_uses, expires_at, active } = req.body;
  runQuery(
    'UPDATE promo_codes SET code = ?, discount_percent = ?, max_uses = ?, expires_at = ?, active = ? WHERE id = ?',
    [code.toUpperCase(), discount_percent, max_uses || 0, expires_at || null, active ? 1 : 0, id]
  );
  res.json({ success: true });
});

router.delete('/promo-codes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  runQuery('DELETE FROM promo_codes WHERE id = ?', [id]);
  res.json({ success: true });
});

// Staff Applications
router.get('/staff-applications', requireAdmin, (req, res) => {
  const applications = getAll('SELECT * FROM staff_applications ORDER BY created_at DESC');
  res.json({ applications });
});

router.put('/staff-applications/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status, admin_notes } = req.body;
  runQuery('UPDATE staff_applications SET status = ?, admin_notes = ? WHERE id = ?', [status, admin_notes || '', id]);
  res.json({ success: true });
});

router.delete('/staff-applications/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  runQuery('DELETE FROM staff_applications WHERE id = ?', [id]);
  res.json({ success: true });
});

module.exports = router;
