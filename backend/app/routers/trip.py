"""
Trip planning router — Dove Andiamo? flow
POST /api/trip/pois       → ranked POIs based on trip profile
POST /api/trip/itinerary  → day-by-day itinerary from liked POIs
"""

import logging
from fastapi import APIRouter, HTTPException
from app.models import TripPOIsRequest, TripItineraryRequest
from app.services import ai as ai_service

logger = logging.getLogger("playthecity")

router = APIRouter(prefix="/api/trip", tags=["trip"])


@router.post("/pois")
async def get_trip_pois(req: TripPOIsRequest):
    """
    Generate and rank POIs for a city based on the trip profile.
    Returns up to 15 POIs sorted by relevance.
    """
    # Build user profile from trip profile for AI functions
    user_profile = req.user_profile
    user_profile.interests = req.trip_profile.interests or user_profile.interests

    # Map experience type to cultural level
    exp_map = {
        "esploratore": "appassionato",
        "classico": "casual",
        "mix": "casual",
    }
    user_profile.cultural_level = exp_map.get(req.trip_profile.experience_type, "casual")

    # Map pace
    user_profile.pace = req.trip_profile.pace

    # Map budget label for AI
    budget_map = {
        "economico": "basso",
        "medio": "medio",
        "comfort": "alto",
        "lusso": "alto",
    }
    budget = budget_map.get(req.trip_profile.budget, "medio")

    logger.info(f"[trip/pois] city={req.city} days={req.trip_profile.days} budget={budget}")

    pois = await ai_service.generate_city_pois(req.city, user_profile, budget)

    if not pois:
        raise HTTPException(status_code=500, detail="Impossibile generare POI per questa città")

    return {"pois": pois, "city": req.city, "total": len(pois)}


@router.post("/itinerary")
async def generate_itinerary(req: TripItineraryRequest):
    """
    Generate a day-by-day itinerary from the POIs the user liked during swipe.
    """
    if not req.all_pois:
        raise HTTPException(status_code=400, detail="Nessun POI selezionato")

    logger.info(
        f"[trip/itinerary] city={req.city} days={req.trip_profile.days} pois={len(req.all_pois)}"
    )

    days = await ai_service.generate_trip_itinerary(
        req.city,
        req.all_pois,
        req.trip_profile,
        req.user_profile,
    )

    return {
        "days": days,
        "city": req.city,
        "total_days": req.trip_profile.days,
        "total_pois": len(req.all_pois),
    }
