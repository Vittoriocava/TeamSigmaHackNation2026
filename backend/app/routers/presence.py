from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.db import supabase

router = APIRouter(prefix="/api/presence", tags=["presence"])


@router.post("/update")
async def update_presence(city_slug: str, lat: float, lng: float, user_id: str = Depends(get_current_user)):
    """Update user's position and city for realtime presence."""
    supabase.table("presence").upsert({
        "user_id": user_id,
        "city_slug": city_slug,
        "lat": lat,
        "lng": lng,
        "last_seen": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()
    return {"status": "ok"}


@router.get("/city/{city_slug}")
async def get_city_presence(city_slug: str):
    """Get active players in a city (last 5 min)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    result = (
        supabase.table("presence")
        .select("lat, lng, last_seen")
        .eq("city_slug", city_slug)
        .gt("last_seen", cutoff)
        .execute()
    )
    return {"city": city_slug, "active_players": len(result.data), "positions": result.data}


@router.delete("/leave")
async def leave_presence(user_id: str = Depends(get_current_user)):
    """Remove user from presence tracking."""
    supabase.table("presence").delete().eq("user_id", user_id).execute()
    return {"status": "ok"}
