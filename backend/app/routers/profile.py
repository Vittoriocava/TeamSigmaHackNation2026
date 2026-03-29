import json
from fastapi import APIRouter
from app.models import UserProfile, ProfileInferRequest
from app.services.ai import infer_profile
from app.db import get_db, row_to_dict

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.post("/infer")
async def infer_user_profile(request: ProfileInferRequest):
    """Infer or update user profile from quiz answers and swipe data."""
    result = await infer_profile(request.quiz_answers, [s.model_dump() for s in request.swipe_batch])
    return result


@router.get("/{user_id}")
async def get_profile(user_id: str):
    """Get user profile."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE user_id = ?", (user_id,)
        ).fetchone()
    if not row:
        return {"user_id": user_id, "interests": [], "age_range": "", "cultural_level": "casual", "language": "it", "pace": "medium"}
    data = dict(row)
    data["interests"] = json.loads(data["interests"]) if isinstance(data["interests"], str) else data["interests"]
    return data


@router.put("/{user_id}")
async def update_profile(user_id: str, profile: UserProfile):
    """Update user profile."""
    with get_db() as conn:
        conn.execute(
            """INSERT INTO profiles (user_id, interests, age_range, cultural_level, language, pace)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 interests = excluded.interests,
                 age_range = excluded.age_range,
                 cultural_level = excluded.cultural_level,
                 language = excluded.language,
                 pace = excluded.pace""",
            (
                user_id,
                json.dumps(profile.interests),
                profile.age_range or "",
                profile.cultural_level or "casual",
                profile.language or "it",
                profile.pace or "medium",
            ),
        )
    return {"status": "ok"}


@router.post("/swipe")
async def record_swipe(user_id: str, poi_id: str, liked: bool):
    """Record a swipe in the Tinder dei Posti."""
    with get_db() as conn:
        conn.execute(
            "INSERT INTO swipe_history (user_id, poi_id, liked) VALUES (?, ?, ?)",
            (user_id, poi_id, 1 if liked else 0),
        )
    return {"status": "ok"}
