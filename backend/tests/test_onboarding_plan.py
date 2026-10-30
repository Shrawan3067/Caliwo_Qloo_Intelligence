"""Onboarding plan-computation regression tests.

Run: cd /app/backend && python -m pytest tests/test_onboarding_plan.py -q
"""
from math_utils import age_from_dob, compute_plan, CALORIE_FLOOR, CALORIE_CEIL


def test_age_from_dob_basic():
    # A person born in 1990 is at least in their 30s (container clock ~2026).
    assert age_from_dob("1990-01-01") >= 30
    assert age_from_dob("not-a-date") == 0
    assert age_from_dob("") == 0


def test_compute_plan_matches_frontend_formula():
    # Male, 80kg, 180cm, age 31, workouts 3-5 (1.55), lose, recommended (350)
    plan = compute_plan(
        sex="male", weight_kg=80, height_cm=180, age=31,
        workouts_per_week="3-5", goal="lose", target_speed="recommended",
    )
    # bmr = 10*80 + 6.25*180 - 5*31 + 5 = 1775 ; tdee = 1775*1.55 = 2751.25 ; -350 = 2401
    assert plan["daily_calories"] == 2401
    assert plan["daily_protein_g"] == round(80 * 1.8)  # 144
    assert plan["daily_fat_g"] == round((2401 * 0.28) / 9)  # 75
    # carbs = remainder of calories after protein & fat
    assert plan["daily_carbs_g"] == max(60, round((2401 - 144 * 4 - 75 * 9) / 4))


def test_compute_plan_female_maintain():
    plan = compute_plan(
        sex="female", weight_kg=70, height_cm=165, age=36,
        workouts_per_week="0-2", goal="maintain", target_speed="recommended",
    )
    # bmr = 700 + 1031.25 - 180 - 161 = 1390.25 ; *1.375 = 1911.6 -> 1912
    assert plan["daily_calories"] == 1912
    assert plan["daily_protein_g"] == 126


def test_gain_increases_calories_over_maintain():
    common = dict(sex="male", weight_kg=75, height_cm=178, age=28, workouts_per_week="3-5")
    maintain = compute_plan(goal="maintain", target_speed="recommended", **common)
    gain = compute_plan(goal="gain", target_speed="recommended", **common)
    lose = compute_plan(goal="lose", target_speed="recommended", **common)
    assert gain["daily_calories"] > maintain["daily_calories"] > lose["daily_calories"]


def test_calorie_floor_enforced():
    # Tiny stats + aggressive loss must never drop below the safe floor.
    plan = compute_plan(
        sex="female", weight_kg=40, height_cm=150, age=70,
        workouts_per_week="0-2", goal="lose", target_speed="fast",
    )
    assert plan["daily_calories"] >= CALORIE_FLOOR


def test_calorie_ceiling_enforced():
    plan = compute_plan(
        sex="male", weight_kg=200, height_cm=210, age=20,
        workouts_per_week="6+", goal="gain", target_speed="fast",
    )
    assert plan["daily_calories"] <= CALORIE_CEIL


def test_age_clamped_internally():
    # age=5 should be clamped up to 15 internally, not crash or produce garbage.
    plan = compute_plan(
        sex="male", weight_kg=60, height_cm=170, age=5,
        workouts_per_week="0-2", goal="maintain",
    )
    assert plan["daily_calories"] >= CALORIE_FLOOR
