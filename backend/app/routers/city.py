import math

import httpx
from app.models import UserProfile
from app.services.ai import rank_pois
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/city", tags=["city"])

NOMINATIM_API = "https://nominatim.openstreetmap.org/search"
WIKIPEDIA_API = "https://it.wikipedia.org/api/rest_v1/page/summary"

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]

# POI fuori da questo raggio (km) vengono scartati anche se generati dall'AI
_MAX_POI_DISTANCE_KM = 10.0

# Dati predefiniti di POI per le città (fallback quando Overpass non risponde)
CITY_POIS = {
    "Roma": [
        {
            "id": "roma_01",
            "name": "Colosseo",
            "category": "cultura",
            "lat": 41.8902,
            "lng": 12.4924,
            "description":
            "L'anfiteatro romano più grande, patrimonio UNESCO e simbolo di Roma",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Colosseo"
        },
        {
            "id": "roma_02",
            "name": "Fontana di Trevi",
            "category": "instagrammabili",
            "lat": 41.9009,
            "lng": 12.4833,
            "description":
            "La più celebre fontana barocca del mondo, meta obbligatoria per i turisti",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Fontana_di_Trevi"
        },
        {
            "id": "roma_03",
            "name": "Basilica di San Pietro",
            "category": "cultura",
            "lat": 41.9029,
            "lng": 12.4534,
            "description":
            "La principale chiesa cattolica nel mondo, capolavoro architettonico del Rinascimento",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Basilica_di_San_Pietro"
        },
        {
            "id": "roma_04",
            "name": "Musei Vaticani",
            "category": "cultura",
            "lat": 41.9066,
            "lng": 12.4538,
            "description":
            "Uno dei musei più importanti del mondo con la Cappella Sistina",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Musei_Vaticani"
        },
        {
            "id": "roma_05",
            "name": "Pantheon",
            "category": "cultura",
            "lat": 41.8986,
            "lng": 12.4769,
            "description":
            "Tempio romano magnificamente conservato, capolavoro dell'architettura antica",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Pantheon_(Roma)"
        },
        {
            "id": "roma_06",
            "name": "Foro Romano",
            "category": "cultura",
            "lat": 41.8925,
            "lng": 12.4853,
            "description":
            "Centro della vita politica e sociale nell'antica Roma",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Foro_Romano"
        },
        {
            "id": "roma_07",
            "name": "Villa Borghese",
            "category": "natura",
            "lat": 41.9119,
            "lng": 12.4896,
            "description":
            "Uno dei più importanti parchi di Roma con Galleria Borghese",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Villa_Borghese"
        },
        {
            "id": "roma_08",
            "name": "Trastevere",
            "category": "food",
            "lat": 41.8929,
            "lng": 12.4693,
            "description":
            "Quartiere caratteristico con ristoranti tipici e atmosfera tradizionale romana",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Trastevere"
        },
        {
            "id": "roma_09",
            "name": "Ponte Sant'Angelo",
            "category": "instagrammabili",
            "lat": 41.8968,
            "lng": 12.4688,
            "description":
            "Ponte romano sulla Tevere con splendida vista e atmosfera romantica",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Ponte_Sant'Angelo"
        },
        {
            "id": "roma_10",
            "name": "Palazzo Altemps",
            "category": "cultura",
            "lat": 41.8994,
            "lng": 12.4723,
            "description":
            "Museo con collezione di sculture antiche e arte rinascimentale",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Palazzo_Altemps"
        },
    ],
    "Milano": [
        {
            "id": "milano_01",
            "name": "Duomo di Milano",
            "category": "cultura",
            "lat": 45.4642,
            "lng": 9.1919,
            "description":
            "La cattedrale gotica più grande d'Italia, capolavoro architettonico milanese",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Duomo_di_Milano"
        },
        {
            "id": "milano_02",
            "name": "La Scala",
            "category": "cultura",
            "lat": 45.4682,
            "lng": 9.1876,
            "description":
            "Il teatro lirico più famoso del mondo, culla della musica classica",
            "wikipedia_url": "https://it.wikipedia.org/wiki/La_Scala"
        },
        {
            "id":
            "milano_03",
            "name":
            "Galleria Vittorio Emanuele II",
            "category":
            "shopping",
            "lat":
            45.4652,
            "lng":
            9.1900,
            "description":
            "Galleria storica con negozi di lusso e architettura straordinaria",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Galleria_Vittorio_Emanuele_II"
        },
        {
            "id": "milano_04",
            "name": "Castello Sforzesco",
            "category": "cultura",
            "lat": 45.4707,
            "lng": 9.1749,
            "description": "Maestosa fortezza con musei e collezioni d'arte",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Castello_Sforzesco"
        },
        {
            "id": "milano_05",
            "name": "Navigli",
            "category": "nightlife",
            "lat": 45.4549,
            "lng": 9.1876,
            "description":
            "Quartiere storico con canali, bar e ristoranti nella movida milanese",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Navigli"
        },
        {
            "id": "milano_06",
            "name": "Pinacoteca di Brera",
            "category": "cultura",
            "lat": 45.4728,
            "lng": 9.1880,
            "description":
            "Importante museo con opere della pittura italiana ed europea",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Pinacoteca_di_Brera"
        },
        {
            "id": "milano_07",
            "name": "Parco Sempione",
            "category": "natura",
            "lat": 45.4795,
            "lng": 9.1784,
            "description": "Polmone verde di Milano con arco della Pace",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Parco_Sempione"
        },
        {
            "id": "milano_08",
            "name": "Triennale di Milano",
            "category": "cultura",
            "lat": 45.4766,
            "lng": 9.1800,
            "description": "Museo di design e architettura contemporanea",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Triennale_di_Milano"
        },
        {
            "id":
            "milano_09",
            "name":
            "Quadrilatero della Moda",
            "category":
            "shopping",
            "lat":
            45.4702,
            "lng":
            9.1947,
            "description":
            "Epicentro della moda italiana con boutique dei grandi stilisti",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Quadrilatero_della_Moda"
        },
        {
            "id": "milano_10",
            "name": "Cimitero Monumentale",
            "category": "cultura",
            "lat": 45.4858,
            "lng": 9.1736,
            "description":
            "Museo all'aperto con sculture e monumenti funerari straordinari",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Cimitero_Monumentale"
        },
    ],
    "Firenze": [
        {
            "id":
            "firenze_01",
            "name":
            "Duomo di Firenze",
            "category":
            "cultura",
            "lat":
            43.7731,
            "lng":
            11.2549,
            "description":
            "La cattedrale gotica con la cupola del Brunelleschi, simbolo di Firenze",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Cattedrale_di_Santa_Maria_del_Fiore"
        },
        {
            "id": "firenze_02",
            "name": "Uffizi",
            "category": "cultura",
            "lat": 43.7674,
            "lng": 11.2566,
            "description":
            "Uno dei musei d'arte più importanti del mondo con capolavori del Rinascimento",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Galleria_degli_Uffizi"
        },
        {
            "id": "firenze_03",
            "name": "Ponte Vecchio",
            "category": "instagrammabili",
            "lat": 43.7681,
            "lng": 11.2532,
            "description":
            "Il ponte più antico di Firenze con botteghe di orafi e atmosfera medievale",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Ponte_Vecchio"
        },
        {
            "id": "firenze_04",
            "name": "Palazzo Pitti",
            "category": "cultura",
            "lat": 43.7646,
            "lng": 11.2488,
            "description":
            "Maestosa residenza rinascimentale con gallerie d'arte e giardini",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Palazzo_Pitti"
        },
        {
            "id": "firenze_05",
            "name": "Giardino di Boboli",
            "category": "natura",
            "lat": 43.7635,
            "lng": 11.2470,
            "description":
            "Spettacolare giardino storico con sculture e fontane",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Giardino_di_Boboli"
        },
        {
            "id":
            "firenze_06",
            "name":
            "Basilica di Santa Maria Novella",
            "category":
            "cultura",
            "lat":
            43.7764,
            "lng":
            11.2482,
            "description":
            "Chiesa gotica con affreschi e opere d'arte rinascimentali",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Basilica_di_Santa_Maria_Novella"
        },
        {
            "id": "firenze_07",
            "name": "Piazzale Michelangelo",
            "category": "instagrammabili",
            "lat": 43.7604,
            "lng": 11.2850,
            "description":
            "Terrazza panoramica con vista mozzafiato su Firenze",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Piazzale_Michelangelo"
        },
        {
            "id": "firenze_08",
            "name": "Mercato Centrale",
            "category": "food",
            "lat": 43.7777,
            "lng": 11.2516,
            "description":
            "Mercato tradizionale con prodotti locali e piatti tipici toscani",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Mercato_Centrale"
        },
        {
            "id":
            "firenze_09",
            "name":
            "Accademia",
            "category":
            "cultura",
            "lat":
            43.7783,
            "lng":
            11.2588,
            "description":
            "Museo con la celebre scultura del David di Michelangelo",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Galleria_dell'Accademia"
        },
        {
            "id": "firenze_10",
            "name": "Oltrarno",
            "category": "food",
            "lat": 43.7615,
            "lng": 11.2489,
            "description":
            "Quartiere bohemien con botteghe artigiane, bar e ristoranti caratteristici",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Oltrarno"
        },
    ],
    "Napoli": [
        {
            "id":
            "napoli_01",
            "name":
            "Museo Archeologico Nazionale",
            "category":
            "cultura",
            "lat":
            40.8559,
            "lng":
            14.2520,
            "description":
            "Uno dei più importanti musei al mondo con reperti da Pompei ed Ercolano",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Museo_archeologico_nazionale_di_Napoli"
        },
        {
            "id": "napoli_02",
            "name": "Spaccanapoli",
            "category": "food",
            "lat": 40.8511,
            "lng": 14.2618,
            "description":
            "Vicolo storico nel cuore di Napoli, autentico e pieno di vita",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Spaccanapoli"
        },
        {
            "id":
            "napoli_03",
            "name":
            "Cattedrale di San Gennaro",
            "category":
            "cultura",
            "lat":
            40.8540,
            "lng":
            14.2685,
            "description":
            "Cattedrale gotica con la reliquia di San Gennaro",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Cattedrale_di_San_Gennaro"
        },
        {
            "id": "napoli_04",
            "name": "Castel dell'Ovo",
            "category": "instagrammabili",
            "lat": 40.8292,
            "lng": 14.2384,
            "description":
            "Castello normanno sul mare con vista del golfo di Napoli",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Castel_dell'Ovo"
        },
        {
            "id": "napoli_05",
            "name": "Lungomare Caracciolo",
            "category": "natura",
            "lat": 40.8364,
            "lng": 14.2353,
            "description": "Passeggiata lungo il mare con vista sul Vesuvio",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Lungomare_Caracciolo"
        },
        {
            "id":
            "napoli_06",
            "name":
            "Palazzo Reale",
            "category":
            "cultura",
            "lat":
            40.8352,
            "lng":
            14.2679,
            "description":
            "Residenza reale con magnifiche sale e collezioni d'arte",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Palazzo_Reale_di_Napoli"
        },
        {
            "id": "napoli_07",
            "name": "San Gregorio Armeno",
            "category": "shopping",
            "lat": 40.8515,
            "lng": 14.2673,
            "description":
            "Strada famosa per i presepi artistici e botteghe tradizionali",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/San_Gregorio_Armeno"
        },
        {
            "id":
            "napoli_08",
            "name":
            "Basilica di Santa Chiara",
            "category":
            "cultura",
            "lat":
            40.8481,
            "lng":
            14.2619,
            "description":
            "Basilica gotica con chiostro decorate d'azzulejos",
            "wikipedia_url":
            "https://it.wikipedia.org/wiki/Basilica_di_Santa_Chiara"
        },
        {
            "id": "napoli_09",
            "name": "Pizzeria Brandi",
            "category": "food",
            "lat": 40.8464,
            "lng": 14.2705,
            "description":
            "Leggendaria pizzeria dove nacque la pizza Margherita nel 1889",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Pizzeria_Brandi"
        },
        {
            "id": "napoli_10",
            "name": "Teatro San Carlo",
            "category": "cultura",
            "lat": 40.8352,
            "lng": 14.2684,
            "description": "Uno dei teatri lirici più importanti d'Italia",
            "wikipedia_url": "https://it.wikipedia.org/wiki/Teatro_San_Carlo"
        },
    ],
}

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


