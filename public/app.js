// ============================================================
// SIMPLE — frontend SPA. Auth, feed, video, groups, messages,
// creator studio. Talks to /api/*. Owned by Daniel Pollard.
// ============================================================
"use strict";

const $ = (s) => document.querySelector(s);
const SAMPLE_VIDEO = "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4";
const state = { token: localStorage.getItem("simple_token") || null, user: null, view: "feed" };

function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (state.token) headers.Authorization = "Bearer " + state.token;
  return fetch("/api/" + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Request failed");
      return d;
    });
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Render ----------
function mount() {
  const app = $("#app");
  app.innerHTML = "";
  if (!state.token) {
    app.appendChild(document.getElementById("tpl-auth").content.cloneNode(true));
    bindAuth();
    return;
  }
  app.appendChild(document.getElementById("tpl-app").content.cloneNode(true));
  bindApp();
  loadMe();
  refreshNotifBadge();
  navigate("feed");
}

function navigate(view) {
  state.view = view;
  render(view);
}

function bindAuth() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      const login = t.dataset.tab === "login";
      $("#a-name").classList.toggle("hidden", login);
      $("#a-handle").classList.toggle("hidden", login);
    };
  });
  $("#auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const err = $("#auth-err");
    err.textContent = "";
    const tab = document.querySelector(".tab.active").dataset.tab;
    const body = {
      email: $("#a-email").value.trim(),
      password: $("#a-password").value,
      displayName: $("#a-name").value.trim(),
      handle: ($("#a-handle").value.trim() || "").replace(/^@/, ""),
    };
    try {
      const r = await api("auth/" + tab, { method: "POST", body });
      state.token = r.token;
      state.user = r.user;
      localStorage.setItem("simple_token", r.token);
      mount();
    } catch (e) { err.textContent = e.message; }
  };
}

function bindApp() {
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.onclick = () => { state.view = b.dataset.view; navigate(state.view); };
  });
  $("#logout").onclick = () => { state.token = null; localStorage.removeItem("simple_token"); mount(); };
  $("#compose-open").onclick = () => $("#compose").classList.remove("hidden");
  $("#compose-cancel").onclick = () => { $("#compose").classList.add("hidden"); $("#compose-body").value = ""; };
  $("#compose-post").onclick = composePost;
  document.querySelectorAll("[data-legal]").forEach((a) => a.onclick = (e) => { e.preventDefault(); state.legalPage = a.dataset.legal; navigate("legal"); });
  const yr = $("#footer-year"); if (yr) yr.textContent = new Date().getFullYear();
  toggleAdmin(state.user);
  $("#my-name").textContent = state.user.displayName;
  $("#my-handle").textContent = state.user.handle;
  $("#my-avatar").textContent = (state.user.displayName || "?").charAt(0).toUpperCase();
}

function toggleAdmin(u) {
  document.querySelectorAll(".admin-only").forEach((b) => b.classList.toggle("hidden", !(u && u.role === "admin")));
}

async function loadMe() {
  try {
    state.user = await api("me");
    const n = $("#my-name"), a = $("#my-avatar");
    if (n) n.textContent = state.user.displayName;
    if ($("#my-handle")) $("#my-handle").textContent = state.user.handle;
    if (a) a.textContent = (state.user.displayName || "?").charAt(0).toUpperCase();
    toggleAdmin(state.user);
  } catch (e) {}
}

function render(view) {
  const titles = { feed: "Feed", video: "Video", groups: "Groups", marketplace: "Auto Marketplace", jobs: "Jobs & Hiring", wellness: "Mental Health", messages: "Messages", live: "Live", notifications: "Notifications", settings: "Settings", creator: "Creator Studio", admin: "Admin", legal: "Legal" };
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  const vt = $("#view-title"); if (vt) vt.textContent = titles[view] || "Feed";
  const el = $("#view");
  ({ feed: viewFeed, video: viewVideo, groups: viewGroups, messages: viewMessages, creator: viewCreator, marketplace: viewMarketplace, jobs: viewJobs, wellness: viewWellness, live: viewLive, notifications: viewNotifications, settings: viewSettings, admin: viewAdmin, legal: viewLegal })[view](el);
}

