"""Caliwo v2 backend tests — barcode + voice endpoints."""
import io
import os
import uuid
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "http://localhost:8000",
).rstrip("/")
API = f"{BASE_URL}/api"

TEST_PASSWORD = os.environ.get("CALIWO_TEST_PASSWORD", "Caliwo#Test2026")
UNIQUE_EMAIL = f"caliwo.v2+{uuid.uuid4().hex[:8]}@example.com"

VOICE_MP3_PATH = Path("/tmp/caliwo_voice_test.mp3")


# --------------- fixtures ---------------
@pytest.fixture(scope="session")
def auth():
    r = requests.post(
        f"{API}/auth/register",
        json={"email": UNIQUE_EMAIL, "password": TEST_PASSWORD, "name": "V2 Tester"},
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data


@pytest.fixture(scope="session")
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}"}


@pytest.fixture(scope="session")
def voice_mp3():
    """Generate a short MP3 with gTTS if missing, or create a dummy mp3."""
    if not VOICE_MP3_PATH.exists():
        try:
            from gtts import gTTS
            tts = gTTS(
                text=(
                    "I had two eggs, a slice of whole wheat toast with butter, "
                    "and a small glass of orange juice for breakfast."
                ),
                lang="en",
            )
            tts.save(str(VOICE_MP3_PATH))
        except Exception:
            VOICE_MP3_PATH.write_bytes(b"\xff\xfb\x90\xc4" + b"\x00" * 2000)
    assert VOICE_MP3_PATH.exists() and VOICE_MP3_PATH.stat().st_size > 100
    return VOICE_MP3_PATH


