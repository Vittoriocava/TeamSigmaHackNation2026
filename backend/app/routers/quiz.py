import uuid
import random
import string
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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


# ── POI piece quiz ─────────────────────────────────────────────────────────────

class PlayQuizRequest(BaseModel):
    poi_name: str
    poi_description: str = ""
    city: str = ""


class SubmitQuizRequest(BaseModel):
    poi_name: str
    city: str
    correct: int
    total: int = 5


@router.post("/poi/{poi_id}/play")
async def play_poi_quiz(
    poi_id: str,
    req: PlayQuizRequest,
    user_id: str = Depends(get_current_user),
):
    """Generate 5 questions for a POI solo quiz (for piece collection).
    
    Difficulty scales with territory tier:
    - Tier 4 (fresh conquest): all hard
    - Tier 3: medium + hard  
    - Tier 2: easy + medium
    - Tier 1 (decayed): all easy
    - No territory: standard mix
    """
    poi = POI(
        id=poi_id,
        name=req.poi_name,
        lat=0,
        lng=0,
        description=req.poi_description or f"Luogo da visitare a {req.city}",
    )
    profile = UserProfile(language="it", cultural_level="casual")

    # Check how many pieces the user already has (cap at 3)
    with get_db() as conn:
        row = conn.execute(
            "SELECT pieces_collected FROM user_pieces WHERE user_id = ? AND poi_id = ?",
            (user_id, poi_id),
        ).fetchone()

        # Get territory tier for difficulty scaling
        territory = conn.execute(
            "SELECT tier FROM territories WHERE poi_id = ? AND active = 1",
            (poi_id,),
        ).fetchone()

        # Get previously used question hashes for this user+POI
        used_rows = conn.execute(
            "SELECT question_hash FROM quiz_results WHERE user_id = ? AND poi_id = ?",
            (user_id, poi_id),
        ).fetchall()
    
    pieces_owned = row["pieces_collected"] if row else 0
    used_hashes = {r["question_hash"] for r in used_rows}
    
    # Determine difficulty based on territory tier
    tier = territory["tier"] if territory else 0
    if tier >= 4:
        difficulties = ["hard", "hard", "hard", "hard", "hard"]
    elif tier == 3:
        difficulties = ["medium", "medium", "hard", "hard", "hard"]
    elif tier == 2:
        difficulties = ["easy", "medium", "medium", "hard", "medium"]
    elif tier == 1:
        difficulties = ["easy", "easy", "easy", "medium", "easy"]
    else:
        difficulties = ["easy", "easy", "medium", "medium", "hard"]

    # Generate 5 questions sequentially to avoid duplicates
    questions = []
    for diff in difficulties:
        q = await generate_quiz(poi, profile, diff, [qq.question for qq in questions])
        # Check if this question was already used
        qhash = question_hash(q)
        retry = 0
        while qhash in used_hashes and retry < 2:
            q = await generate_quiz(poi, profile, diff, [qq.question for qq in questions] + [q.question])
            qhash = question_hash(q)
            retry += 1
        questions.append(q)

    return {
        "poi_id": poi_id,
        "poi_name": req.poi_name,
        "questions": [q.model_dump() for q in questions],
        "pieces_owned": pieces_owned,
        "territory_tier": tier,
    }


@router.post("/poi/{poi_id}/submit")
async def submit_poi_quiz(
    poi_id: str,
    req: SubmitQuizRequest,
    user_id: str = Depends(get_current_user),
):
    """Submit quiz result. Awards 1 piece if >= 3/5 correct (max 3 pieces per POI)."""
    piece_earned = req.correct >= 3

    with get_db() as conn:
        if piece_earned:
            conn.execute(
                """INSERT INTO user_pieces (user_id, poi_id, poi_name, city, pieces_collected)
                   VALUES (?, ?, ?, ?, 1)
                   ON CONFLICT(user_id, poi_id) DO UPDATE SET
                     pieces_collected = MIN(pieces_collected + 1, 3),
                     poi_name = excluded.poi_name""",
                (user_id, poi_id, req.poi_name, req.city),
            )
        row = conn.execute(
            "SELECT pieces_collected FROM user_pieces WHERE user_id = ? AND poi_id = ?",
            (user_id, poi_id),
        ).fetchone()

    pieces_total = row["pieces_collected"] if row else 0
    return {
        "piece_earned": piece_earned,
        "pieces_total": pieces_total,
        "correct": req.correct,
        "total": req.total,
    }
