# Deploying Kiln Controller to Railway

## What you need
- A free account at https://github.com (to store the code)
- A free account at https://railway.app (to host it)
- Node.js + npm on your computer (to build the React frontend once)

---

## Step 1 — Build the React frontend

On your computer, inside the `kiln-ui/` folder:

```bash
npm install
npm run build
```

This compiles React into plain HTML/JS and copies it into `kiln/static/`.
You only need to do this once (or whenever you change the frontend).

---

## Step 2 — Push to GitHub

```bash
cd kiln/
git init
git add .
git commit -m "Initial commit"
```

Then create a new repo on github.com and follow the instructions to push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/kiln-controller.git
git push -u origin main
```

---

## Step 3 — Deploy on Railway

1. Go to https://railway.app and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your `kiln-controller` repo
4. Railway detects Python automatically and starts building

**Add a database:**
5. In your project, click **+ New** → **Database** → **Add PostgreSQL**
6. Railway automatically sets the `DATABASE_URL` environment variable —
   the app reads this and connects to Postgres. Nothing else to configure.

**That's it.** Railway gives you a public URL like:
`https://kiln-controller-production.up.railway.app`

---

## Step 4 — Share the URL

Send that URL to anyone — it works on any device, no installation needed.

---

## Updating the app later

```bash
# Make your changes, then:
cd kiln-ui && npm run build   # rebuild frontend if you changed it
cd ../kiln
git add .
git commit -m "Update"
git push
```

Railway auto-redeploys on every push.

---

## Local development (on your own computer)

Run the backend:
```bash
cd kiln/
pip install -r requirements.txt
uvicorn main:app --reload
# → API running at http://localhost:8000
```

Run the frontend (in a separate terminal):
```bash
cd kiln-ui/
npm install
npm run dev
# → UI running at http://localhost:5173
```

Open http://localhost:5173 in your browser.
The frontend automatically proxies `/api` calls to the backend on port 8000.
