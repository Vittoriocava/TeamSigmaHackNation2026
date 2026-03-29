import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models import ConquerRequest
from app.auth import get_current_user
from app.services.coins import award_coins
from app.db import get_db, row_to_dict, rows_to_list

router = APIRouter(prefix="/api/territory", tags=["territory"])

CONQUEST_COINS = 50
DEFENSE_COINS = 20
DECAY_DAYS = 7          # Check weekly for tier downgrade
TERRITORY_EXPIRY_DAYS = 30  # Full territory loss after 30 days (1 month)


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
            "INSERT INTO territories (id, user_id, poi_id, city_slug, tier) VALUES (?, ?, ?, ?, 4)",
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
        # Defend resets tier to 4 and updates defense timer
        conn.execute(
            "UPDATE territories SET last_defended_at = ?, tier = 4 WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), t["id"]),
        )

    balance = await award_coins(user_id, DEFENSE_COINS, "difesa_territorio", poi_id)

    return {
        "status": "defended",
        "tier": 4,
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
    return {"owner": data, "status": "owned", "custom_phrase": data.get("custom_phrase", "")}


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
    """Weekly tier decay + monthly expiry.
    
    - Territories not defended in 7 days lose 1 tier (min 1)
    - Territories older than 30 days are removed entirely
    """
    weekly_cutoff = (datetime.now(timezone.utc) - timedelta(days=DECAY_DAYS)).isoformat()
    monthly_cutoff = (datetime.now(timezone.utc) - timedelta(days=TERRITORY_EXPIRY_DAYS)).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    decayed = []
    downgraded = []

    with get_db() as conn:
        # 1. Monthly expiry — remove territories older than 30 days
        expired = conn.execute(
            "SELECT * FROM territories WHERE active = 1 AND conquered_at < ?",
            (monthly_cutoff,),
        ).fetchall()

        for t in expired:
            t = dict(t)
            conn.execute("UPDATE territories SET active = 0 WHERE id = ?", (t["id"],))
            conn.execute(
                "INSERT INTO territory_history (poi_id, user_id, city_slug, from_date, to_date) VALUES (?, ?, ?, ?, ?)",
                (t["poi_id"], t["user_id"], t["city_slug"], t["conquered_at"], now),
            )
            decayed.append(t["poi_id"])

        # 2. Weekly tier downgrade — lower tier by 1 if not defended
        stale = conn.execute(
            "SELECT * FROM territories WHERE active = 1 AND last_defended_at < ? AND id NOT IN (SELECT id FROM territories WHERE active = 1 AND conquered_at < ?)",
            (weekly_cutoff, monthly_cutoff),
        ).fetchall()

        for t in stale:
            t = dict(t)
            new_tier = max(1, t["tier"] - 1)
            conn.execute(
                "UPDATE territories SET tier = ?, last_defended_at = ? WHERE id = ?",
                (new_tier, now, t["id"]),
            )
            downgraded.append({"poi_id": t["poi_id"], "old_tier": t["tier"], "new_tier": new_tier})

    return {
        "expired": decayed,
        "expired_count": len(decayed),
        "downgraded": downgraded,
        "downgraded_count": len(downgraded),
    }


class SetPhraseRequest(BaseModel):
    poi_id: str
    phrase: str


@router.post("/set-phrase")
async def set_phrase(req: SetPhraseRequest, user_id: str = Depends(get_current_user)):
    """Set a custom phrase on a conquered territory."""
    with get_db() as conn:
        territory = conn.execute(
            "SELECT id FROM territories WHERE poi_id = ? AND user_id = ? AND active = 1",
            (req.poi_id, user_id),
        ).fetchone()
        if not territory:
            raise HTTPException(status_code=404, detail="Non possiedi questo territorio")

        conn.execute(
            "UPDATE territories SET custom_phrase = ? WHERE id = ?",
            (req.phrase[:200], dict(territory)["id"]),  # cap at 200 chars
        )

    return {"status": "phrase_set", "phrase": req.phrase[:200]}


@router.post("/greet")
async def greet_territory(poi_id: str, user_id: str = Depends(get_current_user)):
    """Greet the territory owner. Awards XP to both users."""
    with get_db() as conn:
        territory = conn.execute(
            "SELECT * FROM territories WHERE poi_id = ? AND active = 1",
            (poi_id,),
        ).fetchone()
        if not territory:
            raise HTTPException(status_code=404, detail="Territorio non trovato")
        t = dict(territory)
        if t["user_id"] == user_id:
            raise HTTPException(status_code=400, detail="Non puoi salutare il tuo stesso territorio")

        # Award XP to both: greeter gets 5, owner gets 10
        conn.execute("UPDATE users SET xp = xp + 5 WHERE id = ?", (user_id,))
        conn.execute("UPDATE users SET xp = xp + 10 WHERE id = ?", (t["user_id"],))

    await award_coins(user_id, 5, "saluto_inviato", poi_id)
    await award_coins(t["user_id"], 10, "saluto_ricevuto", poi_id)

    return {"status": "greeted", "xp_earned": 5, "owner_xp_earned": 10}

