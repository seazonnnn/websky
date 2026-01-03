const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { runQuery, getOne, getAll } = require('../database/init');

// Register page
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile('register.html', { root: './public' });
});

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile('login.html', { root: './public' });
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, playerType } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (username.length < 3 || username.length > 16) {
      return res.status(400).json({ error: 'Username must be 3-16 characters' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email exists
    const existingEmail = getOne('SELECT * FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if username exists
    const existingUser = getOne('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    runQuery(
      'INSERT INTO users (email, password, username, player_type) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, username, playerType || 'java']
    );
    
    // Get the created user
    const user = getOne('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(500).json({ error: 'Failed to create account' });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      playerType: user.player_type,
      balance: user.balance
    };

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = getOne('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set session duration based on remember me
    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    } else {
      req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 day
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      playerType: user.player_type,
      balance: user.balance
    };

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  const user = getOne('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
  if (user) {
    req.session.user.balance = user.balance;
  }
  
  res.json({ user: req.session.user });
});

module.exports = router;
