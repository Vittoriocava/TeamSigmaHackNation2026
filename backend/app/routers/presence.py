from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import get_db, rows_to_list

router = APIRouter(prefix="/api/presence", tags=["presence"])


@router.post("/update")
async def update_presence(city_slug: str, lat: float, lng: float, user_id: str = Depends(get_current_user)):
    """Update user's position and city for realtime presence."""
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO presence (user_id, city_slug, lat, lng, last_seen)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 city_slug = excluded.city_slug,
                 lat = excluded.lat,
                 lng = excluded.lng,
                 last_seen = excluded.last_seen""",
            (user_id, city_slug, lat, lng, now),
        )
    return {"status": "ok"}


@router.get("/city/{city_slug}")
async def get_city_presence(city_slug: str):
    """Get active players in a city (last 5 min)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT lat, lng, last_seen FROM presence WHERE city_slug = ? AND last_seen > ?",
            (city_slug, cutoff),
        ).fetchall()
    positions = rows_to_list(rows)
    return {"city": city_slug, "active_players": len(positions), "positions": positions}


@router.delete("/leave")
async def leave_presence(user_id: str = Depends(get_current_user)):
    """Remove user from presence tracking."""
    with get_db() as conn:
        conn.execute("DELETE FROM presence WHERE user_id = ?", (user_id,))
    return {"status": "ok"}
