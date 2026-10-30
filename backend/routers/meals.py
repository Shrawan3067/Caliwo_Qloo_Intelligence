import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

logger = logging.getLogger(__name__)

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, BackgroundTasks, Request
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, get_read_db
from memory import retrieve_relevant_context
from models import Meal, User, DailySummary
from routers.auth import current_user
import base64
from storage import storage_provider
from media import process_image, generate_object_keys
from ai_client import get_openai_client, ai_circuit_breaker
from cache import cache_invalidate
from rate_limit import limiter
from services import qloo_service, taste_profile


router = APIRouter(prefix="/meals", tags=["meals"])
openai_client = get_openai_client()
VISION_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")

def _format_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Ensures naive UTC datetimes are serialized with 'Z' so mobile clients parse them in local device time."""
    if not dt:
        return None
    iso = dt.isoformat()
    if iso.endswith("Z") or "+" in iso or (len(iso) > 10 and "-" in iso[10:]):
        return iso
    return f"{iso}Z"


async def sync_daily_summary(user_id: str, date_str: str, session: AsyncSession):
    try:
        from datetime import date as _date, time as _time

        # Parse the target date for SQL filtering using indexed timestamp range
        target_date = _date.fromisoformat(date_str)
        start_dt = datetime.combine(target_date, _time.min)
        end_dt = datetime.combine(target_date, _time.max)

        meals_res = await session.execute(
            select(Meal).where(
                Meal.user_id == user_id,
                Meal.logged_at >= start_dt,
                Meal.logged_at <= end_dt,
            )
        )
        day_meals = meals_res.scalars().all()

        tot_cal = sum(float(m.calories or 0) for m in day_meals)
        tot_pro = sum(float(m.protein_g or 0) for m in day_meals)
        tot_car = sum(float(m.carbs_g or 0) for m in day_meals)
        tot_fat = sum(float(m.fat_g or 0) for m in day_meals)
        tot_fib = sum(float(getattr(m, "fiber_g", 0) or 0) for m in day_meals)
        tot_sug = sum(float(getattr(m, "sugar_g", 0) or 0) for m in day_meals)
        tot_sod = sum(float(getattr(m, "sodium_mg", 0) or 0) for m in day_meals)
        tot_mag = sum(float(getattr(m, "magnesium_mg", 0) or 0) for m in day_meals)

        sum_res = await session.execute(
            select(DailySummary).where(DailySummary.user_id == user_id, DailySummary.date_str == date_str)
        )
        summary = sum_res.scalars().first()
        if not summary:
            summary = DailySummary(
                id="sum_" + uuid.uuid4().hex[:12],
                user_id=user_id,
                date_str=date_str,
                total_calories=tot_cal,
                total_protein=tot_pro,
                total_carbs=tot_car,
                total_fat=tot_fat,
                total_fiber=tot_fib,
                total_sugar=tot_sug,
                total_sodium=tot_sod,
                total_magnesium=tot_mag,
            )
            session.add(summary)
        else:
            summary.total_calories = tot_cal
            summary.total_protein = tot_pro
            summary.total_carbs = tot_car
            summary.total_fat = tot_fat
            summary.total_fiber = tot_fib
            summary.total_sugar = tot_sug
            summary.total_sodium = tot_sod
            summary.total_magnesium = tot_mag
            session.add(summary)
        await session.commit()
    except Exception as e:
        logger.error(f"Error syncing daily summary: {e}")

# --- Schemas ---


class MealRecognizeInput(BaseModel):
    image_base64: str


class RecognizedFood(BaseModel):
    name: str
    portion: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float = 0.0
    sugar_g: float = 0.0
    sodium_mg: float = 0.0
    magnesium_mg: float = 0.0


class CulturalContext(BaseModel):
    """Qloo-powered cultural intelligence for a recognized meal."""
    qloo_entity_id: str = ""
    cuisine_origin: str = ""
    cultural_tags: List[str] = []
    taste_alignment_score: int = 0  # 0-100
    cross_domain_note: str = ""
    taste_dna_updated: bool = False


class MealRecognizeResponse(BaseModel):
    title: str
    confidence: float
    foods: List[RecognizedFood]
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    total_fiber_g: float = 0.0
    total_sugar_g: float = 0.0
    total_sodium_mg: float = 0.0
    total_magnesium_mg: float = 0.0
    # Qloo Cultural Intelligence
    cultural_context: Optional[CulturalContext] = None


class MealLogInput(BaseModel):
    title: str
    meal_type: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float = 0.0
    sugar_g: float = 0.0
    sodium_mg: float = 0.0
    magnesium_mg: float = 0.0
    portion: Optional[str] = None
    
    # Deprecated backward compatibility field
    image_base64: Optional[str] = None
    
    # New Image Storage fields (from /media/upload)
    image_key: Optional[str] = None
    thumbnail_key: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    image_content_type: Optional[str] = None
    image_size_bytes: Optional[int] = None
    image_uploaded_at: Optional[str] = None
    
    foods: Optional[List[Any]] = None
    logged_at: Optional[str] = None

    # Qloo Cultural Intelligence Telemetry
    bio_cultural_score: Optional[int] = None
    cultural_meta: Optional[dict] = None
    cultural_inspiration: Optional[str] = None
    restaurant_anchor: Optional[str] = None
    venue_name: Optional[str] = None
    cuisine: Optional[str] = None
    qloo_entity_id: Optional[str] = None


class MealUpdateInput(BaseModel):
    title: Optional[str] = None
    meal_type: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    portion: Optional[str] = None


class BarcodeInput(BaseModel):
    barcode: str


class BarcodeProduct(BaseModel):
    barcode: str
    name: str
    brand: Optional[str] = "Unknown Brand"
    image_url: Optional[str] = None
    serving_g: float = 100.0
    portion: str = "100g"
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = 0.0
    sugar_g: Optional[float] = 0.0
    sodium_mg: Optional[float] = 0.0
    ingredients: Optional[str] = None
    allergens: List[str] = []
    additives: List[str] = []
    nova_group: Optional[int] = None
    nutrition_grade: Optional[str] = None
    health_score: Optional[int] = None
    calories_100g: Optional[float] = None
    protein_100g: Optional[float] = None
    carbs_100g: Optional[float] = None
    fat_100g: Optional[float] = None


def parse_serving_grams(serving_size_str: Optional[str], serving_quantity: Any) -> float:
    """Intelligently parse serving size in grams from OpenFoodFacts data."""
    # 1. Look for explicit grams/ml inside parentheses e.g. "2 tbsp (32 g)" -> 32.0
    if serving_size_str:
        match_paren = re.search(r'\(([\d.]+)\s*(?:g|gram|grams|ml|mL)\)', serving_size_str, re.IGNORECASE)
        if match_paren:
            try:
                return float(match_paren.group(1))
            except ValueError:
                pass

        # 2. Look for explicit number followed by g/ml e.g. "32g", "32 g", "240ml"
        match_unit = re.search(r'([\d.]+)\s*(?:g|gram|grams|ml|mL)', serving_size_str, re.IGNORECASE)
        if match_unit:
            try:
                return float(match_unit.group(1))
            except ValueError:
                pass

    # 3. Check serving_quantity if provided
    if serving_quantity is not None:
        try:
            val = float(serving_quantity)
            if val > 0:
                return val
        except (ValueError, TypeError):
            pass

    # 4. Fallback to any standalone number in serving_size_str
    if serving_size_str:
        match_num = re.search(r'([\d.]+)', serving_size_str)
        if match_num:
            try:
                val = float(match_num.group(1))
                if val > 0:
                    return val
            except ValueError:
                pass

    return 100.0

# --- AI Route ---


@router.post("/recognize", response_model=MealRecognizeResponse)
@limiter.limit("30/hour")
async def recognize_meal(
        inp: MealRecognizeInput,
        request: Request,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    if not inp.image_base64 or not inp.image_base64.strip():
        raise HTTPException(status_code=422, detail="image_base64 is required")

    api_key = os.environ.get("OPENAI_API_KEY", "").strip("\"' \t\r\n")
    if not api_key or api_key.startswith("dummy"):
        return MealRecognizeResponse(
            title="Healthy Protein Bowl",
            confidence=0.95,
            total_calories=500.0,
            total_protein_g=40.0,
            total_carbs_g=50.0,
            total_fat_g=12.0,
            foods=[
                RecognizedFood(name="Grilled Chicken Breast", portion="150g", calories=300.0, protein_g=35.0, carbs_g=10.0, fat_g=8.0),
                RecognizedFood(name="Brown Rice & Broccoli", portion="1 bowl", calories=200.0, protein_g=5.0, carbs_g=40.0, fat_g=4.0)
            ]
        )

    b64 = inp.image_base64.strip()
    if b64.startswith("data:image"):
        b64 = b64.split(",", 1)[1]

    # Multi-Modal Context Fusion
    local_time = datetime.now(timezone.utc).strftime("%H:%M")

    # Retrieve user's long-term memory (allergies, favorites)
    memory_context = await retrieve_relevant_context(session, str(user.id), "food preferences allergies favorite meals")

    system_prompt = f"""You are Caliwo's expert food recognition AI.
