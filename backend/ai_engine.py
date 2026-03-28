import json
import hashlib
from anthropic import Anthropic
from config import get_settings
from models import POI, UserProfile, QuizQuestion

_client = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=get_settings().claude_api_key)
    return _client


MODEL = "claude-sonnet-4-20250514"


def _lang(profile: UserProfile) -> str:
    langs = {"it": "italiano", "en": "English", "fr": "français", "es": "español"}
    return langs.get(profile.language, "italiano")


async def generate_quiz(
    poi: POI,
    profile: UserProfile,
    difficulty: str = "medium",
    previous_questions: list[str] | None = None,
) -> QuizQuestion:
    """Generate a contextual quiz question about a POI."""
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

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    # Extract JSON from response
    start = text.find("{")
    end = text.rfind("}") + 1
    data = json.loads(text[start:end])
    data["poi_id"] = poi.id
    data["difficulty"] = difficulty
    return QuizQuestion(**data)


async def generate_story(poi: POI, profile: UserProfile, city: str) -> str:
    """Generate a micro-story narrative for a POI."""
    prompt = f"""Sei il narratore di Play The City. Genera una micro-storia coinvolgente per:
Luogo: {poi.name} a {city}
Descrizione: {poi.description}
Wikipedia: {poi.wikipedia_url}

Profilo giocatore: interessi {profile.interests}, livello {profile.cultural_level}
Lingua: {_lang(profile)}

Regole:
- 150-250 parole
- Non iniziare MAI con il nome del luogo
- Racconta come se il luogo avesse una voce propria
- Includi un fatto sorprendente poco noto
- Chiudi con una connessione emotiva o una domanda retorica"""

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


async def generate_curiosity(poi: POI, profile: UserProfile) -> str:
    """Generate a hidden curiosity about a POI."""
    prompt = f"""Genera una curiosità nascosta e sorprendente su "{poi.name}".
Qualcosa che il 95% dei visitatori non sa.
Descrizione: {poi.description}
Lingua: {_lang(profile)}
Livello: {profile.cultural_level}

Max 80 parole. Tono: "lo sapevi che...?" coinvolgente."""

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


async def generate_connection(poi1: POI, poi2: POI, profile: UserProfile) -> str:
    """Generate a narrative connection between two POIs."""
    prompt = f"""Trova e racconta una connessione nascosta tra questi due luoghi:
1. {poi1.name}: {poi1.description}
2. {poi2.name}: {poi2.description}

La connessione può essere storica, artistica, leggendaria o urbana.
Lingua: {_lang(profile)}
Max 100 parole. Tono narrativo, come se stessi svelando un segreto."""

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=250,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


async def analyze_photo(image_base64: str, poi: POI | None = None) -> dict:
    """Claude Vision analyzes a photo for AR/challenge verification."""
    system = "Sei l'agente visivo di Play The City. Analizza foto di luoghi e monumenti."
    prompt = "Identifica il luogo in questa foto. Rispondi con JSON: {\"identified\": true/false, \"place_name\": \"...\", \"confidence\": 0.0-1.0, \"description\": \"breve descrizione di cosa vedi\", \"perspective\": \"frontale/laterale/aerea/altro\"}"
    if poi:
        prompt += f"\nIl luogo atteso è: {poi.name}. Conferma se corrisponde."

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        system=system,
    )
    text = response.content[0].text
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


async def generate_dalle_prompt(poi: POI, era: str) -> str:
    """Generate a DALL-E prompt for historical reconstruction of a POI."""
    prompt = f"""Genera un prompt per DALL-E 3 che ricostruisca "{poi.name}" nell'epoca "{era}".
Il prompt deve produrre un'immagine fotorealistica, prospettiva frontale, luce naturale.
Includi dettagli storici accurati: architettura, persone, vestiti, atmosfera dell'epoca.
Rispondi SOLO con il prompt in inglese, nient'altro. Max 200 parole."""

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


async def rank_pois(
    pois: list[dict], profile: UserProfile, city: str, budget: str = "medio"
) -> list[dict]:
    """Claude ranks and enriches a list of raw POIs based on user profile."""
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

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    start = text.find("[")
    end = text.rfind("]") + 1
    return json.loads(text[start:end])


async def infer_profile(quiz_answers: list[dict], swipe_batch: list[dict]) -> dict:
    """Infer user profile from quiz answers and swipe history."""
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

    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    start = text.find("{")
    end = text.rfind("}") + 1
    return json.loads(text[start:end])


def question_hash(q: QuizQuestion) -> str:
    return hashlib.md5(q.question.encode()).hexdigest()[:12]
