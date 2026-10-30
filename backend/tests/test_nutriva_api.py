"""Caliwo backend integration tests."""
import base64
import os
import time
import uuid
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

TEST_EMAIL_BASE = os.environ.get("CALIWO_TEST_EMAIL", "caliwo.test@example.com")
TEST_PASSWORD = os.environ.get("CALIWO_TEST_PASSWORD", "Caliwo#Test2026")

# Unique test user per run so re-runs don't collide
UNIQUE_EMAIL = f"caliwo.test+{uuid.uuid4().hex[:8]}@example.com"

FOOD_IMAGE_PATH = Path("/tmp/food.jpg")


@pytest.fixture(scope="session")
def food_b64():
    if not FOOD_IMAGE_PATH.exists():
        FOOD_IMAGE_PATH.write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9")
    return base64.b64encode(FOOD_IMAGE_PATH.read_bytes()).decode()


@pytest.fixture(scope="session")
def auth():
    """Register a fresh user; return {token, user}."""
    r = requests.post(f"{API}/auth/register", json={
        "email": UNIQUE_EMAIL,
        "password": TEST_PASSWORD,
        "name": "Caliwo Tester",
    }, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == UNIQUE_EMAIL
    return data


@pytest.fixture(scope="session")
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_health():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
def test_register_duplicate_rejected(auth):
    r = requests.post(f"{API}/auth/register", json={
        "email": UNIQUE_EMAIL, "password": TEST_PASSWORD, "name": "Dup"
    }, timeout=15)
    assert r.status_code == 400


def test_login_valid(auth):
    r = requests.post(f"{API}/auth/login", json={
        "email": UNIQUE_EMAIL, "password": TEST_PASSWORD,
    }, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "token" in d and d["user"]["email"] == UNIQUE_EMAIL


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={
        "email": UNIQUE_EMAIL, "password": "wrongpass",
    }, timeout=15)
    assert r.status_code == 401


def test_auth_me(headers, auth):
    r = requests.get(f"{API}/auth/me", headers=headers, timeout=15)
    assert r.status_code == 200
    u = r.json()
    assert u["email"] == UNIQUE_EMAIL
    assert u["user_id"] == auth["user"]["user_id"]


def test_auth_me_requires_token():
    r = requests.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 401


def test_auth_me_bad_token():
    r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"}, timeout=10)
    assert r.status_code == 401


# ---------- Onboarding + profile ----------
def test_onboarding_save_and_fetch(headers):
    payload = {
        "sex": "Male", "workouts_per_week": "3-5", "height_cm": 178,
        "weight_kg": 82, "date_of_birth": "1993-05-04", "works_with_coach": False,
        "goal": "lose", "desired_weight_kg": 75, "target_speed": "recommended",
        "obstacles": ["Busy schedule"], "diet": "none",
        "accomplishments": ["Eat and live healthier"],
        "add_burned_back": True, "rollover_calories": False, "committed": True,
        "daily_calories": 2100, "daily_protein_g": 150,
        "daily_carbs_g": 220, "daily_fat_g": 65,
        "plan_deadline": "2026-04-01",
    }
    r = requests.post(f"{API}/profile/onboarding", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    r2 = requests.get(f"{API}/profile/me", headers=headers, timeout=15)
    assert r2.status_code == 200
    d = r2.json()
    assert d["profile"]["daily_calories"] == 2100
    assert d["profile"]["goal"] == "lose"
    assert d["user"]["onboarded"] is True


# ---------- Meal recognition (Gemini) ----------
def test_meal_recognize(headers, food_b64):
    r = requests.post(f"{API}/meals/recognize",
                      json={"image_base64": f"data:image/jpeg;base64,{food_b64}"},
                      headers=headers, timeout=90)
    assert r.status_code == 200, f"recognize failed {r.status_code}: {r.text[:500]}"
    d = r.json()
    for k in ["foods", "total_calories", "total_protein_g", "total_carbs_g", "total_fat_g", "confidence", "title"]:
        assert k in d, f"missing key {k}"
    assert isinstance(d["foods"], list) and len(d["foods"]) >= 1
    f0 = d["foods"][0]
    for k in ["name", "portion", "calories", "protein_g", "carbs_g", "fat_g"]:
        assert k in f0
    assert d["total_calories"] > 0
    assert 0 <= d["confidence"] <= 1


def test_meal_recognize_requires_auth(food_b64):
    r = requests.post(f"{API}/meals/recognize",
                      json={"image_base64": food_b64}, timeout=15)
    assert r.status_code == 401


# ---------- Meal CRUD ----------
_MEAL_ID = {"id": None}


def test_meal_log(headers):
    payload = {"title": "TEST_Pizza", "meal_type": "lunch", "calories": 640,
               "protein_g": 26, "carbs_g": 70, "fat_g": 24, "portion": "1 slice"}
    r = requests.post(f"{API}/meals/log", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["meal"]["title"] == "TEST_Pizza"
    assert d["meal"]["meal_id"].startswith("meal_")
    _MEAL_ID["id"] = d["meal"]["meal_id"]


def test_meal_list_contains(headers):
    r = requests.get(f"{API}/meals/list", headers=headers, timeout=15)
    assert r.status_code == 200
    ids = [m["meal_id"] for m in r.json()["meals"]]
    assert _MEAL_ID["id"] in ids


def test_nutrition_today(headers):
    r = requests.get(f"{API}/nutrition/today", headers=headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["totals"]["calories"] >= 640
    assert d["goals"]["calories"] == 2100  # from onboarding
    assert "water_ml" in d


def test_meal_delete(headers):
    mid = _MEAL_ID["id"]
    assert mid
    r = requests.delete(f"{API}/meals/{mid}", headers=headers, timeout=15)
    assert r.status_code == 200 and r.json()["ok"] is True

    r2 = requests.get(f"{API}/meals/list", headers=headers, timeout=15)
    ids = [m["meal_id"] for m in r2.json()["meals"]]
    assert mid not in ids


# ---------- Water ----------
def test_water_log_increments(headers):
    r1 = requests.post(f"{API}/water/log", json={"ml": 250}, headers=headers, timeout=15)
    assert r1.status_code == 200
    t1 = r1.json()["total_ml"]
    r2 = requests.post(f"{API}/water/log", json={"ml": 250}, headers=headers, timeout=15)
    assert r2.status_code == 200
    t2 = r2.json()["total_ml"]
    assert t2 == t1 + 250, f"expected increment: {t1} -> {t2}"


# ---------- Weight ----------
def test_weight_log_and_history(headers):
    r = requests.post(f"{API}/weight/log", json={"weight_kg": 81.5}, headers=headers, timeout=15)
    assert r.status_code == 200
    time.sleep(0.5)
    r2 = requests.post(f"{API}/weight/log", json={"weight_kg": 81.2}, headers=headers, timeout=15)
    assert r2.status_code == 200
    r3 = requests.get(f"{API}/weight/history", headers=headers, timeout=15)
    assert r3.status_code == 200
    logs = r3.json()["logs"]
    assert len(logs) >= 2
    weights = [w["weight_kg"] for w in logs]
    assert 81.5 in weights and 81.2 in weights
    # sorted ascending by logged_at
    ts = [w["logged_at"] for w in logs]
    assert ts == sorted(ts)


# ---------- Coach ----------
def test_coach_message_and_history(headers):
    r = requests.post(f"{API}/coach/message",
                      json={"message": "Suggest a high-protein breakfast under 400 calories."},
                      headers=headers, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d.get("reply"), str) and len(d["reply"]) > 5
    sid = d["session_id"]

    r2 = requests.get(f"{API}/coach/history", params={"session_id": sid}, headers=headers, timeout=15)
    assert r2.status_code == 200
    msgs = r2.json()["messages"]
    roles = [m["role"] for m in msgs]
    assert "user" in roles and "assistant" in roles


# ---------- Auth guard ----------
@pytest.mark.parametrize("path,method,body", [
    ("/profile/me", "GET", None),
    ("/profile/onboarding", "POST", {}),
    ("/meals/list", "GET", None),
    ("/meals/log", "POST", {"title": "x", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}),
    ("/nutrition/today", "GET", None),
    ("/water/log", "POST", {"ml": 100}),
    ("/weight/log", "POST", {"weight_kg": 70}),
    ("/weight/history", "GET", None),
    ("/coach/history", "GET", None),
])
def test_auth_required(path, method, body):
    fn = requests.get if method == "GET" else requests.post
    r = fn(f"{API}{path}", json=body, timeout=15)
    assert r.status_code == 401


# ---------- Logout ----------
def test_logout(headers):
    r = requests.post(f"{API}/auth/logout", headers=headers, timeout=15)
    assert r.status_code == 200 and r.json().get("ok") is True