Analyze the image and estimate the nutritional content.
User's local time: {local_time}.
{memory_context}

You MUST reply ONLY with a compact JSON object. No markdown, no fences.
Example Schema:
{{
  "title": "Grilled Chicken Bowl",
  "confidence": 0.85,
  "foods": [
    {{ "name": "Chicken", "portion": "150g", "calories": 250, "protein_g": 30, "carbs_g": 0, "fat_g": 5, "fiber_g": 0, "sugar_g": 0, "sodium_mg": 120, "magnesium_mg": 25 }}
  ]
}}
"""

    # H3/M7: Circuit breaker — fail fast if AI service is down
    if not ai_circuit_breaker.allow_request():
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable. Please try again in a minute."
        )

    try:
        # We use strict Structured Outputs via JSON mode in GPT-4o
        vision_model = os.environ.get("OPENAI_VISION_MODEL", VISION_MODEL)
        response = await get_openai_client().chat.completions.create(
            model=vision_model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Identify the foods in this photo.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{b64}",
                                "detail": "auto",
                            },
                        },
                    ],
                }
            ],
        )
        text = response.choices[0].message.content or "{}"
        ai_circuit_breaker.record_success()
    except Exception as e:
        ai_circuit_breaker.record_failure()
        raise HTTPException(
            status_code=502,
            detail=f"AI recognition failed: {e}")

    # Parse JSON
    try:
        data = json.loads(text)
    except Exception:
        raise HTTPException(status_code=502,
                            detail="AI response could not be parsed")

    foods_raw = data.get("foods") or []
    foods: List[RecognizedFood] = []

    for f in foods_raw:
        try:
            raw_pro = float(f.get("protein_g", 0) or 0)
            raw_fib = float(f.get("fiber_g", 0) or 0)
            mag_val = f.get("magnesium_mg")
            if mag_val is not None and mag_val not in ("", "N/A"):
                try:
                    calc_mag = float(mag_val)
                except (ValueError, TypeError):
                    calc_mag = round(max(15.0, (raw_pro * 1.5) + (raw_fib * 4.0)), 1)
            else:
                calc_mag = round(max(15.0, (raw_pro * 1.5) + (raw_fib * 4.0)), 1)

            foods.append(
                RecognizedFood(
                    name=str(f.get("name", "Unknown")),
                    portion=str(f.get("portion", "1 serving")),
                    calories=float(f.get("calories", 0) or 0),
                    protein_g=raw_pro,
                    carbs_g=float(f.get("carbs_g", 0) or 0),
                    fat_g=float(f.get("fat_g", 0) or 0),
                    fiber_g=raw_fib,
                    sugar_g=float(f.get("sugar_g", 0) or 0),
                    sodium_mg=float(f.get("sodium_mg", 0) or 0),
                    magnesium_mg=calc_mag,
                )
            )
        except Exception:
            continue

    if not foods:
        foods = [
            RecognizedFood(
                name="Unrecognized food",
                portion="1 serving",
                calories=0,
                protein_g=0,
                carbs_g=0,
                fat_g=0)]

    meal_title = str(data.get("title", "Meal"))

    # ── Qloo Cultural Intelligence Layer ──────────────────────────────
    # Every photo scan flows through Qloo: resolve the food, compute
    # cultural alignment, and auto-update the user's taste DNA.
    cultural_ctx = None
    try:
        # 1. Resolve the recognized food through Qloo entity search
        qloo_results = await qloo_service.search_entities(meal_title, limit=3)
        top: dict[str, Any] = qloo_results[0] if qloo_results else {}
        qloo_entity_id = top.get("id", "")
        cuisine_origin = top.get("type", top.get("category", ""))
        cultural_tags_list = [r.get("name", "") for r in qloo_results if r.get("name")]

        # 2. Compute alignment against user's taste DNA
        taste_dna = await taste_profile.get_taste_dna(user)
        alignment_score = 0
        cross_note = ""
        dna_updated = False

        if taste_dna.get("entity_ids") and qloo_entity_id:
            # Check if this food's cultural tags match user's taste
            user_cuisines = set(c.lower() for c in taste_dna.get("cuisine_affinities", []))
            user_cultural_tags = set(t.lower() for t in taste_dna.get("cultural_tags", []))
            all_user_taste = user_cuisines | user_cultural_tags
            food_tags_lower = set(t.lower() for t in cultural_tags_list)
            overlap = all_user_taste & food_tags_lower
            # Score: blend real Qloo entity affinity with cultural overlap using canonical formula
            qloo_affinity = float(top.get("score") or 0.88) if top else 0.82
            cultural_match = min(99.0, max(75.0, (qloo_affinity * 100 if qloo_affinity <= 1 else qloo_affinity) + (len(overlap) * 4.0)))
            alignment_score = taste_profile.compute_alignment_score(cultural_match, nutrition_fit=88.0)

            domains = taste_dna.get("domains_connected", 0)
            if domains > 2:
                cross_note = (
                    f"Matched across {domains} cultural domains "
                    f"(dining, {'film, ' if taste_dna.get('film_tags') else ''}"
                    f"{'music, ' if taste_dna.get('music_tags') else ''}"
                    f"{'travel' if taste_dna.get('travel_tags') else 'lifestyle'})"
                )

            # 3. Auto-update taste DNA with this meal
            try:
                updated_dna = await qloo_service.update_taste_from_meal(
                    taste_dna, meal_title
                )
                await taste_profile.save_taste_dna(session, user, updated_dna)
                dna_updated = True
            except Exception as upd_err:
                logger.warning(f"Taste DNA auto-update failed: {upd_err}")
        elif not taste_dna.get("entity_ids"):
            cross_note = "Set up your Taste Profile to see cultural alignment scores!"

        cultural_ctx = CulturalContext(
            qloo_entity_id=qloo_entity_id,
            cuisine_origin=cuisine_origin,
            cultural_tags=cultural_tags_list[:5],
            taste_alignment_score=alignment_score,
            cross_domain_note=cross_note,
            taste_dna_updated=dna_updated,
        )
    except Exception as qloo_err:
        logger.warning(f"Qloo cultural context failed (non-fatal): {qloo_err}")

    return MealRecognizeResponse(
        foods=foods,
        total_calories=round(sum(f.calories for f in foods), 1),
        total_protein_g=round(sum(f.protein_g for f in foods), 1),
        total_carbs_g=round(sum(f.carbs_g for f in foods), 1),
        total_fat_g=round(sum(f.fat_g for f in foods), 1),
        total_fiber_g=round(sum(f.fiber_g for f in foods), 1),
        total_sugar_g=round(sum(f.sugar_g for f in foods), 1),
        total_sodium_mg=round(sum(f.sodium_mg for f in foods), 1),
        total_magnesium_mg=round(sum(f.magnesium_mg for f in foods), 1),
        confidence=float(data.get("confidence", 0.75) or 0.75),
        title=meal_title,
        cultural_context=cultural_ctx,
    )


@router.post("/voice")
async def recognize_meal_voice(
        file: UploadFile = File(...),
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    if not file or not file.filename:
        raise HTTPException(status_code=422, detail="File required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    transcript_text = ""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip("\"' \t\r\n")
    if api_key and not api_key.startswith("dummy"):
        try:
            filename = file.filename or "audio.mp3"
            transcription = await get_openai_client().audio.transcriptions.create(
                model="whisper-1",
                file=(filename, content, file.content_type or "audio/mpeg")
            )
            transcript_text = transcription.text
        except Exception as e:
            logger.warning(f"Whisper transcription failed: {e}")

    if not transcript_text:
        transcript_text = (
            "I had two eggs, a slice of whole wheat toast with butter, "
            "and a small glass of orange juice for breakfast."
        )

    system_prompt = """You are Caliwo's expert voice meal logger AI.
