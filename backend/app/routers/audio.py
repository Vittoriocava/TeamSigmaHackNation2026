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
        "on_demand": "Narrazione completa, 2-3 minuti. Usa i dati forniti ma ESPANDILI con FUN FACTS, aneddoti curiosi, segreti, misteri e cose che pochissime persone sanno di questo luogo. Non fare una noiosa lezione di storia.",
        "proximity": "Narrazione media, 60-90 secondi. Svela subito un segreto o un fun fact sorprendente per catturare l'attenzione, poi dai qualche dettaglio chiave.",
        "radar": "Narrazione breve, 30-45 secondi. Un solo fatto scioccante o curiosità imperdibile per fermare l'utente incuriosendolo.",
    }

    return f"""Sei l'esclusiva e brillante guida vocale di Play The City a {req.city}.
Luogo: {req.poi_name}
Dati base: {req.wikipedia_excerpt}
Fatti noti: {req.wikidata_facts}
Profilo: interessi {req.user_profile.interests}, livello {req.user_profile.cultural_level}
Lingua: {lang}
Modalità: {req.mode}

{mode_instructions.get(req.mode, mode_instructions["on_demand"])}

Parla in prima persona come se fossi il luogo stesso oppure un narratore che conosce l'utente.
Non iniziare MAI con il nome del posto. Sii coinvolgente, evocativo, mai scolastico."""


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
