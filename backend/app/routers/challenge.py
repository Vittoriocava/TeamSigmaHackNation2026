import uuid
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.services.ai import analyze_photo
from app.models import POI
from app.db import get_db, row_to_dict, rows_to_list

router = APIRouter(prefix="/api/challenge", tags=["challenge"])

# XP rewards: first finder gets most, diminishing returns
XP_REWARDS = [500, 300, 200, 150, 100, 80, 60, 50, 40, 30]
DEFAULT_XP = 20


def _current_week_start() -> str:
    """Get ISO date string for the start of the current week (Monday)."""
    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    return monday.strftime("%Y-%m-%d")


# ── City POI data for challenge generation ────────────────────────────────────
# Import from city router to reuse existing POI data
from app.routers.city import CITY_POIS


@router.get("/weekly/{city_slug}")
async def get_weekly_challenge(city_slug: str):
    """Get the active weekly challenge for a city."""
    week_start = _current_week_start()

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM weekly_challenges WHERE city_slug = ? AND week_start = ? AND active = 1",
            (city_slug, week_start),
        ).fetchone()

        if not row:
            return {"challenge": None, "message": "Nessuna sfida attiva per questa città"}

        challenge = dict(row)

        # Get submissions leaderboard
        submissions = conn.execute(
            """SELECT wcs.user_id, wcs.xp_earned, wcs.submitted_at,
                      u.display_name, u.avatar_url
               FROM weekly_challenge_submissions wcs
               LEFT JOIN users u ON wcs.user_id = u.id
               WHERE wcs.challenge_id = ? AND wcs.verified = 1
               ORDER BY wcs.submitted_at ASC""",
            (challenge["id"],),
        ).fetchall()

    return {
        "challenge": challenge,
        "leaderboard": rows_to_list(submissions),
        "total_found": len(submissions),
    }


class SubmitPhotoRequest(BaseModel):
    image_base64: str


@router.post("/weekly/{challenge_id}/submit")
async def submit_challenge_photo(
    challenge_id: str,
    req: SubmitPhotoRequest,
    user_id: str = Depends(get_current_user),
):
    """Submit a photo for the weekly challenge. Uses Vision AI to verify."""
    with get_db() as conn:
        challenge = conn.execute(
            "SELECT * FROM weekly_challenges WHERE id = ? AND active = 1",
            (challenge_id,),
        ).fetchone()

        if not challenge:
            raise HTTPException(status_code=404, detail="Sfida non trovata o scaduta")

        challenge = dict(challenge)

        # Check if user already submitted
        existing = conn.execute(
            "SELECT * FROM weekly_challenge_submissions WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, user_id),
        ).fetchone()

        if existing:
            return {"already_submitted": True, "verified": dict(existing)["verified"]}

    # Use Vision AI to verify the photo matches the target POI
    target_poi = POI(
        id=challenge["poi_id"],
        name=challenge["poi_name"],
        lat=0, lng=0,
    )

    try:
        analysis = await analyze_photo(req.image_base64, target_poi)
    except Exception:
        analysis = {"identified": False, "confidence": 0.0, "description": "Errore nell'analisi"}

    verified = bool(analysis.get("identified", False))
    confidence = float(analysis.get("confidence", 0.0))

    # Require at least 0.6 confidence for verification
    if confidence < 0.6:
        verified = False

    xp_earned = 0
    if verified:
        # Count how many successful submissions before this one
        with get_db() as conn:
            count = conn.execute(
                "SELECT COUNT(*) FROM weekly_challenge_submissions WHERE challenge_id = ? AND verified = 1",
                (challenge_id,),
            ).fetchone()[0]

        position = count  # 0-indexed
        xp_earned = XP_REWARDS[position] if position < len(XP_REWARDS) else DEFAULT_XP

    with get_db() as conn:
        conn.execute(
            """INSERT INTO weekly_challenge_submissions (challenge_id, user_id, verified, xp_earned)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(challenge_id, user_id) DO UPDATE SET
                 verified = excluded.verified,
                 xp_earned = excluded.xp_earned""",
            (challenge_id, user_id, 1 if verified else 0, xp_earned),
        )

        if verified:
            conn.execute(
                "UPDATE users SET xp = xp + ? WHERE id = ?",
                (xp_earned, user_id),
            )

    return {
        "verified": verified,
        "confidence": confidence,
        "xp_earned": xp_earned,
        "analysis": analysis,
        "message": "Luogo trovato! 🎉" if verified else "Non sembra essere il luogo giusto. Riprova!",
    }


@router.post("/weekly/generate")
async def generate_weekly_challenge(city_slug: str):
    """Generate a new weekly challenge for a city. Picks a random POI and creates a hint."""
    week_start = _current_week_start()

    with get_db() as conn:
        existing = conn.execute(
            "SELECT * FROM weekly_challenges WHERE city_slug = ? AND week_start = ? AND active = 1",
            (city_slug,  week_start),
        ).fetchone()

        if existing:
            return {"challenge": dict(existing), "from_cache": True}

    # Find city name from slug
    city_name = None
    for name, pois in CITY_POIS.items():
        slug = name.lower().replace(" ", "-").replace("'", "")
        if slug == city_slug:
            city_name = name
            break

    if not city_name or city_name not in CITY_POIS:
        raise HTTPException(status_code=404, detail=f"Città non trovata: {city_slug}")

    pois = CITY_POIS[city_name]
    if not pois:
        raise HTTPException(status_code=404, detail="Nessun POI disponibile")

    # Pick a random POI
    chosen = random.choice(pois)

    # Generate a cryptic hint
    from app.services.ai import _chat_async
    try:
        hint_text = await _chat_async([{
            "role": "user",
            "content": f"""Genera un indovinello breve (max 2 frasi) per il luogo "{chosen['name']}" a {city_name}.
L'indovinello deve essere evocativo e dare un indizio senza nominare il luogo direttamente.
Rispondi SOLO con il testo dell'indovinello, nient'altro.""",
        }], max_tokens=200)
    except Exception:
        hint_text = f"Un luogo iconico nel cuore di {city_name}. Cercalo tra arte e storia."

    challenge_id = str(uuid.uuid4())

    with get_db() as conn:
        # Deactivate old challenges for this city
        conn.execute(
            "UPDATE weekly_challenges SET active = 0 WHERE city_slug = ? AND active = 1",
            (city_slug,),
        )
        conn.execute(
            "INSERT INTO weekly_challenges (id, city_slug, poi_id, poi_name, hint, week_start) VALUES (?, ?, ?, ?, ?, ?)",
            (challenge_id, city_slug, chosen["id"], chosen["name"], hint_text.strip(), week_start),
        )

    return {
        "challenge": {
            "id": challenge_id,
            "city_slug": city_slug,
            "poi_id": chosen["id"],
            "poi_name": chosen["name"],
            "hint": hint_text.strip(),
            "week_start": week_start,
        },
        "from_cache": False,
    }


@router.get("/weekly/{challenge_id}/leaderboard")
async def get_challenge_leaderboard(challenge_id: str):
    """Get the leaderboard for a specific challenge."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT wcs.user_id, wcs.xp_earned, wcs.submitted_at,
                      u.display_name, u.avatar_url
               FROM weekly_challenge_submissions wcs
               LEFT JOIN users u ON wcs.user_id = u.id
               WHERE wcs.challenge_id = ? AND wcs.verified = 1
               ORDER BY wcs.submitted_at ASC""",
            (challenge_id,),
        ).fetchall()

    return {"leaderboard": rows_to_list(rows)}
