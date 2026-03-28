-- ============================================================
-- Play The City — Supabase Database Schema
-- HackNation 2026 — Team Sigma
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS & PROFILES
-- ============================================================

CREATE TABLE users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    avatar_url  TEXT,
    level       INT NOT NULL DEFAULT 1,
    xp          INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    age_range       TEXT,
    interests       TEXT[] DEFAULT '{}',
    language        TEXT NOT NULL DEFAULT 'it',
    cultural_level  TEXT NOT NULL DEFAULT 'casual' CHECK (cultural_level IN ('casual','appassionato','esperto')),
    pace            TEXT NOT NULL DEFAULT 'medium' CHECK (pace IN ('slow','medium','fast')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE swipe_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    poi_id      TEXT NOT NULL,
    liked       BOOLEAN NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_swipe_user ON swipe_history(user_id);
CREATE INDEX idx_swipe_poi  ON swipe_history(poi_id);

-- ============================================================
-- GAMES
-- ============================================================

CREATE TABLE games (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city        TEXT NOT NULL,
    city_slug   TEXT NOT NULL,
    board_json  JSONB NOT NULL DEFAULT '{}',
    mode        TEXT NOT NULL CHECK (mode IN ('solo','group','open')),
    status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','completed')),
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_city   ON games(city_slug);
CREATE INDEX idx_games_status ON games(status);

CREATE TABLE game_players (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    score           INT NOT NULL DEFAULT 0,
    unlocked_pois   TEXT[] DEFAULT '{}',
    completed_at    TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(game_id, user_id)
);

CREATE INDEX idx_gp_game ON game_players(game_id);
CREATE INDEX idx_gp_user ON game_players(user_id);

-- ============================================================
-- TEAMS
-- ============================================================

CREATE TABLE teams (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code   TEXT UNIQUE NOT NULL,
    game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id, user_id)
);

-- ============================================================
-- TERRITORY SYSTEM
-- ============================================================

CREATE TABLE territories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    poi_id          TEXT NOT NULL,
    city_slug       TEXT NOT NULL,
    conquered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_defended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tier            INT NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
    weeks_held      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_terr_user   ON territories(user_id);
CREATE INDEX idx_terr_poi    ON territories(poi_id);
CREATE INDEX idx_terr_city   ON territories(city_slug);
CREATE INDEX idx_terr_active ON territories(active);
CREATE UNIQUE INDEX idx_terr_active_poi ON territories(poi_id) WHERE active = true;

CREATE TABLE territory_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poi_id      TEXT NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id),
    city_slug   TEXT NOT NULL,
    from_date   TIMESTAMPTZ NOT NULL,
    to_date     TIMESTAMPTZ
);

CREATE INDEX idx_th_poi  ON territory_history(poi_id);
CREATE INDEX idx_th_user ON territory_history(user_id);

-- ============================================================
-- MONUMENTS
-- ============================================================

CREATE TABLE monuments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    poi_id          TEXT NOT NULL,
    label           TEXT NOT NULL DEFAULT '',
    avatar_url      TEXT,
    quiz_id_chosen  UUID,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mon_poi ON monuments(poi_id);

CREATE TABLE monument_likes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monument_id     UUID NOT NULL REFERENCES monuments(id) ON DELETE CASCADE,
    from_user_id    UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(monument_id, from_user_id)
);

-- ============================================================
-- POI PIECES (pre-conquista da casa)
-- ============================================================

CREATE TABLE poi_pieces (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id),
    poi_id              TEXT NOT NULL,
    pieces_collected    INT NOT NULL DEFAULT 0 CHECK (pieces_collected BETWEEN 0 AND 3),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, poi_id)
);

-- ============================================================
-- ECONOMY
-- ============================================================

CREATE TABLE coins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id),
    balance         INT NOT NULL DEFAULT 0,
    lifetime_earned INT NOT NULL DEFAULT 0
);

CREATE TABLE coin_transactions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id),
    amount      INT NOT NULL,
    reason      TEXT NOT NULL,
    ref_id      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ct_user ON coin_transactions(user_id);

-- ============================================================
-- QUIZ SYSTEM
-- ============================================================

CREATE TABLE quiz_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code       TEXT UNIQUE NOT NULL,
    city            TEXT NOT NULL,
    host_user_id    UUID NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished')),
    max_players     INT NOT NULL DEFAULT 8,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quiz_session_players (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    score           INT NOT NULL DEFAULT 0,
    coins_earned    INT NOT NULL DEFAULT 0,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, user_id)
);

CREATE TABLE quiz_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    poi_id          TEXT NOT NULL,
    question_hash   TEXT NOT NULL,
    correct         BOOLEAN NOT NULL,
    time_ms         INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qr_user ON quiz_results(user_id);
CREATE INDEX idx_qr_poi  ON quiz_results(poi_id);

-- ============================================================
-- PRESENCE (realtime)
-- ============================================================

CREATE TABLE presence (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id),
    city_slug   TEXT NOT NULL,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presence_city ON presence(city_slug);
CREATE INDEX idx_presence_seen ON presence(last_seen);

-- ============================================================
-- AI CACHE — Timeline images
-- ============================================================

