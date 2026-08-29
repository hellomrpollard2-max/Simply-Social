# Deploying Simple to the web
*Simple — owned & created by Daniel Pollard. Zero-dependency Node app.*

This app is fully self-contained (Node built-ins only — no `npm install`, no build
step). That makes it trivially deployable. Below are step-by-step guides for
**all three** hosts. Pick one.

---

## 0. Get the code into GitHub (do this once, any provider)

If you haven't already connected GitHub, add it in the **integrations panel**,
then I can push the repo for you. To do it yourself:

```bash
git init
git add -A
git commit -m "Simple — social platform by Daniel Pollard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/simple-social.git
git push -u origin main
```

> `.gitignore` already excludes `node_modules` and `data/store.json` so a fresh
> deploy seeds clean demo data with **Daniel as the admin account**.
> Demo login: `creator@pollard.social` / `password123`

After pushing, deploy with **one** of the options below.

---

## Option A — Railway (fastest, auto-detect)

1. Go to railway.app → **New Project → Deploy from GitHub repo** → pick `simple-social`.
2. Railway reads `package.json` + `railway.json` automatically — no Docker needed.
3. Under **Variables**, add `STRIPE_SECRET_KEY` (your Stripe test key) if you want real payments.
4. Railway assigns you a `*.up.railway.app` URL. Done.

**Persistent data (optional):** Railway keeps the container filesystem per deploy,
but to be safe add a **Volume** mounted at `/app/data`.

---

## Option B — Render (one-click blueprint + free tier)

1. Push the repo to GitHub (above).
2. In `render.yaml`, replace `YOUR_USERNAME` with your GitHub username.
3. In Render: **New → Blueprint → select the repo**. Render reads `render.yaml`
   and auto-creates a Docker web service + a 1GB persistent disk at `/app/data`.
4. Under your service's **Environment**, paste `STRIPE_SECRET_KEY`.
5. You'll get a public URL like `https://simple-social.onrender.com`.

---

## Option C — Fly.io (Dockerfile, free allowance)

```bash
# install the Fly CLI (once):  see fly.io/docs/flyctl
fly launch            # picks up fly.toml + Dockerfile
fly volumes create simple_data --size 1   # once, for persistence
fly secrets set STRIPE_SECRET_KEY=sk_test_...   # optional
fly deploy
fly open
```

Your app is live at `https://simple-social.fly.dev`.

---

## After it's live

- **Custom domain**: add it in your provider's dashboard (CNAME → your subdomain).
- **Admin account**: sign in with `creator@pollard.social` / `password123` — the
  🛡️ Admin panel appears automatically (Daniel is the admin).
- **Real payments**: set `STRIPE_SECRET_KEY` (Stripe test key).
- **Live video**: connect a provider (Stream.io/Mux/Agora) and pass real
  playback URLs to `POST /api/live`.

## How to re-deploy after changes

- **Railway**: push to `main` → auto-deploys.
- **Render**: push to `main` → auto-deploys (enable Auto-Deploy).
- **Fly**: `fly deploy`.

## Rollback / where data lives

All app state is the JSON file at `/app/data/store.json`, mounted to a persistent
volume on Render/Fly (or a Railway volume). Keep that volume and your data survives
redeploys.