// ---------- FEED ----------
function postCard(p) {
  const a = p.author || {};
  const d = new Date(p.createdAt).toLocaleDateString();
  const likesBtn = `<button data-act="like" data-id="${p.id}" class="${p._liked ? "liked" : ""}">❤️ ${fmt(p.likes)}</button>`;
  let media = "";
  if (p.type === "video" && p.videoUrl) media = `<video controls poster="${esc(p.thumbnail || "")}" src="${esc(p.videoUrl)}"></video>`;
  let poll = "";
  if (p.poll) {
    const opts = p.poll.options.map((o, i) => {
      const total = Object.values(p.poll.votes).reduce((x, y) => x + y, 0);
      const v = p.poll.votes[i] || 0, pct = total ? Math.round((v / total) * 100) : 0;
      return `<div class="poll-opt"><span>${esc(o)}</span><span>${v} · ${pct}%</span></div>`;
    }).join("");
    poll = `<div class="poll"><h4>${esc(p.poll.question)}</h4>${opts}</div>`;
  }
  const comments = (p.comments || []).map((c) =>
    `<div class="comment"><b>${esc(c.authorName || c.author || "?")}</b><span>${esc(c.text)}</span></div>`).join("");
  return `<div class="card" data-post="${p.id}">
    <div class="meta">
      <div class="avatar">${esc((a.displayName || "?").charAt(0).toUpperCase())}</div>
      <div>
        <div class="name">${esc(a.displayName || "?")} ${a.verified ? '<span class="verified">✔</span>' : ""}</div>
        <div class="handle">@${esc(a.handle || "")}</div>
      </div>
    </div>
    ${p.title ? `<div class="title">${esc(p.title)}</div>` : ""}
    ${p.body ? `<div class="body">${esc(p.body)}</div>` : ""}
    ${p.caption ? `<div class="body">${esc(p.caption)}</div>` : ""}
    ${media}
    ${poll}
    <div class="actions">
      <button data-act="like" data-id="${p.id}" class="${p._liked ? "liked" : ""}">❤️ ${fmt(p.likes)}</button>
      <button data-act="comment" data-id="${p.id}">💬 ${p.comments ? p.comments.length : 0}</button>
      <button data-act="share" data-id="${p.id}">↗ ${fmt(p.shares || 0)}</button>
      <span>👁 ${fmt(p.views || 0)}</span>
      ${p.monetized ? '<span class="verified">💰 monetized</span>' : ""}
      <button data-act="report" data-id="${p.id}" class="ghost-act">🚩</button>
    </div>
    <div class="comments">${comments}
      <form class="comment-form"><input placeholder="Add a comment..." /><button class="btn small ghost">Send</button></form>
    </div>
  </div>`;
}

async function viewFeed(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api("feed");
  el.innerHTML = d.items.map(postCard).join("") || '<div class="empty">No posts yet. Be the first!</div>';
  bindPostActions(el);
}

function bindPostActions(root) {
  root.querySelectorAll("button[data-act]").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.id, act = b.dataset.act;
      if (act === "like") { try { await api(`posts/${id}/like`, { method: "POST" }); } catch (e) {} viewFeed(root); }
      if (act === "comment") { return; }
      if (act === "share") { await navigator.clipboard.writeText(location.origin + "/#/post/" + id).catch(() => {}); b.textContent = "✓ Copied link"; }
      if (act === "report") { const reason = prompt("Report this post?\nAdd a reason (optional):"); if (reason !== null) { await api(`posts/${id}/report`, { method: "POST", body: { reason } }); b.textContent = "🚩 Reported"; } }
    };
  });
  root.querySelectorAll(".comment-form").forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const input = f.querySelector("input");
      const card = f.closest(".card");
      await api(`posts/${card.dataset.post}/comment`, { method: "POST", body: { text: input.value } });
      input.value = ""; viewFeed();
    };
  });
}

// ---------- VIDEO ----------
async function viewVideo(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api("feed");
  const vids = d.items.filter((p) => p.type === "video");
  if (!vids.length) { el.innerHTML = '<div class="empty">No videos yet.</div>'; return; }
  el.innerHTML = `<div class="video-grid">${vids.map((p) => `
    <div class="video-card">
      <video controls src="${esc(p.videoUrl || SAMPLE_VIDEO)}"></video>
      <div class="v-meta">
        <div class="v-caption">${esc(p.caption || p.title || p.body || "")}</div>
        <div class="v-views">👁 ${fmt(p.views || 0)} · @${esc(p.author.handle || "")}</div>
      </div>
    </div>`).join("")}</div>`;
}