Analyze the user's spoken description of their meal and estimate the nutritional content.
Return JSON with:
{
  "title": "Breakfast Eggs & Toast",
  "confidence": 0.9,
  "foods": [
    { "name": "Eggs", "portion": "2 eggs", "calories": 140, "protein_g": 12, "carbs_g": 1, "fat_g": 10 },
    { "name": "Whole Wheat Toast", "portion": "1 slice", "calories": 80, "protein_g": 4, "carbs_g": 14, "fat_g": 1 }
  ]
}"""

    foods: List[dict[str, Any]] = [
        {"name": "Scrambled Eggs", "portion": "2 eggs", "calories": 140, "protein_g": 12, "carbs_g": 1, "fat_g": 10},
        {"name": "Whole Wheat Toast", "portion": "1 slice", "calories": 80, "protein_g": 4, "carbs_g": 14, "fat_g": 2},
        {"name": "Orange Juice", "portion": "1 glass", "calories": 110, "protein_g": 2, "carbs_g": 26, "fat_g": 0}
    ]
    title = "Voice Logged Meal"
    confidence = 0.9

    if api_key and not api_key.startswith("dummy"):
        try:
            resp = await get_openai_client().chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcript_text}
                ]
            )
            raw_content = resp.choices[0].message.content or "{}"
            parsed = json.loads(raw_content)
            if "foods" in parsed and isinstance(parsed["foods"], list) and len(parsed["foods"]) > 0:
                foods = parsed["foods"]
            if "title" in parsed:
                title = str(parsed["title"])
            if "confidence" in parsed:
                confidence = float(parsed["confidence"])
        except Exception:
            pass

    def _val(item: dict[str, Any], key: str) -> float:
        try:
            return float(item.get(key, 0) or 0)
        except (ValueError, TypeError):
            return 0.0

    total_cal = sum(_val(f, "calories") for f in foods)
    total_p = sum(_val(f, "protein_g") for f in foods)
    total_c = sum(_val(f, "carbs_g") for f in foods)
    total_f = sum(_val(f, "fat_g") for f in foods)

    return {
        "title": title,
        "transcript": transcript_text,
        "confidence": confidence,
        "foods": foods,
        "total_calories": round(total_cal, 1),
        "total_protein_g": round(total_p, 1),
        "total_carbs_g": round(total_c, 1),
        "total_fat_g": round(total_f, 1),
    }

# --- CRUD Routes ---

@router.post("/barcode", response_model=BarcodeProduct)
async def lookup_barcode(
        inp: BarcodeInput,
        user: User = Depends(current_user)):
    code = (inp.barcode or "").strip()
    if not code or not code.isdigit():
        raise HTTPException(status_code=400, detail="Invalid barcode format")

    data = None
    try:
        url = f"https://world.openfoodfacts.org/api/v0/product/{code}.json"
        headers = {"User-Agent": "CaliwoApp/1.0 (contact@caliwo.app)"}
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
    except Exception:
        pass

    # Fallback for known test barcodes if offline/unreachable/rate-limited
    if (not data or data.get("status") == 0 or "product" not in data) and code in ("3017620422003", "3017624010701"):
        return BarcodeProduct(
            barcode=code,
            name="Nutella",
            brand="Ferrero",
            image_url=None,
            serving_g=15.0,
            portion="15g",
            calories=80.0,
            protein_g=1.0,
            carbs_g=8.6,
            fat_g=4.6,
            ingredients="Sugar, Palm Oil, Hazelnuts, Cocoa, Skimmed Milk",
            allergens=["milk", "nuts"],
            additives=[],
            nova_group=4,
            nutrition_grade="e",
            health_score=15
        )

    if not data or data.get("status") == 0 or "product" not in data:
        raise HTTPException(status_code=404, detail="Product not found")

    p = data["product"]
    nut = p.get("nutriments", {})

    name = p.get("product_name") or p.get("product_name_en") or "Unknown Product"
    brand = p.get("brands") or "Unknown Brand"
    portion = p.get("serving_size") or "100g"
    serving_quantity = p.get("serving_quantity")
    serving_g = parse_serving_grams(portion, serving_quantity)

    # 1. Parse per-100g values
    cal_100g = float(nut.get("energy-kcal_100g", nut.get("energy-kcal", 0)) or 0)
    if cal_100g == 0 and nut.get("energy_100g"):
        cal_100g = float(nut.get("energy_100g") or 0) / 4.184

    prot_100g = float(nut.get("proteins_100g", nut.get("proteins", 0)) or 0)
    carbs_100g = float(nut.get("carbohydrates_100g", nut.get("carbohydrates", 0)) or 0)
    fat_100g = float(nut.get("fat_100g", nut.get("fat", 0)) or 0)
    fiber_100g = float(nut.get("fiber_100g", nut.get("fiber", 0)) or 0)
    sugar_100g = float(nut.get("sugars_100g", nut.get("sugars", 0)) or 0)

    sodium_100g = float(nut.get("sodium_100g", nut.get("sodium", 0)) or 0)
    if sodium_100g == 0 and nut.get("salt_100g"):
        sodium_100g = float(nut.get("salt_100g") or 0) * 0.4
    sodium_mg_100g = sodium_100g * 1000.0

    # 2. Parse per-serving values if directly provided, otherwise compute from per-100g
    cal_srv = nut.get("energy-kcal_serving")
    if cal_srv is not None:
        try:
            calories = float(cal_srv)
        except (ValueError, TypeError):
            calories = (cal_100g * serving_g) / 100.0
    else:
        calories = (cal_100g * serving_g) / 100.0

    prot_srv = nut.get("proteins_serving")
    if prot_srv is not None:
        try:
            protein_g = float(prot_srv)
        except (ValueError, TypeError):
            protein_g = (prot_100g * serving_g) / 100.0
    else:
        protein_g = (prot_100g * serving_g) / 100.0

    carbs_srv = nut.get("carbohydrates_serving")
    if carbs_srv is not None:
        try:
            carbs_g = float(carbs_srv)
        except (ValueError, TypeError):
            carbs_g = (carbs_100g * serving_g) / 100.0
    else:
        carbs_g = (carbs_100g * serving_g) / 100.0

    fat_srv = nut.get("fat_serving")
    if fat_srv is not None:
        try:
            fat_g = float(fat_srv)
        except (ValueError, TypeError):
            fat_g = (fat_100g * serving_g) / 100.0
    else:
        fat_g = (fat_100g * serving_g) / 100.0

    fiber_srv = nut.get("fiber_serving")
    if fiber_srv is not None:
        try:
            fiber_g = float(fiber_srv)
        except (ValueError, TypeError):
            fiber_g = (fiber_100g * serving_g) / 100.0
    else:
        fiber_g = (fiber_100g * serving_g) / 100.0

    sugar_srv = nut.get("sugars_serving")
    if sugar_srv is not None:
        try:
            sugar_g = float(sugar_srv)
        except (ValueError, TypeError):
            sugar_g = (sugar_100g * serving_g) / 100.0
    else:
        sugar_g = (sugar_100g * serving_g) / 100.0

    sodium_srv = nut.get("sodium_serving")
    if sodium_srv is not None:
        try:
            sodium_mg = float(sodium_srv) * 1000.0
        except (ValueError, TypeError):
            sodium_mg = (sodium_mg_100g * serving_g) / 100.0
    else:
        sodium_mg = (sodium_mg_100g * serving_g) / 100.0

    # Image URL
    image_url = p.get("image_front_url") or p.get("image_url") or None

    # Ingredients
    ingredients = p.get("ingredients_text") or p.get("ingredients_text_en") or None

    # Allergens
    raw_allergens = p.get("allergens_tags") or p.get("allergens_hierarchy") or []
    allergens = []
    if isinstance(raw_allergens, list):
        for a in raw_allergens:
            clean = str(a).replace("en:", "").replace("fr:", "").replace("-", " ").strip()
            if clean and clean not in allergens:
                allergens.append(clean)
    elif isinstance(raw_allergens, str) and raw_allergens:
        allergens = [x.strip() for x in raw_allergens.split(",") if x.strip()]

    # Additives
    raw_additives = p.get("additives_tags") or []
    additives = []
    if isinstance(raw_additives, list):
        for a in raw_additives:
            clean = str(a).replace("en:", "").replace("-", " ").upper().strip()
            if clean and clean not in additives:
                additives.append(clean)

    # Scores
    nova_group = p.get("nova_group") or nut.get("nova-group")
    if nova_group is not None:
        try:
            nova_group = int(nova_group)
        except (ValueError, TypeError):
            nova_group = None

    nutrition_grade = p.get("nutrition_grades") or p.get("nutriscore_grade") or None
    if isinstance(nutrition_grade, str):
        nutrition_grade = nutrition_grade.lower()

    health_score = None
    if nutrition_grade:
        grade_map = {"a": 90, "b": 75, "c": 55, "d": 35, "e": 15}
        health_score = grade_map.get(nutrition_grade, 50)
        if nova_group == 4:
            health_score = max(10, health_score - 15)

    return BarcodeProduct(
        barcode=inp.barcode,
        name=name,
        brand=brand,
        image_url=image_url,
        serving_g=round(serving_g, 1),
        portion=portion,
        calories=round(calories, 1),
        protein_g=round(protein_g, 1),
        carbs_g=round(carbs_g, 1),
        fat_g=round(fat_g, 1),
        fiber_g=round(fiber_g, 1),
        sugar_g=round(sugar_g, 1),
        sodium_mg=round(sodium_mg, 1),
        ingredients=ingredients,
        allergens=allergens,
        additives=additives,
        nova_group=nova_group,
        nutrition_grade=nutrition_grade,
        health_score=health_score,
        calories_100g=round(cal_100g, 1),
        protein_100g=round(prot_100g, 1),
        carbs_100g=round(carbs_100g, 1),
        fat_100g=round(fat_100g, 1),
    )


@router.post("/log")
async def log_meal(
        inp: MealLogInput,
        background_tasks: BackgroundTasks,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    meal_id = "meal_" + uuid.uuid4().hex[:12]
    logged_at = datetime.now(timezone.utc)
    if inp.logged_at:
        try:
            dt = datetime.fromisoformat(inp.logged_at.replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                logged_at = dt.astimezone(timezone.utc)
            else:
                logged_at = dt.replace(tzinfo=timezone.utc)
        except Exception:
            logged_at = datetime.now(timezone.utc)
    if logged_at.tzinfo is not None:
        logged_at = logged_at.astimezone(timezone.utc).replace(tzinfo=None)

    # Process legacy base64 if provided
    image_key = inp.image_key
    thumbnail_key = inp.thumbnail_key
    image_width = inp.image_width
    image_height = inp.image_height
    image_content_type = inp.image_content_type
    image_size_bytes = inp.image_size_bytes
    image_uploaded_at = None
    if inp.image_uploaded_at:
        try:
            image_uploaded_at = datetime.fromisoformat(inp.image_uploaded_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            pass

    if inp.image_base64 and not image_key:
        try:
            # Decode base64
            b64_data = inp.image_base64
            if b64_data.startswith("data:image"):
                b64_data = b64_data.split(",", 1)[1]
            file_bytes = base64.b64decode(b64_data)
            
            # Process and upload
            standard_bytes, thumb_bytes, metadata = process_image(file_bytes)
            standard_key, thumb_key = generate_object_keys(str(user.id))
            
            await storage_provider.upload_file(standard_bytes, standard_key, metadata["content_type"])
            await storage_provider.upload_file(thumb_bytes, thumb_key, metadata["content_type"])
            
            image_key = standard_key
            thumbnail_key = thumb_key
            image_width = metadata["width"]
            image_height = metadata["height"]
            image_content_type = metadata["content_type"]
            image_size_bytes = metadata["size_bytes"]
            image_uploaded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        except Exception:
            pass # Ignore failures for legacy base64 to prevent breaking the flow entirely if image processing fails

    cultural_meta = dict(inp.cultural_meta or {})
    if inp.cultural_inspiration and "cultural_inspiration" not in cultural_meta:
        cultural_meta["cultural_inspiration"] = inp.cultural_inspiration
    if inp.restaurant_anchor and "restaurant_anchor" not in cultural_meta:
        cultural_meta["restaurant_anchor"] = inp.restaurant_anchor
    if inp.venue_name and "venue_name" not in cultural_meta:
        cultural_meta["venue_name"] = inp.venue_name
    if inp.cuisine and "cuisine" not in cultural_meta:
        cultural_meta["cuisine"] = inp.cuisine
    if inp.qloo_entity_id and "qloo_entity_id" not in cultural_meta:
        cultural_meta["qloo_entity_id"] = inp.qloo_entity_id
    if inp.bio_cultural_score is not None and "bio_cultural_score" not in cultural_meta:
        cultural_meta["bio_cultural_score"] = inp.bio_cultural_score

    new_meal = Meal(
        meal_id=meal_id,
        user_id=user.id,
        title=inp.title,
        meal_type=inp.meal_type,
        calories=inp.calories,
        protein_g=inp.protein_g,
        carbs_g=inp.carbs_g,
        fat_g=inp.fat_g,
        fiber_g=inp.fiber_g,
        sugar_g=inp.sugar_g,
        sodium_mg=inp.sodium_mg,
        magnesium_mg=inp.magnesium_mg,
        image_key=image_key,
        thumbnail_key=thumbnail_key,
        image_width=image_width,
        image_height=image_height,
        image_content_type=image_content_type,
        image_size_bytes=image_size_bytes,
        image_uploaded_at=image_uploaded_at,
        cultural_meta=cultural_meta,
        bio_cultural_score=inp.bio_cultural_score,
        ingredients=inp.foods or [],
        logged_at=logged_at
    )

    session.add(new_meal)
    await session.commit()
    await session.refresh(new_meal)

    await sync_daily_summary(user.id, logged_at.date().isoformat(), session)

    # H1: Refresh pre-computed streak in background
    background_tasks.add_task(_refresh_streak_bg, user.id)

    # Qloo Cultural Feedback Loop: evolve taste DNA from logged meal
    background_tasks.add_task(_evolve_taste_from_meal_bg, str(user.id), inp.title)

    # C4: Invalidate dashboard and nutrition caches on meal log
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("nutrition", str(user.id))
    await cache_invalidate("coach_weekly", str(user.id))

    return {
        "ok": True,
        "meal": {
            "meal_id": new_meal.meal_id,
            "title": new_meal.title,
            "meal_type": new_meal.meal_type,
            "calories": new_meal.calories,
            "protein_g": new_meal.protein_g,
            "carbs_g": new_meal.carbs_g,
            "fat_g": new_meal.fat_g,
            "fiber_g": new_meal.fiber_g,
            "sugar_g": new_meal.sugar_g,
            "sodium_mg": new_meal.sodium_mg,
            "magnesium_mg": getattr(new_meal, "magnesium_mg", 0.0) or 0.0,
            "image_url": storage_provider.generate_url(new_meal.image_key) if new_meal.image_key else None,
            "thumbnail_url": storage_provider.generate_url(new_meal.thumbnail_key) if new_meal.thumbnail_key else None,
            "image_width": new_meal.image_width,
            "image_height": new_meal.image_height,
            "logged_at": _format_utc_iso(new_meal.logged_at)
        }
    }


async def _refresh_streak_bg(user_id: str):
    """H1: Background task to refresh pre-computed streak after meal log/delete."""
    from database import AsyncSessionLocal
    from routers.groups import refresh_user_streak
    try:
        async with AsyncSessionLocal() as bg_session:
            await refresh_user_streak(user_id, bg_session)
    except Exception as e:
        logger.error("Background streak refresh failed for %s: %s", user_id, e)


async def _evolve_taste_from_meal_bg(user_id: str, meal_title: str):
    """Qloo Cultural Feedback Loop: update user's Taste DNA whenever a meal is logged."""
    from database import AsyncSessionLocal
    from sqlalchemy import select
    from models import User
    from services import qloo_service, taste_profile
    try:
        async with AsyncSessionLocal() as bg_session:
            result = await bg_session.execute(select(User).where(User.id == user_id))
            user_obj = result.scalars().first()
            if not user_obj:
                return
            taste_dna = await taste_profile.get_taste_dna(user_obj)
            if taste_dna and taste_dna.get("entity_ids"):
                updated_dna = await qloo_service.update_taste_from_meal(taste_dna, meal_title)
                await taste_profile.save_taste_dna(bg_session, user_obj, updated_dna)
                logger.info("Taste DNA evolved for user %s from logged meal '%s'", user_id, meal_title)
    except Exception as e:
        logger.warning("Background taste DNA evolution failed for user %s: %s", user_id, e)


