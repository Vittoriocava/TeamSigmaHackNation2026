from fastapi import APIRouter
from app.models import POI
from app.services.ai import generate_dalle_prompt, get_client, _image_model
from app.db import get_db, rows_to_list

router = APIRouter(prefix="/api/ai/timeline", tags=["timeline"])

ERAS = [
    ("100 d.C.", "Ancient Rome, 100 AD"),
    ("1200", "Medieval, 1200 AD"),
    ("1800", "Early modern, 1800 AD"),
    ("1950", "Post-war, 1950"),
]


@router.get("/{poi_id}")
async def get_timeline_images(poi_id: str):
    """Get cached timeline images for a POI."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM temporal_images WHERE poi_id = ?", (poi_id,)
        ).fetchall()
    return {"poi_id": poi_id, "images": rows_to_list(rows)}


@router.post("/{poi_id}")
async def generate_timeline_images(poi_id: str, poi_name: str, poi_description: str = ""):
    """Generate timeline images for a POI across historical eras."""
    with get_db() as conn:
        cached_rows = conn.execute(
            "SELECT * FROM temporal_images WHERE poi_id = ?", (poi_id,)
        ).fetchall()

    cached = rows_to_list(cached_rows)
    if len(cached) >= len(ERAS):
        return {"poi_id": poi_id, "images": cached, "from_cache": True}

    cached_eras = {img["era_label"] for img in cached}
    poi = POI(id=poi_id, name=poi_name, lat=0, lng=0, description=poi_description)
    images = list(cached)

    for era_label, _era_desc in ERAS:
        if era_label in cached_eras:
            continue

        dalle_prompt = await generate_dalle_prompt(poi, era_label)

        try:
            response = get_client().images.generate(
                model=_image_model(),
                prompt=dalle_prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            image_url = response.data[0].url

            with get_db() as conn:
                conn.execute(
                    """INSERT INTO temporal_images (poi_id, era_label, image_url, dalle_prompt)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(poi_id, era_label) DO UPDATE SET
                         image_url = excluded.image_url,
                         dalle_prompt = excluded.dalle_prompt""",
                    (poi_id, era_label, image_url, dalle_prompt),
                )
            images.append({"poi_id": poi_id, "era_label": era_label, "image_url": image_url, "dalle_prompt": dalle_prompt})
        except Exception as e:
            images.append({
                "poi_id": poi_id,
                "era_label": era_label,
                "image_url": "",
                "dalle_prompt": dalle_prompt,
                "error": str(e),
            })

    return {"poi_id": poi_id, "images": images, "from_cache": False}
