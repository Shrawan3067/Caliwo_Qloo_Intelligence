"""Iteration 14: Smoke test after fresh clone of Caliwo repo.
Focus: healthcheck + auth + onboarding + core CRUD (meals, water, weight, sleep, referrals).
Skip AI-heavy flows.
"""
import os
import time
import uuid
import pytest
import requests


def _base_url():
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
    if url:
        return url
    env_path = os.path.join(os.path.dirname(__file__), "../../frontend/.env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    val = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    if val:
                        return val
    return "http://localhost:8000"


BASE_URL = _base_url()
API = f"{BASE_URL}/api"
print(f"Smoke test API={API}")


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def new_user():
    email = f"TEST_smoke_{int(time.time())}_{uuid.uuid4().hex[:6]}@caliwo.dev"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Demo123!", "name": "SmokeUser"},
                      timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    j = r.json()
    return {"email": email, "token": j["token"], "user": j["user"]}


# --- Health ---
class TestHealth:
    def test_root_healthcheck(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("service") == "Caliwo API"
        assert d.get("status") == "ok"


# --- Auth: register, login, /auth/me, seed test user ---
class TestAuth:
    def test_login_new_user(self, new_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": new_user["email"], "password": "Demo123!"},
                          timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j.get("token")
        assert j["user"]["email"].lower() == new_user["email"].lower()

    def test_login_wrong_password(self, new_user):
        r = requests.post(f"{API}/auth/login",
                          json={"email": new_user["email"], "password": "wrong-pw"},
                          timeout=15)
        assert r.status_code == 401

    def test_auth_me(self, new_user):
        r = requests.get(f"{API}/auth/me",
                         headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"].lower() == new_user["email"].lower()

    def test_seeded_user_login_or_create(self):
        # Ensure the pre-declared smoke user works (create if missing, then login).
        payload_reg = {"email": "smoketest@caliwo.dev", "password": "Test1234!", "name": "Smoke"}
        requests.post(f"{API}/auth/register", json=payload_reg, timeout=15)
        r = requests.post(f"{API}/auth/login",
                          json={"email": "smoketest@caliwo.dev", "password": "Test1234!"},
                          timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("token")


# --- Onboarding (POST /api/profile/onboarding + GET /api/profile/me) ---
class TestOnboarding:
    def test_save_and_get_onboarding(self, new_user):
        body = {
            "sex": "male", "height_cm": 180, "weight_kg": 80,
            "goal": "maintain", "workouts_per_week": "3-5",
            "daily_calories": 2400, "daily_protein_g": 150,
            "daily_carbs_g": 260, "daily_fat_g": 80,
        }
        r = requests.post(f"{API}/profile/onboarding", json=body,
                          headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        r2 = requests.get(f"{API}/profile/me",
                          headers=_auth(new_user["token"]), timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["user"]["onboarded"] is True
        assert d["profile"]["goal"] == "maintain"
        assert d["profile"]["daily_calories"] == 2400


# --- Meals CRUD (POST /api/meals/log + GET /api/meals/list?day=today) ---
class TestMeals:
    def test_log_meal_and_list(self, new_user):
        payload = {
            "title": "Test Grilled Chicken",
            "meal_type": "lunch",
            "calories": 500, "protein_g": 55, "carbs_g": 20, "fat_g": 18,
            "portion": "1 bowl",
        }
        r = requests.post(f"{API}/meals/log", json=payload,
                          headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        meal = r.json().get("meal")
        assert meal and meal.get("meal_id") and meal.get("title") == "Test Grilled Chicken"

        today = time.strftime("%Y-%m-%d")
        r2 = requests.get(f"{API}/meals/list?day={today}",
                          headers=_auth(new_user["token"]), timeout=15)
        assert r2.status_code == 200
        items = r2.json().get("meals", [])
        assert any(m.get("meal_id") == meal["meal_id"] for m in items), "logged meal not returned in list"

    def test_nutrition_today_reflects_meal(self, new_user):
        r = requests.get(f"{API}/nutrition/today",
                         headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["totals"]["calories"] >= 500
        assert "goals" in d


# --- Water (POST /api/water/log + verified via /api/nutrition/today) ---
class TestWater:
    def test_log_water(self, new_user):
        r = requests.post(f"{API}/water/log", json={"ml": 500},
                          headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("total_ml", 0) >= 500

    def test_water_reflected_in_summary(self, new_user):
        r = requests.get(f"{API}/nutrition/today",
                         headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json().get("water_ml", 0) >= 500


# --- Weight (POST /api/weight/log + GET /api/weight/history) ---
class TestWeight:
    def test_log_and_history(self, new_user):
        r = requests.post(f"{API}/weight/log", json={"weight_kg": 79.5},
                          headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["log"]["weight_kg"] == 79.5

        r2 = requests.get(f"{API}/weight/history",
                          headers=_auth(new_user["token"]), timeout=15)
        assert r2.status_code == 200
        logs = r2.json()["logs"]
        assert len(logs) >= 1
        assert logs[-1]["weight_kg"] == 79.5


# --- Sleep (POST /api/sleep/log + GET /api/sleep/today) ---
class TestSleep:
    def test_log_and_today(self, new_user):
        r = requests.post(f"{API}/sleep/log", json={"hours": 7.5, "quality": "good"},
                          headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/sleep/today",
                          headers=_auth(new_user["token"]), timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("logged") is True
        assert float(d["hours"]) == 7.5


# --- Referrals (GET /api/referrals/me) ---
class TestReferrals:
    def test_referral_code(self, new_user):
        r = requests.get(f"{API}/referrals/me",
                         headers=_auth(new_user["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("code") and isinstance(d["code"], str) and d["code"].isalnum()
        assert d.get("commission_rate") == 0.20


# --- 401 without token ---
class TestAuthGuards:
    def test_meals_list_requires_auth(self):
        r = requests.get(f"{API}/meals/list", timeout=15)
        assert r.status_code == 401