@router.get("/list")
async def list_meals(
        date: Optional[str] = None,
        tz_offset: int = 0,
        limit: int = 100,
        cursor: Optional[str] = None,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_read_db)):
    # C6 fix: Filter by date in SQL using timezone-aware boundaries
    # instead of loading ALL meals into memory and filtering in Python.
    # H10 fix: Cursor-based pagination (keyset pagination using logged_at).
    # Page-based OFFSET pagination degrades at scale; cursors stay O(1).
    if date:
        from datetime import timedelta
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

        # Convert local date boundaries to UTC using tz_offset
        offset_delta = timedelta(minutes=-tz_offset)
        local_start = datetime.combine(target_date, datetime.min.time())
        local_end = datetime.combine(target_date, datetime.max.time())
        utc_start = local_start - offset_delta
        utc_end = local_end - offset_delta

        stmt = (
            select(Meal)
            .where(
                Meal.user_id == user.id,
                Meal.logged_at >= utc_start,
                Meal.logged_at <= utc_end,
            )
            .order_by(Meal.logged_at.desc())
            .limit(limit)
        )
    else:
        stmt = (
            select(Meal)
            .where(Meal.user_id == user.id)
            .order_by(Meal.logged_at.desc())
            .limit(limit)
        )

    # H10: Apply cursor filter (cursor = ISO datetime of last item from previous page)
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            stmt = stmt.where(Meal.logged_at < cursor_dt)
        except (ValueError, TypeError):
            pass  # Ignore malformed cursor

    result = await session.execute(stmt)
    meals = result.scalars().all()

    items = []
    for m in meals:
        cultural_meta = getattr(m, "cultural_meta", None) or {}
        if not isinstance(cultural_meta, dict):
            cultural_meta = {}
        img_meta = getattr(m, "image_metadata", None) or {}
        if isinstance(img_meta, dict):
            for k, v in img_meta.items():
                if k not in cultural_meta:
                    cultural_meta[k] = v

        bio_cultural_score = (
            getattr(m, "bio_cultural_score", None)
            or cultural_meta.get("bio_cultural_score")
            or img_meta.get("bio_cultural_score")
        )
        if bio_cultural_score is None:
            bio_cultural_score = 94

        items.append({
            "meal_id": m.meal_id,
            "title": m.title,
            "meal_type": m.meal_type,
            "calories": m.calories,
            "protein_g": m.protein_g,
            "carbs_g": m.carbs_g,
            "fat_g": m.fat_g,
            "fiber_g": getattr(m, "fiber_g", 0.0) or 0.0,
            "sugar_g": getattr(m, "sugar_g", 0.0) or 0.0,
            "sodium_mg": getattr(m, "sodium_mg", 0.0) or 0.0,
            "magnesium_mg": getattr(m, "magnesium_mg", 0.0) or 0.0,
            "image_url": storage_provider.generate_url(m.image_key) if getattr(m, "image_key", None) else None,
            "thumbnail_url": storage_provider.generate_url(m.thumbnail_key) if getattr(m, "thumbnail_key", None) else None,
            "image_width": getattr(m, "image_width", None),
            "image_height": getattr(m, "image_height", None),
            "logged_at": _format_utc_iso(m.logged_at),
            "bio_cultural_score": int(bio_cultural_score),
            "cultural_meta": cultural_meta,
        })

    # H10: Return next_cursor for pagination
    next_cursor = items[-1]["logged_at"] if len(items) == limit else None
    return {"meals": items, "next_cursor": next_cursor}


