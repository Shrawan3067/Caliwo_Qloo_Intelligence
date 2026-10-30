from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from models import User
from routers.auth import current_user

router = APIRouter(prefix="/grocery", tags=["grocery"])


class GroceryToggleInput(BaseModel):
    name: str
    checked: bool


class GroceryAddInput(BaseModel):
    name: str
    category: Optional[str] = None


class GroceryDeleteItemInput(BaseModel):
    name: str


CULTURAL_SPECIALTY_KEYWORDS = {
    "miso", "adobo", "poblano", "farro", "truffle", "quinoa", "edamame",
    "bok choy", "guajillo", "kimchi", "harissa", "tahini", "dashi", "ponzu",
    "kalamata", "sourdough", "injera", "merguez", "lemongrass", "cotija",
    "saikyo", "meyer lemon", "sea bass", "black cod", "za'atar", "sumac",
    "mirin", "tamari", "galbi", "mole", "ceviche", "shakshuka", "tamarind",
    "cardamom", "forbidden rice", "avocado", "tapenade", "ricotta", "gnocchi",
    "branzino", "feta", "chia", "matcha", "truffle glaze", "flank steak",
    "carnitas", "barbacoa",
}
PRODUCE_KEYWORDS = {"apple", "banana", "berry", "spinach", "kale", "lettuce", "tomato", "onion", "garlic", "avocado", "broccoli", "carrot", "cucumber", "lemon", "lime", "fruit", "veggie", "vegetable", "pepper", "potato", "berry"}
DAIRY_KEYWORDS = {"milk", "cheese", "yogurt", "butter", "cream", "egg", "eggs", "curd", "paneer"}
MEAT_KEYWORDS = {"chicken", "beef", "pork", "turkey", "fish", "salmon", "tuna", "shrimp", "steak", "bacon", "meat"}
PANTRY_KEYWORDS = {"rice", "oats", "oatmeal", "bread", "pasta", "flour", "oil", "olive oil", "salt", "pepper", "sugar", "sauce", "spice", "nut", "almond", "peanut", "seed", "bean", "lentil", "cereal"}
BEVERAGE_KEYWORDS = {"water", "coffee", "tea", "juice", "soda", "drink", "beverage", "smoothie"}

CULTURAL_MICRONUTRIENT_BENEFITS = {
    "miso": "Fermented zinc, copper & protective probiotics for gut microbiome",
    "saikyo": "Sweet Kyoto white miso rich in natural zinc and probiotic enzymes",
    "adobo": "Antioxidant capsaicin & carotenoids for cellular defense",
    "poblano": "Rich in Vitamin C (>100% DV) & potassium for muscle tone",
    "farro": "Magnesium-dense ancient grain (64mg) & sustained-energy fiber",
    "truffle": "Bioactive ergosterol & essential restorative minerals",
    "quinoa": "Complete plant protein & rich in magnesium (118mg/cup)",
    "edamame": "Natural folate, iron & muscular recovery magnesium (64mg)",
    "bok choy": "High calcium bioavailability & Vitamin K bone density support",
    "guajillo": "Capsaicinoids for metabolic support & Vitamin A carotenoids",
    "kimchi": "Lactobacillus probiotics & bioavailable immunity Vitamin C",
    "harissa": "Anti-inflammatory capsaicin & natural mineral complex",
    "tahini": "Bioavailable calcium (130mg) & heart-healthy sesamin lignans",
    "dashi": "Natural glutamates & thyroid-supporting iodine",
    "ponzu": "Citrus bioflavonoids & electrolyte balance preservation",
    "kalamata": "Polyphenols, cardioprotective oleic acid & Vitamin E",
    "sourdough": "Slow-fermented prebiotic gut health & lower glycemic index",
    "injera": "Iron-dense teff prebiotic fiber & bioavailable magnesium",
    "merguez": "Heme iron, restorative B12 & thermogenic cumin/coriander",
    "lemongrass": "Citral antioxidant & natural digestive enzyme support",
    "cotija": "Bioavailable calcium & natural trace electrolyte balance",
    "meyer lemon": "Flavonoid-rich Vitamin C & citric acid boosting mineral absorption",
    "sea bass": "Lean bioavailable protein & anti-inflammatory Omega-3 fatty acids",
    "black cod": "Heart-healthy EPA & DHA Omega-3 fatty acids for recovery",
    "za'atar": "Thymol & carvacrol polyphenols with natural cellular defense",
    "sumac": "High ORAC antioxidant tannins supporting metabolic health",
    "tamari": "Gluten-free fermented soy with gut-friendly organic amino acids",
    "mirin": "Traditional koji fermentation providing complex umami enzymes",
    "galbi": "Iron-rich protein marinade with restorative trace minerals",
    "mole": "Raw cacao theobromine, zinc & capsaicin complex",
    "tapenade": "Polyphenol antioxidants and monounsaturated fatty acids",
    "avocado": "Heart-healthy monounsaturated fats & potassium electrolyte balance",
    "tamarind": "Tartaric acid antioxidant aiding digestion & recovery",
    "chia": "Soluble dietary fiber (10g/oz) and plant-based ALA Omega-3",
    "matcha": "L-theanine and EGCG catechins for clean metabolic focus",
    "feta": "Bioavailable calcium and phosphorus for bone and cellular health",
    "ricotta": "High-whey protein fraction with branched-chain amino acids (BCAAs)",
    "branzino": "High selenium, protein & essential marine fatty acids",
}


def _get_micronutrient_benefit(name: str) -> Optional[str]:
    """Retrieve micronutrient and metabolic benefit for cultural specialty ingredients."""
    n = name.lower()
    for kw, benefit in CULTURAL_MICRONUTRIENT_BENEFITS.items():
        if kw in n:
            return benefit
    for w in n.split():
        if w in CULTURAL_MICRONUTRIENT_BENEFITS:
            return CULTURAL_MICRONUTRIENT_BENEFITS[w]
    return None


def _categorize_ingredient(name: str) -> str:
    n = name.lower()
    # Check multi-word cultural specialty keywords first
    for kw in CULTURAL_SPECIALTY_KEYWORDS:
        if kw in n:
            return "Global Pantry & Cultural Specialties 🌐"
    for w in n.split():
        if w in CULTURAL_SPECIALTY_KEYWORDS:
            return "Global Pantry & Cultural Specialties 🌐"
        if w in PRODUCE_KEYWORDS:
            return "Produce 🥦"
        if w in DAIRY_KEYWORDS:
            return "Dairy & Eggs 🥛"
        if w in MEAT_KEYWORDS:
            return "Meat & Seafood 🥩"
        if w in PANTRY_KEYWORDS:
            return "Pantry & Grains 🌾"
        if w in BEVERAGE_KEYWORDS:
            return "Beverages ☕"
    return "Others 🥖"


def _is_cultural_specialty(name: str) -> bool:
    n = name.lower()
    for kw in CULTURAL_SPECIALTY_KEYWORDS:
        if kw in n:
            return True
    return False


def _extract_ingredients(plan: dict) -> list[str]:
    """Extract unique ingredients from a meal plan."""
    ingredients: list[str] = []
    if isinstance(plan.get("days"), list):
        for d in plan["days"]:
            if isinstance(d.get("meals"), list):
                for m in d["meals"]:
                    if isinstance(m.get("ingredients"), list):
                        ingredients.extend(m["ingredients"])

    # Deduplicate preserving order
    unique: list[str] = []
    seen: set[str] = set()
    for ing in ingredients:
        ing_clean = str(ing).strip()
        if ing_clean and ing_clean.lower() not in seen:
            seen.add(ing_clean.lower())
            unique.append(ing_clean)
    return unique


@router.get("/current")
async def grocery_current(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = user.profile or {}
    plan = profile.get("current_plan")
    custom_items: list = profile.get("custom_grocery_items", [])
    if not isinstance(custom_items, list):
        custom_items = []

    plan_id = plan.get("plan_id") if plan else "custom"
    plan_ings = _extract_ingredients(plan) if plan else []

    all_ings = []
    seen = set()
    for ing in plan_ings + custom_items:
        clean = str(ing).strip()
        if clean and clean.lower() not in seen:
            seen.add(clean.lower())
            all_ings.append(clean)

    checked_items: list = profile.get("grocery_checked", [])
    if not isinstance(checked_items, list):
        checked_items = []

    items = []
    checked_count = 0
    checked_lower = {c.lower() for c in checked_items}
    for ing in all_ings:
        is_chk = ing.lower() in checked_lower
        if is_chk:
            checked_count += 1
        items.append({
            "name": ing,
            "checked": is_chk,
            "category": _categorize_ingredient(ing),
            "is_custom": ing in custom_items,
            "is_cultural": _is_cultural_specialty(ing),
            "micronutrient_benefit": _get_micronutrient_benefit(ing),
        })

    return {
        "plan_id": plan_id,
        "items": items,
        "checked_count": checked_count,
        "total_count": len(items),
        "cultural_pantry_count": sum(1 for it in items if it.get("is_cultural")),
    }


@router.post("/add")
async def grocery_add_item(
    inp: GroceryAddInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    if not inp.name or not inp.name.strip():
        raise HTTPException(status_code=400, detail="Item name cannot be empty")

    name = inp.name.strip()
    profile: dict = dict(user.profile) if user.profile else {}
    custom_items: list = profile.get("custom_grocery_items", [])
    if not isinstance(custom_items, list):
        custom_items = []

    if name.lower() not in {c.lower() for c in custom_items}:
        custom_items.append(name)
        profile["custom_grocery_items"] = custom_items
        user.profile = profile
        flag_modified(user, "profile")
        await session.commit()

    return {
        "ok": True,
        "name": name,
        "category": _categorize_ingredient(name),
        "micronutrient_benefit": _get_micronutrient_benefit(name),
    }


@router.post("/toggle")
async def grocery_toggle(
    inp: GroceryToggleInput,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}

    checked_items: list = profile.get("grocery_checked", [])
    if not isinstance(checked_items, list):
        checked_items = []

    if inp.checked:
        if inp.name not in checked_items:
            checked_items.append(inp.name)
    else:
        checked_items = [i for i in checked_items if i.lower() != inp.name.lower()]

    profile["grocery_checked"] = checked_items
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()

    return {"ok": True, "name": inp.name, "checked": inp.checked}


@router.post("/clear-checked")
async def grocery_clear_checked(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}
    checked_items: list = profile.get("grocery_checked", [])
    custom_items: list = profile.get("custom_grocery_items", [])
    if not isinstance(checked_items, list):
        checked_items = []
    if not isinstance(custom_items, list):
        custom_items = []

    checked_lower = {c.lower() for c in checked_items}
    new_custom = [c for c in custom_items if c.lower() not in checked_lower]

    profile["custom_grocery_items"] = new_custom
    profile["grocery_checked"] = []
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()

    return {"ok": True, "cleared_count": len(checked_items)}


@router.post("/reset")
async def grocery_reset(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
):
    profile: dict = dict(user.profile) if user.profile else {}
    profile["grocery_checked"] = []
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()

    return {"ok": True}