# =========== BARCODE ENDPOINT ===========
class TestBarcode:
    def test_barcode_requires_auth(self):
        r = requests.post(
            f"{API}/meals/barcode",
            json={"barcode": "3017624010701"},
            timeout=20,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_barcode_valid_nutella(self, headers):
        r = requests.post(
            f"{API}/meals/barcode",
            json={"barcode": "3017624010701"},
            headers=headers,
            timeout=25,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        d = r.json()
        # Required fields per PRD
        for key in [
            "barcode",
            "name",
            "brand",
            "image_url",
            "serving_g",
            "calories",
            "protein_g",
            "carbs_g",
            "fat_g",
            "allergens",
            "additives",
            "nutrition_grade",
            "health_score",
        ]:
            assert key in d, f"missing key {key} in barcode response: {d}"
        assert d["barcode"] == "3017624010701"
        assert "nutella" in (d.get("name") or "").lower(), f"name should contain Nutella: {d['name']}"
        assert isinstance(d["allergens"], list)
        assert isinstance(d["additives"], list)
        # Nutella is generally graded 'e'
        assert d["nutrition_grade"] in {"a", "b", "c", "d", "e", None}
        assert d["calories"] > 0
        # Optional but common
        assert d.get("serving_g", 0) > 0

    def test_parse_serving_grams(self):
        from routers.meals import parse_serving_grams
        # Test peanut butter 2 tbsp (32 g) with serving_quantity=100 (common OpenFoodFacts case)
        assert parse_serving_grams("2 tbsp (32 g)", 100) == 32.0
        assert parse_serving_grams("2 tbsp (32g)", None) == 32.0
        assert parse_serving_grams("32 g", 100) == 32.0
        assert parse_serving_grams("32g", 100) == 32.0
        assert parse_serving_grams("1 serving (33 g)", 33) == 33.0
        assert parse_serving_grams("100 g", 100) == 100.0
        assert parse_serving_grams(None, 100) == 100.0

    def test_barcode_not_found(self, headers):
        r = requests.post(
            f"{API}/meals/barcode",
            json={"barcode": "0000000000000"},
            headers=headers,
            timeout=25,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"
        d = r.json()
        assert "Product not found" in d.get("detail", ""), d

    def test_barcode_invalid_non_digits(self, headers):
        r = requests.post(
            f"{API}/meals/barcode",
            json={"barcode": "abc"},
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_barcode_invalid_empty(self, headers):
        r = requests.post(
            f"{API}/meals/barcode",
            json={"barcode": ""},
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_barcode_can_be_logged_as_meal(self, headers):
        """Combine barcode result → POST /api/meals/log."""
        r = requests.post(
            f"{API}/meals/barcode",
            json={"barcode": "3017624010701"},
            headers=headers,
            timeout=25,
        )
        assert r.status_code == 200
        p = r.json()
        log_payload = {
            "title": f"TEST_{p['name']}",
            "meal_type": "snack",
            "calories": p["calories"],
            "protein_g": p["protein_g"],
            "carbs_g": p["carbs_g"],
            "fat_g": p["fat_g"],
            "portion": f"{p['serving_g']} g",
        }
        lg = requests.post(
            f"{API}/meals/log",
            json=log_payload,
            headers={**headers, "Content-Type": "application/json"},
            timeout=15,
        )
        assert lg.status_code == 200, lg.text
        j = lg.json()
        assert j.get("ok") is True
        assert j["meal"]["title"].startswith("TEST_")
        assert j["meal"]["calories"] == log_payload["calories"]


# =========== VOICE ENDPOINT ===========
class TestVoice:
    def test_voice_requires_auth(self, voice_mp3):
        with open(voice_mp3, "rb") as fh:
            r = requests.post(
                f"{API}/meals/voice",
                files={"file": ("test.mp3", fh, "audio/mpeg")},
                timeout=60,
            )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_voice_no_file_returns_422(self, headers):
        r = requests.post(f"{API}/meals/voice", headers=headers, timeout=15)
        # FastAPI validation error is 422; endpoint also accepts 400 per spec
        assert r.status_code in (400, 422), f"got {r.status_code}: {r.text}"

    def test_voice_full_flow_returns_meal(self, headers, voice_mp3):
        with open(voice_mp3, "rb") as fh:
            r = requests.post(
                f"{API}/meals/voice",
                files={"file": ("test.mp3", fh, "audio/mpeg")},
                headers=headers,
                timeout=90,
            )
        # Allow a single retry with a longer clip if it fails on transcription
        if r.status_code != 200:
            try:
                from gtts import gTTS
                long_path = Path("/tmp/caliwo_voice_long.mp3")
                gTTS(
                    text=(
                        "For lunch today I ate a grilled chicken breast, "
                        "about one cup of brown rice, half an avocado, "
                        "and a large mixed green salad with olive oil dressing."
                    ),
                    lang="en",
                ).save(str(long_path))
                with open(long_path, "rb") as fh2:
                    r = requests.post(
                        f"{API}/meals/voice",
                        files={"file": ("test.mp3", fh2, "audio/mpeg")},
                        headers=headers,
                        timeout=120,
                    )
            except Exception:
                pass
        assert r.status_code == 200, f"voice failed: {r.status_code} {r.text}"
        d = r.json()
        for key in ["foods", "total_calories", "total_protein_g", "total_carbs_g", "total_fat_g", "confidence", "title"]:
            assert key in d, f"missing {key} in {d}"
        assert isinstance(d["foods"], list) and len(d["foods"]) >= 1, f"no foods parsed: {d}"
        assert d["total_calories"] > 0, f"expected calories > 0: {d}"
        assert d["confidence"] > 0

    def test_voice_result_can_be_logged(self, headers, voice_mp3):
        with open(voice_mp3, "rb") as fh:
            r = requests.post(
                f"{API}/meals/voice",
                files={"file": ("test.mp3", fh, "audio/mpeg")},
                headers=headers,
                timeout=90,
            )
        if r.status_code != 200:
            pytest.skip(f"voice endpoint not returning 200 for combined-log test: {r.status_code}")
        d = r.json()
        log_payload = {
            "title": f"TEST_voice_{d.get('title', 'meal')[:40]}",
            "meal_type": "lunch",
            "calories": d["total_calories"],
            "protein_g": d["total_protein_g"],
            "carbs_g": d["total_carbs_g"],
            "fat_g": d["total_fat_g"],
            "foods": [f for f in d["foods"]],
        }
        lg = requests.post(
            f"{API}/meals/log",
            json=log_payload,
            headers={**headers, "Content-Type": "application/json"},
            timeout=15,
        )
        assert lg.status_code == 200, lg.text
        assert lg.json().get("ok") is True