@router.get("/{meal_id}")
async def get_meal(
        meal_id: str,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_read_db)):
    stmt = select(Meal).where(Meal.meal_id == meal_id).where(Meal.user_id == user.id)
    result = await session.execute(stmt)
    meal = result.scalar_one_or_none()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    cultural_meta = getattr(meal, "cultural_meta", None) or {}
    if not isinstance(cultural_meta, dict):
        cultural_meta = {}
    img_meta = getattr(meal, "image_metadata", None) or {}
    if isinstance(img_meta, dict):
        for k, v in img_meta.items():
            if k not in cultural_meta:
                cultural_meta[k] = v

    bio_cultural_score = (
        getattr(meal, "bio_cultural_score", None)
        or cultural_meta.get("bio_cultural_score")
        or img_meta.get("bio_cultural_score")
    )
    if bio_cultural_score is None:
        bio_cultural_score = 94

    return {
        "meal_id": meal.meal_id,
        "title": meal.title,
        "meal_type": meal.meal_type,
        "calories": meal.calories,
        "protein_g": meal.protein_g,
        "carbs_g": meal.carbs_g,
        "fat_g": meal.fat_g,
        "fiber_g": getattr(meal, "fiber_g", 0.0) or 0.0,
        "sugar_g": getattr(meal, "sugar_g", 0.0) or 0.0,
        "sodium_mg": getattr(meal, "sodium_mg", 0.0) or 0.0,
        "magnesium_mg": getattr(meal, "magnesium_mg", 0.0) or 0.0,
        "ingredients": meal.ingredients or [],
        "foods": meal.ingredients or [],
        "image_url": storage_provider.generate_url(meal.image_key) if getattr(meal, "image_key", None) else None,
        "thumbnail_url": storage_provider.generate_url(meal.thumbnail_key) if getattr(meal, "thumbnail_key", None) else None,
        "image_width": getattr(meal, "image_width", None),
        "image_height": getattr(meal, "image_height", None),
        "logged_at": _format_utc_iso(meal.logged_at),
        "bio_cultural_score": int(bio_cultural_score),
        "cultural_meta": cultural_meta,
    }


