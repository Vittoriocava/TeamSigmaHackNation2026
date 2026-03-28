import math
import httpx
from fastapi import APIRouter, HTTPException
from app.models import UserProfile
from app.services.ai import rank_pois, generate_city_pois

router = APIRouter(prefix="/api/city", tags=["city"])

NOMINATIM_API = "https://nominatim.openstreetmap.org/search"

# POI fuori da questo raggio (km) vengono scartati anche se generati dall'AI
_MAX_POI_DISTANCE_KM = 10.0


# ──────────────────────────────────────────────
# Geocoding
# ──────────────────────────────────────────────

async def geocode_city(city: str) -> tuple[float, float] | None:
    params = {"q": f"{city}, Italy", "format": "json", "limit": 1, "featuretype": "city"}
    headers = {"User-Agent": "PlayTheCity/1.0 (hacknation2026)"}
    async with httpx.AsyncClient(timeout=8) as client:
        try:
            resp = await client.get(NOMINATIM_API, params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception:
            pass
    return None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def filter_pois_by_distance(pois: list[dict], center: tuple[float, float]) -> list[dict]:
    clat, clng = center
    return [p for p in pois if _haversine_km(clat, clng, p["lat"], p["lng"]) <= _MAX_POI_DISTANCE_KM]


# ──────────────────────────────────────────────
# Main fetch pipeline (AI-only, no Overpass)
# ──────────────────────────────────────────────

async def _fetch_and_filter_pois(city_name: str, profile: UserProfile | None = None, budget: str = "medio") -> list[dict]:
    """
    Generate POIs via AI (names/descriptions) + Nominatim (real coordinates).
    Distance filter is kept as a sanity check against the wrong-city edge case.
    """
    _default_profile = UserProfile()
    p = profile or _default_profile

    pois = await generate_city_pois(city_name, p, budget)

    # Sanity check: discard any POI geocoded to a completely different city
    center = await geocode_city(city_name)
    if center and pois:
        filtered = filter_pois_by_distance(pois, center)
        # Keep filtered only if it didn't remove too many (Nominatim found them all correctly)
        pois = filtered if len(filtered) >= max(3, len(pois) // 2) else pois

    return pois


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.get("/{city_name}/pois")
async def get_city_pois(city_name: str):
    pois = await _fetch_and_filter_pois(city_name)
    return {"city": city_name, "count": len(pois), "pois": pois}


@router.post("/{city_name}/rank")
async def rank_city_pois(city_name: str, profile: UserProfile, budget: str = "medio"):
    pois = await _fetch_and_filter_pois(city_name, profile, budget)
    if not pois:
        raise HTTPException(status_code=404, detail=f"Nessun POI trovato per {city_name}")
    return {"city": city_name, "count": len(pois), "pois": pois}
