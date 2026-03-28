import json
from fastapi import APIRouter
from pydantic import BaseModel
from app.models import POI
from app.services.ai import analyze_photo, generate_dalle_prompt, get_client, _vision_model
from app.db import get_db, row_to_dict

router = APIRouter(prefix="/api/ai/vision", tags=["vision"])


class IdentifyRequest(BaseModel):
    image_base64: str
    poi_id: str | None = None
    poi_name: str | None = None


class ComeEraRequest(BaseModel):
    image_base64: str
    poi_id: str
    poi_name: str
    era: str = "100 d.C."


class SouvenirRequest(BaseModel):
    image_base64: str
    poi_id: str
    poi_name: str


@router.post("/identify")
async def identify_place(req: IdentifyRequest):
    """Identify a place/monument from a photo using Claude Vision."""
    poi = None
    if req.poi_id:
        poi = POI(id=req.poi_id, name=req.poi_name or "", lat=0, lng=0)
    return await analyze_photo(req.image_base64, poi)


@router.post("/come-era")
async def come_era(req: ComeEraRequest):
    """'Come era' — retrieve historical overlay for a POI photo."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM temporal_images WHERE poi_id = ? AND era_label = ?",
            (req.poi_id, req.era),
        ).fetchone()

    if row:
        historical_image = row_to_dict(row)
    else:
        poi = POI(id=req.poi_id, name=req.poi_name, lat=0, lng=0)
        dalle_prompt = await generate_dalle_prompt(poi, req.era)
        historical_image = {
            "poi_id": req.poi_id,
            "era_label": req.era,
            "dalle_prompt": dalle_prompt,
            "image_url": "",
        }

    poi = POI(id=req.poi_id, name=req.poi_name, lat=0, lng=0)
    analysis = await analyze_photo(req.image_base64, poi)

    return {
        "analysis": analysis,
        "historical_image": historical_image,
        "overlay_hints": {
            "perspective": analysis.get("perspective", "frontale"),
            "blend_mode": "dissolve",
        },
    }


@router.post("/souvenir")
async def souvenir(req: SouvenirRequest):
    """'Foto col Monumento' — generate historical souvenir composite."""
    client = get_client()
    response = client.chat.completions.create(
        model=_vision_model(),
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{req.image_base64}"},
                    },
                    {
                        "type": "text",
                        "text": f"""Analizza questa foto scattata davanti a {req.poi_name}.
Identifica:
1. La posizione del soggetto umano (sinistra/centro/destra, percentuale dell'immagine)
2. La posizione del monumento
3. La prospettiva

Poi genera un prompt per ricreare lo sfondo storico di {req.poi_name} nell'antichità,
mantenendo la stessa prospettiva e lasciando spazio per il soggetto umano.

Rispondi con JSON:
{{
  "subject_position": "left|center|right",
  "subject_size_pct": 30,
  "monument_visible": true,
  "perspective": "frontale|laterale",
  "dalle_prompt": "prompt per sfondo storico..."
}}""",
                    },
                ],
            }
        ],
    )

    text = response.choices[0].message.content
    start = text.find("{")
    end = text.rfind("}") + 1
    result = json.loads(text[start:end])

    return {
        "analysis": result,
        "dalle_prompt": result.get("dalle_prompt", ""),
        "compositing_hints": {
            "subject_position": result.get("subject_position", "center"),
            "subject_size_pct": result.get("subject_size_pct", 30),
        },
    }
