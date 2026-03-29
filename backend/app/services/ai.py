import asyncio
import json
import re
import hashlib
from openai import OpenAI
from app.config import get_settings
from app.models import POI, UserProfile, QuizQuestion

REGOLO_BASE_URL = "https://api.regolo.ai/v1"

_client = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=get_settings().regolo_api_key,
            base_url=REGOLO_BASE_URL,
        )
    return _client


def _model() -> str:
    return get_settings().regolo_chat_model


def _vision_model() -> str:
    return get_settings().regolo_vision_model


def _image_model() -> str:
    return get_settings().regolo_image_model


def _lang(profile: UserProfile) -> str:
    langs = {"it": "italiano", "en": "English", "fr": "français", "es": "español"}
    return langs.get(profile.language, "italiano")


def _strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks emitted by reasoning models (e.g. Qwen3)."""
    return re.sub(r"<think>.*?(?:</think>|$)", "", text, flags=re.DOTALL).strip()


def _chat(messages: list, max_tokens: int = 500) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model=_model(),
        max_tokens=max_tokens,
        messages=messages,
    )
    return _strip_thinking(response.choices[0].message.content or "")


async def _chat_async(messages: list, max_tokens: int = 500) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: _chat(messages, max_tokens))


def _extract_json_object(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response: {repr(text)}")
    return json.loads(text[start:end])


def _extract_json_array(text: str) -> list:
    start = text.find("[")
    if start == -1:
        raise ValueError(f"No JSON array found in response: {repr(text)}")
    end = text.rfind("]") + 1
    candidate = text[start:end] if end > 0 else text[start:]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Response was truncated — recover complete objects up to the last valid `}`
        last_obj_end = candidate.rfind("}")
        if last_obj_end == -1:
            raise ValueError(f"No JSON array found in response: {text[:200]}")
        repaired = candidate[: last_obj_end + 1] + "]"
        return json.loads(repaired)


async def generate_city_pois(city: str, profile: UserProfile, budget: str = "medio") -> list[dict]:
    """
    Generate POIs via AI, then enrich coordinates via Nominatim.
    AI provides cultural knowledge + approximate coords; Nominatim corrects them where possible.
    """
    import httpx as _httpx
    import logging as _logging
    _log = _logging.getLogger("playthecity")

    # Step 1: AI generates full POI list including approximate coordinates
    prompt = f"""Sei un esperto di turismo italiano e guida locale di {city}.

Elenca esattamente 12 luoghi DA VISITARE nella città di {city}, Italia.
Devono essere luoghi REALI, fisicamente situati nel comune di {city}.

IMPORTANTE: includi una MIX di luoghi:
- 4 luoghi classici/iconici
- 4 luoghi insoliti o poco noti (hidden gems, cortili segreti, vicolos nascosti, storie urbane)
- 2 luoghi legati a leggende locali, misteri o personaggi storici
- 2 luoghi di street art, mercati, o vita quotidiana autentica

Profilo utente:
- interessi: {profile.interests}
- livello culturale: {profile.cultural_level}
- budget: {budget}

OUTPUT: SOLO array JSON valido. Inizia con [ e termina con ]. Nessun testo extra.

Ogni oggetto:
- "name": nome ufficiale del luogo
- "description": 2-3 frasi vivide e coinvolgenti. Includi UN fatto sorprendente o poco noto.
- "lat": latitudine approssimativa (numero decimale)
- "lng": longitudine approssimativa (numero decimale)
- "category": uno tra: museum, monument, church, restaurant, park, attraction, viewpoint, theatre, castle, archaeological_site, street_art, market, legend_site
- "relevance_score": punteggio 0-10
- "why_for_you": frase che spiega perché questo luogo è speciale PER QUESTO utente specifico
- "hidden_gem": true se è un luogo insolito o poco turistico
- "estimated_cost": "gratuito" o "€" o "€€" o "€€€"
- "crowd_level": "basso" o "medio" o "alto"

