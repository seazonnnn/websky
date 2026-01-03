# SkyBattle Store

Minecraft server store for SkyBattle.fun

## Setup

1. Copy `.env.example` to `.env` and fill in your values:
   - `SESSION_SECRET` - Random string for sessions
   - `DISCORD_WEBHOOK_URL` - Your Discord webhook URL
   - `ADMIN_USERNAME` - Admin login username
   - `ADMIN_PASSWORD` - Admin login password
   - `API_KEY` - Key for Minecraft plugin API

2. Install dependencies:
```bash
npm install
```

3. Run locally:
```bash
npm start
```

## Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Set environment variables in Render dashboard
4. Build command: `npm install`
5. Start command: `npm start`

## Admin Panel

Access at `/admin/login` with your admin credentials.

## API for Minecraft Plugin

- `GET /api/pending-commands` - Get pending commands (requires X-API-Key header)
- `POST /api/command-executed/:orderId` - Mark command as executed