// ---------- GROUPS ----------
async function viewGroups(el) {
  const d = await api("groups");
  const html = d.groups.map((g) => `
    <div class="card group-card">
      <div class="g-name">${esc(g.name)}</div>
      <div class="members">${g.members.length} members · ${esc(g.description || "")}</div>
      ${(g.posts || []).map((p) => `<div class="comment"><b>${esc(p.authorName || "?")}</b><span>${esc(p.text)}</span></div>`).join("")}
    </div>`).join("");
  el.innerHTML = html + `
    <div class="card"><h3>Create a group</h3>
      <form class="comment-form"><input id="g-name" placeholder="Group name" /><button class="btn primary">Create</button></form>
    </div>`;
  const f = el.querySelector("form");
  f.onsubmit = async (e) => {
    e.preventDefault();
    await api("groups", { method: "POST", body: { name: $("#g-name").value } });
    viewGroups(el);
  };
}

// ---------- MESSAGES ----------
async function viewMessages(el) {
  const d = await api("messages");
  const list = d.messages.map((m) =>
    `<div class="msg ${m.from === state.user.id ? "out" : "in"}"><span class="msg-chip">${esc(m.fromName || "?")}</span>${esc(m.text)}</div>`).join("");
  el.innerHTML = `<div class="msg-list">${list || '<div class="empty">No messages yet.</div>'}</div>
    <form class="comment-form" id="dm-form" style="margin-top:14px"><input id="dm-to" placeholder="To: @handle or email" style="max-width:180px"/><input id="dm-text" placeholder="Message..." /><button class="btn primary">Send</button></form>`;
  $("#dm-form").onsubmit = async (e) => {
    e.preventDefault();
    await api("messages", { method: "POST", body: { to: $("#dm-to").value, text: $("#dm-text").value } });
    $("#dm-text").value = ""; viewMessages(el);
  };
}

// ---------- CREATOR STUDIO ----------
async function viewCreator(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api("creator");
  const a = d.analytics, m = d.monetization;
  const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : n);
  el.innerHTML = `
    <div class="payout" style="margin-bottom:18px">
      <div><div class="lbl" style="color:var(--muted);font-size:12px">Lifetime creator earnings</div>
      <div class="amt">$${fmtNum(m.payoutsTotal)}</div></div>
      <button class="btn primary" id="payout">Request payout</button>
    </div>
    <div class="stat-grid">
      <div class="stat"><div class="num">${fmtNum(a.profileViews)}</div><div class="lbl">Profile views</div></div>
      <div class="stat"><div class="num">${(a.engagementRate * 100).toFixed(1)}%</div><div class="lbl">Engagement rate</div></div>
      <div class="stat"><div class="num">${a.avgWatchSeconds}s</div><div class="lbl">Avg watch time</div></div>
      <div class="stat"><div class="num">${fmtNum(a.reach30d)}</div><div class="lbl">30-day reach</div></div>
    </div>
    <div class="card"><h3 style="margin-bottom:10px">Earnings this period</h3>
      <div class="bar"><div style="width:68%"></div></div>
      <div class="handle" style="margin-top:8px">68% of your payout goal this cycle · next payout ${m.nextPayoutDue ? new Date(m.nextPayoutDue).toLocaleDateString() : "—"}</div>
    </div>
    <div class="card"><h3 style="margin-bottom:8px">Your reach by day</h3>
      <div class="bar"><div style="width:100%"></div></div>
    </div>`;
  const b = $("#payout");
  if (b) b.onclick = async () => { b.textContent = "Payout requested ✓"; b.disabled = true; };
}

