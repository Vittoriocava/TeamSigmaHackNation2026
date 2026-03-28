import random
import string
from fastapi import APIRouter, Depends, HTTPException
from models import POI, UserProfile, QuizQuestion, QuizAnswer
from auth import get_current_user
from ai_engine import generate_quiz, question_hash
from coin_engine import award_coins
from supabase_client import supabase

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


def _generate_room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.post("/session/create")
async def create_session(city: str, user_id: str = Depends(get_current_user)):
    """Create a multiplayer quiz lobby."""
    room_code = _generate_room_code()
    result = supabase.table("quiz_sessions").insert({
        "room_code": room_code,
        "city": city,
        "host_user_id": user_id,
    }).execute()

    # Host auto-joins
    supabase.table("quiz_session_players").insert({
        "session_id": result.data[0]["id"],
        "user_id": user_id,
    }).execute()

    return {"session_id": result.data[0]["id"], "room_code": room_code}


@router.post("/session/{room_code}/join")
async def join_session(room_code: str, user_id: str = Depends(get_current_user)):
    """Join a quiz lobby."""
    session = (
        supabase.table("quiz_sessions")
        .select("*")
        .eq("room_code", room_code)
        .single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    if session.data["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Sessione già iniziata")

    # Check max players
    players = (
        supabase.table("quiz_session_players")
        .select("id")
        .eq("session_id", session.data["id"])
        .execute()
    )
    if len(players.data) >= session.data["max_players"]:
        raise HTTPException(status_code=400, detail="Sessione piena")

    supabase.table("quiz_session_players").insert({
        "session_id": session.data["id"],
        "user_id": user_id,
    }).execute()

    return {"status": "joined", "session_id": session.data["id"]}


@router.get("/session/{room_code}")
async def get_session(room_code: str):
    """Get session status and players."""
    session = (
        supabase.table("quiz_sessions")
        .select("*, quiz_session_players(user_id, score, coins_earned)")
        .eq("room_code", room_code)
        .single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    return session.data


@router.post("/session/{room_code}/start")
async def start_session(room_code: str, user_id: str = Depends(get_current_user)):
    """Host starts the quiz session. Generates questions with Claude."""
    session = (
        supabase.table("quiz_sessions")
        .select("*")
        .eq("room_code", room_code)
        .single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Sessione non trovata")
    if session.data["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Solo l'host può avviare")

    # Generate 10 questions about the city
    profile = UserProfile(language="it", cultural_level="casual")
    city_poi = POI(
        id=f"city_{session.data['city']}",
        name=session.data["city"],
        lat=0, lng=0,
        category="city",
        description=f"Domande generali sulla città di {session.data['city']}",
    )

    questions = []
    for i in range(10):
        difficulty = "easy" if i < 3 else "medium" if i < 7 else "hard"
        q = await generate_quiz(city_poi, profile, difficulty, [qq.question for qq in questions])
        questions.append(q)

    # Update session status and store questions
    supabase.table("quiz_sessions").update({
        "status": "active",
    }).eq("id", session.data["id"]).execute()

    return {
        "status": "started",
        "questions": [q.model_dump() for q in questions],
    }


@router.post("/session/{room_code}/answer")
async def submit_answer(
    room_code: str,
    answer: QuizAnswer,
    user_id: str = Depends(get_current_user),
):
    """Submit an answer to a quiz question."""
    session = (
        supabase.table("quiz_sessions")
        .select("id, city")
        .eq("room_code", room_code)
        .single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Sessione non trovata")

    # Record the result
    supabase.table("quiz_results").insert({
        "user_id": user_id,
        "poi_id": f"city_{session.data['city']}",
        "question_hash": answer.question_hash,
        "correct": answer.answer_index >= 0,  # Will be validated client-side
        "time_ms": answer.time_ms,
    }).execute()

    # Update player score
    if answer.answer_index >= 0:
        points = max(10, 100 - answer.time_ms // 100)
        supabase.table("quiz_session_players").update({
            "score": supabase.table("quiz_session_players")
            .select("score")
            .eq("session_id", session.data["id"])
            .eq("user_id", user_id)
            .single()
            .execute()
            .data["score"] + points,
        }).eq("session_id", session.data["id"]).eq("user_id", user_id).execute()

    return {"status": "recorded"}


@router.post("/poi/{poi_id}/generate")
async def generate_poi_quiz(poi_id: str, poi_name: str, difficulty: str = "medium"):
    """Generate a single quiz question for a POI (for piece collection or defense)."""
    poi = POI(id=poi_id, name=poi_name, lat=0, lng=0, category="")

    # Get previous questions for this user+poi to avoid repeats
    profile = UserProfile(language="it")
    q = await generate_quiz(poi, profile, difficulty)

    return {
        "question": q.model_dump(),
        "question_hash": question_hash(q),
    }
