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
    start = text.find("{")
    end = text.rfind("}") + 1
    data = json.loads(text[start:end])
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
    prompt = f"""Sei il motore di personalizzazione di Play The City.
Città: {city}
Profilo: interessi={profile.interests}, livello={profile.cultural_level}, età={profile.age_range}, budget={budget}

Ricevi una lista di POI grezzi. Per ciascuno assegna:
- relevance_score (0-10): quanto è adatto a QUESTO profilo
- why_for_you: frase breve sul perché questo posto è giusto per l'utente
- hidden_gem: true se poco noto ma di alto valore
- estimated_cost: "gratuito" / "€" / "€€" / "€€€"
- crowd_level: "basso" / "medio" / "alto"

Garantisci un mix bilanciato: non solo musei, non solo food.
Se budget basso, priorità ai posti gratuiti.

POI da valutare:
{json.dumps(pois[:40], ensure_ascii=False, indent=2)}

Rispondi SOLO con un JSON array di oggetti con i campi originali + quelli nuovi.
Ordina per relevance_score decrescente."""

    text = await _chat_async([{"role": "user", "content": prompt}], max_tokens=4000)
    start = text.find("[")
    end = text.rfind("]") + 1
    return json.loads(text[start:end])


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
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


def question_hash(q: QuizQuestion) -> str:
    return hashlib.md5(q.question.encode()).hexdigest()[:12]
