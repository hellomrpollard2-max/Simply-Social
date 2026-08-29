// ============================================================
// SIMPLE — in-memory datastore with JSON file persistence.
// Zero external dependencies: works anywhere Node runs.
// Created by Daniel Pollard.
// In production swap this module for the SQL database in
// schema.sql (Postgres/SQLite) without touching the API layer.
// ============================================================
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "..", "data", "store.json");
const DATA_DIR = path.join(__dirname, "..", "data");

// ---- local hash helper (demo only; use bcrypt in production) ----
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// ---- Seed creator account (Daniel Pollard) + demo content ----
function seed() {
  const now = Date.now();
  const creatorId = "u_daniel_pollard";
  const users = [
    {
      id: creatorId,
      handle: "danielpollard",
      displayName: "Daniel Pollard",
      email: "creator@pollard.social",
      passwordHash: hash("password123"), // demo only — never ship plaintext
      bio: "Founder & Owner of Simple — the social network built for people, not advertisers.",
      avatar: null,
      verified: true,
      role: "admin",
      followers: 1204500,
      following: 182,
      joinedAt: now - 86400000 * 400,
      monetization: { payoutsTotal: 48210.55, nextPayoutDue: now + 86400000 * 7 },
      analytics: {
        profileViews: 3210800,
        engagementRate: 0.086,
        avgWatchSeconds: 84,
        totalEarnings: 48210.55,
        reach30d: 890000,
      },
    },
  ];

  // demo influencer + a normal user so the feed is alive
  const extra = [
    {
      id: "u_ava",
      handle: "ava.codes",
      displayName: "Ava Chen",
      email: "ava@example.com",
      passwordHash: hash("password1234"),
      bio: "Dev tutorials & behind-the-scenes",
      verified: false,
      role: "creator",
      followers: 340200,
      createdAt: now - 86400000 * 300,
    },
    {
      id: "u_marcus",
      handle: "marcus",
      displayName: "Marcus Reid",
      email: "marcus@example.com",
      passwordHash: hash("password1234"),
      bio: "Music producer 🎧",
      verified: false,
      role: "user",
      followers: 8800,
      createdAt: now - 86400000 * 200,
    },
  ];
  users.push(...extra);

  const posts = [
    {
      id: "p1",
      authorId: creatorId,
      type: "video",
      title: "Introducing Simple — a social network owned by its creators",
      body: "We are building the first major social platform where the community owns the platform. No engagement-maximizing algorithms. No ads that track you. Creators keep 85% of what they earn.",
      videoUrl: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
      thumbnail: null,
      createdAt: now - 86400000 * 2,
      likes: 82400,
      comments: [],
      views: 1200000,
      shares: 8900,
      monetized: true,
      trending: 0.98,
    },
    {
      id: "p2",
      author: "u_ava",
      type: "video",
      caption: "Ship fast, ship small ✨ #buildinpublic",
      videoUrl: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4",
      duration: 24,
      createdAt: now - 86400000 * 1,
      likes: 12000,
      comments: [
        { id: "c1", author: "u_marcus", text: "Love the energy!", likes: 12, createdAt: now - 3600000 },
      ],
      views: 210000,
      shares: 340,
      trending: 0.91,
    },
    {
      id: "p3",
      author: "u_marcus",
      type: "text",
      body: "Drop your favorite album of the year below 👇 I need new material.",
      createdAt: now - 3600000 * 5,
      likes: 540,
      comments: [
        { id: "c2", author: "u_ava", text: "Anything by Remi Wolf.", likes: 30, createdAt: now - 2000000 },
      ],
      shares: 12,
      trending: 0.2,
    },
    {
      id: "p4",
      author: creatorId,
      type: "text",
      body: "Big question for the roadmap: should creators get a share of ad-adjacent revenue too, or keep the platform 100% free-to-use and funded by subscription tiers? Cast your vote in the poll ⬇️",
      createdAt: now - 3600000 * 2,
      likes: 3200,
      comments: [],
      shares: 210,
      trending: 0.6,
      poll: { question: "Revenue model?", options: ["Creator revenue share", "Subscription tiers", "Both"], votes: { 0: 128, 1: 74, 2: 302 } },
    },
  ];

  const messages = [
    { id: "m1", from: "u_ava", to: creatorId, text: "Congrats on the launch Dan! 🎉", at: now - 3600000 * 8, read: true },
    { id: "m2", from: creatorId, to: "u_ava", text: "Thanks Ava! Let's collab on a creator earnings breakdown video.", at: now - 3600000 * 7, read: true },
  ];

  const groups = [
    {
      id: "g1",
      name: "Simple Creators",
      members: [creatorId, "u_ava", "u_marcus"],
      description: "Community hub for platform creators.",
      posts: [
        { id: "gp1", author: "u_ava", text: "Just hit 10k followers! 🎉", likes: 5, at: now - 3600000 },
      ],
      createdAt: now - 86400000 * 30,
    },
  ];

  // ---- Auto Auction marketplace ----
  const auctions = [
    {
      id: "a1",
      sellerId: creatorId,
      title: "2019 Ford Mustang GT",
      make: "Ford",
      model: "Mustang GT",
      year: 2019,
      mileage: 32000,
      condition: "Excellent",
      image: null,
      description: "Clean title, 5.0L V8, premium package, garage kept. Great condition, no accidents.",
      startPrice: 28000,
      currentBid: 30500,
      bidCount: 14,
      bids: [{ bidder: "u_marcus", amount: 30500, at: now - 3600000 }],
      endsAt: now + 86400000 * 2,
      status: "active",
    },
    {
      id: "a2",
      sellerId: "u_marcus",
      title: "2020 Honda Civic Type R",
      make: "Honda",
      model: "Civic Type R",
      year: 2020,
      mileage: 18000,
      condition: "Like new",
      image: null,
      description: "Track-ready, 2.0T, stock except exhaust. Manual only.",
      startPrice: 31000,
      currentBid: 31000,
      bidCount: 0,
      bids: [],
      endsAt: now + 86400000 * 4,
      status: "active",
    },
    {
      id: "a3",
      sellerId: "u_ava",
      title: "2017 Harley-Davidson Sportster",
      make: "Harley-Davidson",
      model: "Sportster Iron 883",
      year: 2017,
      mileage: 8900,
      condition: "Good",
      image: null,
      description: "Classic cruiser, clean title, recent service.",
      startPrice: 6500,
      currentBid: 6700,
      bidCount: 3,
      bids: [{ bidder: creatorId, amount: 6700, at: now - 7200000 }],
      endsAt: now + 86400000 * 3,
      status: "active",
    },
  ];

  // ---- Jobs & Hiring ----
  const jobs = [
    {
      id: "j1",
      employerId: creatorId,
      title: "Senior Full-Stack Engineer",
      company: "Simple Labs",
      location: "Remote",
      experience: "Senior",
      type: "Full-time",
      salary: "$130k – $170k",
      category: "Technology",
      description: "Build the social layer of Simple. Node.js + Postgres, product-minded, impact-driven.",
      postedAt: now - 86400000,
      applications: [],
      active: true,
    },
    {
      id: "j2",
      employerId: "u_ava",
      title: "Video Editor / Content Creator",
      company: "Ava's Studio",
      location: "Austin, TX",
      experience: "Mid-level",
      type: "Contract",
      salary: "$45/hr",
      bio: "Creative",
      description: "Edit short-form video for a 340k-follower tech channel. Remote-friendly.",
      postedAt: now - 86400000 * 2,
      applications: [],
      active: true,
    },
    {
      id: "j3",
      employerId: "u_marcus",
      title: "Music Studio Assistant",
      company: "Reid Records",
      location: "Nashville, TN",
      experience: "Entry-level",
      type: "Part-time",
      salary: "$18/hr",
      bio: "Music",
      description: "Help run sessions, manage gear, and keep the studio flowing.",
      postedAt: now - 3600000 * 6,
      applications: [],
      active: true,
    },
  ];

  // ---- Mental health & wellness ----
  const wellness = {
    checkIns: [
      { id: "w1", userId: "u_marcus", mood: "okay", note: "Long week, but the gym helped.", at: now - 86400000 },
    ],
    resources: [
      { id: "r1", title: "Crisis Support — 988", text: "Call or text 988 (US) anytime. Free, confidential, 24/7.", kind: "crisis" },
      { id: "r2", title: "Breathing exercise", text: "Try box breathing: in 4s, hold 4s, out 4s, hold 4s. Repeat 4 cycles.", kind: "practice" },
      { id: "r3", title: "The 5-4-3-2-1 grounding technique", text: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste.", kind: "practice" },
      { id: "r4", title: "Start a mood journal", text: "A daily 2-line note can reveal patterns. Simple makes it private to you.", kind: "tip" },
    ],
  };

  // ---- Notifications ----
  const notifications = [
    { id: "n1", userId: creatorId, type: "comment", text: "Ava Chen commented on your post.", actor: "u_ava", at: now - 3600000 * 3, read: false },
    { id: "n2", userId: creatorId, type: "bid", text: "Marcus Reid placed a bid on your 2019 Ford Mustang GT.", actor: "u_marcus", at: now - 3600000 * 2, read: false },
    { id: "n3", userId: creatorId, type: "job", text: "You have a new application for Senior Full-Stack Engineer.", actor: "u_ava", at: now - 3600000, read: false },
    { id: "n4", userId: creatorId, type: "follow", text: "Ava Chen is now following you.", actor: "u_ava", at: now - 3600000 * 5, read: true },
  ];

  // ---- Live streams ----
  const live = [
    { id: "l1", hostId: "u_ava", title: "LIVE: Building a feature in real time 🛠️", viewerCount: 1234, videoUrl: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4", startedAt: now - 3600000, live: true },
    { id: "l2", hostId: "u_marcus", title: "LIVE: Studio session 🎧", viewerCount: 678, videoUrl: "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4", startedAt: now - 1800000, live: true },
  ];

  const store = { users, posts, messages, groups, auctions, jobs, wellness, notifications, live, reports: [], sessionTokens: {} };
  // default settings for any user missing them
  store.users.forEach((u) => {
    if (!u.settings) u.settings = {
      privacy: { publicProfile: true, showOnline: true },
      notifications: { likes: true, comments: true, follows: true, bids: true, applications: true },
      appearance: { theme: "dark" },
    };
  });
  persist(store);
  return store;
}

function load() {
  if (!fs.existsSync(DATA_FILE)) return seed();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return seed();
  }
}

function persist(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

const store = load();
// Backfill guard: ensure newer collections exist even on legacy store files.
store.auctions = store.auctions || [];
store.jobs = store.jobs || [];
store.wellness = store.wellness || { checkIns: [], resources: [] };
store.notifications = store.notifications || [];
store.live = store.live || [];
store.reports = store.reports || [];
module.exports = {
  store,
  persist: () => persist(store),
  uid: (p = "id") => p + "_" + crypto.randomBytes(6).toString("hex"),
  hash,
};