CREATE TABLE temporal_images (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poi_id      TEXT NOT NULL,
    era_label   TEXT NOT NULL,
    image_url   TEXT NOT NULL,
    dalle_prompt TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(poi_id, era_label)
);

CREATE INDEX idx_ti_poi ON temporal_images(poi_id);

-- ============================================================
-- MATERIALIZED VIEW — Leaderboard
-- ============================================================

CREATE MATERIALIZED VIEW leaderboard AS
SELECT
    u.id            AS user_id,
    u.display_name,
    u.avatar_url,
    u.level,
    COALESCE(c.balance, 0)              AS coins,
    COALESCE(t.territories_count, 0)    AS territories_held,
    COALESCE(gp.total_score, 0)         AS total_score,
    (COALESCE(gp.total_score, 0) + COALESCE(t.territories_count, 0) * 100 + u.xp) AS rank_score
FROM users u
LEFT JOIN coins c ON c.user_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS territories_count
    FROM territories WHERE active = true
    GROUP BY user_id
) t ON t.user_id = u.id
LEFT JOIN (
    SELECT user_id, SUM(score) AS total_score
    FROM game_players
    GROUP BY user_id
) gp ON gp.user_id = u.id;

CREATE UNIQUE INDEX idx_leaderboard_user ON leaderboard(user_id);
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank_score DESC);

-- Function to refresh leaderboard
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- AUTO-CREATE user record on auth signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

    INSERT INTO profiles (user_id) VALUES (NEW.id);
    INSERT INTO coins (user_id) VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- AUTO-UPDATE updated_at on profiles
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monuments ENABLE ROW LEVEL SECURITY;
ALTER TABLE monument_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporal_images ENABLE ROW LEVEL SECURITY;

-- Users: read all, update own
CREATE POLICY users_select ON users FOR SELECT USING (true);
CREATE POLICY users_update ON users FOR UPDATE USING (auth.uid() = id);

-- Profiles: read all, modify own
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Swipe history: own only
CREATE POLICY swipe_select ON swipe_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY swipe_insert ON swipe_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Games: read all, create own
CREATE POLICY games_select ON games FOR SELECT USING (true);
CREATE POLICY games_insert ON games FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY games_update ON games FOR UPDATE USING (auth.uid() = created_by);

-- Game players: read all, join own
CREATE POLICY gp_select ON game_players FOR SELECT USING (true);
CREATE POLICY gp_insert ON game_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY gp_update ON game_players FOR UPDATE USING (auth.uid() = user_id);

-- Teams: read all
CREATE POLICY teams_select ON teams FOR SELECT USING (true);
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (true);

-- Team members: read all, join own
CREATE POLICY tm_select ON team_members FOR SELECT USING (true);
CREATE POLICY tm_insert ON team_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Territories: read all, modify own
CREATE POLICY terr_select ON territories FOR SELECT USING (true);
CREATE POLICY terr_insert ON territories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY terr_update ON territories FOR UPDATE USING (auth.uid() = user_id);

-- Territory history: read all
CREATE POLICY th_select ON territory_history FOR SELECT USING (true);

-- Monuments: read all, modify own
CREATE POLICY mon_select ON monuments FOR SELECT USING (true);
CREATE POLICY mon_insert ON monuments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY mon_update ON monuments FOR UPDATE USING (auth.uid() = user_id);

-- Monument likes: read all, create own
CREATE POLICY ml_select ON monument_likes FOR SELECT USING (true);
CREATE POLICY ml_insert ON monument_likes FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- POI pieces: own only
CREATE POLICY pp_select ON poi_pieces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pp_insert ON poi_pieces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pp_update ON poi_pieces FOR UPDATE USING (auth.uid() = user_id);

-- Coins: own only
CREATE POLICY coins_select ON coins FOR SELECT USING (auth.uid() = user_id);

-- Coin transactions: own only
CREATE POLICY ct_select ON coin_transactions FOR SELECT USING (auth.uid() = user_id);

-- Quiz sessions: read all, host creates
CREATE POLICY qs_select ON quiz_sessions FOR SELECT USING (true);
CREATE POLICY qs_insert ON quiz_sessions FOR INSERT WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY qs_update ON quiz_sessions FOR UPDATE USING (auth.uid() = host_user_id);

-- Quiz session players: read all, join own
CREATE POLICY qsp_select ON quiz_session_players FOR SELECT USING (true);
CREATE POLICY qsp_insert ON quiz_session_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY qsp_update ON quiz_session_players FOR UPDATE USING (auth.uid() = user_id);

-- Quiz results: own only
CREATE POLICY qr_select ON quiz_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY qr_insert ON quiz_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Presence: read all, modify own
CREATE POLICY pres_select ON presence FOR SELECT USING (true);
CREATE POLICY pres_insert ON presence FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pres_update ON presence FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pres_delete ON presence FOR DELETE USING (auth.uid() = user_id);

-- Temporal images: read all (cache pubblica)
CREATE POLICY ti_select ON temporal_images FOR SELECT USING (true);
CREATE POLICY ti_insert ON temporal_images FOR INSERT WITH CHECK (true);

-- ============================================================
-- REALTIME — Enable for key tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE territories;
ALTER PUBLICATION supabase_realtime ADD TABLE monument_likes;
