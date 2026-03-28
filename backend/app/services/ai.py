import asyncio
import json
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


def _chat(messages: list, max_tokens: int = 500) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model=_model(),
        max_tokens=max_tokens,
        messages=messages,
    )
    return response.choices[0].message.content


async def _chat_async(messages: list, max_tokens: int = 500) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: _chat(messages, max_tokens))


def _extract_json_object(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response: {text[:200]}")
    return json.loads(text[start:end])


def _extract_json_array(text: str) -> list:
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON array found in response: {text[:200]}")
    return json.loads(text[start:end])


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

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=500)
    data = _extract_json_object(text)
    data["poi_id"] = poi.id
    data["difficulty"] = difficulty
    return QuizQuestion(**data)


async def generate_story(poi: POI, profile: UserProfile, city: str) -> str:
    prompt = f"""Sei il narratore di Play The City. Genera una micro-storia coinvolgente per:
Luogo: {poi.name} a {city}
Descrizione: {poi.description}

Profilo giocatore: interessi {profile.interests}, livello {profile.cultural_level}
Lingua: {_lang(profile)}

Regole:
- 150-250 parole
- Non iniziare MAI con il nome del luogo
- Racconta come se il luogo avesse una voce propria
- Includi un fatto sorprendente poco noto
- Chiudi con una connessione emotiva o una domanda retorica"""

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=600)


async def generate_curiosity(poi: POI, profile: UserProfile) -> str:
    prompt = f"""Genera una curiosità nascosta e sorprendente su "{poi.name}".
Qualcosa che il 95% dei visitatori non sa.
Descrizione: {poi.description}
Lingua: {_lang(profile)}
Livello: {profile.cultural_level}

Max 80 parole. Tono: "lo sapevi che...?" coinvolgente."""

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=200)


async def generate_connection(poi1: POI, poi2: POI, profile: UserProfile) -> str:
    prompt = f"""Trova e racconta una connessione nascosta tra questi due luoghi:
1. {poi1.name}: {poi1.description}
2. {poi2.name}: {poi2.description}

La connessione può essere storica, artistica, leggendaria o urbana.
Lingua: {_lang(profile)}
Max 100 parole. Tono narrativo, come se stessi svelando un segreto."""

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=250)


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

    return await _chat_async([{"role": "user", "content": prompt}], max_tokens=300)


async def rank_pois(
    pois: list[dict], profile: UserProfile, city: str, budget: str = "medio"
) -> list[dict]:
    # Send only ids+names to keep the prompt small and the response predictable
    slim = [{"id": p["id"], "name": p["name"], "category": p.get("category", "")} for p in pois[:40]]

    prompt = f"""OUTPUT MUST BE VALID JSON ONLY. NO PREAMBLE. NO EXPLANATION. START WITH [ AND END WITH ].

Rank these {len(slim)} places in {city} for a user with:
- interests: {profile.interests}
- cultural level: {profile.cultural_level}
- budget: {budget}

For each place output a JSON object with EXACTLY these fields:
"id", "relevance_score" (0-10 float), "why_for_you" (short Italian phrase), "hidden_gem" (boolean), "estimated_cost" ("gratuito"/"€"/"€€"/"€€€"), "crowd_level" ("basso"/"medio"/"alto")

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

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=300)
    return _extract_json_object(text)


def question_hash(q: QuizQuestion) -> str:
    return hashlib.md5(q.question.encode()).hexdigest()[:12]