["""

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=5000)
    if not text.strip().startswith("["):
        text = "[" + text

    try:
        raw: list[dict] = _extract_json_array(text)
    except Exception as e:
        _log.warning(f"generate_city_pois: JSON parse failed for {city}: {e}")
        return []

    if not raw:
        _log.warning(f"generate_city_pois: empty list from AI for {city}")
        return []

    # Step 2: Enrich coordinates via Nominatim sequentially (rate limit: 1 req/sec)
    async def _nominatim_coords(name: str) -> tuple[float, float] | None:
        params = {"q": f"{name}, {city}, Italy", "format": "json", "limit": 1}
        headers = {"User-Agent": "PlayTheCity/1.0 (hacknation2026)"}
        try:
            async with _httpx.AsyncClient(timeout=6) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params=params,
                    headers=headers,
                )
            data = resp.json() if resp.status_code == 200 else []
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception:
            pass
        return None

    seen_ids: set[str] = set()
    result = []
    for idx, item in enumerate(raw):
        name = item.get("name", "").strip()
        if not name:
            continue

        # Parse AI coordinates as fallback
        try:
            ai_lat = float(item.get("lat") or item.get("latitude") or 0)
            ai_lng = float(item.get("lng") or item.get("longitude") or item.get("lon") or 0)
        except (TypeError, ValueError):
            ai_lat, ai_lng = 0.0, 0.0

        # Try Nominatim for accurate coordinates
        coords = await _nominatim_coords(name)
        import asyncio as _asyncio
        await _asyncio.sleep(1.1)  # Nominatim rate limit

        if coords:
            lat, lng = coords
        elif ai_lat and ai_lng:
            lat, lng = ai_lat, ai_lng
        else:
            continue  # no usable coordinates at all

        # Ensure unique IDs — include index to avoid hash collisions on same name
        base_id = f"ai_{hashlib.md5(name.encode()).hexdigest()[:10]}"
        poi_id = base_id if base_id not in seen_ids else f"{base_id}_{idx}"
        seen_ids.add(poi_id)

        result.append({
            "id": poi_id,
            "name": name,
            "lat": lat,
            "lng": lng,
            "category": item.get("category", "attraction"),
            "description": item.get("description", f"Luogo storico di {city}."),
            "wikipedia_url": "",
            "wikidata_id": "",
            "opening_hours": "",
            "fee": "",
            "website": "",
            "relevance_score": float(item.get("relevance_score", 7.0)),
            "why_for_you": item.get("why_for_you", ""),
            "hidden_gem": bool(item.get("hidden_gem", False)),
            "estimated_cost": item.get("estimated_cost", "gratuito"),
            "crowd_level": item.get("crowd_level", "medio"),
        })

    result.sort(key=lambda x: x["relevance_score"], reverse=True)
    return result


async def generate_quiz(
    poi: POI,
    profile: UserProfile,
    difficulty: str = "medium",
    previous_questions: list[str] | None = None,
) -> QuizQuestion:
    prev = "\n".join(previous_questions or [])
    prompt = f"""Genera UNA domanda quiz sul luogo "{poi.name}" ({poi.category}).
Descrizione: {poi.description}
Difficoltà: {difficulty}
Lingua: {_lang(profile)}
Livello culturale utente: {profile.cultural_level}

{f"Domande già poste (NON ripetere):{chr(10)}{prev}" if prev else ""}

Rispondi SOLO con JSON valido:
{{
  "question": "testo domanda",
  "options": ["opzione1", "opzione2", "opzione3", "opzione4"],
  "correct_index": 0,
  "explanation": "breve spiegazione della risposta corretta",
  "source": "fonte verificabile"
}}"""

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=4000)
    data = _extract_json_object(text)
    data["poi_id"] = poi.id
    data["difficulty"] = difficulty
    return QuizQuestion(**data)


async def generate_story(poi: POI, profile: UserProfile, city: str) -> str:
    desc = poi.description or f"un luogo significativo nel centro di {city}, in Italia"
    prompt = f"""Sei il narratore di Play The City — una guida con la voce di uno storyteller cinematografico.

Luogo: {poi.name}
Città: {city} (Italia)
Dati reali: {desc}

Profilo giocatore: interessi {profile.interests}, livello {profile.cultural_level}
Lingua: {_lang(profile)}

Scrivi una storia immersiva di 180-250 parole. Regole:
- Inizia con una SCENA vivida: un momento storico specifico, un personaggio reale, un dettaglio sensoriale
- Racconta come se tu fossi LÌ in quel momento — odori, suoni, emozioni
- Rivela UN segreto o aneddoto che il 95% dei visitatori non conosce
- Usa SOLO fatti verificabili su {poi.name} a {city}
- NON iniziare con il nome del luogo
- Inserisci un personaggio storico reale legato a questo posto, se esiste
- Chiudi con una domanda o una provocazione che invita l'utente a guardare il luogo con occhi nuovi

Tono: avvincente, come un racconto da ascoltare di notte."""

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=1000)


async def generate_curiosity(poi: POI, profile: UserProfile) -> str:
    prompt = f"""Genera una curiosità nascosta e sorprendente su "{poi.name}".
Qualcosa che il 95% dei visitatori non sa.
Descrizione: {poi.description}
Lingua: {_lang(profile)}
Livello: {profile.cultural_level}

Max 80 parole. Tono: "lo sapevi che...?" coinvolgente."""

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=1000)


async def generate_connection(poi1: POI, poi2: POI, profile: UserProfile) -> str:
    prompt = f"""Trova e racconta una connessione nascosta tra questi due luoghi:
1. {poi1.name}: {poi1.description}
2. {poi2.name}: {poi2.description}

La connessione può essere storica, artistica, leggendaria o urbana.
Lingua: {_lang(profile)}
Max 100 parole. Tono narrativo, come se stessi svelando un segreto."""

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=1000)


async def analyze_photo(image_base64: str, poi: POI | None = None) -> dict:
    system_msg = "Sei l'agente visivo di Play The City. Analizza foto di luoghi e monumenti."
    user_text = 'Identifica il luogo in questa foto. Rispondi con JSON: {"identified": true/false, "place_name": "...", "confidence": 0.0-1.0, "description": "breve descrizione di cosa vedi", "perspective": "frontale/laterale/aerea/altro"}'
    if poi:
        user_text += f"\nIl luogo atteso è: {poi.name}. Conferma se corrisponde."

    client = get_client()
    loop = asyncio.get_event_loop()

    def _call():
        return client.chat.completions.create(
            model=_vision_model(),
            max_tokens=300,
            messages=[
                {"role": "system", "content": system_msg},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                        {"type": "text", "text": user_text},
                    ],
                },
            ],
        )

    response = await loop.run_in_executor(None, _call)
    text = response.choices[0].message.content
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


async def generate_dalle_prompt(poi: POI, era: str) -> str:
    prompt = f"""Genera un prompt per la generazione di immagini che ricostruisca "{poi.name}" nell'epoca "{era}".
Il prompt deve produrre un'immagine fotorealistica, prospettiva frontale, luce naturale.
Includi dettagli storici accurati: architettura, persone, vestiti, atmosfera dell'epoca.
Rispondi SOLO con il prompt in inglese, nient'altro. Max 200 parole."""

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=1000)


