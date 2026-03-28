import httpx
from fastapi import APIRouter, HTTPException
from app.models import UserProfile
from app.services.ai import rank_pois

router = APIRouter(prefix="/api/city", tags=["city"])

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]
WIKIPEDIA_API = "https://it.wikipedia.org/api/rest_v1/page/summary"


def build_overpass_query(city: str) -> str:
    # Use a simpler, faster query with timeout 25s
    return f"""
[out:json][timeout:25];
area["name"="{city}"]["admin_level"~"^[4-8]$"]->.searchArea;
(
  nwr["tourism"~"attraction|museum|viewpoint"](area.searchArea);
  nwr["historic"~"monument|castle|archaeological_site|church"](area.searchArea);
  nwr["amenity"~"restaurant|cafe|theatre"](area.searchArea);
  nwr["leisure"~"park|garden"](area.searchArea);
);
out center 80;
"""


def parse_overpass(data: dict) -> list[dict]:
    pois = []
    seen = set()
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "")
        if not name or name in seen:
            continue
        seen.add(name)

        lat = el.get("lat") or el.get("center", {}).get("lat", 0)
        lng = el.get("lon") or el.get("center", {}).get("lon", 0)
        if not lat or not lng:
            continue

        category = (
            tags.get("tourism", "")
            or tags.get("historic", "")
            or tags.get("amenity", "")
            or tags.get("leisure", "")
        )

        wikipedia = tags.get("wikipedia", "")

        pois.append({
            "id": f"osm_{el['id']}",
            "name": name,
            "lat": lat,
            "lng": lng,
            "category": category,
            "description": tags.get("description", ""),
            "wikipedia_url": f"https://it.wikipedia.org/wiki/{wikipedia.split(':',1)[-1]}" if wikipedia else "",
            "wikidata_id": tags.get("wikidata", ""),
            "opening_hours": tags.get("opening_hours", ""),
            "fee": tags.get("fee", ""),
            "website": tags.get("website", ""),
        })

    return pois


async def fetch_overpass(query: str) -> dict:
    """Try each mirror in order, return first successful response."""
    last_error = None
    async with httpx.AsyncClient(timeout=40) as client:
        for mirror in OVERPASS_MIRRORS:
            try:
                resp = await client.post(mirror, data={"data": query})
                if resp.status_code == 200:
                    return resp.json()
                last_error = f"{mirror} → HTTP {resp.status_code}"
            except Exception as e:
                last_error = f"{mirror} → {e}"
    raise HTTPException(status_code=502, detail=f"Overpass non raggiungibile: {last_error}")


async def enrich_with_wikipedia(pois: list[dict]) -> list[dict]:
    async with httpx.AsyncClient(timeout=8) as client:
        for poi in pois[:20]:  # limit to 20 to keep it fast
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
                    extract = data.get("extract", "")
                    if extract:
                        poi["description"] = extract[:500]  # cap length
            except Exception:
                pass
    return pois


@router.get("/{city_name}/pois")
async def get_city_pois(city_name: str):
    """Fetch raw POIs from OSM for a city."""
    query = build_overpass_query(city_name)
    data = await fetch_overpass(query)
    pois = parse_overpass(data)
    pois = await enrich_with_wikipedia(pois)
    return {"city": city_name, "count": len(pois), "pois": pois}


@router.post("/{city_name}/rank")
async def rank_city_pois(city_name: str, profile: UserProfile, budget: str = "medio"):
    """Rank POIs using AI based on user profile."""
    query = build_overpass_query(city_name)
    data = await fetch_overpass(query)
    pois = parse_overpass(data)
    pois = await enrich_with_wikipedia(pois)

    if not pois:
        raise HTTPException(status_code=404, detail=f"Nessun POI trovato per {city_name}")

    ranked = await rank_pois(pois, profile, city_name, budget)
    return {"city": city_name, "count": len(ranked), "pois": ranked}
