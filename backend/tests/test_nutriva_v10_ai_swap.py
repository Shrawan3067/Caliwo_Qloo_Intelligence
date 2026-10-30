"""Caliwo backend tests — iteration 10.

Focus: verify AI model swap (Claude Sonnet 4.5 coach + GPT-4o vision +
GPT-4o-mini recipe/plan + NEW OpenAI TTS /api/coach/speak) did not break
anything. Covers all endpoints listed in the review request.
"""
import base64
import io
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / "frontend" / ".env")
load_dotenv(ROOT_DIR / "backend" / ".env", override=False)

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")

TEST_EMAIL = f"e2e-v10-{uuid.uuid4().hex[:8]}@caliwo.example.com"
TEST_PASS = "Test@1234"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    r = session.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": TEST_EMAIL, "password": TEST_PASS, "name": "E2E V10"},
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    assert d.get("token") and d.get("user")
    return {
        "token": d["token"],
        "user_id": d["user"]["user_id"],
        "headers": {
            "Authorization": f"Bearer {d['token']}",
            "Content-Type": "application/json",
        },
    }


# ---------------- Auth ----------------
class TestAuth:
    def test_register_duplicate_400(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": TEST_EMAIL, "password": TEST_PASS},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_login_ok(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASS},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("token")

    def test_login_wrong_password_401(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "WRONG_password"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_me(self, session, auth):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=auth["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == TEST_EMAIL


# ---------------- Onboarding ----------------
class TestOnboarding:
    def test_save_and_read(self, session, auth):
        payload = {
            "sex": "female",
            "workouts_per_week": "3-5",
            "height_cm": 170,
            "weight_kg": 68,
            "goal": "lose",
            "desired_weight_kg": 62,
            "diet": "vegetarian",
            "daily_calories": 1900,
            "daily_protein_g": 130,
            "daily_carbs_g": 210,
            "daily_fat_g": 60,
        }
        r = session.post(
            f"{BASE_URL}/api/profile/onboarding",
            json=payload,
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200 and r.json().get("ok") is True
        r2 = session.get(
            f"{BASE_URL}/api/profile/me", headers=auth["headers"], timeout=15
        )
        assert r2.status_code == 200
        prof = r2.json().get("profile", {})
        assert prof.get("daily_calories") == 1900
        assert prof.get("goal") == "lose"
        assert prof.get("diet") == "vegetarian"


# ---------------- Vision: GPT-4o food recognition ----------------
def _make_jpeg_b64() -> str:
    """Try to fetch a small real JPEG (apple). Fallback to a tiny generated JPEG."""
    try:
        r = requests.get(
            "https://images.openfoodfacts.org/images/products/301/762/402/2003/front_en.3.400.jpg",
            timeout=10,
        )
        if r.status_code == 200 and r.content:
            return base64.b64encode(r.content).decode()
    except Exception:
        pass
    # Fallback: 8x8 red JPEG via PIL if available; else 1x1 pixel
    try:
        from PIL import Image  # type: ignore
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), (200, 30, 30)).save(buf, format="JPEG")
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return base64.b64encode(b"\xff\xd8\xff\xe0" + b"0" * 32 + b"\xff\xd9").decode()


class TestVision:
    def test_recognize_meal(self, session, auth):
        b64 = _make_jpeg_b64()
        r = session.post(
            f"{BASE_URL}/api/meals/recognize",
            json={"image_base64": b64},
            headers=auth["headers"],
            timeout=90,
        )
        assert r.status_code == 200, f"vision failed: {r.status_code} {r.text[:400]}"
        d = r.json()
        assert isinstance(d.get("foods"), list) and len(d["foods"]) >= 1
        assert "total_calories" in d and "confidence" in d and "title" in d


# ---------------- Coach: Claude Sonnet 4.5 ----------------
class TestCoach:
    session_id_holder: dict[str, str] = {}

    def test_coach_message_and_history(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/coach/message",
            json={"message": "Suggest a high-protein breakfast in under 30 words."},
            headers=auth["headers"],
            timeout=90,
        )
        assert r.status_code == 200, f"coach failed: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("reply") and isinstance(d["reply"], str) and len(d["reply"]) > 5
        assert d.get("session_id")
        self.session_id_holder["sid"] = d["session_id"]

    def test_coach_followup_and_history_recall(self, session, auth):
        sid = self.session_id_holder.get("sid")
        assert sid
        r = session.post(
            f"{BASE_URL}/api/coach/message",
            json={"message": "Make it dairy-free please.", "session_id": sid},
            headers=auth["headers"],
            timeout=90,
        )
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("reply")

        h = session.get(
            f"{BASE_URL}/api/coach/history",
            params={"session_id": sid},
            headers=auth["headers"],
            timeout=15,
        )
        assert h.status_code == 200
        msgs = h.json().get("messages", [])
        # 2 user + 2 assistant = 4 messages minimum
        assert len(msgs) >= 4
        roles = [m["role"] for m in msgs]
        assert roles.count("user") >= 2 and roles.count("assistant") >= 2

    def test_weekly_insight(self, session, auth):
        r = session.get(
            f"{BASE_URL}/api/coach/weekly-insight",
            headers=auth["headers"],
            timeout=90,
        )
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        # Endpoint should return some insight/string field even for sparse history
        assert isinstance(d, dict) and len(d) > 0


# ---------------- TTS: NEW /api/coach/speak ----------------
class TestTTS:
    def test_speak_shimmer_mp3(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/coach/speak",
            json={"text": "Hello, this is your Caliwo coach!", "voice": "shimmer"},
            headers=auth["headers"],
            timeout=60,
        )
        assert r.status_code == 200, f"tts failed: {r.status_code} {r.text[:300]}"
        ct = r.headers.get("content-type", "")
        assert "audio/mpeg" in ct.lower(), f"unexpected content-type: {ct}"
        assert len(r.content) > 1000, f"tts body too small: {len(r.content)}"
        # ID3 or MPEG frame sync
        assert r.content[:3] == b"ID3" or r.content[0] == 0xFF, "not an MP3 stream"
        assert r.headers.get("X-Voice", "shimmer") == "shimmer"

    def test_speak_empty_text_400(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/coach/speak",
            json={"text": "  "},
            headers=auth["headers"],
            timeout=30,
        )
        assert r.status_code == 400


# ---------------- Barcode ----------------
class TestBarcode:
    def test_nutella_ean(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/meals/barcode",
            json={"barcode": "3017620422003"},
            headers=auth["headers"],
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["barcode"] == "3017620422003"
        assert d.get("name")
        assert d.get("calories", 0) > 0
        assert "health_score" in d


# ---------------- Meals + nutrition aggregation ----------------
class TestMealsFlow:
    def test_log_list_today(self, session, auth):
        payload = {
            "title": "TEST_v10 salad",
            "meal_type": "lunch",
            "calories": 450,
            "protein_g": 30,
            "carbs_g": 40,
            "fat_g": 15,
            "portion": "1 bowl",
        }
        r = session.post(
            f"{BASE_URL}/api/meals/log", json=payload, headers=auth["headers"], timeout=15
        )
        assert r.status_code == 200
        meal_id = r.json()["meal"]["meal_id"]

        lst = session.get(
            f"{BASE_URL}/api/meals/list", headers=auth["headers"], timeout=15
        )
        assert lst.status_code == 200
        assert any(m["meal_id"] == meal_id for m in lst.json()["meals"])

        today = session.get(
            f"{BASE_URL}/api/nutrition/today", headers=auth["headers"], timeout=15
        )
        assert today.status_code == 200
        td = today.json()
        assert td["totals"]["calories"] >= 450
        assert td["goals"]["calories"] == 1900


# ---------------- Water + weight ----------------
class TestWaterWeight:
    def test_water(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/water/log",
            json={"ml": 600},
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["total_ml"] >= 600

    def test_weight_and_history(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/weight/log",
            json={"weight_kg": 67.8},
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200
        h = session.get(
            f"{BASE_URL}/api/weight/history", headers=auth["headers"], timeout=15
        )
        assert h.status_code == 200
        assert any(abs(w["weight_kg"] - 67.8) < 1e-6 for w in h.json()["logs"])


# ---------------- Recipes (GPT-4o-mini) ----------------
class TestRecipe:
    def test_generate(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/recipes/generate",
            json={
                "prompt": "quick high-protein vegetarian lunch",
                "meal_type": "lunch",
                "servings": 2,
            },
            headers=auth["headers"],
            timeout=90,
        )
        assert r.status_code == 200, f"recipe failed: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("recipe_id", "").startswith("rec_")
        assert d.get("title") and d.get("steps")
        assert isinstance(d.get("ingredients"), list) and len(d["ingredients"]) >= 1
        assert d.get("calories_per_serving", 0) > 0


# ---------------- Meal plan (GPT-4o-mini, days=3) ----------------
class TestMealPlan:
    def test_generate_3_days(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/meal-plans/generate",
            json={"days": 3, "focus": "high protein"},
            headers=auth["headers"],
            timeout=120,
        )
        assert r.status_code == 200, f"plan failed: {r.status_code} {r.text[:300]}"
        d = r.json()
        assert d.get("plan_id", "").startswith("mp_")
        assert isinstance(d.get("days"), list) and len(d["days"]) == 3
        # Each day should have at least 1 meal
        assert all(len(day.get("meals", [])) >= 1 for day in d["days"])


# ---------------- Subscription ----------------
class TestSubscription:
    def test_status_free(self, session, auth):
        r = session.get(
            f"{BASE_URL}/api/subscription/status",
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("is_pro") is False
        assert d.get("price_usd") == 9.99
