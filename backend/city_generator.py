import httpx
from fastapi import APIRouter, Depends, HTTPException
from models import POI, UserProfile
from auth import get_current_user
from ai_engine import rank_pois

router = APIRouter(prefix="/api/city", tags=["city"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
WIKIPEDIA_API = "https://it.wikipedia.org/api/rest_v1/page/summary"


def _build_overpass_query(city: str) -> str:
    """Build Overpass QL to fetch tourist-relevant POIs in a city."""
    return f"""
[out:json][timeout:30];
area["name"="{city}"]["admin_level"~"^[4-8]$"]->.searchArea;
(
  nwr["tourism"~"attraction|museum|artwork|viewpoint|gallery"](area.searchArea);
  nwr["historic"~"monument|memorial|castle|archaeological_site|ruins|church"](area.searchArea);
  nwr["amenity"~"restaurant|cafe|bar|pub|nightclub|library|theatre"](area.searchArea);
  nwr["leisure"~"park|garden"](area.searchArea);
  nwr["building"~"cathedral|church|temple|synagogue|mosque"](area.searchArea);
);
out center 100;
"""


def _parse_overpass(data: dict) -> list[dict]:
    """Parse Overpass response into raw POI dicts."""
    pois = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name:
            continue

        lat = el.get("lat") or el.get("center", {}).get("lat", 0)
        lng = el.get("lon") or el.get("center", {}).get("lon", 0)
        if not lat or not lng:
            continue

        category = (
            tags.get("tourism", "")
            or tags.get("historic", "")
            or tags.get("amenity", "")
            or tags.get("leisure", "")
            or tags.get("building", "")
        )

        wikipedia = tags.get("wikipedia", "")
        wikidata = tags.get("wikidata", "")

        pois.append({
            "id": f"osm_{el['id']}",
            "name": name,
            "lat": lat,
            "lng": lng,
            "category": category,
            "description": tags.get("description", ""),
            "wikipedia_url": f"https://it.wikipedia.org/wiki/{wikipedia.split(':',1)[-1]}" if wikipedia else "",
            "wikidata_id": wikidata,
            "opening_hours": tags.get("opening_hours", ""),
            "fee": tags.get("fee", ""),
            "website": tags.get("website", ""),
        })

    return pois


async def _enrich_with_wikipedia(pois: list[dict]) -> list[dict]:
    """Enrich POIs with Wikipedia summaries."""
    async with httpx.AsyncClient(timeout=10) as client:
        for poi in pois[:30]:  # Limit to avoid rate limits
            wiki_url = poi.get("wikipedia_url", "")
            if not wiki_url:
                continue
            title = wiki_url.split("/wiki/")[-1] if "/wiki/" in wiki_url else ""
            if not title:
                continue
            try:
                resp = await client.get(f"{WIKIPEDIA_API}/{title}")
                if resp.status_code == 200:
                    data = resp.json()
                    poi["description"] = data.get("extract", poi["description"])
            except Exception:
                pass
    return pois


@router.get("/{city_name}/pois")
async def get_city_pois(city_name: str):
    """Fetch raw POIs from OSM for a city."""
    query = _build_overpass_query(city_name)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Errore Overpass API")
        data = resp.json()

    pois = _parse_overpass(data)
    pois = await _enrich_with_wikipedia(pois)
    return {"city": city_name, "count": len(pois), "pois": pois}


@router.post("/{city_name}/rank")
async def rank_city_pois(
    city_name: str,
    profile: UserProfile,
    budget: str = "medio",
):
    """Rank POIs using Claude AI based on user profile."""
    # First get raw POIs
    query = _build_overpass_query(city_name)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Errore Overpass API")
        data = resp.json()

    pois = _parse_overpass(data)
    pois = await _enrich_with_wikipedia(pois)

    if not pois:
        raise HTTPException(status_code=404, detail=f"Nessun POI trovato per {city_name}")

    ranked = await rank_pois(pois, profile, city_name, budget)
    return {"city": city_name, "count": len(ranked), "pois": ranked}