# ──────────────────────────────────────────────
# Overpass Query Builder
# ──────────────────────────────────────────────


def build_overpass_query(city: str) -> str:
    """Build Overpass query for POI discovery in a city."""
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


# ──────────────────────────────────────────────
# Geocoding
# ──────────────────────────────────────────────


async def geocode_city(city: str) -> tuple[float, float] | None:
    params = {
        "q": f"{city}, Italy",
        "format": "json",
        "limit": 1,
        "featuretype": "city"
    }
    headers = {"User-Agent": "PlayTheCity/1.0 (hacknation2026)"}
    async with httpx.AsyncClient(timeout=8) as client:
        try:
            resp = await client.get(NOMINATIM_API,
                                    params=params,
                                    headers=headers)
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
    a = (math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) * math.sin(dlng / 2)**2)
    return R * 2 * math.asin(math.sqrt(a))


def filter_pois_by_distance(pois: list[dict],
                            center: tuple[float, float]) -> list[dict]:
    clat, clng = center
    return [
        p for p in pois if _haversine_km(clat, clng, p["lat"], p["lng"]) <=
        _MAX_POI_DISTANCE_KM
    ]


# ──────────────────────────────────────────────
# Overpass parsing
# ──────────────────────────────────────────────


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

        category = (tags.get("tourism", "") or tags.get("historic", "")
                    or tags.get("amenity", "") or tags.get("leisure", ""))

        wikipedia = tags.get("wikipedia", "")

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
            tags.get("wikidata", ""),
            "opening_hours":
            tags.get("opening_hours", ""),
            "fee":
            tags.get("fee", ""),
            "website":
            tags.get("website", ""),
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
    raise HTTPException(status_code=502,
                        detail=f"Overpass non raggiungibile: {last_error}")


