import asyncio
import json
import random

from app.auth import get_optional_user
from app.db import supabase
from app.models import (POI, BoardStop, CreateGameRequest, GameBoard,
                        QuizQuestion, UserProfile)
from app.routers.city import (CITY_POIS, build_overpass_query,
                              enrich_with_wikipedia, fetch_overpass,
                              parse_overpass)
from app.services.ai import (generate_connection, generate_curiosity,
                             generate_quiz, generate_story, rank_pois)
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
            return {
                "instruction": f"Sfida {stype}: trova e fotografa {poi.name}"
            }
    except Exception as e:
        return {"fallback": f"Visita {poi.name}", "error": str(e)}
    return {"instruction": f"Visita {poi.name}"}


@router.post("/create-demo")
async def create_demo_game(req: CreateGameRequest):
    """Create a demo game without requiring authentication or AI processing.
    Uses preloaded POI data for supported cities."""
    city_slug = _slug(req.city)

    # Step 1: Get POIs from local data (no API calls needed)
    if req.city not in CITY_POIS:
        raise HTTPException(
            status_code=404,
            detail=
            f"Città '{req.city}' non disponibile in modalità demo. Città supportate: {', '.join(CITY_POIS.keys())}"
        )

    pois_data = CITY_POIS[req.city]

    if len(pois_data) < 3:
        raise HTTPException(status_code=404,
                            detail=f"POI insufficienti per {req.city}")

    # Step 2: Select top N stops
    n_stops = min(len(pois_data), max(3, req.duration_days * 2))
    selected = pois_data[:n_stops]

    # Step 3: Build stops with minimal processing
    stops = []
    for i, poi_data in enumerate(selected):
        poi = POI(**{
            k: v
            for k, v in poi_data.items() if k in POI.model_fields
        })

        # Assign stop type
        if i == 0:
            stype = "story"
        elif i == len(selected) - 1:
            stype = "challenge"
        else:
            stype = STOP_TYPES[i % len(STOP_TYPES)]

        # Create minimal content
        content = {
            "instruction": f"Visita {poi.name}",
            "description": poi_data.get("description", "")
        }

        stops.append(BoardStop(poi=poi, type=stype, content=content))

    board = GameBoard(city=req.city,
                      city_slug=city_slug,
                      mode=req.mode,
                      stops=stops)

    return {"game_id": None, "board": board.model_dump()}


@router.post("/create")
async def create_game(req: CreateGameRequest,
                      user_id: str | None = Depends(get_optional_user)):
    """Create a complete game board for a city. Orchestrates all AI agents."""
    city_slug = _slug(req.city)

    # Step 1: Fallback to local data if AI processing unavailable
    if req.city in CITY_POIS:
        pois_data = CITY_POIS[req.city]
    else:
        # Try to fetch from Overpass as fallback
        try:
            query = build_overpass_query(req.city)
            data = await fetch_overpass(query)
            pois_data = parse_overpass(data)
            pois_data = await enrich_with_wikipedia(pois_data)
        except Exception:
            raise HTTPException(
                status_code=404,
                detail=
                f"Nessun luogo trovato per {req.city}. Prova con il nome italiano esatto (es: 'Firenze', 'Milano')."
            )

    if len(pois_data) < 3:
        raise HTTPException(status_code=404,
                            detail=f"POI insufficienti per {req.city}")

    # Step 2: Select top N stops
    n_stops = min(len(pois_data), max(6, req.duration_days * 5))
    selected = pois_data[:n_stops]

    # Step 3: Build stop types with variety
    stop_assignments = []
    for i, poi_data in enumerate(selected):
        poi = POI(**{
            k: v
            for k, v in poi_data.items() if k in POI.model_fields
        })
        if i == 0:
            stype = "story"
        elif i == len(selected) - 1:
            stype = "challenge"
        else:
            stype = STOP_TYPES[i % len(STOP_TYPES)]
        prev_poi_data = selected[i - 1] if i > 0 else None
        prev_poi = POI(**{
            k: v
            for k, v in prev_poi_data.items() if k in POI.model_fields
        }) if prev_poi_data else None
        stop_assignments.append((poi, stype, prev_poi))

    # Step 4: Try to generate AI content, fallback to simple content
    contents = []
    for poi, stype, prev_poi in stop_assignments:
        try:
            content = await _generate_stop_content(poi, stype, prev_poi,
                                                   req.profile, req.city)
            contents.append(content)
        except Exception:
            # Fallback: simple content if AI fails
            contents.append({"instruction": f"Visita {poi.name}"})

    stops = [
        BoardStop(poi=poi, type=stype, content=content)
        for (poi, stype, _), content in zip(stop_assignments, contents)
    ]

    board = GameBoard(city=req.city,
                      city_slug=city_slug,
                      mode=req.mode,
                      stops=stops)

    # Step 5: Save to Supabase (optional — skip if auth unavailable)
    game_id = None
    if user_id:
        try:
            result = supabase.table("games").insert({
                "city":
                req.city,
                "city_slug":
                city_slug,
                "board_json":
                json.dumps(board.model_dump(), ensure_ascii=False),
                "mode":
                req.mode,
                "status":
                "active",
                "created_by":
                user_id,
            }).execute()
            game_id = result.data[0]["id"]
            board.id = game_id
            supabase.table("game_players").insert({
                "game_id": game_id,
                "user_id": user_id,
            }).execute()
        except Exception:
            pass

    return {"game_id": game_id, "board": board.model_dump()}