// ---------- MARKETPLACE (auto auctions) ----------
async function viewMarketplace(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api("auctions");
  const cards = d.auctions.map((a) => {
    const left = Math.max(0, Math.ceil(a.endsInDays = a.endsIn || (a.endsAt - Date.now()) / 86400000));
    const hrs = Math.max(0, Math.ceil(((a.endsAt - Date.now()) % 86400000) / 3600000));
    const bid = (a.currentBid || 0).toLocaleString();
    return `<div class="card">
      <div class="meta"><div class="avatar">🚗</div>
        <div><div class="name">${esc(a.title)}</div>
        <div class="handle">${esc(a.year || "")} ${esc(a.make || "")} ${esc(a.model || "")} · ${esc(a.mileage || 0).toLocaleString()} mi · ${esc(a.condition)}</div></div></div>
      <div class="body">${esc(a.description || "")}</div>
      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><div class="num">$${bid}</div><div class="lbl">Current bid · ${a.bidCount} bids</div></div>
        <div class="stat"><div class="num">${hrs}h</div><div class="lbl">Auction ends</div></div>
        <div class="stat"><div class="num">$${(a.startPrice || 0).toLocaleString()}</div><div class="lbl">Starting price</div></div>
      </div>
      <div class="comment-form" style="margin-top:12px"><input class="bid-input" data-id="${a.id}" type="number" placeholder="Place bid > $${bid}" /><button class="btn primary" data-bid="${a.id}">Bid</button></div>
    </div>`;
  }).join("");
  el.innerHTML = cards + `<div class="card"><h3 style="margin-bottom:12px">List a vehicle for auction</h3>
    <div class="jobform">
      <input id="au-title" placeholder="Title e.g. 2019 Ford Mustang GT" />
      <div class="row2"><input id="au-make" placeholder="Make" /><input id="au-model" placeholder="Model" /><input id="au-year" placeholder="Year" type="number" /></div>
      <div class="row2"><input id="au-miles" placeholder="Mileage" type="number" /><input id="au-start" placeholder="Starting price $" type="number" /><input id="au-days" placeholder="Auction days (3)" type="number" /></div>
      <textarea id="au-desc" placeholder="Condition, history, extras..."></textarea>
      <button class="btn primary" id="au-submit">Start Auction</button>
    </div></div>`;
  el.querySelectorAll("button[data-bid]").forEach((b) => b.onclick = async () => {
    const id = b.dataset.bid;
    const inp = el.querySelector('.bid-input[data-id="' + id + '"]');
    try {
      await api("auctions/" + id + "/bid", { method: "POST", body: { amount: Number(inp.value) } });
      viewMarketplace(el);
    } catch (e) { alert(e.message); }
  });
  $("#au-submit").onclick = async () => {
    await api("auctions", { method: "POST", body: {
      title: $("#au-title").value, make: $("#au-make").value, model: $("#au-model").value,
      year: $("#au-year").value, mileage: $("#au-miles").value, startPrice: $("#au-start").value,
      days: $("#au-days").value || 3, description: $("#au-desc").value,
    }});
    viewMarketplace(el);
  };
}

// ---------- JOBS & HIRING ----------
async function viewJobs(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api("jobs");
  const cards = d.jobs.map((j) => `<div class="card">
      <div class="meta"><div class="avatar">💼</div><div>
        <div class="name">${esc(j.title)} <span class="tag">${esc(j.type)}</span></div>
        <div class="handle">${esc(j.company)} · ${esc(j.location)} · ${esc(j.experience)}</div></div></div>
      <div class="body">${esc(j.description)}</div>
      <div class="actions"><span>💰 ${esc(j.salary || "—")}</span><span>📂 ${esc(j.category)}</span><span>👤 ${j.applications || 0} applicant(s)</span></div>
      <div class="comment-form" style="margin-top:10px"><input class="apply-msg" data-id="${j.id}" placeholder="Note to employer (optional)" /><button class="btn primary" data-apply="${j.id}">Apply</button></div>
    </div>`).join("");
  el.innerHTML = cards + `<div class="card"><h3 style="margin-bottom:12px">Post a job / hiring</h3>
    <div class="jobform">
      <input id="jb-title" placeholder="Job title" />
      <div class="row2"><input id="jb-company" placeholder="Company" /><input id="jb-location" placeholder="Location (city/remote)" /><input id="jb-salary" placeholder="Pay (e.g. $60k)" /></div>
      <div class="row2"><select id="jb-type"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select>
      <select id="jb-exp"><option>Entry-level</option><option>Mid-level</option><option>Senior</option><option>Any</option></select>
      <input id="jb-cat" placeholder="Category (e.g. Tech)" /></div>
      <textarea id="jb-desc" placeholder="Describe the role..."></textarea>
      <button class="btn primary" id="jb-submit">Post Job</button>
    </div></div>`;
  el.querySelectorAll("button[data-apply]").forEach((b) => b.onclick = async () => {
    const id = b.dataset.apply;
    const msg = el.querySelector('.apply-msg[data-id="' + id + '"]');
    try { await api("jobs/" + id + "/apply", { method: "POST", body: { message: msg.value } }); viewJobs(el); }
    catch (e) { alert(e.message); }
  });
  $("#jb-submit").onclick = async () => {
    await api("jobs", { method: "POST", body: {
      title: $("#jb-title").value, company: $("#jb-company").value, location: $("#jb-location").value,
      salary: $("#jb-salary").value, type: $("#jb-type").value, experience: $("#jb-exp").value,
      category: $("#jb-cat").value, description: $("#jb-desc").value,
    }});
    viewJobs(el);
  };
}

