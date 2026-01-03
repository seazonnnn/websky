require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'skybattle-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days for remember me
  }
}));

// Make session data available to all routes
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAdmin = req.session.isAdmin || false;
  next();
});

// Initialize database then start server
async function start() {
  await db.initialize();
  
  // Routes (loaded after db init)
  const authRoutes = require('./routes/auth');
  const shopRoutes = require('./routes/shop');
  const adminRoutes = require('./routes/admin');
  const apiRoutes = require('./routes/api');
  
  app.use('/auth', authRoutes);
  app.use('/shop', shopRoutes);
  app.use('/admin', adminRoutes);
  app.use('/api', apiRoutes);

  // Home page (SkyBattle landing page) - MUST be before static middleware
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
  });

  // Also accessible at /home
  app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
  });

  // Store page
  app.get('/store', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Leaderboard page
  app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
  });

  // Vote page
  app.get('/vote', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vote.html'));
  });

  // Rules page
  app.get('/rules', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rules.html'));
  });

  // Static files - AFTER route definitions
  app.use(express.static(path.join(__dirname, 'public')));

  app.listen(PORT, () => {
    console.log(`SkyBattle Store running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
  });
}

start().catch(console.error);
