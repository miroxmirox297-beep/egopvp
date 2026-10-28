# EGO PvP — Vortex Edition

This project keeps the original Vortex website layout, glassmorphism, animations, and page structure, rebranded to **EGO PvP** with a red/black theme. The Heists page and navigation entry are removed. A Node.js/Express backend and protected admin dashboard provide product, staff, rules, settings, streamer, application, and purchase-request management.

## Run locally
1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env`.
3. Set `PROJECT_CREATOR_USERNAME`, `PROJECT_CREATOR_PASSWORD` and a long random `SESSION_SECRET`. The first admin account is created automatically at first launch only if `data/accounts.json` does not already exist and the creator password is set.
4. In this folder run `npm install`, then `npm start`.
5. Visit `http://localhost:3000`. Admin dashboard: `http://localhost:3000/admin` (also available at `/admin.html`).

## Discord setup
Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` (for local development: `http://localhost:3000/auth/discord/callback`), and optionally `DISCORD_ADMIN_REDIRECT_URI` (`http://localhost:3000/auth/discord/admin/callback`). For server membership/roles, set `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and `DISCORD_ADMIN_ROLE_ID`. Keep all credentials server-side in `.env`; never place secrets in browser JavaScript.

## Features
- Original Vortex visual design preserved and rebranded to EGO PvP.
- Red/dark visual theme; Heists removed.
- Dynamic shop and staff profiles.
- Staff applications and purchase requests saved to the server data store.
- Admin login with role-based access, overview metrics, Discord user directory/moderation, settings, products, staff, rules, streamer records, submissions, announcements, maintenance mode, accounts and activity logs.
- Discord OAuth login with state validation and persistent directory for users who sign in; optional guild membership lookup when configured. Discord admin login additionally requires `DISCORD_ADMIN_REDIRECT_URI`, `DISCORD_ADMIN_ROLE_ID`, a bot token, and a guild ID; the server verifies the admin role before granting access.
- The staff roster is managed from the admin panel; old hard-coded team members have been removed.
- The former Vortex hero image has been removed and replaced by a native EGO red/black background.
- FiveM live status, online players, verified payment totals, and Discord admin OAuth require external integrations/credentials and are clearly reported as unavailable until configured.
- Persistent JSON data files in `data/`; ensure the host provides persistent disk storage.

## Deploy
Use a Node.js host with persistent disk storage. Set environment variables in the provider dashboard, including a strong session secret and creator password. Configure the Discord OAuth redirect URL to the deployed domain. Use HTTPS in production. Do not commit `.env`, account records, or activity logs.

## Notes
The public site uses the original Vortex HTML/CSS/JS structure. Shop and staff application submissions require the Node server; static-only hosting such as GitHub Pages cannot run this backend or the protected admin panel.
