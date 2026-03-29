import base64
import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.config import get_settings
from app.models import NarrationRequest
from app.services.ai import get_client, _model

router = APIRouter(prefix="/api/audio", tags=["audio"])


def _narration_prompt(req: NarrationRequest) -> str:
    langs = {"it": "italiano", "en": "English", "fr": "français", "es": "español"}
    lang = langs.get(req.user_profile.language, "italiano")

    mode_instructions = {
        "on_demand": "Narrazione completa, 2-3 minuti. Apri con una SCENA evocativa ambientata nel luogo — un momento storico, un odore, un suono. Poi svela segreti, misteri, aneddoti che pochissimi conoscono. Cita un personaggio storico reale se esiste. Chiudi con una domanda che cambia il modo di guardare il luogo.",
        "proximity": "Narrazione media, 60-90 secondi. Inizia con un fatto scioccante o un segreto che nessuno conosce. Poi 2-3 dettagli essenziali. Tono da sussurro complice.",
        "radar": "Narrazione breve, 30-45 secondi. UN singolo fatto così sorprendente che ferma il passo. Nient'altro.",
    }

    return f"""Sei la voce narrante di Play The City — come un grande storyteller che conosce ogni segreto di {req.city}.

Luogo: {req.poi_name} ({req.city})
Dati: {req.wikipedia_excerpt}
Contesto aggiuntivo: {req.wikidata_facts}
Utente: interessi {req.user_profile.interests}, livello {req.user_profile.cultural_level}
Lingua: {lang}

{mode_instructions.get(req.mode, mode_instructions["on_demand"])}

Regole assolute:
- MAI iniziare con il nome del posto o con "Benvenuti"
- Parla come se stessi raccontando un segreto all'orecchio dell'utente
- Usa dettagli sensoriali: luci, odori, texture, suoni dell'epoca
- Ogni frase deve guadagnarsi il diritto di esistere — niente riempitivo"""


async def _generate_narration_text(req: NarrationRequest) -> str:
    client = get_client()
    response = client.chat.completions.create(
        model=_model(),
        max_tokens=800,
        messages=[{"role": "user", "content": _narration_prompt(req)}],
    )
    return response.choices[0].message.content


@router.post("/narrate")
async def narrate(req: NarrationRequest):
    """Generate narration text + ElevenLabs audio."""
    text = await _generate_narration_text(req)
    settings = get_settings()

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}",
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )

    if resp.status_code == 200:
        audio_b64 = base64.b64encode(resp.content).decode()
        return {"text": text, "audio_base64": audio_b64, "format": "audio/mpeg"}

    return {"text": text, "audio_base64": None, "error": "ElevenLabs non disponibile"}


@router.post("/narrate/stream")
async def narrate_stream(req: NarrationRequest):
    """Stream narration audio via ElevenLabs."""
    text = await _generate_narration_text(req)
    settings = get_settings()

    async def audio_stream():
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}/stream",
                headers={
                    "xi-api-key": settings.elevenlabs_api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                },
            ) as resp:
                async for chunk in resp.aiter_bytes(1024):
                    yield chunk

    return StreamingResponse(audio_stream(), media_type="audio/mpeg")
