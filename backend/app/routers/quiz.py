import uuid
import random
import string
from fastapi import APIRouter, Depends, HTTPException
from app.models import POI, UserProfile, QuizAnswer
from app.auth import get_current_user
from app.services.ai import generate_quiz, question_hash
from app.db import get_db, row_to_dict, rows_to_list

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


def _generate_room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.post("/session/create")
async def create_session(city: str, user_id: str = Depends(get_current_user)):
    """Create a multiplayer quiz lobby."""
    room_code = _generate_room_code()
    session_id = str(uuid.uuid4())

    with get_db() as conn:
        conn.execute(
            "INSERT INTO quiz_sessions (id, room_code, city, host_user_id) VALUES (?, ?, ?, ?)",
            (session_id, room_code, city, user_id),
        )
        conn.execute(
            "INSERT INTO quiz_session_players (session_id, user_id) VALUES (?, ?)",
            (session_id, user_id),
        )

    return {"session_id": session_id, "room_code": room_code}


@router.post("/session/{room_code}/join")
async def join_session(room_code: str, user_id: str = Depends(get_current_user)):
    """Join a quiz lobby."""
    with get_db() as conn:
        session = conn.execute(
            "SELECT * FROM quiz_sessions WHERE room_code = ?", (room_code,)
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Sessione non trovata")
        session = dict(session)
        if session["status"] != "waiting":
            raise HTTPException(status_code=400, detail="Sessione già iniziata")

        player_count = conn.execute(
            "SELECT COUNT(*) FROM quiz_session_players WHERE session_id = ?", (session["id"],)
        ).fetchone()[0]
        if player_count >= session["max_players"]:
            raise HTTPException(status_code=400, detail="Sessione piena")

        conn.execute(
            "INSERT OR IGNORE INTO quiz_session_players (session_id, user_id) VALUES (?, ?)",
            (session["id"], user_id),
        )

    return {"status": "joined", "session_id": session["id"]}


@router.get("/session/{room_code}")
async def get_session(room_code: str):
    """Get session status and players."""
    with get_db() as conn:
        session = conn.execute(
            "SELECT * FROM quiz_sessions WHERE room_code = ?", (room_code,)
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Sessione non trovata")
        session = dict(session)
        players = conn.execute(
            "SELECT user_id, score, coins_earned FROM quiz_session_players WHERE session_id = ?",
            (session["id"],),
        ).fetchall()

    session["quiz_session_players"] = rows_to_list(players)
    return session


@router.post("/session/{room_code}/start")
async def start_session(room_code: str, user_id: str = Depends(get_current_user)):
    """Host starts the quiz session. Generates questions with Claude."""
    with get_db() as conn:
        session = conn.execute(
            "SELECT * FROM quiz_sessions WHERE room_code = ?", (room_code,)
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Sessione non trovata")
        session = dict(session)
        if session["host_user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Solo l'host può avviare")

    profile = UserProfile(language="it", cultural_level="casual")
    city_poi = POI(
        id=f"city_{session['city']}",
        name=session["city"],
        lat=0, lng=0,
        category="city",
        description=f"Domande generali sulla città di {session['city']}",
    )

    questions = []
    for i in range(10):
        difficulty = "easy" if i < 3 else "medium" if i < 7 else "hard"
        q = await generate_quiz(city_poi, profile, difficulty, [qq.question for qq in questions])
        questions.append(q)

    with get_db() as conn:
        conn.execute(
            "UPDATE quiz_sessions SET status = 'active' WHERE id = ?", (session["id"],)
        )

    return {
        "status": "started",
        "questions": [q.model_dump() for q in questions],
    }


@router.post("/session/{room_code}/answer")
async def submit_answer(room_code: str, answer: QuizAnswer, user_id: str = Depends(get_current_user)):
    """Submit an answer to a quiz question."""
    with get_db() as conn:
        session = conn.execute(
            "SELECT id, city FROM quiz_sessions WHERE room_code = ?", (room_code,)
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Sessione non trovata")
        session = dict(session)

        conn.execute(
            "INSERT INTO quiz_results (user_id, poi_id, question_hash, correct, time_ms) VALUES (?, ?, ?, ?, ?)",
            (user_id, f"city_{session['city']}", answer.question_hash, 1 if answer.answer_index >= 0 else 0, answer.time_ms),
        )

        if answer.answer_index >= 0:
            points = max(10, 100 - answer.time_ms // 100)
            player = conn.execute(
                "SELECT score FROM quiz_session_players WHERE session_id = ? AND user_id = ?",
                (session["id"], user_id),
            ).fetchone()
            if player:
                conn.execute(
                    "UPDATE quiz_session_players SET score = ? WHERE session_id = ? AND user_id = ?",
                    (player["score"] + points, session["id"], user_id),
                )

    return {"status": "recorded"}


@router.post("/poi/{poi_id}/generate")
async def generate_poi_quiz(poi_id: str, poi_name: str, difficulty: str = "medium"):
    """Generate a single quiz question for a POI."""
    poi = POI(id=poi_id, name=poi_name, lat=0, lng=0)
    profile = UserProfile(language="it")
    q = await generate_quiz(poi, profile, difficulty)
    return {"question": q.model_dump(), "question_hash": question_hash(q)}