// ---------- MENTAL HEALTH & WELLNESS ----------
async function viewWellness(el) {
  const r = await api("wellness/resources");
  const c = await api("wellness/checkins");
  const moods = ["great", "good", "okay", "low", "rough"];
  const moodBtn = moods.map((m) => `<button class="btn ghost mood-btn" data-mood="${m}">${m}</button>`).join("");
  const resources = r.resources.map((x) => `<div class="card"><div class="name" style="font-weight:700;margin-bottom:4px">${x.kind === "crisis" ? "🆘 " : x.kind === "practice" ? "🧘 " : "💡 "}${esc(x.title)}</div><div class="body">${esc(x.text)}</div></div>`).join("");
  const history = c.checkIns.slice(-5).reverse().map((x) => `<div class="comment"><b>${x.mood}</b><span>${esc(x.note || "")} · ${new Date(x.at).toLocaleDateString()}</span></div>`).join("");
  el.innerHTML = `<div class="card" style="border-color:var(--accent)">
      <h3 style="margin-bottom:6px">You matter. Take a moment.</h3>
      <div class="body" style="color:var(--muted)">How are you feeling right now? This is private — only you can see it.</div>
      <div class="actions" style="margin:12px 0">${moodBtn}</div>
      <input id="mood-note" placeholder="Anything you want to get off your chest (optional)" />
      <div class="history" style="margin-top:10px">${history || '<div class="empty" style="padding:10px">No check-ins yet — your first one is today.</div>'}</div>
    </div>
    <h3 style="margin:18px 0 10px">Support &amp; self-care</h3>
    ${resources}
    <div class="card" style="border-color:var(--pink)"><h3 style="margin-bottom:6px">🧘 60-second breathing break</h3>
      <div class="breath" id="breath-circle">Breathe</div>
      <button class="btn primary" id="breath-start" style="margin-top:12px">Start breathing exercise</button>
    </div>`;
  el.querySelectorAll(".mood-btn").forEach((b) => b.onclick = async () => {
    await api("wellness/checkin", { method: "POST", body: { mood: b.dataset.mood, note: $("#mood-note").value } });
    viewWellness(el);
  });
  startBreathing(el);
}

function startBreathing(el) {
  const circle = $("#breath-circle");
  const btn = $("#breath-start");
  if (!circle || !btn) return;
  btn.onclick = () => {
    let phase = 0;
    const seq = [
      { label: "Breathe in", secs: 4 },
      { label: "Hold", secs: 4 },
      { label: "Breathe out", secs: 4 },
      { label: "Hold", secs: 4 },
    ];
    const run = () => {
      const p = seq[phase % seq.length];
      circle.textContent = p.label;
      circle.classList.add("animating");
      const scale = p.label === "Breathe in" ? 1.4 : p.label === "Breathe out" ? 0.9 : 1.15;
      circle.style.transform = `scale(${scale})`;
      phase++;
      setTimeout(run, p.secs * 1000);
    };
    btn.textContent = "Running… (tap to stop)";
    run();
    btn.onclick = () => { circle.textContent = "Breathe"; circle.style.transform = "scale(1)"; circle.classList.remove("animating"); btn.textContent = "Start breathing exercise"; startBreathing(el); };
  };
}

async function refreshNotifBadge() {
  try {
    const d = await api("notifications");
    const b = $("#notif-badge");
    if (b) { b.textContent = d.unread; b.classList.toggle("hidden", !d.unread); }
  } catch (e) {}
}

