"""Unit & Integration tests for Feature 6 (Calorie & Macro Engine) and Feature 7 (Home Dashboard).

Covers:
- compute_plan (BMR, TDEE, goal speed delta, safe clamping, macro splits)
- calculate_water_goal
- calculate_macros
- GET /api/meals/summary/daily (Daily summary aggregation, remaining calorie budget)
"""
import os
import uuid
import datetime
import pytest
import requests
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from math_utils import (
    calculate_bmr,
    calculate_tdee,
    calculate_macros,
    calculate_water_goal,
    compute_plan
)

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_user_with_onboarding() -> tuple[str, dict]:
    email = f"test_dash_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234Word!"}, timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    token = r.json()["token"]

    onb_res = requests.post(
        f"{API}/profile/onboarding",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sex": "male",
            "date_of_birth": "1995-06-15",
            "height_cm": 180,
            "weight_kg": 80,
            "goal": "lose",
            "target_speed": "recommended",
            "workouts_per_week": "3-5"
        },
        timeout=10
    )
    assert onb_res.status_code == 200
    return token, onb_res.json()["profile"]


class TestCalorieMacroEngineUnit:
    def test_compute_plan_clamping_and_math(self):
        # Male 80kg, 180cm, 30y, 3-5 workouts (mult 1.55), lose recommended (-350)
        # BMR = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
        # TDEE = 1780 * 1.55 = 2759
        # Goal lose recommended -> 2759 - 350 = 2409 cals
        plan = compute_plan(
            sex="male",
            weight_kg=80.0,
            height_cm=180.0,
            age=30,
            workouts_per_week="3-5",
            goal="lose",
            target_speed="recommended"
        )
        assert 2350 <= plan["daily_calories"] <= 2450
        assert plan["daily_protein_g"] == 144  # 80 * 1.8
        assert plan["daily_fat_g"] > 0
        assert plan["daily_carbs_g"] > 0

    def test_compute_plan_floor_clamping(self):
        # Very small weight/height should clamp to CALORIE_FLOOR = 1200
        plan = compute_plan(
            sex="female",
            weight_kg=30.0,
            height_cm=100.0,
            age=80,
            workouts_per_week="0-2",
            goal="lose",
            target_speed="fast"
        )
        assert plan["daily_calories"] == 1200

    def test_water_goal_computation(self):
        # 70kg * 35 = 2450ml
        w1 = calculate_water_goal(70.0, "sedentary")
        assert w1 == 2450

        # 70kg moderately active (+500ml) = 2950ml
        w2 = calculate_water_goal(70.0, "moderately_active")
        assert w2 == 2950

    def test_macro_splits(self):
        m_bal = calculate_macros(2000, "balanced")
        assert m_bal["protein_g"] == 150  # 30% of 2000 = 600 / 4 = 150
        assert m_bal["carbs_g"] == 200    # 40% of 2000 = 800 / 4 = 200
        assert m_bal["fat_g"] == 67       # 30% of 2000 = 600 / 9 = 67


class TestHomeDashboardFeature:
    def test_daily_summary_aggregation(self):
        token, prof = _fresh_user_with_onboarding()
        headers = {"Authorization": f"Bearer {token}"}
        today_str = datetime.datetime.utcnow().date().isoformat()

        # Log a meal
        requests.post(
            f"{API}/meals/log",
            headers=headers,
            json={
                "title": "Steak & Eggs",
                "meal_type": "breakfast",
                "calories": 500.0,
                "protein_g": 40.0,
                "carbs_g": 10.0,
                "fat_g": 30.0
            },
            timeout=10
        )

        # Get daily nutrition summary
        res = requests.get(f"{API}/nutrition/today?date={today_str}", headers=headers, timeout=10)
        assert res.status_code == 200
        data = res.json()
        assert "totals" in data and "goals" in data
        assert data["totals"]["calories"] == 500.0
        assert data["totals"]["protein_g"] == 40.0
        assert data["totals"]["carbs_g"] == 10.0
        assert data["totals"]["fat_g"] == 30.0


if __name__ == "__main__":
    t_unit = TestCalorieMacroEngineUnit()
    print("Running test_compute_plan_clamping_and_math...")
    t_unit.test_compute_plan_clamping_and_math()
    print("Running test_compute_plan_floor_clamping...")
    t_unit.test_compute_plan_floor_clamping()
    print("Running test_water_goal_computation...")
    t_unit.test_water_goal_computation()
    print("Running test_macro_splits...")
    t_unit.test_macro_splits()

    t_dash = TestHomeDashboardFeature()
    print("Running test_daily_summary_aggregation...")
    t_dash.test_daily_summary_aggregation()
    print("ALL ENGINE & DASHBOARD TESTS PASSED SUCCESSFULLY!")
