from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from models import ConquerRequest
from auth import get_current_user
from coin_engine import award_coins
from supabase_client import supabase

router = APIRouter(prefix="/api/territory", tags=["territory"])

CONQUEST_COINS = 50
DEFENSE_COINS = 20
DECAY_DAYS = 7


@router.post("/conquer")
async def conquer_territory(req: ConquerRequest, user_id: str = Depends(get_current_user)):
    """Conquer a POI after GPS verification."""
    # Check if POI is already owned
    existing = (
        supabase.table("territories")
        .select("*")
        .eq("poi_id", req.poi_id)
        .eq("active", True)
        .execute()
    )

    if existing.data:
        owner = existing.data[0]
        if owner["user_id"] == user_id:
            raise HTTPException(status_code=400, detail="Possiedi già questo territorio")
        # Deactivate previous owner
        supabase.table("territories").update({
            "active": False,
        }).eq("id", owner["id"]).execute()
        # Record in history
        supabase.table("territory_history").insert({
            "poi_id": req.poi_id,
            "user_id": owner["user_id"],
            "city_slug": req.city_slug,
            "from_date": owner["conquered_at"],
            "to_date": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # Create new territory
    territory = supabase.table("territories").insert({
        "user_id": user_id,
        "poi_id": req.poi_id,
        "city_slug": req.city_slug,
    }).execute()

    # Check if user had pre-claimed (3 pieces)
    pieces = (
        supabase.table("poi_pieces")
        .select("pieces_collected")
        .eq("user_id", user_id)
        .eq("poi_id", req.poi_id)
        .execute()
    )
    bonus = 0
    if pieces.data and pieces.data[0]["pieces_collected"] >= 3:
        bonus = 30  # Bonus for pre-claim

    # Award coins
    total = CONQUEST_COINS + bonus
    balance = await award_coins(user_id, total, "conquista_territorio", req.poi_id)

    # Award XP
    supabase.rpc("increment_xp", {"uid": user_id, "amount": 25}).execute()

    return {
        "status": "conquered",
        "territory": territory.data[0] if territory.data else {},
        "coins_earned": total,
        "bonus_preclaim": bonus,
        "balance": balance,
    }


@router.post("/defend")
async def defend_territory(poi_id: str, user_id: str = Depends(get_current_user)):
    """Defend a territory by completing a quiz (called after quiz success)."""
    territory = (
        supabase.table("territories")
        .select("*")
        .eq("poi_id", poi_id)
        .eq("user_id", user_id)
        .eq("active", True)
        .single()
        .execute()
    )

    if not territory.data:
        raise HTTPException(status_code=404, detail="Non possiedi questo territorio")

    t = territory.data
    new_weeks = t["weeks_held"] + 1
    new_tier = min(3, 1 + new_weeks // 2)

    supabase.table("territories").update({
        "last_defended_at": datetime.now(timezone.utc).isoformat(),
        "weeks_held": new_weeks,
        "tier": new_tier,
    }).eq("id", t["id"]).execute()

    balance = await award_coins(user_id, DEFENSE_COINS, "difesa_territorio", poi_id)

    return {
        "status": "defended",
        "weeks_held": new_weeks,
        "tier": new_tier,
        "coins_earned": DEFENSE_COINS,
        "balance": balance,
    }


@router.get("/user/{user_id}")
async def get_user_territories(user_id: str):
    """Get all active territories for a user."""
    result = supabase.table("territories").select("*").eq("user_id", user_id).eq("active", True).execute()
    return {"territories": result.data}


@router.get("/poi/{poi_id}")
async def get_poi_owner(poi_id: str):
    """Get current owner of a POI."""
    result = (
        supabase.table("territories")
        .select("*, users(display_name, avatar_url, level)")
        .eq("poi_id", poi_id)
        .eq("active", True)
        .execute()
    )
    if not result.data:
        return {"owner": None, "status": "free"}
    return {"owner": result.data[0], "status": "owned"}


@router.get("/city/{city_slug}")
async def get_city_territories(city_slug: str):
    """Get all active territories in a city (for map coloring)."""
    result = (
        supabase.table("territories")
        .select("poi_id, user_id, tier, weeks_held, conquered_at, last_defended_at")
        .eq("city_slug", city_slug)
        .eq("active", True)
        .execute()
    )
    return {"city": city_slug, "territories": result.data}


@router.post("/decay")
async def run_decay():
    """Run decay check — deactivate undefended territories."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=DECAY_DAYS)).isoformat()
    expired = (
        supabase.table("territories")
        .select("*")
        .eq("active", True)
        .lt("last_defended_at", cutoff)
        .execute()
    )

    deactivated = 0
    for t in expired.data or []:
        supabase.table("territories").update({"active": False}).eq("id", t["id"]).execute()
        supabase.table("territory_history").insert({
            "poi_id": t["poi_id"],
            "user_id": t["user_id"],
            "city_slug": t["city_slug"],
            "from_date": t["conquered_at"],
            "to_date": datetime.now(timezone.utc).isoformat(),
        }).execute()
        deactivated += 1

    return {"deactivated": deactivated}
