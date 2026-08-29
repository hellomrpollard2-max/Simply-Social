# SIMPLE — The social network owned by its creators
### Business & Feature Blueprint — Created & owned by Daniel Pollard

> **Positioning:** Facebook optimizes engagement, X optimizes debate, TikTok optimizes
> attention. **Simple optimizes for the creator and the community** — the platform
> treats its users as owners and partners, not as the product. That single principle
> is the wedge that lets a new entrant beat entrenched giants.

---

## 1. The "outdo the giants" thesis

| Giant | What it's worst at | Simple's counter |
|-------|--------------------|-------------------|
| **Facebook** | Algorithm amplifies divisive content; users are the product sold to advertisers | Chronological + transparent ranking; no engagement-maximizing dark patterns; zero behavioral ad tracking |
| **X / Twitter** | Paid blue-checks, abuse, hate-speech spirals, engagement bait | Identity verification for *credibility*, not status; community-moderation governance |
| **TikTok** | Addictive infinite scroll that optimizes against your wellbeing | User-controlled feeds + "watch less" signals; built-in usage limits; watch-time shown to the user |

**The core moat:** community ownership. A share of platform revenue flows to
creators via a transparent pool. This is the one thing the incumbents *cannot*
copy — it guts their own business model.

---

## 2. Feature set (all implemented in the prototype)

1. **Accounts & identity** — sign up / log in, verified creator badges, handle/email.
2. **Smart feed** — hybrid chronological + optional "for you" ranking (feed_scores).
3. **Short-form video** — vertical video wall (TikTok-style) with watch-time tracking.
4. **Text posts, images, polls** — rich posting surface (Facebook-style + polling).
5. **Social graph** — follow, followers, likes, threaded comments, shares, reposts.
6. **Groups** — interest communities with members + group posts.
7. **Direct messages** — private conversations.
8. **Creator Studio** — analytics (views, engagement rate, watch time, reach) +
   monetization dashboard (earnings, payout requests).
9. **Monetization** — 85% creator revenue share, payout engine (in schema).
10. **Safe-by-default feed ranking** — formula encodes "watch time and creator
    value," not just raw engagement.
11. **Auto Auction Marketplace** — list vehicles for auction, live bidding,
    current-bid tracking, countdown.
12. **Jobs & Hiring** — post jobs, hire, browse & apply — full employer / job-seeker workflow.
12. **Jobs & Hiring** — post jobs, hire, browse & apply — full employer / job-seeker workflow.
13. **Mental Health & Wellness** — private mood check-ins, self-care practices,
    crisis-support resources, and a guided breathing exercise.
14. **Live Video** — go live and browse streams with a live viewer count.
15. **Notifications** — likes, comments, follows, bids & applications with an unread badge.
16. **Settings** — profile, privacy, notification preferences.
17. **Payments & Payouts** — Stripe test-mode checkout + payout flow (sandbox
    by default; add `STRIPE_SECRET_KEY` to go live).
18. **Admin & Moderation** — platform stats, report queue, hide content,
    suspend users.
19. **Legal** — Terms of Service, Privacy Policy, Content & Safety, Cookies
    (each credited to Daniel Pollard).

---

## 3. Data model (see `schema.sql`)

The prototype uses a zero-dependency JSON store mirroring this production model.
Production uses Postgres with these tables:

- **Identity:** `users`, follows
- **Content:** `posts`, `post_media`, `polls`, `poll_options`, `poll_votes`
- **Interactions:** `likes`, `comments`, `shares`, `reposts`
- **Communities:** `groups`, `group_members`, `group_posts`
- **Messaging:** `conversations`, `conversation_participants`, `messages`
- **Analytics:** `video_events`, `daily_post_stats`
- **Money:** `creator_earnings`, `payouts`
- **Commerce:** `auctions`, `bids`
- **Work:** `jobs`, `applications`
- **Wellbeing:** `mood_checkins`, `wellness_resources`
- **Community & prefs:** `notifications`, `user_settings`
- **Streaming:** `live_streams`
- **Ranking:** `feed_scores` (per-user recommendation output)

---

## 4. How "owning your content" actually works

- Creators keep **85%** of all monetization (industry standard is ~45-55%).
- The remaining 15% funds platform infra + the **creator fund** that pays out to
  the community.
- Every video's **watch time and engagement** accrues to the author's earnings,
  visible in the Creator Studio.

---

## 5. Differentiation roadmap (v1 → v1.1 → v1.2)

- **v1 (done — this prototype):** social + video + groups + DMs + creator studio.
- **v1.1:** mobile PWA, real video transcoding (HLS), push notifications.
- **v1.2:** AI "For You" feed (see `feed_scores`), verified identity trust-tiers,
  community moderation DAO, in-app wallet & payouts to real money.
- **v1.3:** subscription tiers & badges, live streaming, creator storefronts.

---

## 6. Target metrics & unit economics (illustrative)

- Creator takes **85%** vs industry average **30%** → "double your earnings here."
- Assume 1M DAU, 10% are creators → strong flywheel: more creators → more great
  content → more users → more payouts → more creators.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Cold-start (no content) | Launch with seed creator cohort; creator fund seeded by revenue-share |
| Moderation at scale | Community moderation + reporting + verified-trust model (not engagement games) |
| Big-platform network effect | Differentiate on economics + ownership, not just features |
| Ad-model pressure | Stay subscription/fund-based so the "product" is never the user |

---

## 8. Quick-start commands

```bash
npm install        # (no deps — this is just for npm start convenience)
npm start          # starts the server
# open http://localhost:3000
```

**Demo accounts**
| Role | Email | Password |
|------|-------|----------|
| Creator (Daniel Pollard) | `creator@pollard.social` | `password123` |
| User (Ava) | `ava@example.com` | `password1234` |
| User (Marcus) | `marcus@example.com` | `password1234` |

**Tests:** `node test.js` (runs the full API suite, 43 checks).

---

*© Daniel Pollard. Prototype + model copyright. See `schema.sql`, `server/`, `public/`.*