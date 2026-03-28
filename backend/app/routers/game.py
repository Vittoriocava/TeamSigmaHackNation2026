import json
import random
from fastapi import APIRouter, Depends, HTTPException
from app.models import (
    CreateGameRequest, GameBoard, BoardStop, POI, UserProfile, QuizQuestion,
)
from app.auth import get_current_user
from app.services.ai import generate_quiz, generate_story, generate_curiosity, generate_connection, rank_pois
from app.services.coins import award_coins
from app.db import supabase
from app.routers.city import build_overpass_query, parse_overpass, enrich_with_wikipedia

import httpx

router = APIRouter(prefix="/api/game", tags=["game"])

STOP_TYPES = ["story", "quiz", "curiosity", "challenge", "connection", "ar", "geoguessr"]
STOP_XP = {"quiz": 15, "story": 10, "curiosity": 10, "challenge": 20, "connection": 10, "ar": 25, "geoguessr": 15}
STOP_COINS = {"quiz": 10, "story": 5, "curiosity": 5, "challenge": 15, "connection": 5, "ar": 20, "geoguessr": 10}


def _slug(city: str) -> str:
    return city.lower().replace(" ", "-").replace("'", "")


@router.post("/create")
async def create_game(req: CreateGameRequest, user_id: str = Depends(get_current_user)):
    """Create a complete game board for a city. Orchestrates all AI agents."""
    city_slug = _slug(req.city)

    # Step 1: Fetch and rank POIs via city router helpers
    query = build_overpass_query(req.city)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post("https://overpass-api.de/api/interpreter", data={"data": query})
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Errore caricamento POI città")
        data = resp.json()

    raw_pois = parse_overpass(data)
    raw_pois = await enrich_with_wikipedia(raw_pois)

    if len(raw_pois) < 3:
        raise HTTPException(status_code=404, detail=f"Troppo pochi POI per {req.city}")

    # Step 2: Rank with AI
    ranked = await rank_pois(raw_pois, req.profile, req.city, req.budget)

    # Step 3: Select top N stops (10-15 based on duration)
    n_stops = min(len(ranked), max(8, req.duration_days * 5))
    selected = ranked[:n_stops]


@router.post("/create-demo")
async def create_game_demo(req: CreateGameRequest):
    """Create a demo game without authentication (for development/testing)."""
    # Ritorna un gioco di demo con la città selezionata
    return {
        "id": f"demo-{_slug(req.city)}-{int(__import__('time').time())}",
        "city": req.city,
        "city_slug": _slug(req.city),
        "mode": req.mode or "solo",
        "stops": [
            {
                "poi": {
                    "id": "1",
                    "name": f"Punto di interesse 1 - {req.city}",
                    "lat": 41.8902,
                    "lng": 12.4922,
                    "category": "storia",
                    "description": f"Benvenuto a {req.city}",
                    "relevance_score": 9.5,
                    "estimated_cost": "€€",
                    "estimated_duration": 90,
                    "hidden_gem": False,
                    "why_for_you": "Imperdibile"
                },
                "type": "story",
                "content": {"story": f"Stai esplorando {req.city}. Buona avventura!"},
                "completed": False
            }
        ]
    }

    # Step 4: Build board stops with varied types
    stops = []
    for i, poi_data in enumerate(selected):
        poi = POI(**{k: v for k, v in poi_data.items() if k in POI.model_fields})

        # Assign stop type — ensure variety
        if i == 0:
            stype = "story"  # First stop is always a story
        elif i == len(selected) - 1:
            stype = "challenge"  # Last is a challenge
        else:
            stype = STOP_TYPES[i % len(STOP_TYPES)]

        # Generate content based on type
        content = {}
        try:
            if stype == "quiz":
                q = await generate_quiz(poi, req.profile)
                content = {"quiz": q.model_dump()}
            elif stype == "story":
                story = await generate_story(poi, req.profile, req.city)
                content = {"story": story}
            elif stype == "curiosity":
                curiosity = await generate_curiosity(poi, req.profile)
                content = {"curiosity": curiosity}
            elif stype == "connection" and i > 0:
                prev_poi_data = selected[i - 1]
                prev_poi = POI(**{k: v for k, v in prev_poi_data.items() if k in POI.model_fields})
                conn = await generate_connection(prev_poi, poi, req.profile)
                content = {"connection": conn}
            elif stype in ("ar", "geoguessr", "challenge"):
                content = {"instruction": f"Sfida {stype} per {poi.name}"}
        except Exception as e:
            content = {"error": str(e), "fallback": f"Visita {poi.name}"}

        stops.append(BoardStop(poi=poi, type=stype, content=content))

    # Step 5: Save game to Supabase
    board = GameBoard(city=req.city, city_slug=city_slug, mode=req.mode, stops=stops)
    board_dict = board.model_dump()

    result = supabase.table("games").insert({
        "city": req.city,
        "city_slug": city_slug,
        "board_json": json.dumps(board_dict, ensure_ascii=False),
        "mode": req.mode,
        "status": "active",
        "created_by": user_id,
    }).execute()

    game_id = result.data[0]["id"]
    board.id = game_id

    # Add player to game
    supabase.table("game_players").insert({
        "game_id": game_id,
        "user_id": user_id,
    }).execute()

    return {"game_id": game_id, "board": board.model_dump()}


