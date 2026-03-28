import httpx
from app.models import UserProfile
from app.services.ai import rank_pois
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/city", tags=["city"])

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
WIKIPEDIA_API = "https://it.wikipedia.org/api/rest_v1/page/summary"

# Lista di città popolari in Italia (dinamica - potrebbe venire da DB)
POPULAR_CITIES = [
    {
        "name": "Roma",
        "slug": "roma",
        "lat": 41.9028,
        "lng": 12.4964,
        "description": "La città eterna"
    },
    {
        "name": "Milano",
        "slug": "milano",
        "lat": 45.4642,
        "lng": 9.1900,
        "description": "Capitale della moda"
    },
    {
        "name": "Firenze",
        "slug": "firenze",
        "lat": 43.7696,
        "lng": 11.2558,
        "description": "Culla del Rinascimento"
    },
    {
        "name": "Napoli",
        "slug": "napoli",
        "lat": 40.8518,
        "lng": 14.2681,
        "description": "Città del sole"
    },
    {
        "name": "Venezia",
        "slug": "venezia",
        "lat": 45.4408,
        "lng": 12.3155,
        "description": "La città dell'acqua"
    },
    {
        "name": "Torino",
        "slug": "torino",
        "lat": 45.0705,
        "lng": 7.6868,
        "description": "Porta d'Italia"
    },
    {
        "name": "Bologna",
        "slug": "bologna",
        "lat": 44.4949,
        "lng": 11.3467,
        "description": "La città rossa"
    },
    {
        "name": "Palermo",
        "slug": "palermo",
        "lat": 38.1156,
        "lng": 13.3615,
        "description": "Capitale della Sicilia"
    },
    {
        "name": "Genova",
        "slug": "genova",
        "lat": 44.4056,
        "lng": 8.9463,
        "description": "La superba"
    },
    {
        "name": "Verona",
        "slug": "verona",
        "lat": 45.4384,
        "lng": 10.9916,
        "description": "Città dell'amore"
    },
]


@router.get("/list")
async def get_cities():
    """Ritorna la lista di città disponibili."""
    return {"cities": POPULAR_CITIES, "total": len(POPULAR_CITIES)}


@router.get("/search")
async def search_city(q: str = ""):
    """Cerca città per nome."""
    if not q:
        return {"cities": POPULAR_CITIES}

    query_lower = q.lower()
    filtered = [c for c in POPULAR_CITIES if query_lower in c["name"].lower()]
    return {"cities": filtered, "total": len(filtered)}


@router.get("/{city_name}/exists")
async def check_city_exists(city_name: str):
    """Controlla se una città è disponibile."""
    city = next(
        (c for c in POPULAR_CITIES if c["name"].lower() == city_name.lower()),
        None)
    if not city:
        raise HTTPException(status_code=404,
                            detail=f"Città '{city_name}' non trovata")
    return {"exists": True, "city": city}


def build_overpass_query(city: str) -> str:
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


def parse_overpass(data: dict) -> list[dict]:
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

        category = (tags.get("tourism", "") or tags.get("historic", "")
                    or tags.get("amenity", "") or tags.get("leisure", "")
                    or tags.get("building", ""))

        wikipedia = tags.get("wikipedia", "")
        wikidata = tags.get("wikidata", "")

        pois.append({
            "id":
            f"osm_{el['id']}",
            "name":
            name,
            "lat":
            lat,
            "lng":
            lng,
            "category":
            category,
            "description":
            tags.get("description", ""),
            "wikipedia_url":
            f"https://it.wikipedia.org/wiki/{wikipedia.split(':',1)[-1]}"
            if wikipedia else "",
            "wikidata_id":
            wikidata,
            "opening_hours":
            tags.get("opening_hours", ""),
            "fee":
            tags.get("fee", ""),
            "website":
            tags.get("website", ""),
        })

    return pois


async def enrich_with_wikipedia(pois: list[dict]) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        for poi in pois[:30]:
            wiki_url = poi.get("wikipedia_url", "")
            if not wiki_url:
                continue
            title = wiki_url.split(
                "/wiki/")[-1] if "/wiki/" in wiki_url else ""
            if not title:
                continue
            try:
                resp = await client.get(f"{WIKIPEDIA_API}/{title}")
                if resp.status_code == 200:
                    data = resp.json()
                    poi["description"] = data.get("extract",
                                                  poi["description"])
            except Exception:
                pass
    return pois


@router.get("/{city_name}/pois")
async def get_city_pois(city_name: str):
    """Fetch raw POIs from OSM for a city."""
    query = build_overpass_query(city_name)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Errore Overpass API")
        data = resp.json()

    pois = parse_overpass(data)
    pois = await enrich_with_wikipedia(pois)
    return {"city": city_name, "count": len(pois), "pois": pois}


@router.post("/{city_name}/rank")
async def rank_city_pois(city_name: str,
                         profile: UserProfile,
                         budget: str = "medio"):
    """Rank POIs using Claude AI based on user profile."""
    query = build_overpass_query(city_name)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Errore Overpass API")
        data = resp.json()

    pois = parse_overpass(data)
    pois = await enrich_with_wikipedia(pois)

    if not pois:
        raise HTTPException(status_code=404,
                            detail=f"Nessun POI trovato per {city_name}")

    ranked = await rank_pois(pois, profile, city_name, budget)
    return {"city": city_name, "count": len(ranked), "pois": ranked}
