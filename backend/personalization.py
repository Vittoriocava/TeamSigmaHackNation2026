from fastapi import APIRouter
from models import UserProfile, ProfileInferRequest
from ai_engine import infer_profile
from supabase_client import supabase

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.post("/infer")
async def infer_user_profile(request: ProfileInferRequest):
    """Infer or update user profile from quiz answers and swipe data."""
    result = await infer_profile(request.quiz_answers, [s.model_dump() for s in request.swipe_batch])
    return result


@router.get("/{user_id}")
async def get_profile(user_id: str):
    """Get user profile."""
    result = supabase.table("profiles").select("*").eq("user_id", user_id).single().execute()
    return result.data


@router.put("/{user_id}")
async def update_profile(user_id: str, profile: UserProfile):
    """Update user profile."""
    supabase.table("profiles").update({
        "interests": profile.interests,
        "age_range": profile.age_range,
        "cultural_level": profile.cultural_level,
        "language": profile.language,
        "pace": profile.pace,
    }).eq("user_id", user_id).execute()
    return {"status": "ok"}


@router.post("/swipe")
async def record_swipe(user_id: str, poi_id: str, liked: bool):
    """Record a swipe in the Tinder dei Posti."""
    supabase.table("swipe_history").insert({
        "user_id": user_id,
        "poi_id": poi_id,
        "liked": liked,
    }).execute()
    return {"status": "ok"}