async def rank_pois(
    pois: list[dict], profile: UserProfile, city: str, budget: str = "medio"
) -> list[dict]:
    # Send only ids+names to keep the prompt small and the response predictable
    slim = [{"id": p["id"], "name": p["name"], "category": p.get("category", "")} for p in pois[:40]]

    prompt = f"""OUTPUT MUST BE VALID JSON ONLY. NO PREAMBLE. NO EXPLANATION. START WITH [ AND END WITH ].

You are ranking tourist places for the city of {city} (Italy).
User profile:
- interests: {profile.interests}
- cultural level: {profile.cultural_level}
- budget: {budget}

IMPORTANT: all places listed belong to {city}. Rank them for this specific city's context.

For EACH place output a JSON object with EXACTLY these fields:
"id", "relevance_score" (0-10 float), "why_for_you" (short Italian phrase explaining why THIS place in {city} matches the user), "hidden_gem" (boolean), "estimated_cost" ("gratuito"/"€"/"€€"/"€€€"), "crowd_level" ("basso"/"medio"/"alto")

Places: {json.dumps(slim, ensure_ascii=False)}

["""

    text = await _chat_async(
        [{"role": "user", "content": prompt}],
        max_tokens=2000,
    )
    # The model may or may not include the opening [
    if not text.strip().startswith("["):
        text = "[" + text

    try:
        scores: list[dict] = _extract_json_array(text)
    except Exception:
        # Fallback: return pois as-is with default scores
        return [
            {**p, "relevance_score": 7.0, "why_for_you": "Luogo interessante", "hidden_gem": False, "estimated_cost": "gratuito", "crowd_level": "medio"}
            for p in pois[:20]
        ]

    # Merge scores back into full POI data
    score_map = {s["id"]: s for s in scores if "id" in s}
    result = []
    for p in pois:
        s = score_map.get(p["id"], {})
        result.append({
            **p,
            "relevance_score": s.get("relevance_score", 5.0),
            "why_for_you": s.get("why_for_you", ""),
            "hidden_gem": s.get("hidden_gem", False),
            "estimated_cost": s.get("estimated_cost", "gratuito"),
            "crowd_level": s.get("crowd_level", "medio"),
        })
    result.sort(key=lambda x: x["relevance_score"], reverse=True)
    return result


async def infer_profile(quiz_answers: list[dict], swipe_batch: list[dict]) -> dict:
    prompt = f"""Analizza queste risposte e preferenze per dedurre il profilo utente.

Risposte quiz onboarding: {json.dumps(quiz_answers, ensure_ascii=False)}
Swipe (liked=true/false): {json.dumps(swipe_batch, ensure_ascii=False)}

Deduci e rispondi SOLO con JSON:
{{
  "interests": ["lista", "interessi", "dedotti"],
  "cultural_level": "casual|appassionato|esperto",
  "pace": "slow|medium|fast",
  "age_range": "fascia dedotta o null"
}}"""

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=1000)
    return _extract_json_object(text)