// ---------- LIVE VIDEO ----------
async function viewLive(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api("live");
  const grid = d.live.map((l) => `<div class="video-card">
      <video controls src="${esc(l.videoUrl)}"></video>
      <div class="v-meta">
        <div class="v-caption"><span style="color:var(--pink)">🔴 LIVE</span> ${esc(l.title)}</div>
        <div class="v-views">👁 ${fmt(l.viewerCount)} watching · @${esc(l.hostHandle || "")}</div>
      </div></div>`).join("");
  el.innerHTML = `<div class="video-grid">${grid || '<div class="empty">No live streams right now.</div>'}</div>
    <div class="card" style="margin-top:16px"><h3 style="margin-bottom:12px">Go Live</h3>
      <div class="jobform">
        <input id="live-title" placeholder="Stream title" />
        <button class="btn primary" id="live-start">📡 Start a live stream</button>
      </div></div>`;
  $("#live-start").onclick = async () => {
    await api("live", { method: "POST", body: { title: $("#live-title").value } });
    viewLive(el);
  };
}

// ---------- NOTIFICATIONS ----------
async function viewNotifications(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const d = await api("notifications");
  const items = d.notifications.length ? d.notifications.map((n) => `<div class="card" style="${n.read ? "opacity:.6" : "border-color:var(--accent)"}">
      <div class="body">${esc(n.text)}</div>
      <div class="handle">${esc(n.actorName)} · ${new Date(n.at).toLocaleString()}${n.read ? "" : " · <b style='color:var(--pink)'>new</b>"}</div>
    </div>`).join("") : '<div class="empty">No notifications yet.</div>';
  el.innerHTML = `<div class="actions" style="margin-bottom:12px"><button class="btn ghost" id="mark-read">Mark all as read</button></div>${items}`;
  $("#mark-read").onclick = async () => { await api("notifications/read", { method: "POST" }); refreshNotifBadge(); viewNotifications(el); };
}

// ---------- SETTINGS + PAYMENTS ----------
async function viewSettings(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  const s = await api("settings");
  const set = s.settings;
  const notify = set.notifications || {};
  const priv = set.privacy || {};
  const ntogg = (k, v, label) => `<label class="row"><input type="checkbox" data-notif="${k}" ${v ? "checked" : ""} /> ${label}</label>`;
  const ptogg = (k, v, label) => `<label class="row"><input type="checkbox" data-priv="${k}" ${v ? "checked" : ""} /> ${label}</label>`;
  el.innerHTML = `<div class="card"><h3 style="margin-bottom:12px">Profile</h3>
      <div class="jobform">
        <input id="set-name" value="${esc(state.user.displayName)}" placeholder="Display name" />
        <textarea id="set-bio" placeholder="Bio">${esc(state.user.bio || "")}</textarea>
      </div></div>
    <div class="card"><h3 style="margin-bottom:12px">Notifications</h3>
      ${ntogg("likes", notify.likes, "Likes")}${ntogg("comments", notify.comments, "Comments")}
      ${ntogg("follows", notify.follows, "Follows")}${ntogg("bids", notify.bids, "Auction bids")}
      ${ntogg("applications", notify.applications, "Job applications")}
    </div>
    <div class="card"><h3 style="margin-bottom:12px">Privacy</h3>
      ${ptogg("publicProfile", priv.publicProfile, "Public profile")}${ptogg("showOnline", priv.showOnline, "Show when I'm online")}
    </div>
    <div class="card"><h3 style="margin-bottom:12px">Payments & Payouts</h3>
      <div class="body" id="pay-status" style="color:var(--muted)">Loading payment status…</div>
      <div class="row2" style="margin-top:12px">
        <input id="pay-amount" type="number" placeholder="Amount $" />
        <button class="btn primary" id="pay-checkout">Pay / Top up</button>
        <button class="btn ghost" id="pay-payout">Request payout</button>
      </div>
    </div>
    <button class="btn primary" id="set-save" style="margin-top:4px">Save settings</button>`;
  loadPayStatus();
  $("#set-save").onclick = async () => {
    const notif = {}; document.querySelectorAll("input[data-notif]").forEach((i) => { notif[i.dataset.notif] = i.checked; });
    const privacy = {}; document.querySelectorAll("input[data-priv]").forEach((i) => { privacy[i.dataset.priv] = i.checked; });
    await api("settings", { method: "PUT", body: { displayName: $("#set-name").value, bio: $("#set-bio").value, notifications: notif, privacy } });
    loadMe(); viewSettings(el);
  };
  $("#pay-checkout").onclick = async () => {
    try {
      const r = await api("payments/checkout", { method: "POST", body: { amount: Number($("#pay-amount").value) || 0 } });
      alert("Checkout " + r.mode + " created: " + r.id + "\n(clientSecret: " + r.clientSecret + ")" + (r.mode === "sandbox" ? "\n\nSandbox mode — set STRIPE_SECRET_KEY to make real charges." : ""));
    } catch (e) { alert(e.message); }
  };
  $("#pay-payout").onclick = async () => {
    const r = await api("payments/payout", { method: "POST", body: { amount: Number($("#pay-amount").value) || 0 } });
    alert("Payout requested: $" + r.amount + " (" + r.mode + ")"); loadPayStatus();
  };
}

