import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.environ.get("SQLITE_PATH", "playthecity.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    interests TEXT DEFAULT '[]',
    age_range TEXT DEFAULT '',
    cultural_level TEXT DEFAULT 'casual',
    language TEXT DEFAULT 'it',
    pace TEXT DEFAULT 'medium'
);

CREATE TABLE IF NOT EXISTS coins (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    lifetime_earned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coin_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    ref_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    city_slug TEXT NOT NULL,
    board_json TEXT NOT NULL,
    mode TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    unlocked_pois TEXT DEFAULT '[]',
    UNIQUE(game_id, user_id)
);

CREATE TABLE IF NOT EXISTS territories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    poi_id TEXT NOT NULL,
    city_slug TEXT NOT NULL,
    conquered_at TEXT DEFAULT (datetime('now')),
    last_defended_at TEXT DEFAULT (datetime('now')),
    weeks_held INTEGER DEFAULT 0,
    tier INTEGER DEFAULT 1,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS territory_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poi_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    city_slug TEXT,
    from_date TEXT,
    to_date TEXT
);

CREATE TABLE IF NOT EXISTS poi_pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    poi_id TEXT NOT NULL,
    pieces_collected INTEGER DEFAULT 0,
    UNIQUE(user_id, poi_id)
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
    id TEXT PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL,
    host_user_id TEXT,
    status TEXT DEFAULT 'waiting',
    max_players INTEGER DEFAULT 10,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_session_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    coins_earned INTEGER DEFAULT 0,
    UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    poi_id TEXT,
    question_hash TEXT,
    correct INTEGER DEFAULT 0,
    time_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS swipe_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    poi_id TEXT NOT NULL,
    liked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS temporal_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poi_id TEXT NOT NULL,
    era_label TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    dalle_prompt TEXT DEFAULT '',
    UNIQUE(poi_id, era_label)
);

CREATE TABLE IF NOT EXISTS presence (
    user_id TEXT PRIMARY KEY,
    city_slug TEXT,
    lat REAL DEFAULT 0,
    lng REAL DEFAULT 0,
    last_seen TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itineraries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    city TEXT NOT NULL,
    city_slug TEXT NOT NULL,
    days INTEGER DEFAULT 1,
    liked_pois_count INTEGER DEFAULT 0,
    itinerary_json TEXT NOT NULL,
    trip_profile_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'future',
    start_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    poi_id TEXT NOT NULL,
    poi_name TEXT DEFAULT '',
    city TEXT DEFAULT '',
    pieces_collected INTEGER DEFAULT 0,
    UNIQUE(user_id, poi_id)
);

CREATE TABLE IF NOT EXISTS weekly_challenges (
    id TEXT PRIMARY KEY,
    city_slug TEXT NOT NULL,
    poi_id TEXT NOT NULL,
    poi_name TEXT NOT NULL,
    hint TEXT DEFAULT '',
    week_start TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_challenge_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    submitted_at TEXT DEFAULT (datetime('now')),
    UNIQUE(challenge_id, user_id)
);
"""


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist."""
    with get_db() as conn:
        conn.executescript(SCHEMA)
        # Migrations for existing databases
        for migration in [
            "ALTER TABLE itineraries ADD COLUMN start_date TEXT",
            "ALTER TABLE territories ADD COLUMN custom_phrase TEXT DEFAULT ''",
        ]:
            try:
                conn.execute(migration)
            except Exception:
                pass  # column already exists


def row_to_dict(row) -> dict:
    return dict(row) if row else None


def rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]