async def enrich_with_wikipedia(pois: list[dict]) -> list[dict]:
    async with httpx.AsyncClient(timeout=8) as client:
        for poi in pois[:20]:  # limit to 20 to keep it fast
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
                    extract = data.get("extract", "")
                    if extract:
                        poi["description"] = extract[:500]  # cap length
            except Exception:
                pass
    return pois


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("/{city_name}/pois")
async def get_city_pois(city_name: str):
    """Fetch POIs from OSM for a city, with fallback to local data."""
    # Se la città ha dati predefiniti, usali direttamente
    if city_name in CITY_POIS:
        pois = CITY_POIS[city_name]
        return {"city": city_name, "count": len(pois), "pois": pois}

    # Altrimenti tenta di recuperare da Overpass
    try:
        query = build_overpass_query(city_name)
        data = await fetch_overpass(query)
        pois = parse_overpass(data)
        pois = await enrich_with_wikipedia(pois)

        if not pois:
            raise HTTPException(status_code=404,
                                detail=f"Nessun POI trovato per {city_name}")

        return {"city": city_name, "count": len(pois), "pois": pois}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502,
                            detail=f"Errore nel caricamento POI: {str(e)}")


@router.post("/{city_name}/rank")
async def rank_city_pois(city_name: str,
                         profile: UserProfile,
                         budget: str = "medio"):
    """Rank POIs using Claude AI based on user profile."""
    query = build_overpass_query(city_name)
    data = await fetch_overpass(query)
    pois = parse_overpass(data)
    pois = await enrich_with_wikipedia(pois)

    if not pois:
        raise HTTPException(status_code=404,
                            detail=f"Nessun POI trovato per {city_name}")

    ranked = await rank_pois(pois, profile, city_name, budget)
    return {"city": city_name, "count": len(ranked), "pois": ranked}


