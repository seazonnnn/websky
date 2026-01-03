const express = require('express');
const router = express.Router();
const { runQuery, getOne, getAll } = require('../database/init');

// API Key authentication middleware (for Minecraft plugin)
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// Get pending commands for execution
router.get('/pending-commands', requireApiKey, (req, res) => {
  const orders = getAll(`
    SELECT o.id, o.quantity, u.username, p.name as product_name, p.minecraft_command
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN products p ON o.product_id = p.id
    WHERE o.command_executed = 0 AND o.status = 'completed'
    ORDER BY o.created_at ASC
  `);

  // Format commands with player name
  const commands = orders.map(order => {
    let command = order.minecraft_command || '';
    // Replace {player} placeholder with actual username
    command = command.replace(/{player}/gi, order.username);
    // Replace {quantity} placeholder
    command = command.replace(/{quantity}/gi, order.quantity.toString());
    
    return {
      orderId: order.id,
      player: order.username,
      product: order.product_name,
      command: command,
      quantity: order.quantity
    };
  });

  res.json({ commands });
});

// Mark command as executed
router.post('/command-executed/:orderId', requireApiKey, (req, res) => {
  const { orderId } = req.params;
  
  runQuery('UPDATE orders SET command_executed = 1 WHERE id = ?', [orderId]);
  res.json({ success: true });
});

// Check if player exists
router.get('/player/:username', requireApiKey, (req, res) => {
  const { username } = req.params;
  const user = getOne('SELECT id, username, balance FROM users WHERE username = ?', [username]);
  
  if (user) {
    res.json({ exists: true, user });
  } else {
    res.json({ exists: false });
  }
});

// Get player balance
router.get('/balance/:username', requireApiKey, (req, res) => {
  const { username } = req.params;
  const user = getOne('SELECT balance FROM users WHERE username = ?', [username]);
  
  if (user) {
    res.json({ balance: user.balance });
  } else {
    res.status(404).json({ error: 'Player not found' });
  }
});

// Update player stats (from plugin)
router.post('/stats/update', requireApiKey, (req, res) => {
  const { players } = req.body;
  
  if (!players || !Array.isArray(players)) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  
  for (const player of players) {
    const existing = getOne('SELECT id FROM player_stats WHERE username = ?', [player.username]);
    
    if (existing) {
      runQuery(`
        UPDATE player_stats 
        SET money = ?, kills = ?, deaths = ?, playtime = ?, streak = ?, updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
      `, [player.money || 0, player.kills || 0, player.deaths || 0, player.playtime || 0, player.streak || 0, player.username]);
    } else {
      runQuery(`
        INSERT INTO player_stats (username, money, kills, deaths, playtime, streak)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [player.username, player.money || 0, player.kills || 0, player.deaths || 0, player.playtime || 0, player.streak || 0]);
    }
  }
  
  res.json({ success: true, updated: players.length });
});

// Get leaderboard (public endpoint)
router.get('/leaderboard/:type', (req, res) => {
  const { type } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  let orderBy = 'money';
  switch (type) {
    case 'money': orderBy = 'money DESC'; break;
    case 'kills': orderBy = 'kills DESC'; break;
    case 'deaths': orderBy = 'deaths DESC'; break;
    case 'playtime': orderBy = 'playtime DESC'; break;
    default: orderBy = 'money DESC';
  }
  
  const players = getAll(`
    SELECT username, money, kills, deaths, playtime, streak
    FROM player_stats
    ORDER BY ${orderBy}
    LIMIT ?
  `, [limit]);
  
  res.json({ players, type });
});

// Submit staff application (public endpoint)
router.post('/staff-apply', async (req, res) => {
  const { ign, age, discord, rank, reason } = req.body;
  
  if (!ign || !age || !discord || !rank || !reason) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Save to database
  const result = runQuery(`
    INSERT INTO staff_applications (ign, age, discord, rank, reason)
    VALUES (?, ?, ?, ?, ?)
  `, [ign, age, discord, rank, reason]);
  
  // Send Discord webhook notification
  const settings = getAll('SELECT * FROM settings');
  const settingsObj = {};
  settings.forEach(s => settingsObj[s.key] = s.value);
  
  const webhookUrl = settingsObj.staff_webhook;
  
  if (webhookUrl) {
    try {
      const message = `**New Staff Application**\n\n**IGN:** ${ign}\n**Age:** ${age}\n**Discord:** ${discord}\n**Applying For:** ${rank}\n**Why should we pick you?**\n${reason}`;
      
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      });
    } catch (e) {
      console.log('Webhook error:', e);
    }
  }
  
  res.json({ success: true, id: result.lastInsertRowid });
});

module.exports = router;
