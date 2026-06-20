# Stryktipset Tracker

Group betting tracker for Stryktipset. Fetches live draws from Svenska Spel, tracks picks via bet URLs, and auto-corrects results.

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your local Postgres URL and secrets

# 3. Run local Postgres (if you don't have one)
docker run -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=stryktipset -p 5432:5432 postgres

# 4. Start dev server
npm run dev
```

## Deploy to Railway

### 1. Create GitHub repo
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/stryktipset.git
git push -u origin main
```

### 2. Set up Railway
1. Go to https://railway.app and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your repo
4. Click **Add Plugin → PostgreSQL** (Railway auto-sets DATABASE_URL)

### 3. Set environment variables in Railway dashboard
Go to your service → **Variables** and add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | any long random string (e.g. from https://generate-secret.now.sh/64) |
| `ADMIN_CODE` | the secret code your 4 friends will use |
| `NODE_ENV` | `production` |

Railway sets `PORT` and `DATABASE_URL` automatically.

### 4. Deploy
Railway deploys automatically on every push to main. Your site will be live at `https://yourapp.up.railway.app`.

## How it works

### Adding a bet
1. Place your bet on spela.se as normal
2. Copy the URL from the confirmation page (looks like `https://spela.svenskaspel.se/stryktipset/kupong?...signs=...`)
3. In the app, click **+ Lägg till kupong**, paste the URL → picks are auto-parsed
4. Save — the draw info (week/year) is fetched automatically from Svenska Spel's API

### Getting results
- Once games are played, click **🔄 Hämta resultat** on any bet
- The app fetches the draw from Svenska Spel, derives 1/X/2 from scores, and marks each pick correct/wrong
- Works for live games too (shows current score/outcome in real time)

### Auth
- Anyone can visit the site and see all bets, results, and the leaderboard
- Admin actions (add bets, sync results, manage players) require the `ADMIN_CODE`
- Admin sessions last 30 days

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/draws/current` | Public | Current Stryktipset draw |
| GET | `/api/draws/:number` | Public | Specific draw |
| GET | `/api/bets?year=2025` | Public | All bets, optionally filtered by year |
| POST | `/api/bets` | Admin | Add a bet (paste URL or manual picks) |
| POST | `/api/bets/:id/sync-results` | Admin | Auto-correct from Svenska Spel API |
| PUT | `/api/bets/:id` | Admin | Update winnings |
| DELETE | `/api/bets/:id` | Admin | Delete a bet |
| GET | `/api/players` | Public | List players |
| POST | `/api/players` | Admin | Add player |
| DELETE | `/api/players/:id` | Admin | Remove player |
| POST | `/api/auth/login` | Public | Get admin token |
| GET | `/api/auth/me` | Public | Check current role |