# ──────────────────────────────────────────────
# Profile-based POI suggestions
# ──────────────────────────────────────────────

INTEREST_CATEGORY_MAP = {
    "arte": ["museum", "cultura", "monument", "church", "attraction"],
    "storia": ["museum", "cultura", "monument", "castle", "archaeological_site", "church"],
    "architettura": ["monument", "church", "castle", "cultura", "attraction"],
    "fotografia": ["instagrammabili", "viewpoint", "monument", "park"],
    "natura": ["park", "natura", "garden", "viewpoint"],
    "food": ["food", "restaurant", "cafe"],
    "nightlife": ["nightlife", "bar", "restaurant"],
    "shopping": ["shopping", "attraction"],
    "musica": ["theatre", "cultura", "attraction"],
    "sport": ["park", "natura", "garden"],
    "scienza": ["museum", "cultura", "attraction"],
    "religione": ["church", "monument", "cultura"],
}


@router.get("/{city_name}/profile-pois")
async def get_profile_pois(city_name: str, interests: str = ""):
    """Get POI suggestions based on user interests."""
    interest_list = [i.strip().lower() for i in interests.split(",") if i.strip()] if interests else []

    # Get POIs from local data or Overpass
    if city_name in CITY_POIS:
        all_pois = CITY_POIS[city_name]
    else:
        try:
            query = build_overpass_query(city_name)
            data = await fetch_overpass(query)
            all_pois = parse_overpass(data)
        except Exception:
            return {"city": city_name, "pois": []}

    if not interest_list:
        return {"city": city_name, "pois": all_pois[:5]}

    # Build set of matching categories from interests
    matching_categories: set[str] = set()
    for interest in interest_list:
        cats = INTEREST_CATEGORY_MAP.get(interest, [])
        matching_categories.update(cats)

    if not matching_categories:
        matching_categories = {"attraction", "monument", "museum"}

    # Score and filter POIs
    scored = []
    for poi in all_pois:
        cat = poi.get("category", "").lower()
        if cat in matching_categories:
            scored.append(poi)

    # Return top 8 matches, or fall back to first 5
    result = scored[:8] if scored else all_pois[:5]
    return {"city": city_name, "pois": result, "matched_interests": interest_list}
