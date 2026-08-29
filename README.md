# SIMPLE — Social network owned by its creators
**Created & owned by Daniel Pollard**

A working, zero-dependency social media platform prototype built to outdo the
big platforms by optimizing for the **creator and the community**, not advertisers.

## What's inside

| Path | Purpose |
|------|---------|
| `server/server.js` | HTTP API (Node built-in `http`, no dependencies) |
| `server/db.js` | Zero-dependency JSON data store (auto-seeds demo data) |
| `public/` | Frontend SPA (feed, video, groups, messages, creator studio) |
| `schema.sql` | Production Postgres/SQLite data model |
| `blueprint.md` | Business & feature strategy doc |
| `test.js` | End-to-end API test suite (15 checks) |

## Run it

```bash
npm start          # or: node server/server.js
# open http://localhost:3000
```

### Real payments (optional)
The app runs in **sandbox mode** for payments by default. To enable real
Stripe test payments + payouts, set your key:

```bash
STRIPE_SECRET_KEY=sk_test_... node server/server.js
```

Live video is scaffolded with a sample stream; plug in a provider
(Stream.io / Mux / Agora) by supplying a real playback URL.

## Deploy to the web

Simple is fully self-contained (no npm deps, Node built-ins only), so it runs
on any Node host with zero build steps.

**Option A — Render (one-click):**
1. Push this folder to a GitHub repo.
2. Edit `render.yaml` and set your repo URL, then in Render choose
   **New → Blueprint → this repo**. A web service + persistent disk are created.
3. Open your service → **Environment** and paste your Stripe test key into
   `STRIPE_SECRET_KEY`, then Redeploy.

**Option B — Railway:** push the repo; Railway auto-detects Node from
`package.json` (config in `railway.json`). Add `STRIPE_SECRET_KEY` under Settings.

**Option C — Any Docker host (Fly, VPS):** build the included `Dockerfile`.

A `Dockerfile`, `render.yaml`, `railway.json`, `.dockerignore` and `.env.example`
are included. See `.env.example` for all variables. After deploying, you own a
public URL to share — e.g. `https://simple-social.onrender.com`.

### What still needs a human (not code)
- **Stripe account** (free, no cost) to get your `sk_test_...` key for real
  test-mode payments and later live payouts. Only you can open this.
- **Live-video provider** (Stream.io / Mux / Agora) to replace the sample
  stream with real broadcast + playback.
- **Domain** (optional) — add a custom domain in your host's dashboard.
- **Legal/privacy review** before taking real payments.

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `creator@pollard.social` | `password123` | Creator (Daniel Pollard) |
| `ava@example.com` | `password1234` | User / creator |
| `marcus@example.com` | `password1234` | User |

## Test

```bash
node test.js
```

## How the "outdo the giants" angle works
- **Chronological + transparent feed** — no engagement-maximizing dark patterns.
- **Creators keep 85%** of monetization (industry avg ~30%).
- **Creator Studio** — analytics + earnings dashboard.
- **Auto Marketplace, Jobs & Hiring, Mental Health** — commerce, work, and
  wellbeing built into the social graph.
- **Short-form video, posts, polls, groups, DMs** all in one integrated app.
- See `blueprint.md` for the full strategy and roadmap.