@router.get("/{game_id}")
async def get_game(game_id: str):
    """Get game by ID."""
    result = supabase.table("games").select("*").eq(
        "id", game_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Partita non trovata")

    game = result.data
    game["board"] = json.loads(game["board_json"]) if isinstance(
        game["board_json"], str) else game["board_json"]

    players = (supabase.table("game_players").select(
        "user_id, score, unlocked_pois, users(display_name, avatar_url, level)"
    ).eq("game_id", game_id).execute())
    game["players"] = players.data
    return game


@router.post("/{game_id}/complete-stop/{poi_id}")
async def complete_stop(game_id: str,
                        poi_id: str,
                        user_id: str | None = Depends(get_optional_user)):
    """Mark a stop as completed. Award XP and coins."""
    game = supabase.table("games").select("board_json").eq(
        "id", game_id).single().execute()
    if not game.data:
        raise HTTPException(status_code=404, detail="Partita non trovata")

    board = json.loads(game.data["board_json"]) if isinstance(
        game.data["board_json"], str) else game.data["board_json"]

    stop_type = "quiz"
    for stop in board.get("stops", []):
        if stop["poi"]["id"] == poi_id:
            stop_type = stop["type"]
            stop["completed"] = True
            break

    supabase.table("games").update({
        "board_json":
        json.dumps(board, ensure_ascii=False),
    }).eq("id", game_id).execute()

    xp = STOP_XP.get(stop_type, 10)
    coins = STOP_COINS.get(stop_type, 5)
    return {
        "status": "completed",
        "stop_type": stop_type,
        "xp_earned": xp,
        "coins_earned": coins
    }


@router.get("/{game_id}/leaderboard")
async def get_game_leaderboard(game_id: str):
    result = (supabase.table("game_players").select(
        "user_id, score, unlocked_pois, users(display_name, avatar_url, level)"
    ).eq("game_id", game_id).order("score", desc=True).execute())
    return {"leaderboard": result.data}


@router.get("/user/actions")
async def get_user_actions(user_id: str | None = Depends(get_optional_user)):
    """Get actionable items for the user: territories to defend, nearby cities, future itinerary quizzes"""
    if not user_id:
        return {
            "actions": [{
                "type": "territories",
                "text": "Accedi per difendere i tuoi territori",
                "icon": "Shield",
                "color": "bg-yellow-500/20"
            }]
        }

    actions = []

    try:
        # 1. Check for territories to defend (active territories)
        territories_result = supabase.table("territories").select(
            "id, poi_id, city_slug").eq("user_id", user_id).eq("active",
                                                               True).execute()

        active_territories = territories_result.data if territories_result.data else []
        if active_territories:
            actions.append({
                "type": "territories",
                "text": f"{len(active_territories)} posti da difendere",
                "icon": "Shield",
                "color": "bg-yellow-500/20"
            })

        # 2. Nearby cities (based on user's main city - default Roma)
        # In a real scenario, this would be based on user's location
        user_main_city = "Roma"
        nearby_cities = {
            "Roma": "Tivoli e Frascati sono vicine a Roma (30 km)",
            "Firenze": "Siena e Volterra sono vicine a Firenze (50 km)",
            "Milano": "Como e Varese sono vicine a Milano (40 km)",
            "Napoli": "Pompei e Sorrento sono vicine a Napoli (25 km)"
        }

        if user_main_city in nearby_cities:
            actions.append({
                "type": "nearby_cities",
                "text": nearby_cities[user_main_city],
                "icon": "MapPin",
                "color": "bg-green-500/20"
            })

        # 3. Future itinerary quizzes
        # Check for games in planning status or future start date
        future_games_result = supabase.table("games").select(
            "id, city, created_at, status").eq("created_by", user_id).eq(
                "status", "waiting").execute()

        future_games = future_games_result.data if future_games_result.data else []
        if future_games:
            quiz_count = len(future_games)
            first_city = future_games[0]["city"]
            actions.append({
                "type": "future_quizzes",
                "text":
                f"{quiz_count} quiz da fare sugli itinerari futuri a {first_city}",
                "icon": "Zap",
                "color": "bg-blue-500/20"
            })

        # If no actions, show default suggestions
        if not actions:
            actions = [{
                "type": "territories",
                "text": "Conquistare il primo territorio",
                "icon": "Shield",
                "color": "bg-yellow-500/20"
            }, {
                "type": "nearby_cities",
                "text": "Scopri città vicine",
                "icon": "MapPin",
                "color": "bg-green-500/20"
            }, {
                "type": "future_quizzes",
                "text": "Crea il tuo primo itinerario",
                "icon": "Zap",
                "color": "bg-blue-500/20"
            }]

    except Exception as e:
        print(f"Error fetching user actions: {str(e)}")
        actions = [{
            "type": "territories",
            "text": "Scopri i territori",
            "icon": "Shield",
            "color": "bg-yellow-500/20"
        }, {
            "type": "nearby_cities",
            "text": "Città vicine a te",
            "icon": "MapPin",
            "color": "bg-green-500/20"
        }, {
            "type": "future_quizzes",
            "text": "Quiz sugli itinerari",
            "icon": "Zap",
            "color": "bg-blue-500/20"
        }]

    return {"actions": actions}
