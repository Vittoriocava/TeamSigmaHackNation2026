import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
from app.db import supabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("playthecity")

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


@app.get("/")
async def root():
    return {"name": "Play The City API", "version": "0.1.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    logger.info("🏙️ Play The City API running — HackNation 2026")


@app.get("/api/leaderboard")
async def get_leaderboard(limit: int = 50):
    """Get global leaderboard."""
    try:
        result = supabase.from_("leaderboard").select("*").order("rank_score", desc=True).limit(limit).execute()
        return {"leaderboard": result.data}
    except Exception:
        result = (
            supabase.table("users")
            .select("id, display_name, avatar_url, level, xp")
            .order("xp", desc=True)
            .limit(limit)
            .execute()
        )
        return {"leaderboard": result.data}


@app.get("/api/leaderboard/city/{city_slug}")
async def get_city_leaderboard(city_slug: str, limit: int = 50):
    """Get leaderboard for a specific city."""
    result = (
        supabase.table("game_players")
        .select("user_id, score, users(display_name, avatar_url, level)")
        .order("score", desc=True)
        .limit(limit)
        .execute()
    )
    return {"city": city_slug, "leaderboard": result.data}
