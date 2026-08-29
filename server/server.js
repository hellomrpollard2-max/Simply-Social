// ============================================================
// SIMPLE — API server (zero-dependency, Node built-in http)
// Handles: auth, feed, posts, video, comments, likes, follow,
// groups, DMs, creator analytics & monetization.
// Created by Daniel Pollard.
// ============================================================
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

const { store, persist, uid, hash } = db;
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(body);
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, handle: u.handle, displayName: u.displayName, bio: u.bio,
    verified: u.verified, role: u.role, followers: u.followers,
    avatar: u.avatar, joinedAt: u.joinedAt,
  };
}

function auth(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  const sid = store.sessionTokens[token];
  if (!sid) return null;
  return store.users.find((u) => u.id === sid.userId) || null;
}

function makeToken() { return crypto.randomBytes(24).toString("hex"); }

function withUser(payload) {
  const author = store.users.find((u) => u.id === payload.authorId || u.id === payload.author);
  return { ...payload, author: publicUser(author) || publicUser({ id: payload.authorId || payload.author, displayName: "Unknown" }) };
}

// ---------------- Routes ----------------
async function api(req, res, pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const base = parts[0] || "";
  const method = req.method;

  // ---- AUTH ----
  if (base === "auth" && method === "POST") {
    const body = await readBody(req);
    if (parts[1] === "login") {
      const u = store.users.find((x) => x.email === body.email);
      if (!u || u.passwordHash !== hash(body.password)) return json(res, 401, { error: "Invalid email or password." });
      const token = makeToken();
      store.sessionTokens[token] = { userId: u.id, at: Date.now() };
      persist();
      return json(res, 200, { token, user: publicUser(u) });
    }
    if (parts[1] === "register") {
      if (store.users.some((x) => x.email === body.email)) return json(res, 409, { error: "Email already registered." });
      const u = {
        id: uid("u"), handle: body.handle || "user_" + Math.floor(Math.random() * 100000),
        displayName: body.displayName || body.handle, email: body.email,
        passwordHash: hash(body.password), bio: body.bio || "", verified: false,
        role: "user", followers: 0, following: 0, joinedAt: Date.now(),
      };
      store.users.push(u);
      const token = makeToken();
      store.sessionTokens[token] = { userId: u.id, at: Date.now() };
      persist();
      return json(res, 201, { token, user: publicUser(u) });
    }
  }

  // ---- require auth below ----
  const me = auth(req);
  if (base === "me" && method === "GET") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    return json(res, 200, publicUser(me));
  }

  // ---- FEED ----
  if (base === "feed" && method === "GET") {
    const items = store.posts
      .filter((p) => !p.hidden)
      .map(withUser)
      .sort((a, b) => (b.trending || 0) - (a.trending || 0) || (b.createdAt - a.createdAt));
    return json(res, 200, { items });
  }

  // ---- POSTS (nested actions first: like/comment on /posts/:id/:action) ----
  const postId = parts[1];
  if (base === "posts" && postId && parts[2]) {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    const p = store.posts.find((x) => x.id === postId);
    if (!p) return json(res, 404, { error: "Post not found" });
    const sub = parts[2];
    if (sub === "like" && method === "POST") { p.likes++; persist(); return json(res, 200, { likes: p.likes }); }
    if (sub === "comment" && method === "POST") {
      const body = await readBody(req);
      p.comments.push({ id: uid("c"), author: me.id, authorName: me.displayName, text: body.text, likes: 0, createdAt: Date.now() });
      if (p.authorId !== me.id) {
        store.notifications.push({ id: uid("n"), userId: p.authorId, type: "comment", text: me.displayName + " commented on your post.", actor: me.id, at: Date.now(), read: false });
      }
      persist();
      return json(res, 201, p.comments);
    }
    if (sub === "report" && method === "POST") {
      const body = await readBody(req);
      store.reports = store.reports || [];
      store.reports.push({ id: uid("r"), postId: p.id, reporterId: me.id, reason: body.reason || "Reported", at: Date.now(), resolved: false });
      p.reported = true;
      persist();
      return json(res, 201, { reported: true });
    }
  }

  // ---- POSTS (create) ----
  if (base === "posts" && method === "POST") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    const body = await readBody(req);
    const p = {
      id: uid("p"), authorId: me.id, type: body.type || "text",
      body: body.body || "", title: body.title, caption: body.caption,
      videoUrl: body.videoUrl, duration: body.duration, poll: body.poll,
      createdAt: Date.now(), likes: 0, comments: [], shares: 0, views: 0, trending: 0, monetized: !!body.monetized,
    };
    store.posts.push(p);
    persist();
    return json(res, 201, withUser(p));
  }

  // ---- USERS / FOLLOW ----
  if (base === "users") {
    if (method === "GET") {
      const list = store.users.map(publicUser);
      return json(res, 200, { users: list });
    }
    if (parts[1] === "follow" && method === "POST") {
      if (!me) return json(res, 401, { error: "Not authenticated" });
      const body = await readBody(req);
      const target = store.users.find((x) => x.id === body.userId);
      if (target) { target.followers++; me.following++; store.notifications.push({ id: uid("n"), userId: target.id, type: "follow", text: me.displayName + " is now following you.", actor: me.id, at: Date.now(), read: false }); persist(); }
      return json(res, 200, { followers: target ? target.followers : me.followers });
    }
  }

  // ---- GROUPS ----
  if (base === "groups") {
    if (method === "GET") {
      return json(res, 200, { groups: store.groups.map((g) => ({ ...g, posts: g.posts.map((x) => ({ ...x, authorName: (store.users.find(u => u.id === x.author) || {}).displayName })) })) });
    }
    if (method === "POST") {
      if (!me) return json(res, 401, { error: "Not authenticated" });
      const body = await readBody(req);
      const g = { id: uid("g"), name: body.name, description: body.description || "", members: [me.id], posts: [], createdAt: Date.now() };
      store.groups.push(g); persist();
      return json(res, 201, g);
    }
  }

  // ---- MESSAGES ----
  if (base === "messages") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    if (method === "GET") {
      const conv = store.messages.filter((m) => m.from === me.id || m.to === me.id)
        .map((m) => ({ ...m, fromName: (store.users.find(u => u.id === m.from) || {}).displayName }));
      return json(res, 200, { messages: conv });
    }
    if (method === "POST") {
      const body = await readBody(req);
      store.messages.push({ id: uid("m"), from: me.id, to: body.to, text: body.text, at: Date.now(), read: false });
      persist();
      return json(res, 201, { ok: true });
    }
  }

  // ---- CREATOR DASHBOARD ----
  if (base === "creator") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    return json(res, 200, {
      analytics: me.analytics || {
        profileViews: 0, engagementRate: 0, avgWatchSeconds: 0,
        totalEarnings: 0, reach30d: 0,
      },
      monetization: me.monetization || { payoutsTotal: 0, nextPayoutDue: null },
    });
  }

  // ---- AUTO AUCTIONS (marketplace) ----
  const auctionId = parts[1];
  if (base === "auctions" && auctionId && parts[2] === "bid" && method === "POST") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    const a = store.auctions.find((x) => x.id === auctionId);
    if (!a) return json(res, 404, { error: "Auction not found" });
    const b = await readBody(req);
    const amt = Number(b.amount);
    if (!amt || amt <= (a.currentBid || 0)) return json(res, 400, { error: "Bid must exceed the current bid" });
    a.bids.push({ bidder: me.id, amount: amt, at: Date.now() });
    a.currentBid = amt; a.bidCount++; persist();
    if (a.sellerId !== me.id) store.notifications.push({ id: uid("n"), userId: a.sellerId, type: "bid", text: me.displayName + " placed a bid of $" + amt + " on " + a.title, actor: me.id, at: Date.now(), read: false });
    return json(res, 200, { currentBid: a.currentBid, bidCount: a.bidCount });
  }
  if (base === "auctions") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    if (method === "GET") {
      const list = store.auctions.map((a) => ({
        ...a,
        sellerName: (store.users.find((u) => u.id === a.sellerId) || {}).displayName || "Unknown",
        endsIn: a.endsAt - Date.now(),
      }));
      return json(res, 200, { auctions: list });
    }
    if (method === "POST") {
      const b = await readBody(req);
      const a = {
        id: uid("a"), sellerId: me.id, title: b.title, make: b.make, model: b.model,
        year: b.year, mileage: b.mileage, condition: b.condition || "—", image: b.image || null,
        description: b.description || "", startPrice: Number(b.startPrice) || 0,
        currentBid: Number(b.startPrice) || 0, bidCount: 0, bids: [],
        endsAt: Date.now() + (Number(b.days) || 3) * 86400000, status: "active",
      };
      store.auctions.push(a); persist();
      return json(res, 201, a);
    }
  }

  // ---- JOBS & HIRING — apply must precede the base POST ----
  const jobId = parts[1];
  if (base === "jobs" && jobId && parts[2] === "apply" && method === "POST") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    const j = store.jobs.find((x) => x.id === jobId);
    if (!j) return json(res, 404, { error: "Job not found" });
    const b = await readBody(req);
    if (j.applications.some((x) => x.userId === me.id)) return json(res, 400, { error: "Already applied" });
    j.applications.push({ userId: me.id, name: me.displayName, message: b.message || "", at: Date.now() });
    if (j.employerId !== me.id) store.notifications.push({ id: uid("n"), userId: j.employerId, type: "job", text: me.displayName + " applied to " + j.title, actor: me.id, at: Date.now(), read: false });
    persist();
    return json(res, 200, { applied: true, applications: j.applications.length });
  }
  if (base === "jobs") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    if (method === "GET") {
      const list = store.jobs.filter((j) => j.active).map((j) => ({
        ...j,
        employerName: (store.users.find((u) => u.id === j.employerId) || {}).displayName || "Unknown",
        applications: j.applications.length,
      }));
      return json(res, 200, { jobs: list });
    }
    if (method === "POST") {
      const b = await readBody(req);
      const j = {
        id: uid("j"), employerId: me.id, title: b.title, company: b.company || me.displayName,
        location: b.location || "Remote", experience: b.experience || "Any", type: b.type || "Full-time",
        salary: b.salary || "", category: b.category || "General", description: b.description || "",
        postedAt: Date.now(), applications: [], active: true,
      };
      store.jobs.push(j); persist();
      return json(res, 201, j);
    }
  }

  // ---- MENTAL HEALTH & WELLNESS ----
  if (base === "wellness") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    if (method === "GET" && parts[1] === "resources") {
      return json(res, 200, { resources: store.wellness.resources });
    }
    if (parts[1] === "checkin" && method === "POST") {
      const b = await readBody(req);
      const w = { id: uid("w"), userId: me.id, mood: b.mood, note: b.note || "", at: Date.now() };
      store.wellness.checkIns.push(w); persist();
      return json(res, 201, w);
    }
    if (method === "GET" && parts[1] === "checkins") {
      return json(res, 200, { checkIns: store.wellness.checkIns.filter((x) => x.userId === me.id) });
    }
  }

  // ---- NOTIFICATIONS ----
  if (base === "notifications") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    if (method === "GET") {
      const list = store.notifications.filter((n) => n.userId === me.id)
        .map((n) => ({ ...n, actorName: (store.users.find((u) => u.id === n.actor) || {}).displayName || "Someone" }))
        .sort((a, b) => b.at - a.at);
      const unread = list.filter((n) => !n.read).length;
      return json(res, 200, { notifications: list, unread });
    }
    if (parts[1] === "read" && method === "POST") {
      store.notifications.forEach((n) => { if (n.userId === me.id) n.read = true; });
      persist();
      return json(res, 200, { unread: 0 });
    }
  }

  // ---- SETTINGS ----
  if (base === "settings") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    const defaults = { privacy: { publicProfile: true, showOnline: true }, notifications: { likes: true, comments: true, follows: true, bids: true, applications: true }, appearance: { theme: "dark" } };
    if (method === "GET") {
      me.settings = me.settings || defaults;
      return json(res, 200, { settings: me.settings });
    }
    if (method === "PUT") {
      const b = await readBody(req);
      const cur = me.settings || defaults;
      me.settings = {
        privacy: { ...cur.privacy, ...(b.privacy || {}) },
        notifications: { ...cur.notifications, ...(b.notifications || {}) },
        appearance: { ...cur.appearance, ...(b.appearance || {}) },
      };
      if (b.displayName) me.displayName = b.displayName;
      if (b.bio !== undefined) me.bio = b.bio;
      persist();
      return json(res, 200, { settings: me.settings, user: publicUser(me) });
    }
  }

  // ---- PAYMENTS / PAYOUTS (Stripe test-mode, configurable via STRIPE_SECRET_KEY) ----
  if (base === "payments") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    const SK = process.env.STRIPE_SECRET_KEY;
    if (method === "GET") {
      return json(res, 200, {
        mode: SK ? "stripe" : "sandbox",
        balance: (me.analytics && me.analytics.totalEarnings) || (me.monetization && me.monetization.payoutsTotal) || 0,
        payouts: (me.monetization && me.monetization.payoutsTotal) || 0,
        note: SK ? "Connected to Stripe (test mode)." : "No STRIPE_SECRET_KEY set — running in sandbox. Add it to enable real payments.",
      });
    }
    if (parts[1] === "checkout" && method === "POST") {
      const b = await readBody(req);
      const amount = Math.round(Number(b.amount) || 0);
      if (amount <= 0) return json(res, 400, { error: "Amount must be positive" });
      if (SK) {
        try {
          const r = await fetch("https://api.stripe.com/v1/payment_intents", {
            method: "POST",
            headers: { "Authorization": "Bearer " + SK, "Content-Type": "application/x-www-form-urlencoded" },
            body: "amount=" + (amount * 100) + "&currency=usd&automatic_payment_methods[enabled]=true",
          });
          const d = await r.json();
          return json(res, r.ok ? 200 : 402, { mode: "stripe", clientSecret: d.client_secret, id: d.id, status: d.status, amount });
        } catch (e) { return json(res, 500, { error: "Stripe call failed: " + e.message }); }
      }
      return json(res, 200, { mode: "sandbox", clientSecret: "mock_secret_" + uid("pi"), id: uid("pi"), status: "requires_payment_method", amount });
    }
    if (parts[1] === "payout" && method === "POST") {
      const b = await readBody(req);
      const amount = Math.round(Number(b.amount) || 0);
      me.monetization = me.monetization || { payoutsTotal: 0 };
      me.monetization.payoutsTotal = (me.monetization.payoutsTotal || 0) - amount;
      persist();
      return json(res, 200, { mode: SK ? "stripe" : "sandbox", amount, status: "pending", message: "Payout requested. In production this creates a Stripe Transfer to your connected account." });
    }
  }

  // ---- LIVE VIDEO ----
  if (base === "live") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    if (method === "GET") {
      const list = store.live.filter((l) => l.live).map((l) => ({
        ...l,
        hostName: (store.users.find((u) => u.id === l.hostId) || {}).displayName || "Someone",
        hostHandle: (store.users.find((u) => u.id === l.hostId) || {}).handle || "",
      }));
      return json(res, 200, { live: list });
    }
    if (method === "POST") {
      const b = await readBody(req);
      const l = {
        id: uid("l"), hostId: me.id, title: b.title || "Untitled live",
        videoUrl: b.videoUrl || "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
        viewerCount: 0, startedAt: Date.now(), live: true,
      };
      store.live.push(l); persist();
      return json(res, 201, l);
    }
  }

  // ---- ADMIN / MODERATION ----
  if (base === "admin") {
    if (!me) return json(res, 401, { error: "Not authenticated" });
    if (me.role !== "admin") return json(res, 403, { error: "Admins only" });
    if (parts[1] === "stats" && method === "GET") {
      return json(res, 200, {
        users: store.users.length,
        posts: store.posts.length,
        comments: store.posts.reduce((a, p) => a + (p.comments ? p.comments.length : 0), 0),
        likes: store.posts.reduce((a, p) => a + (p.likes || 0), 0),
        groups: store.groups.length,
        messages: store.messages.length,
        auctions: store.auctions.length,
        jobs: store.jobs.length,
        live: store.live.filter((l) => l.live).length,
        openReports: (store.reports || []).filter((r) => !r.resolved).length,
      });
    }
    if (parts[1] === "users" && method === "GET") {
      return json(res, 200, { users: store.users.map((u) => ({ ...publicUser(u), email: u.email, suspended: !!u.suspended })) });
    }
    if (parts[1] === "users" && parts[2] && parts[3] && method === "POST") {
      const u = store.users.find((x) => x.id === parts[2]);
      if (!u) return json(res, 404, { error: "User not found" });
      u.suspended = parts[3] === "suspend";
      persist();
      return json(res, 200, { id: u.id, suspended: !!u.suspended });
    }
    if (parts[1] === "reports" && method === "GET") {
      const list = (store.reports || []).map((r) => ({
        ...r,
        reporterName: (store.users.find((u) => u.id === r.reporterId) || {}).displayName || "Unknown",
        post: store.posts.find((p) => p.id === r.postId) || null,
      }));
      return json(res, 200, { reports: list });
    }
    if (parts[1] === "reports" && parts[2] && parts[3] === "resolve" && method === "POST") {
      const r = (store.reports || []).find((x) => x.id === parts[2]);
      if (r) r.resolved = true;
      persist();
      return json(res, 200, { resolved: true });
    }
    if (parts[1] === "posts" && parts[2] && parts[3] === "hide" && method === "POST") {
      const p = store.posts.find((x) => x.id === parts[2]);
      if (!p) return json(res, 404, { error: "Post not found" });
      p.hidden = true; persist();
      return json(res, 200, { hidden: true });
    }
  }

  return json(res, 404, { error: "Not found: " + pathname });
}

// ---------------- Static file server ----------------
function serveStatic(req, res, pathname) {
  let p = pathname === "/" ? "/index.html" : pathname;
  p = path.join(PUBLIC, p);
  if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(p).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  if (pathname.startsWith("/api/")) {
    api(req, res, pathname.replace("/api/", "")).catch((e) => json(res, 500, { error: String(e && e.message || e) }));
  } else {
    serveStatic(req, res, pathname);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 SIMPLE running at http://localhost:${PORT}`);
  console.log(`   Created & owned by Daniel Pollard`);
  console.log(`   Demo login: creator@pollard.social / password123`);
  console.log(`   (Ava/Marcus: ava@example.com | marcus@example.com / password1234)\n`);
});

module.exports = server;