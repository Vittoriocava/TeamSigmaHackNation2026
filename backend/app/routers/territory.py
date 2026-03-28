import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.models import ConquerRequest
from app.auth import get_current_user
from app.services.coins import award_coins
from app.db import get_db, row_to_dict, rows_to_list

router = APIRouter(prefix="/api/territory", tags=["territory"])

CONQUEST_COINS = 50
DEFENSE_COINS = 20
DECAY_DAYS = 7


@router.post("/conquer")
async def conquer_territory(req: ConquerRequest, user_id: str = Depends(get_current_user)):
    """Conquer a POI after GPS verification."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT * FROM territories WHERE poi_id = ? AND active = 1",
            (req.poi_id,),
        ).fetchone()

        if existing:
            owner = dict(existing)
            if owner["user_id"] == user_id:
                raise HTTPException(status_code=400, detail="Possiedi già questo territorio")
            conn.execute("UPDATE territories SET active = 0 WHERE id = ?", (owner["id"],))
            conn.execute(
                "INSERT INTO territory_history (poi_id, user_id, city_slug, from_date, to_date) VALUES (?, ?, ?, ?, ?)",
                (req.poi_id, owner["user_id"], req.city_slug, owner["conquered_at"], datetime.now(timezone.utc).isoformat()),
            )

        territory_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO territories (id, user_id, poi_id, city_slug) VALUES (?, ?, ?, ?)",
            (territory_id, user_id, req.poi_id, req.city_slug),
        )
        territory = conn.execute("SELECT * FROM territories WHERE id = ?", (territory_id,)).fetchone()

        pieces = conn.execute(
            "SELECT pieces_collected FROM poi_pieces WHERE user_id = ? AND poi_id = ?",
            (user_id, req.poi_id),
        ).fetchone()

    bonus = 30 if pieces and pieces["pieces_collected"] >= 3 else 0
    total = CONQUEST_COINS + bonus
    balance = await award_coins(user_id, total, "conquista_territorio", req.poi_id)

    return {
        "status": "conquered",
        "territory": row_to_dict(territory),
        "coins_earned": total,
        "bonus_preclaim": bonus,
        "balance": balance,
    }


@router.post("/defend")
async def defend_territory(poi_id: str, user_id: str = Depends(get_current_user)):
    """Defend a territory by completing a quiz."""
    with get_db() as conn:
        territory = conn.execute(
            "SELECT * FROM territories WHERE poi_id = ? AND user_id = ? AND active = 1",
            (poi_id, user_id),
        ).fetchone()

        if not territory:
            raise HTTPException(status_code=404, detail="Non possiedi questo territorio")

        t = dict(territory)
        new_weeks = t["weeks_held"] + 1
        new_tier = min(3, 1 + new_weeks // 2)

        conn.execute(
            "UPDATE territories SET last_defended_at = ?, weeks_held = ?, tier = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), new_weeks, new_tier, t["id"]),
        )

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
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM territories WHERE user_id = ? AND active = 1", (user_id,)
        ).fetchall()
    return {"territories": rows_to_list(rows)}


@router.get("/poi/{poi_id}")
async def get_poi_owner(poi_id: str):
    """Get current owner of a POI."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT t.*, u.display_name, u.avatar_url, u.level
               FROM territories t
               LEFT JOIN users u ON t.user_id = u.id
               WHERE t.poi_id = ? AND t.active = 1""",
            (poi_id,),
        ).fetchone()

    if not row:
        return {"owner": None, "status": "free"}

    data = dict(row)
    # Nest user info like Supabase did
    data["users"] = {
        "display_name": data.pop("display_name", None),
        "avatar_url": data.pop("avatar_url", None),
        "level": data.pop("level", None),
    }
    return {"owner": data, "status": "owned"}


@router.get("/city/{city_slug}")
async def get_city_territories(city_slug: str):
    """Get all active territories in a city."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT poi_id, user_id, tier, weeks_held, conquered_at, last_defended_at FROM territories WHERE city_slug = ? AND active = 1",
            (city_slug,),
        ).fetchall()
    return {"city_slug": city_slug, "territories": rows_to_list(rows)}


@router.post("/decay")
async def run_decay():
    """Mark territories as inactive if not defended in DECAY_DAYS days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=DECAY_DAYS)).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    decayed = []

    with get_db() as conn:
        stale = conn.execute(
            "SELECT * FROM territories WHERE active = 1 AND last_defended_at < ?",
            (cutoff,),
        ).fetchall()

        for t in stale:
            t = dict(t)
            conn.execute("UPDATE territories SET active = 0 WHERE id = ?", (t["id"],))
            conn.execute(
                "INSERT INTO territory_history (poi_id, user_id, city_slug, from_date, to_date) VALUES (?, ?, ?, ?, ?)",
                (t["poi_id"], t["user_id"], t["city_slug"], t["conquered_at"], now),
            )
            decayed.append(t["poi_id"])

    return {"decayed": decayed, "count": len(decayed)}
