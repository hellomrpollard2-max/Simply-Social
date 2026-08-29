-- SIMPLE — Production database schema (PostgreSQL 15+ / SQLite-compatible)
-- This is the scale-out data model. The demo app in server/db.js stores the
-- same shapes in a JSON file; swap this in when you deploy for real.
-- Created & owned by Daniel Pollard.
-- ============================================================================

-- ---------- Identity ----------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,             -- bcrypt/argon2 only
  avatar_url    TEXT,
  bio           TEXT,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','creator','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_at     TIMESTAMPTZ
);
CREATE INDEX idx_users_handle ON users (lower(handle));

-- ---------- Posts (text, images, video, polls) ----------
CREATE TABLE posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','video','poll','repost')),
  body        TEXT,
  media_url   TEXT,
  duration_s  INT,                          -- video length
  monetized   BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','removed')),
  trending    DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_author ON posts (author_id, created_at DESC);
CREATE INDEX idx_posts_trending ON posts (trending DESC);

CREATE TABLE post_media (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  position  INT NOT NULL DEFAULT 0
);

CREATE TABLE polls (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  question  TEXT NOT NULL
);
CREATE TABLE poll_options (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label   TEXT NOT NULL,
  position INT NOT NULL
);
CREATE TABLE poll_votes (
  poll_id   UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (poll_id, user_id)
);

-- ---------- Social graph ----------
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX idx_follows_followee ON follows (followee_id, created_at DESC);

CREATE TABLE likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,  -- threaded replies
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_post ON comments (post_id, created_at);

CREATE TABLE shares (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE reposts (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id  UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  comment  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ---------- Groups ----------
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE TABLE group_posts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Direct messages ----------
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON messages (conversation_id, sent_at);

-- ---------- Video (watch time = the real metric) ----------
CREATE TABLE video_events (
  id        BIGSERIAL PRIMARY KEY,
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id   UUID,
  watch_s   INT NOT NULL,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Daily rollup table for cheap analytics
CREATE TABLE daily_post_stats (
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  day       DATE NOT NULL,
  views     INT NOT NULL DEFAULT 0,
  watch_sec BIGINT NOT NULL DEFAULT 0,
  likes     INT NOT NULL DEFAULT 0,
  comments  INT NOT NULL DEFAULT 0,
  shares    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, day)
);

-- ---------- Monetization ----------
CREATE TABLE creator_earnings (
  user_id   UUID NOT NULL REFERENCES users(id),
  post_id   UUID REFERENCES posts(id),
  amount    NUMERIC(12,2) NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('subscription','ads_share','tips','badges')),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE payouts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id),
  amount    NUMERIC(12,2) NOT NULL,
  status    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at   TIMESTAMPTZ
);

-- ---------- Auto Auction marketplace ----------
CREATE TABLE auctions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  make        TEXT,
  model       TEXT,
  year        INT,
  mileage     INT,
  condition   TEXT,
  image_url   TEXT,
  description TEXT,
  start_price NUMERIC(12,2) NOT NULL,
  current_bid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ends_at     TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','sold')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auctions_active ON auctions (status, ends_at);

CREATE TABLE bids (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id  UUID NOT NULL REFERENCES users(id),
  amount     NUMERIC(12,2) NOT NULL,
  placed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bids_auction ON bids (auction_id, amount DESC);

-- ---------- Jobs & hiring ----------
CREATE TABLE jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  company     TEXT NOT NULL,
  location    TEXT NOT NULL,
  experience  TEXT,
  type        TEXT NOT NULL DEFAULT 'Full-time',
  salary      TEXT,
  category    TEXT,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_active ON jobs (active, posted_at DESC);
CREATE TABLE applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES users(id),
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','hired','rejected')),
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);

-- ---------- Mental health & wellness ----------
CREATE TABLE mood_checkins (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood    TEXT NOT NULL CHECK (mood IN ('great','good','okay','low','rough')),
  note    TEXT,
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_user ON mood_checkins (user_id, at DESC);
CREATE TABLE wellness_resources (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  text  TEXT NOT NULL,
  kind  TEXT NOT NULL CHECK (kind IN ('crisis','practice','tip','community'))
);

-- ---------- Notifications ----------
CREATE TABLE notifications (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type     TEXT NOT NULL CHECK (type IN ('like','comment','follow','bid','job','system')),
  text     TEXT NOT NULL,
  read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, read, created_at DESC);

-- ---------- User settings ----------
CREATE TABLE user_settings (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_profile BOOLEAN NOT NULL DEFAULT TRUE,
  show_online    BOOLEAN NOT NULL DEFAULT TRUE,
  notif_likes    BOOLEAN NOT NULL DEFAULT TRUE,
  notif_comments BOOLEAN NOT NULL DEFAULT TRUE,
  notif_follows  BOOLEAN NOT NULL DEFAULT TRUE,
  notif_bids     BOOLEAN NOT NULL DEFAULT TRUE,
  notif_jobs     BOOLEAN NOT NULL DEFAULT TRUE,
  theme          TEXT NOT NULL DEFAULT 'dark'
);

-- ---------- Live video ----------
CREATE TABLE live_streams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  playback_url TEXT,
  stream_key   TEXT,
  viewer_count INT NOT NULL DEFAULT 0,
  live         BOOLEAN NOT NULL DEFAULT TRUE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ
);

-- ---------- Recommended feed (per-user score table) ----------
CREATE TABLE feed_scores (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  score     DOUBLE PRECISION NOT NULL,      -- ranking model output
  reason    TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX idx_feed_scores_user ON feed_scores (user_id, score DESC);

COMMIT;