@router.get("/{game_id}")
async def get_game(game_id: str):
    """Get game by ID."""
    result = supabase.table("games").select("*").eq("id", game_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Partita non trovata")

    game = result.data
    game["board"] = json.loads(game["board_json"]) if isinstance(game["board_json"], str) else game["board_json"]

    # Get players
    players = (
        supabase.table("game_players")
        .select("user_id, score, unlocked_pois, users(display_name, avatar_url, level)")
        .eq("game_id", game_id)
        .execute()
    )
    game["players"] = players.data
    return game


@router.post("/{game_id}/complete-stop/{poi_id}")
async def complete_stop(game_id: str, poi_id: str, user_id: str = Depends(get_current_user)):
    """Mark a stop as completed. Award XP and coins."""
    game = supabase.table("games").select("board_json").eq("id", game_id).single().execute()
    if not game.data:
        raise HTTPException(status_code=404, detail="Partita non trovata")

    board = json.loads(game.data["board_json"]) if isinstance(game.data["board_json"], str) else game.data["board_json"]

    # Find the stop
    stop_type = "quiz"
    for stop in board.get("stops", []):
        if stop["poi"]["id"] == poi_id:
            stop_type = stop["type"]
            stop["completed"] = True
            break

    # Update board
    supabase.table("games").update({
        "board_json": json.dumps(board, ensure_ascii=False),
    }).eq("id", game_id).execute()

    # Update player
    player = (
        supabase.table("game_players")
        .select("*")
        .eq("game_id", game_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if player.data:
        unlocked = player.data["unlocked_pois"] or []
        if poi_id not in unlocked:
            unlocked.append(poi_id)
        new_score = player.data["score"] + STOP_XP.get(stop_type, 10)
        supabase.table("game_players").update({
            "score": new_score,
            "unlocked_pois": unlocked,
        }).eq("id", player.data["id"]).execute()

    # Award coins
    coins = STOP_COINS.get(stop_type, 5)
    balance = await award_coins(user_id, coins, f"tappa_{stop_type}", poi_id)

    xp = STOP_XP.get(stop_type, 10)

    return {
        "status": "completed",
        "stop_type": stop_type,
        "xp_earned": xp,
        "coins_earned": coins,
        "balance": balance,
    }


@router.get("/{game_id}/leaderboard")
async def get_game_leaderboard(game_id: str):
    """Get game leaderboard."""
    result = (
        supabase.table("game_players")
        .select("user_id, score, unlocked_pois, users(display_name, avatar_url, level)")
        .eq("game_id", game_id)
        .order("score", desc=True)
        .execute()
    )
    return {"leaderboard": result.data}
