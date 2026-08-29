// Self-contained end-to-end test: starts the app server on an ephemeral
// port and exercises every API surface with global fetch — all in one
// process, immune to sandbox background-process reaping.
const http = require("http");
const path = require("path");
process.env.PORT = "0"; // ephemeral
const server = require("./server/server.js");

function listen() {
  return new Promise((r) => server.on("listening", () => r(server.address().port)));
}

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log("  OK  " + m); };
const bad = (m) => { fail++; console.log("  FAIL " + m); };

async function main() {
  const port = await listen();
  const base = `http://localhost:${port}/api`;

  const J = (r) => r.json();
  async function req(p, opts = {}) {
    const r = await fetch(base + p, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
  }
  const auth = (t) => ({ Authorization: "Bearer " + t });

  console.log("== AUTH ==");
  let { status, data } = await req("/auth/login", { method: "POST", body: { email: "creator@pollard.social", password: "password123" } });
  if (status === 200 && data.token) { ok("login"); } else bad("login " + status);
  const T = data.token;
  const E = "u" + Date.now() + "@test.com";
  ({ status } = await req("/auth/register", { method: "POST", body: { email: E, password: "x", displayName: "U", handle: "u" } }));
  status === 201 ? ok("register (201)") : bad("register got " + status);
  let s2 = (await req("/auth/register", { method: "POST", body: { email: E, password: "x" } })).status;
  s2 === 409 ? ok("register rejects duplicate (409)") : bad("dup got " + s2);

  console.log("== ME ==");
  (await req("/me", { headers: auth(T) })).status === 200 ? ok("me") : bad("me");
  (await req("/me")).status === 401 ? ok("me requires auth") : bad("me auth");

  console.log("== FEED / POSTS ==");
  (await req("/feed", { headers: auth(T) })).status === 200 ? ok("feed") : bad("feed");
  let p = (await req("/posts", { method: "POST", headers: auth(T), body: { body: "test post" } })).data;
  if (p && p.id) { ok("create post " + p.id); } else bad("create post");
  let like = (await req("/posts/" + p.id + "/like", { method: "POST", headers: auth(T) })).data;
  like && "likes" in like ? ok("like returns likes count") : bad("like");
  !("authorId" in like) ? ok("like does not leak post") : bad("like leaked post!");
  let c = (await req("/posts/" + p.id + "/comment", { method: "POST", headers: auth(T), body: { text: "c1" } })).data;
  Array.isArray(c) && c.length === 1 ? ok("comment") : bad("comment");

  console.log("== VIDEO ==");
  let v = (await req("/feed", { headers: auth(T) })).data;
  v.items.some((x) => x.type === "video") ? ok("feed includes video") : bad("video in feed");

  console.log("== GROUPS / MESSAGES / CREATOR ==");
  let g = (await req("/groups", { method: "POST", headers: auth(T), body: { name: "GroupX" } })).data;
  g && g.name === "GroupX" ? ok("create group") : bad("group");
  (await req("/groups", { headers: auth(T) })).status === 200 ? ok("list groups") : bad("list groups");
  await req("/messages", { method: "POST", headers: auth(T), body: { to: "x", text: "hi" } });
  (await req("/messages", { headers: auth(T) })).status === 200 ? ok("messages") : bad("messages");
  (await req("/creator", { headers: auth(T) })).status === 200 ? ok("creator studio") : bad("creator studio");

  console.log("== MARKETPLACE / JOBS / WELLNESS ==");
  let mk = (await req("/auctions", { headers: auth(T) })).data;
  mk && mk.auctions && mk.auctions.length ? ok("auctions list (" + mk.auctions.length + ")") : bad("auctions list");
  let tgt = mk.auctions.find((a) => a.id === "a2");
  let bidAmt = (tgt.currentBid || 0) + 1000;
  let bid = (await req("/auctions/a2/bid", { method: "POST", headers: auth(T), body: { amount: bidAmt } })).data;
  bid && bid.currentBid === bidAmt ? ok("place bid -> " + bid.currentBid) : bad("bid");
  let badBid = (await req("/auctions/a1/bid", { method: "POST", headers: auth(T), body: { amount: 100 } })).status;
  badBid === 400 ? ok("rejects low bid (400)") : bad("low bid got " + badBid);
  let aj = (await req("/auctions", { method: "POST", headers: auth(T), body: { title: "Test Car", make: "Tesla", model: "3", startPrice: 20000 } })).data;
  aj && aj.id ? ok("create auction") : bad("create auction");

  (await req("/jobs", { headers: auth(T) })).data.jobs.length > 0 ? ok("jobs list") : bad("jobs list");
  let jj = (await req("/jobs", { method: "POST", headers: auth(T), body: { title: "Tester", company: "X", salary: "$10" } })).data;
  jj && jj.id ? ok("post job") : bad("post job");
  let apply = (await req("/jobs/" + jj.id + "/apply", { method: "POST", headers: auth(T), body: { message: "hi" } })).data;
  apply && apply.applied ? ok("apply to job") : bad("apply");

  (await req("/wellness/resources", { headers: auth(T) })).data.resources.length > 0 ? ok("wellness resources") : bad("wellness resources");
  let w = (await req("/wellness/checkin", { method: "POST", headers: auth(T), body: { mood: "good", note: "feeling fine" } })).data;
  w && w.id ? ok("mood check-in") : bad("checkin");

  console.log("== NOTIFICATIONS / SETTINGS / PAYMENTS / LIVE ==");
  let nf = (await req("/notifications", { headers: auth(T) })).data;
  nf && Array.isArray(nf.notifications) && nf.notifications.length ? ok("notifications list (" + nf.notifications.length + ")") : bad("notifications");
  let rd = (await req("/notifications/read", { method: "POST", headers: auth(T) })).data;
  rd && rd.unread === 0 ? ok("mark all read") : bad("mark read");

  let st = (await req("/settings", { headers: auth(T) })).data;
  st && st.settings && st.settings.privacy ? ok("get settings") : bad("get settings");
  let st2 = (await req("/settings", { method: "PUT", headers: auth(T), body: { displayName: "Daniel Pollard", bio: "hi", notifications: { likes: false } } })).data;
  st2 && st2.settings.notifications.likes === false ? ok("update settings") : bad("update settings");

  let pm = (await req("/payments", { headers: auth(T) })).data;
  pm && pm.mode === "sandbox" ? ok("payments status (sandbox)") : bad("payments status");
  let co = (await req("/payments/checkout", { method: "POST", headers: auth(T), body: { amount: 25 } })).data;
  co && co.clientSecret && co.mode === "sandbox" ? ok("checkout created (sandbox)") : bad("checkout");
  let po = (await req("/payments/payout", { method: "POST", headers: auth(T), body: { amount: 10 } })).data;
  po && po.status === "pending" ? ok("payout requested") : bad("payout");

  let lv = (await req("/live", { headers: auth(T) })).data;
  lv && lv.live && lv.live.length ? ok("live streams list (" + lv.live.length + ")") : bad("live list");
  let nl = (await req("/live", { method: "POST", headers: auth(T), body: { title: "Test Stream" } })).data;
  nl && nl.id ? ok("create live stream") : bad("create live");

  console.log("== ADMIN / MODERATION / LEGAL ==");
  let rp = (await req("/posts/" + p.id + "/report", { method: "POST", headers: auth(T), body: { reason: "spam test" } })).data;
  rp && rp.reported ? ok("report post") : bad("report post");
  let st3 = (await req("/admin/stats", { headers: auth(T) })).data;
  st3 && typeof st3.users === "number" && st3.openReports >= 1 ? ok("admin stats") : bad("admin stats");
  let adU = (await req("/admin/users", { headers: auth(T) })).data;
  adU && Array.isArray(adU.users) ? ok("admin list users") : bad("admin users");
  let rep = (await req("/admin/reports", { headers: auth(T) })).data;
  rep && Array.isArray(rep.reports) && rep.reports.length ? ok("admin reports") : bad("admin reports");
  let sus = (await req("/admin/users/u_ava/suspend", { method: "POST", headers: auth(T) })).data;
  sus && sus.suspended ? ok("suspend user") : bad("suspend");
  let uns = (await req("/admin/users/u_ava/unsuspend", { method: "POST", headers: auth(T) })).data;
  uns && !uns.suspended ? ok("unsuspend user") : bad("unsuspend");
  let hide = (await req("/admin/posts/p1/hide", { method: "POST", headers: auth(T) })).data;
  hide && hide.hidden ? ok("hide post") : bad("hide post");
  (await req("/admin/stats", { headers: auth({ token: "bad" }) })).status === 401 ? ok("admin requires auth") : bad("admin auth");

  console.log("== STATIC ==");
  (await fetch("http://localhost:" + port + "/")).status === 200 ? ok("index served") : bad("index");
  (await fetch("http://localhost:" + port + "/app.js")).status === 200 ? ok("app.js served") : bad("app.js");

  console.log("==============================");
  console.log("PASS=" + pass + " FAIL=" + fail);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });