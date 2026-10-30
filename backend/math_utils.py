"""Deterministic core functions for nutrition calculations."""

def calculate_bmr(gender: str, weight_kg: float, height_cm: float, age: int) -> float:
    """
    Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
    Returns 0.0 if inputs are invalid.
    """
    if weight_kg <= 0 or height_cm <= 0 or age <= 0:
        return 0.0
    
    # Mifflin-St Jeor
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
    
    if gender.lower() == "male":
        return base + 5
    else:
        # Female or default
        return base - 161

def calculate_tdee(bmr: float, activity_level: str) -> float:
    """Calculate Total Daily Energy Expenditure based on activity multiplier."""
    multipliers = {
        "sedentary": 1.2,
        "lightly_active": 1.375,
        "moderately_active": 1.55,
        "very_active": 1.725,
        "extra_active": 1.9
    }
    # Default to lightly_active if not found
    mult = multipliers.get(activity_level.lower(), 1.375)
    return bmr * mult

def get_calorie_goal(tdee: float, goal: str = "maintain") -> float:
    """Calculate target calories based on goal (e.g. lose, gain)."""
    if goal == "lose":
        return tdee - 500  # standard 1lb/week loss
    elif goal == "gain":
        return tdee + 500  # standard 1lb/week gain
    return tdee

def calculate_macros(target_calories: float, preference: str = "balanced") -> dict:
    """
    Calculate strict macro split in grams.
    Protein = 4 kcal/g, Carbs = 4 kcal/g, Fats = 9 kcal/g.
    Returns exact deterministic values.
    """
    if target_calories <= 0:
        return {"protein_g": 0, "carbs_g": 0, "fat_g": 0}

    # Define percentage splits (protein, carbs, fat)
    splits = {
        "balanced": (0.30, 0.40, 0.30),
        "low_carb": (0.40, 0.20, 0.40),
        "high_protein": (0.40, 0.35, 0.25),
        "keto": (0.25, 0.05, 0.70)
    }
    
    p_pct, c_pct, f_pct = splits.get(preference.lower(), splits["balanced"])
    
    protein_cals = target_calories * p_pct
    carbs_cals = target_calories * c_pct
    fat_cals = target_calories * f_pct
    
    return {
        "protein_g": round(protein_cals / 4.0),
        "carbs_g": round(carbs_cals / 4.0),
        "fat_g": round(fat_cals / 9.0)
    }

def calculate_water_goal(weight_kg: float, activity_level: str) -> int:
    """Calculate daily water intake goal in ml based on weight and activity."""
    if weight_kg <= 0:
        return 2000
    
    # Base: 35ml per kg of body weight
    base_ml = weight_kg * 35
    
    # Add bonus for activity
    bonus = 0
    if activity_level in ["moderately_active", "very_active"]:
        bonus = 500
    elif activity_level == "extra_active":
        bonus = 1000
        
    return int(round(base_ml + bonus))


# ---------------------------------------------------------------------------
# Authoritative onboarding plan computation.
# Kept intentionally identical to the frontend preview (OnboardingContext.
# computePlan) so the plan a user previews == the plan stored on the server.
# The SERVER is the source of truth; client-sent calorie/macro values are
# ignored and recomputed here.
# ---------------------------------------------------------------------------
WORKOUTS_TO_MULTIPLIER = {"0-2": 1.375, "3-5": 1.55, "6+": 1.725}
SPEED_TO_DELTA = {"slow": 200, "recommended": 350, "fast": 500}
CALORIE_FLOOR = 1200
CALORIE_CEIL = 6000


def age_from_dob(dob_str: str) -> int:
    """Whole years from an ISO 'YYYY-MM-DD' date of birth. 0 if unparsable."""
    try:
        from datetime import date
        y, m, d = (int(x) for x in dob_str.split("-")[:3])
        born = date(y, m, d)
        today = date.today()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        return 0


def compute_plan(
    *,
    sex: str,
    weight_kg: float,
    height_cm: float,
    age: int,
    workouts_per_week: str = "0-2",
    goal: str = "maintain",
    target_speed: str = "recommended",
) -> dict:
    """Deterministic daily calorie + macro targets. Clamped to safe ranges."""
    age = max(15, min(120, int(age or 25)))
    is_male = str(sex or "").lower().startswith("m")
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if is_male else -161)
    mult = WORKOUTS_TO_MULTIPLIER.get(str(workouts_per_week or "0-2"), 1.375)
    tdee = bmr * mult
    delta = SPEED_TO_DELTA.get(str(target_speed or "recommended"), 350)
    if goal == "lose":
        tdee -= delta
    elif goal == "gain":
        tdee += delta
    cal = int(max(CALORIE_FLOOR, min(CALORIE_CEIL, round(tdee))))
    protein = int(round(weight_kg * 1.8))
    fat = int(round((cal * 0.28) / 9))
    carbs = int(max(60, round((cal - protein * 4 - fat * 9) / 4)))
    return {
        "daily_calories": cal,
        "daily_protein_g": protein,
        "daily_carbs_g": carbs,
        "daily_fat_g": fat,
    }