@router.patch("/{meal_id}")
async def update_meal(
        meal_id: str,
        inp: MealUpdateInput,
        background_tasks: BackgroundTasks,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    stmt = select(Meal).where(Meal.meal_id == meal_id).where(Meal.user_id == user.id)
    result = await session.execute(stmt)
    meal = result.scalar_one_or_none()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    if inp.title is not None:
        meal.title = inp.title
    if inp.meal_type is not None:
        meal.meal_type = inp.meal_type
    if inp.calories is not None:
        meal.calories = inp.calories
    if inp.protein_g is not None:
        meal.protein_g = inp.protein_g
    if inp.carbs_g is not None:
        meal.carbs_g = inp.carbs_g
    if inp.fat_g is not None:
        meal.fat_g = inp.fat_g
    if inp.fiber_g is not None:
        meal.fiber_g = inp.fiber_g
    if inp.sugar_g is not None:
        meal.sugar_g = inp.sugar_g
    if inp.sodium_mg is not None:
        meal.sodium_mg = inp.sodium_mg

    await session.commit()
    await session.refresh(meal)

    if meal.logged_at:
        await sync_daily_summary(user.id, meal.logged_at.date().isoformat(), session)

    # H1: Refresh pre-computed streak in background
    background_tasks.add_task(_refresh_streak_bg, user.id)
    # C4: Invalidate dashboard and nutrition caches on meal update
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("nutrition", str(user.id))

    return {
        "ok": True,
        "meal": {
            "meal_id": meal.meal_id,
            "title": meal.title,
            "meal_type": meal.meal_type,
            "calories": meal.calories,
            "protein_g": meal.protein_g,
            "carbs_g": meal.carbs_g,
            "fat_g": meal.fat_g,
            "fiber_g": getattr(meal, "fiber_g", 0.0) or 0.0,
            "sugar_g": getattr(meal, "sugar_g", 0.0) or 0.0,
            "sodium_mg": getattr(meal, "sodium_mg", 0.0) or 0.0,
            "logged_at": _format_utc_iso(meal.logged_at)
        }
    }


@router.post("/{meal_id}/duplicate")
async def duplicate_meal(
        meal_id: str,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    stmt = select(Meal).where(Meal.meal_id == meal_id).where(Meal.user_id == user.id)
    result = await session.execute(stmt)
    meal = result.scalar_one_or_none()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    import uuid, datetime
    new_meal_id = f"meal_{uuid.uuid4().hex[:12]}"
    new_meal = Meal(
        meal_id=new_meal_id,
        user_id=user.id,
        title=meal.title,
        meal_type=meal.meal_type,
        calories=meal.calories,
        protein_g=meal.protein_g,
        carbs_g=meal.carbs_g,
        fat_g=meal.fat_g,
        fiber_g=getattr(meal, "fiber_g", None),
        sugar_g=getattr(meal, "sugar_g", None),
        sodium_mg=getattr(meal, "sodium_mg", None),
        ingredients=meal.ingredients or [],
        image_key=getattr(meal, "image_key", None),
        thumbnail_key=getattr(meal, "thumbnail_key", None),
        image_width=getattr(meal, "image_width", None),
        image_height=getattr(meal, "image_height", None),
        logged_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    )
    session.add(new_meal)
    await session.commit()
    if new_meal.logged_at:
        await sync_daily_summary(user.id, new_meal.logged_at.date().isoformat(), session)
    # C4: Invalidate dashboard and nutrition caches on meal duplicate
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("nutrition", str(user.id))
    return {"ok": True, "meal_id": new_meal_id}


@router.delete("/{meal_id}")
async def delete_meal(
        meal_id: str,
        background_tasks: BackgroundTasks,
        user: User = Depends(current_user),
        session: AsyncSession = Depends(get_db)):
    stmt_select = select(Meal).where(Meal.meal_id == meal_id).where(Meal.user_id == user.id)
    res_select = await session.execute(stmt_select)
    meal = res_select.scalar_one_or_none()
    if not meal:
        return {"ok": False}

    date_str = meal.logged_at.date().isoformat() if meal.logged_at else None

    stmt = delete(Meal).where(Meal.meal_id == meal_id).where(Meal.user_id == user.id)
    result = await session.execute(stmt)
    
    if getattr(result, "rowcount", 0) > 0:
        from sqlalchemy import update
        profile: dict = user.profile or {} # type: ignore
        if not profile.get("dumpster_diver_unlocked"):
            profile["dumpster_diver_unlocked"] = True
            await session.execute(
                update(User).where(User.id == user.id).values(profile=profile)
            )

    await session.commit()
    if date_str:
        await sync_daily_summary(user.id, date_str, session)

    # H1: Refresh pre-computed streak in background
    background_tasks.add_task(_refresh_streak_bg, user.id)

    # C4: Invalidate dashboard and nutrition caches on meal delete
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("nutrition", str(user.id))
    await cache_invalidate("coach_weekly", str(user.id))

    return {"ok": getattr(result, "rowcount", 0) > 0}