async def generate_trip_itinerary(
    city: str,
    pois: list[dict],
    trip_profile,  # TripProfile — avoid circular import
    user_profile: UserProfile,
) -> list[dict]:
    """Generate a day-by-day itinerary from a list of liked POIs."""
    import math as _math

    poi_list = json.dumps(
        [
            {
                "id": p.get("id", ""),
                "name": p.get("name", ""),
                "category": p.get("category", "attraction"),
                "estimated_duration": p.get("estimated_duration", 45),
                "estimated_cost": p.get("estimated_cost", "gratuito"),
                "lat": p.get("lat", 0),
                "lng": p.get("lng", 0),
                "description": (p.get("description") or "")[:120],
            }
            for p in pois
        ],
        ensure_ascii=False,
    )

    prompt = f"""Sei un esperto pianificatore di viaggi italiani.
Crea un itinerario di {trip_profile.days} giorni a {city}, Italia.

Profilo viaggio:
- Giorni disponibili: {trip_profile.days}
- Budget: {trip_profile.budget}
- Gruppo: {trip_profile.group}
- Interessi: {trip_profile.interests}
- Ritmo: {trip_profile.pace}
- Stile: {trip_profile.experience_type}

POI scelti dal viaggiatore: {poi_list}

Istruzioni:
- Distribuisci logicamente i POI nei {trip_profile.days} giorni per vicinanza geografica
- Orari realistici: mattina 9:00-13:00, pomeriggio 14:00-18:00, sera 19:00+
- Indica come spostarsi tra i posti (piedi/bus/metro/taxi)
- Aggiungi suggerimenti pranzo e cena vicino ai luoghi del giorno
- Ritmo "{trip_profile.pace}": slow = max 3 posti/giorno, medium = 4-5, fast = 6+

OUTPUT: SOLO array JSON valido, {trip_profile.days} oggetti.

Ogni oggetto giorno:
{{
  "day": 1,
  "theme": "titolo descrittivo del giorno",
  "stops": [
    {{
      "poi_id": "id",
      "poi_name": "nome",
      "arrival_time": "09:00",
      "duration_min": 60,
      "transport": "piedi",
      "distance_from_prev": "500m a piedi",
      "tips": "consiglio pratico utile per visitare questo posto"
    }}
  ],
  "lunch_suggestion": "zona o tipo di posto per pranzo",
  "dinner_suggestion": "zona o tipo di posto per cena",
  "total_cost_estimate": "€/€€/€€€"
}}

["""

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=4000)
    if not text.strip().startswith("["):
        text = "[" + text

    try:
        days = _extract_json_array(text)
        # Ensure correct day numbers
        for i, d in enumerate(days):
            d["day"] = i + 1
        return days
    except Exception:
        # Fallback: simple day split
        stops_per_day = max(1, _math.ceil(len(pois) / max(trip_profile.days, 1)))
        result = []
        for d in range(trip_profile.days):
            chunk = pois[d * stops_per_day : (d + 1) * stops_per_day]
            result.append(
                {
                    "day": d + 1,
                    "theme": f"Giorno {d + 1} a {city}",
                    "stops": [
                        {
                            "poi_id": p.get("id", ""),
                            "poi_name": p.get("name", ""),
                            "arrival_time": "09:00",
                            "duration_min": p.get("estimated_duration", 45),
                            "transport": "piedi",
                            "distance_from_prev": "",
                            "tips": "",
                        }
                        for p in chunk
                    ],
                    "lunch_suggestion": "Centro città",
                    "dinner_suggestion": "Centro città",
                    "total_cost_estimate": "€€",
                }
            )
        return result


def question_hash(q: QuizQuestion) -> str:
    return hashlib.md5(q.question.encode()).hexdigest()[:12]


async def generate_city_character(city: str, date_str: str) -> dict:
    """Generate a 'character of the day' — a historical figure tied to the city."""
    prompt = f"""Sei il narratore di Play The City.

Oggi è {date_str}. Genera il PERSONAGGIO DEL GIORNO per la città di {city}, Italia.

Scegli un personaggio storico REALE e verificabile (o una figura leggendaria ben documentata) legata alla città di {city}.
NON inventare persone. Il personaggio deve essere realmente associato a {city}.

Rispondi SOLO con JSON valido:
{{
  "name": "Nome completo del personaggio",
  "period": "Secolo o periodo storico (es: 'XIV secolo', '1800-1860')",
  "role": "Ruolo o professione (es: 'Architetto', 'Condottiero', 'Pittore')",
  "avatar_emoji": "emoji che rappresenta il personaggio",
  "quote": "Una frase memorabile o attribuita a questo personaggio (in italiano, max 20 parole)",
  "story": "Una storia coinvolgente di 80-120 parole su questo personaggio e il suo legame con {city}. Scrivi in prima persona come se il personaggio parlasse oggi.",
  "poi_hint": "Nome di un luogo a {city} associato a questo personaggio"
}}"""

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=1000)
    return _extract_json_object(text)
