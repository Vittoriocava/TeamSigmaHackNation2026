from fastapi import APIRouter, HTTPException
from openai import OpenAI
from config import get_settings
from models import POI, TimelineImage
from ai_engine import generate_dalle_prompt
from supabase_client import supabase

router = APIRouter(prefix="/api/ai/timeline", tags=["timeline"])

ERAS = [
    ("100 d.C.", "Ancient Rome, 100 AD"),
    ("1200", "Medieval, 1200 AD"),
    ("1800", "Early modern, 1800 AD"),
    ("1950", "Post-war, 1950"),
]


def _get_openai() -> OpenAI:
    return OpenAI(api_key=get_settings().openai_api_key)


@router.get("/{poi_id}")
async def get_timeline_images(poi_id: str):
    """Get cached timeline images for a POI."""
    result = supabase.table("temporal_images").select("*").eq("poi_id", poi_id).execute()
    return {"poi_id": poi_id, "images": result.data}


@router.post("/{poi_id}")
async def generate_timeline_images(poi_id: str, poi_name: str, poi_description: str = ""):
    """Generate timeline images for a POI across historical eras."""
    # Check cache first
    cached = supabase.table("temporal_images").select("*").eq("poi_id", poi_id).execute()
    if cached.data and len(cached.data) >= len(ERAS):
        return {"poi_id": poi_id, "images": cached.data, "from_cache": True}

    cached_eras = {img["era_label"] for img in (cached.data or [])}
    poi = POI(id=poi_id, name=poi_name, lat=0, lng=0, description=poi_description)
    client = _get_openai()
    images = list(cached.data or [])

    for era_label, era_desc in ERAS:
        if era_label in cached_eras:
            continue

        # Claude generates the prompt, DALL-E generates the image
        dalle_prompt = await generate_dalle_prompt(poi, era_label)

        try:
            response = client.images.generate(
                model="dall-e-3",
                prompt=dalle_prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            image_url = response.data[0].url

            # Cache in Supabase
            record = {
                "poi_id": poi_id,
                "era_label": era_label,
                "image_url": image_url,
                "dalle_prompt": dalle_prompt,
            }
            supabase.table("temporal_images").upsert(record, on_conflict="poi_id,era_label").execute()
            images.append(record)
        except Exception as e:
            # Continue with other eras if one fails
            images.append({
                "poi_id": poi_id,
                "era_label": era_label,
                "image_url": "",
                "dalle_prompt": dalle_prompt,
                "error": str(e),
            })

    return {"poi_id": poi_id, "images": images, "from_cache": False}
