import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.db import get_db, rows_to_list, row_to_dict

router = APIRouter(prefix="/api/itineraries", tags=["itineraries"])


class SaveItineraryRequest(BaseModel):
    city: str
    city_slug: str
    days: int
    liked_pois_count: int
    itinerary: list
    trip_profile: dict = {}


class CollectPieceRequest(BaseModel):
    poi_id: str
    poi_name: str
    city: str


@router.post("")
async def save_itinerary(req: SaveItineraryRequest, user_id: str = Depends(get_current_user)):
    """Save a planned itinerary for a user."""
    itin_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """INSERT INTO itineraries (id, user_id, city, city_slug, days, liked_pois_count, itinerary_json, trip_profile_json, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'future')""",
            (itin_id, user_id, req.city, req.city_slug, req.days, req.liked_pois_count,
             json.dumps(req.itinerary, ensure_ascii=False), json.dumps(req.trip_profile, ensure_ascii=False)),
        )
    return {"id": itin_id, "status": "saved"}


@router.get("/user/{user_id}")
async def get_user_itineraries(user_id: str):
    """Get all itineraries for a user."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, city, days, liked_pois_count, status, created_at FROM itineraries WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return {"itineraries": rows_to_list(rows)}


@router.get("/{itin_id}")
async def get_itinerary(itin_id: str):
    """Get full itinerary by ID."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM itineraries WHERE id = ?", (itin_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Itinerario non trovato")
    data = dict(row)
    data["itinerary"] = json.loads(data["itinerary_json"])
    data["trip_profile"] = json.loads(data.get("trip_profile_json", "{}"))
    return data


@router.patch("/{itin_id}/status")
async def update_status(itin_id: str, status: str, user_id: str = Depends(get_current_user)):
    """Update itinerary status (future/active/completed)."""
    with get_db() as conn:
        conn.execute(
            "UPDATE itineraries SET status = ? WHERE id = ? AND user_id = ?",
            (status, itin_id, user_id),
        )
    return {"status": "updated"}


# ── Pieces ────────────────────────────────────────────────────────────────────

@router.post("/pieces/collect")
async def collect_piece(req: CollectPieceRequest, user_id: str = Depends(get_current_user)):
    """Add one piece to a POI for a user (max 3)."""
    with get_db() as conn:
        conn.execute(
            """INSERT INTO user_pieces (user_id, poi_id, poi_name, city, pieces_collected)
               VALUES (?, ?, ?, ?, 1)
               ON CONFLICT(user_id, poi_id) DO UPDATE SET
                 pieces_collected = MIN(pieces_collected + 1, 3),
                 poi_name = excluded.poi_name""",
            (user_id, req.poi_id, req.poi_name, req.city),
        )
        row = conn.execute(
            "SELECT pieces_collected FROM user_pieces WHERE user_id = ? AND poi_id = ?",
            (user_id, req.poi_id),
        ).fetchone()
    return {"poi_id": req.poi_id, "pieces_collected": row["pieces_collected"]}


@router.get("/pieces/user/{user_id}")
async def get_user_pieces(user_id: str):
    """Get all pieces collected by a user."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT poi_id, poi_name, city, pieces_collected FROM user_pieces WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    return {"pieces": rows_to_list(rows)}
