import asyncio
import json
import uuid
import random

from app.auth import get_optional_user
from app.db import get_db, row_to_dict, rows_to_list
from app.models import (POI, BoardStop, CreateGameRequest, GameBoard,
                        QuizQuestion, UserProfile)
from app.routers.city import (CITY_POIS, build_overpass_query,
                              enrich_with_wikipedia, fetch_overpass,
                              parse_overpass)
from app.services.ai import (generate_city_pois, generate_connection,
                             generate_curiosity, generate_quiz, generate_story,
                             rank_pois)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/api/game", tags=["game"])

STOP_TYPES = [
    "story", "quiz", "curiosity", "challenge", "connection", "ar", "geoguessr"
]
STOP_XP = {
    "quiz": 15,
    "story": 10,
    "curiosity": 10,
    "challenge": 20,
    "connection": 10,
    "ar": 25,
    "geoguessr": 15
}
STOP_COINS = {
    "quiz": 10,
    "story": 5,
    "curiosity": 5,
    "challenge": 15,
    "connection": 5,
    "ar": 20,
    "geoguessr": 10
}


def _slug(city: str) -> str:
    return city.lower().replace(" ", "-").replace("'", "")


async def _fetch_and_filter_pois(city: str, profile: UserProfile, budget: str) -> list[dict]:
    return await generate_city_pois(city, profile, budget)


async def _generate_stop_content(poi: POI, stype: str, prev_poi: POI | None,
                                 profile: UserProfile, city: str) -> dict:
    try:
        if stype == "quiz":
            q = await generate_quiz(poi, profile)
            return {"quiz": q.model_dump()}
        elif stype == "story":
            story = await generate_story(poi, profile, city)
            return {"story": story}
        elif stype == "curiosity":
            curiosity = await generate_curiosity(poi, profile)
            return {"curiosity": curiosity}
        elif stype == "connection" and prev_poi:
            conn = await generate_connection(prev_poi, poi, profile)
            return {"connection": conn}
        elif stype in ("ar", "geoguessr", "challenge"):
            return {"instruction": f"Sfida {stype}: trova e fotografa {poi.name}"}
    except Exception as e:
        return {"fallback": f"Visita {poi.name}", "error": str(e)}
    return {"instruction": f"Visita {poi.name}"}


@router.post("/create-demo")
async def create_demo_game(req: CreateGameRequest):
    """Create a demo game without requiring authentication or AI processing."""
    city_slug = _slug(req.city)

    if req.city not in CITY_POIS:
        raise HTTPException(
            status_code=404,
            detail=f"Città '{req.city}' non disponibile in modalità demo. Città supportate: {', '.join(CITY_POIS.keys())}"
        )

    pois_data = CITY_POIS[req.city]
    if len(pois_data) < 3:
        raise HTTPException(status_code=404, detail=f"POI insufficienti per {req.city}")

    n_stops = min(len(pois_data), max(3, req.duration_days * 2))
    selected = pois_data[:n_stops]

    stops = []
    for i, poi_data in enumerate(selected):
        poi = POI(**{k: v for k, v in poi_data.items() if k in POI.model_fields})
        if i == 0:
            stype = "story"
        elif i == len(selected) - 1:
            stype = "challenge"
        else:
            stype = STOP_TYPES[i % len(STOP_TYPES)]
        content = {"instruction": f"Visita {poi.name}", "description": poi_data.get("description", "")}
        stops.append(BoardStop(poi=poi, type=stype, content=content))

    board = GameBoard(city=req.city, city_slug=city_slug, mode=req.mode, stops=stops)
    return {"game_id": None, "board": board.model_dump()}