async function loadPayStatus() {
  try {
    const p = await api("payments");
    const el = $("#pay-status");
    if (el) el.innerHTML = `<b>Balance:</b> $${fmt(p.balance || 0)} · <b>Mode:</b> ${p.mode} · ${esc(p.note || "")}`;
  } catch (e) {}
}

// ---------- ADMIN / MODERATION ----------
async function viewAdmin(el) {
  el.innerHTML = '<div class="empty">Loading…</div>';
  let stats, users, reports;
  try {
    const r = await Promise.all([api("admin/stats"), api("admin/users"), api("admin/reports")]);
    stats = r[0]; users = r[1]; reports = r[2];
  } catch (e) { el.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  const stat = (k, v) => `<div class="stat"><div class="num">${v}</div><div class="lbl">${k}</div></div>`;
  const open = (reports.reports || []).filter((x) => !x.resolved);
  const repCards = open.map((r) => `<div class="card">
      <div class="body">${esc(r.reason)}</div>
      <div class="handle">reported by ${esc(r.reporterName)} · ${new Date(r.at).toLocaleString()}</div>
      ${r.post ? `<div class="body" style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px">${esc(r.post.body || r.post.title || r.post.caption || "(video post)")}</div>` : ""}
      <div class="row2" style="margin-top:10px">
        <button class="btn small primary" data-resolve="${r.id}">Resolve</button>
        ${r.post ? `<button class="btn small ghost" data-hide="${r.post.id}">Hide post</button>` : ""}
      </div></div>`).join("");
  const userRows = users.users.map((u) => `<div class="card row" style="justify-content:space-between">
      <span>${esc(u.displayName)} <span class="handle">@${esc(u.handle)}</span>${u.suspended ? " <span style='color:#ff6b6b;font-weight:700'>SUSPENDED</span>" : ""}</span>
      <button class="btn small ghost" data-suspend="${u.id}" data-sus="${u.suspended ? 1 : 0}">${u.suspended ? "Unsuspend" : "Suspend"}</button></div>`).join("");
  el.innerHTML = `<div class="stat-grid">${stat("Users", stats.users)}${stat("Posts", stats.posts)}${stat("Comments", stats.comments)}${stat("Likes", stats.likes)}${stat("Groups", stats.groups)}${stat("Live now", stats.live)}${stat("Auctions", stats.auctions)}${stat("Jobs", stats.jobs)}${stat("Open reports", stats.openReports)}</div>
    <h2 style="margin:20px 0 10px">🚩 Open reports</h2>${repCards || '<div class="empty">No open reports.</div>'}
    <h2 style="margin-top:20px">Users</h2>${userRows || '<div class="empty">No users.</div>'}`;
  el.querySelectorAll("button[data-resolve]").forEach((b) => b.onclick = async () => { await api("admin/reports/" + b.dataset.resolve + "/resolve", { method: "POST" }); viewAdmin(el); });
  el.querySelectorAll("button[data-hide]").forEach((b) => b.onclick = async () => { await api("admin/posts/" + b.dataset.hide + "/hide", { method: "POST" }); viewAdmin(el); });
  el.querySelectorAll("button[data-suspend]").forEach((b) => b.onclick = async () => { await api("admin/users/" + b.dataset.suspend + "/" + (b.dataset.sus === "1" ? "unsuspend" : "suspend"), { method: "POST" }); viewAdmin(el); });
}

// ---------- LEGAL ----------
const LEGAL = {
  terms: { title: "Terms of Service", body: `
    <p>Welcome to <b>Simple</b>, the social platform owned and created by <b>Daniel Pollard</b>. By using Simple you agree to these terms.</p>
    <h4>1. Your content</h4><p>You keep ownership of what you post. By posting you grant Simple a worldwide license to host, display, and distribute it on the platform so your posts can be shown to other users.</p>
    <h4>2. Acceptable use</h4><p>You agree not to post illegal content, harassment, hate, spam, or anything that harms others. We may remove content and suspend accounts that violate these terms or our Content &amp; Safety guidelines.</p>
    <h4>3. Payments &amp; payouts</h4><p>Where monetization is offered, earnings are paid to verified creators. Payouts require identity verification (KYC) and are processed through our payment provider. Simulated/"sandbox" transactions are for testing only.</p>
    <h4>4. Live content</h4><p>Live streams are public. You are responsible for what you broadcast; we may terminate any live stream that breaches these terms.</p>
    <h4>5. Availability</h4><p>We work to keep Simple available, but we cannot promise uninterrupted service. Simple is provided "as is" without warranties.</p>
    <h4>6. Changes</h4><p>We may update these terms. Continued use after changes means you accept them.</p>
  ` },
  privacy: { title: "Privacy Policy", body: `
    <p>Your privacy matters to us at <b>Simple</b> (created by <b>Daniel Pollard</b>).</p>
    <h4>What we collect</h4><p>Account details (name, email, handle), content you post, comments and messages, device and usage data, and, where you enable monetization, payout information via our payment provider.</p>
    <h4>How we use it</h4><p>To operate Simple, show you relevant content, enable social features and monetization, keep the platform safe, and improve the product.</p>
    <h4>Who we share it with</h4><p>We do not sell your data. We share it with service providers that run Simple (hosting, storage, payments, video) and when legally required.</p>
    <h4>Your choices</h4><p>You can edit your profile and settings, download your data, and request deletion by contacting us. You may opt out of notification emails.</p>
    <h4>Data retention</h4><p>We keep your data while your account is active, and longer where law requires.</p>
    <h4>Contact</h4><p>For privacy questions, contact the owner, Daniel Pollard.</p>
  ` },
  safety: { title: "Content & Safety", body: `
    <p>Simple is built to be a safe, healthy space.</p>
    <h4>Community guidelines</h4><p>No harassment, hate speech, threats, illegal content, spam, graphic violence, or content that glorifies self-harm. In the mental-health &amp; wellness area, respect the community and encourage kindness.</p>
    <h4>Reporting</h4><p>Use the 🚩 button on any post to report it. Our admin team reviews reports and can remove content or suspend accounts.</p>
    <h4>Mental health note</h4><p>The mental-health features are supportive tools, not medical advice. If you are in crisis, please reach out to professional services in your region.</p>
  ` },
  cookies: { title: "Cookies", body: `
    <p><b>Simple</b> (created by <b>Daniel Pollard</b>) uses a small amount of cookies and local storage.</p>
    <h4>What we store</h4><p>An authentication token in your browser's local storage so you stay signed in, plus preferences such as your theme. We do not use third-party advertising trackers.</p>
    <h4>Your control</h4><p>You can clear stored data via your browser settings; doing so will sign you out.</p>
  ` },
};
async function viewLegal(el) {
  const page = LEGAL[state.legalPage || "terms"];
  el.innerHTML = `<div class="card"><h2 style="margin-bottom:12px">${page.title}</h2>${page.body}
    <p style="margin-top:18px;color:var(--muted)">© ${new Date().getFullYear()} Simple · Owned &amp; created by Daniel Pollard</p></div>`;
}

// ---------- helpers ----------
function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : n; }

async function composePost() {
  const body = $("#compose-body").value.trim();
  if (!body) return;
  const payload = {
    body, monetized: $("#compose-monetized").checked,
    type: $("#compose-video").checked ? "video" : "text",
  };
  if (payload.type === "video") { payload.videoUrl = SAMPLE_VIDEO; payload.caption = body; delete payload.body; }
  await api("posts", { method: "POST", body: payload });
  $("#compose").classList.add("hidden");
  $("#compose-body").value = "";
  render("feed");
}

mount();