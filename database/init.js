const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'store.db');

let db = null;

async function getDb() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initialize() {
  const database = await getDb();
  
  // Categories table
  database.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    )
  `);
  
  // Users table
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      player_type TEXT DEFAULT 'java',
      balance REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  database.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      on_sale INTEGER DEFAULT 0,
      image_url TEXT,
      minecraft_command TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Orders table
  database.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      command_executed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table
  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Cart table
  database.run(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1
    )
  `);

  // Promo codes table
  database.run(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL,
      max_uses INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      expires_at DATETIME,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Leaderboard stats table
  database.run(`
    CREATE TABLE IF NOT EXISTS player_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      money REAL DEFAULT 0,
      kills INTEGER DEFAULT 0,
      deaths INTEGER DEFAULT 0,
      playtime INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Staff applications table
  database.run(`
    CREATE TABLE IF NOT EXISTS staff_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ign TEXT NOT NULL,
      age INTEGER NOT NULL,
      discord TEXT NOT NULL,
      rank TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize default categories
  const defaultCategories = [
    ['Keys', 'keys', 1],
    ['Crates', 'crates', 2],
    ['Ranks', 'ranks', 3]
  ];
  
  defaultCategories.forEach(([name, slug, order]) => {
    database.run('INSERT OR IGNORE INTO categories (name, slug, display_order) VALUES (?, ?, ?)', [name, slug, order]);
  });

  // Initialize default settings
  const defaultSettings = [
    ['sale_active', '1'],
    ['sale_text', '30% OFF WINTER SALE'],
    ['sale_percentage', '30'],
    ['server_ip', 'skybattle.fun'],
    ['discord_link', 'https://discord.gg/3BhxMG4P4n'],
    ['discord_webhook', ''],
    ['payment_goal', '100'],
    ['payment_goal_current', '0'],
    ['payment_goal_text', 'Monthly Server Costs'],
    // Home page settings
    ['server_name', 'SkyBattle'],
    ['server_tagline', 'NETWORK'],
    ['hero_badge', 'SEASON 1 LIVE'],
    ['hero_title', 'WELCOME TO'],
    ['hero_subtitle', 'SKYBATTLE'],
    ['hero_description', 'The ultimate competitive PvP network. Experience custom rankings, clan wars, and optimized gameplay.'],
    ['owner_username', 'Seazonn_'],
    ['owner_quote', 'I created SkyBattle to bring the most competitive and optimized PvP experience to the community.'],
    ['staff_apply_link', ''],
    ['media_rank_link', ''],
    ['gamemodes', '[{"name":"Economy","icon":"coins"},{"name":"SwordPvP","icon":"sword"},{"name":"CrystalPvP","icon":"gem"},{"name":"BoxPvP","icon":"box"},{"name":"Lifesteal","icon":"heart"}]'],
    ['team_members', '[{"username":"Seazonn_","role":"FOUNDER"},{"username":"Weekness_xD","role":"OWNER"},{"username":"heroic","role":"OWNER"},{"username":"Taym12345","role":"MOD"},{"username":"yourdeatherror","role":"MOD"},{"username":"JKPthelegend","role":"HELPER"},{"username":"Yeager","role":"HELPER"},{"username":"missosaurus4","role":"HELPER"},{"username":"nepplayz","role":"HELPER"}]'],
    ['rules_client', '["No Hack Clients","No Movement Mods","No Itemscroller / Mouse Tweaks","No Radar / Minimap","No ESP (Any type)","No Freecam / ReplayMod","No Accurate Block Placement","No Macros / Auto Clickers","No Crystal Optimizers","No X-Ray"]'],
    ['rules_server', '["No IRL / Cross-Trading","No Hacking / Cheating","No Bug Exploits","No Doxxing","No Spamming","No NSFW Content","No Abusive Language","No Advertisements","No Death Threats","No Impersonation"]'],
    ['rules_discord', '["Be Respectful","No Spam or Drama","Keep It Clean (No NSFW)","Use Channels Correctly","No Self-Promotion","Respect Staff Members","Use Tickets for Support","Follow Discord TOS","No Trolling Staff"]'],
    ['staff_webhook', '']
  ];

  defaultSettings.forEach(([key, value]) => {
    database.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  });

  saveDb();
  console.log('Database initialized successfully');
}

function runQuery(sql, params = []) {
  const database = db;
  database.run(sql, params);
  saveDb();
  return { lastInsertRowid: database.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
}

function getOne(sql, params = []) {
  const database = db;
  const stmt = database.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function getAll(sql, params = []) {
  const database = db;
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

module.exports = { initialize, getDb, saveDb, runQuery, getOne, getAll };
