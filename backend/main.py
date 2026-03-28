import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.routers.city import router as city_router
from app.routers.profile import router as profile_router
from app.routers.timeline import router as timeline_router
from app.routers.audio import router as audio_router
from app.routers.vision import router as vision_router
from app.routers.territory import router as territory_router
from app.routers.quiz import router as quiz_router
from app.routers.presence import router as presence_router
from app.routers.game import router as game_router
from app.routers.trip import router as trip_router
from app.db import get_db, init_db, rows_to_list
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("playthecity")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

app = FastAPI(
    title="Play The City API",
    description="Backend API per Play The City — HackNation 2026",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(city_router)
app.include_router(profile_router)
app.include_router(timeline_router)
app.include_router(audio_router)
app.include_router(vision_router)
app.include_router(territory_router)
app.include_router(quiz_router)
app.include_router(presence_router)
app.include_router(game_router)
app.include_router(trip_router)


# ── Auth models ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _make_token(user_id: str) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    """Create a new user account."""
    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(req.password)
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)",
                (user_id, req.email.lower().strip(), req.display_name, password_hash),
            )
            # init coins row
            conn.execute(
                "INSERT INTO coins (user_id) VALUES (?)", (user_id,)
            )
    except Exception:
        raise HTTPException(status_code=400, detail="Email già in uso")

    token = _make_token(user_id)
    return {
        "token": token,
        "user": {"id": user_id, "email": req.email, "display_name": req.display_name, "level": 1, "xp": 0},
    }


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    """Login with email and password."""
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?", (req.email.lower().strip(),)
        ).fetchone()

    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    token = _make_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "display_name": user["display_name"],
            "avatar_url": user["avatar_url"],
            "level": user["level"],
            "xp": user["xp"],
        },
    }


# ── Leaderboard ───────────────────────────────────────────────────────────────

@app.get("/api/leaderboard")
async def get_leaderboard(limit: int = 50):
    """Get global leaderboard."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, display_name, avatar_url, level, xp FROM users ORDER BY xp DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return {"leaderboard": rows_to_list(rows)}


@app.get("/api/leaderboard/city/{city_slug}")
async def get_city_leaderboard(city_slug: str, limit: int = 50):
    """Get leaderboard for a specific city."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT gp.user_id, gp.score, u.display_name, u.avatar_url, u.level
               FROM game_players gp
               JOIN games g ON gp.game_id = g.id
               LEFT JOIN users u ON gp.user_id = u.id
               WHERE g.city_slug = ?
               ORDER BY gp.score DESC
               LIMIT ?""",
            (city_slug, limit),
        ).fetchall()

    result = []
    for p in rows:
        pd = dict(p)
        pd["users"] = {"display_name": pd.pop("display_name", None), "avatar_url": pd.pop("avatar_url", None), "level": pd.pop("level", None)}
        result.append(pd)

    return {"city": city_slug, "leaderboard": result}


# ── System ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"name": "Play The City API", "version": "0.1.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("🏙️ Play The City API running — HackNation 2026 (SQLite)")