@router.post("/create")
async def create_game(req: CreateGameRequest, user_id: str | None = Depends(get_optional_user)):
    """Create a complete game board for a city. Orchestrates all AI agents."""
    city_slug = _slug(req.city)

    if req.city in CITY_POIS:
        pois_data = CITY_POIS[req.city]
    else:
        try:
            query = build_overpass_query(req.city)
            data = await fetch_overpass(query)
            pois_data = parse_overpass(data)
            pois_data = await enrich_with_wikipedia(pois_data)
        except Exception:
            raise HTTPException(
                status_code=404,
                detail=f"Nessun luogo trovato per {req.city}. Prova con il nome italiano esatto (es: 'Firenze', 'Milano')."
            )

    if len(pois_data) < 3:
        raise HTTPException(status_code=404, detail=f"POI insufficienti per {req.city}")

    n_stops = min(len(pois_data), max(6, req.duration_days * 5))
    selected = pois_data[:n_stops]

    stop_assignments = []
    for i, poi_data in enumerate(selected):
        poi = POI(**{k: v for k, v in poi_data.items() if k in POI.model_fields})
        if i == 0:
            stype = "story"
        elif i == len(selected) - 1:
            stype = "challenge"
        else:
            stype = STOP_TYPES[i % len(STOP_TYPES)]
        prev_poi_data = selected[i - 1] if i > 0 else None
        prev_poi = POI(**{k: v for k, v in prev_poi_data.items() if k in POI.model_fields}) if prev_poi_data else None
        stop_assignments.append((poi, stype, prev_poi))

    contents = []
    for poi, stype, prev_poi in stop_assignments:
        try:
            content = await _generate_stop_content(poi, stype, prev_poi, req.profile, req.city)
            contents.append(content)
        except Exception:
            contents.append({"instruction": f"Visita {poi.name}"})

    stops = [
        BoardStop(poi=poi, type=stype, content=content)
        for (poi, stype, _), content in zip(stop_assignments, contents)
    ]

    board = GameBoard(city=req.city, city_slug=city_slug, mode=req.mode, stops=stops)

    game_id = None
    if user_id:
        try:
            game_id = str(uuid.uuid4())
            board.id = game_id
            with get_db() as conn:
                conn.execute(
                    "INSERT INTO games (id, city, city_slug, board_json, mode, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (game_id, req.city, city_slug, json.dumps(board.model_dump(), ensure_ascii=False), req.mode, "active", user_id),
                )
                conn.execute(
                    "INSERT OR IGNORE INTO game_players (game_id, user_id) VALUES (?, ?)",
                    (game_id, user_id),
                )
        except Exception:
            game_id = None

    return {"game_id": game_id, "board": board.model_dump()}


@router.get("/user/actions")
async def get_user_actions(user_id: str | None = Depends(get_optional_user)):
    """Get actionable items for the user."""
    if not user_id:
        return {"actions": [{"type": "territories", "text": "Accedi per difendere i tuoi territori", "icon": "Shield", "color": "bg-yellow-500/20"}]}

    actions = []
    try:
        with get_db() as conn:
            territories = conn.execute(
                "SELECT id, poi_id, city_slug FROM territories WHERE user_id = ? AND active = 1", (user_id,)
            ).fetchall()
            future_games = conn.execute(
                "SELECT id, city, created_at, status FROM games WHERE created_by = ? AND status = 'waiting'", (user_id,)
            ).fetchall()

        active_territories = rows_to_list(territories)
        if active_territories:
            actions.append({"type": "territories", "text": f"{len(active_territories)} posti da difendere", "icon": "Shield", "color": "bg-yellow-500/20"})

        nearby_cities = {
            "Roma": "Tivoli e Frascati sono vicine a Roma (30 km)",
            "Firenze": "Siena e Volterra sono vicine a Firenze (50 km)",
            "Milano": "Como e Varese sono vicine a Milano (40 km)",
            "Napoli": "Pompei e Sorrento sono vicine a Napoli (25 km)"
        }
        actions.append({"type": "nearby_cities", "text": nearby_cities.get("Roma", "Scopri città vicine"), "icon": "MapPin", "color": "bg-green-500/20"})

        future = rows_to_list(future_games)
        if future:
            actions.append({"type": "future_quizzes", "text": f"{len(future)} quiz da fare sugli itinerari futuri a {future[0]['city']}", "icon": "Zap", "color": "bg-blue-500/20"})

        if not actions:
            actions = [
                {"type": "territories", "text": "Conquistare il primo territorio", "icon": "Shield", "color": "bg-yellow-500/20"},
                {"type": "nearby_cities", "text": "Scopri città vicine", "icon": "MapPin", "color": "bg-green-500/20"},
                {"type": "future_quizzes", "text": "Crea il tuo primo itinerario", "icon": "Zap", "color": "bg-blue-500/20"},
            ]
    except Exception:
        actions = [
            {"type": "territories", "text": "Scopri i territori", "icon": "Shield", "color": "bg-yellow-500/20"},
            {"type": "nearby_cities", "text": "Città vicine a te", "icon": "MapPin", "color": "bg-green-500/20"},
            {"type": "future_quizzes", "text": "Quiz sugli itinerari", "icon": "Zap", "color": "bg-blue-500/20"},
        ]

    return {"actions": actions}


@router.get("/{game_id}")
async def get_game(game_id: str):
    """Get game by ID."""
    with get_db() as conn:
        game = conn.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game:
            raise HTTPException(status_code=404, detail="Partita non trovata")
        game = dict(game)
        game["board"] = json.loads(game["board_json"]) if isinstance(game["board_json"], str) else game["board_json"]

        players = conn.execute(
            """SELECT gp.user_id, gp.score, gp.unlocked_pois,
                      u.display_name, u.avatar_url, u.level
               FROM game_players gp
               LEFT JOIN users u ON gp.user_id = u.id
               WHERE gp.game_id = ?""",
            (game_id,),
        ).fetchall()

    player_list = []
    for p in players:
        pd = dict(p)
        pd["users"] = {"display_name": pd.pop("display_name", None), "avatar_url": pd.pop("avatar_url", None), "level": pd.pop("level", None)}
        player_list.append(pd)

    game["players"] = player_list
    return game


@router.post("/{game_id}/complete-stop/{poi_id}")
async def complete_stop(game_id: str, poi_id: str, user_id: str | None = Depends(get_optional_user)):
    """Mark a stop as completed. Award XP and coins."""
    with get_db() as conn:
        game = conn.execute("SELECT board_json FROM games WHERE id = ?", (game_id,)).fetchone()
        if not game:
            raise HTTPException(status_code=404, detail="Partita non trovata")

        board = json.loads(game["board_json"]) if isinstance(game["board_json"], str) else game["board_json"]
        stop_type = "quiz"
        for stop in board.get("stops", []):
            if stop["poi"]["id"] == poi_id:
                stop_type = stop["type"]
                stop["completed"] = True
                break

        conn.execute(
            "UPDATE games SET board_json = ? WHERE id = ?",
            (json.dumps(board, ensure_ascii=False), game_id),
        )

    xp = STOP_XP.get(stop_type, 10)
    coins = STOP_COINS.get(stop_type, 5)
    return {"status": "completed", "stop_type": stop_type, "xp_earned": xp, "coins_earned": coins}


@router.get("/{game_id}/leaderboard")
async def get_game_leaderboard(game_id: str):
    with get_db() as conn:
        rows = conn.execute(
            """SELECT gp.user_id, gp.score, gp.unlocked_pois,
                      u.display_name, u.avatar_url, u.level
               FROM game_players gp
               LEFT JOIN users u ON gp.user_id = u.id
               WHERE gp.game_id = ?
               ORDER BY gp.score DESC""",
            (game_id,),
        ).fetchall()

    result = []
    for p in rows:
        pd = dict(p)
        pd["users"] = {"display_name": pd.pop("display_name", None), "avatar_url": pd.pop("avatar_url", None), "level": pd.pop("level", None)}
        result.append(pd)

    return {"leaderboard": result}
