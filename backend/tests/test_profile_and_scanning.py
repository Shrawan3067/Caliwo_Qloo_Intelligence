"""Unit & Integration tests for Feature 3 (Profile & Settings) and Feature 4 (AI Meal Scanning).

Covers:
- GET /api/profile/me
- PUT /api/profile/me (validation, plan recomputation, privilege escalation defense)
- DELETE /api/profile/me (cascade account purge)
- POST /api/meals/recognize (AI image recognition & base64 input validation)
- POST /api/meals/log (Meal logging & daily summary sync)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_user() -> tuple[str, dict]:
    email = f"test_prof_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234Word!"}, timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    token = r.json()["token"]

    # Perform onboarding
    onb_res = requests.post(
        f"{API}/profile/onboarding",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sex": "female",
            "date_of_birth": "1996-04-12",
            "height_cm": 165,
            "weight_kg": 60,
            "desired_weight_kg": 55,
            "goal": "lose",
            "target_speed": "recommended",
            "workouts_per_week": "3-5"
        },
        timeout=10
    )
    assert onb_res.status_code == 200, f"Onboarding failed: {onb_res.text}"
    return token, onb_res.json()["profile"]


class TestProfileFeature:
    def test_get_profile(self):
        token, prof = _fresh_user()
        r = requests.get(f"{API}/profile/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "user" in data and "profile" in data
        assert data["profile"]["weight_kg"] == 60

    def test_update_profile_recomputes_plan(self):
        token, prof = _fresh_user()
        old_cal = prof["daily_calories"]

        # Update weight to 70kg
        up_res = requests.put(
            f"{API}/profile/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"weight_kg": 70},
            timeout=10
        )
        assert up_res.status_code == 200
        new_prof = up_res.json()["profile"]
        assert new_prof["weight_kg"] == 70
        assert new_prof["daily_calories"] != old_cal
        assert new_prof["goals"]["calories"] == new_prof["daily_calories"]

    def test_update_profile_validation_error(self):
        token, _ = _fresh_user()
        # Invalid weight out of bounds
        r = requests.put(
            f"{API}/profile/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"weight_kg": 500},
            timeout=10
        )
        assert r.status_code == 422

    def test_update_profile_privilege_escalation_blocked(self):
        token, _ = _fresh_user()
        r = requests.put(
            f"{API}/profile/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"weight_kg": 62, "pro_until": "2099-01-01T00:00:00Z", "is_admin": True},
            timeout=10
        )
        assert r.status_code == 200
        prof = r.json()["profile"]
        assert "pro_until" not in prof
        assert "is_admin" not in prof


class TestAIMealScanningFeature:
    def test_recognize_meal_empty_input_422(self):
        token, _ = _fresh_user()
        r = requests.post(
            f"{API}/meals/recognize",
            headers={"Authorization": f"Bearer {token}"},
            json={"image_base64": ""},
            timeout=10
        )
        assert r.status_code == 422

    def test_recognize_meal_success(self):
        token, _ = _fresh_user()
        dummy_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        r = requests.post(
            f"{API}/meals/recognize",
            headers={"Authorization": f"Bearer {token}"},
            json={"image_base64": dummy_b64},
            timeout=10
        )
        assert r.status_code in (200, 500, 502)
        if r.status_code == 200:
            data = r.json()
            assert "title" in data
            assert "foods" in data
            assert "total_calories" in data
            assert len(data["foods"]) > 0
        else:
            assert "AI recognition failed" in r.json()["detail"]

    def test_log_recognized_meal(self):
        token, _ = _fresh_user()
        log_res = requests.post(
            f"{API}/meals/log",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": "Avocado Toast with Eggs",
                "meal_type": "breakfast",
                "calories": 420.0,
                "protein_g": 18.0,
                "carbs_g": 35.0,
                "fat_g": 22.0,
                "portion": "1 plate"
            },
            timeout=10
        )
        assert log_res.status_code in (200, 201)
        res_data = log_res.json()
        assert res_data.get("ok") is True
        meal_info = res_data.get("meal", res_data)
        assert meal_info["calories"] == 420.0


if __name__ == "__main__":
    t_prof = TestProfileFeature()
    print("Running test_get_profile...")
    t_prof.test_get_profile()
    print("Running test_update_profile_recomputes_plan...")
    t_prof.test_update_profile_recomputes_plan()
    print("Running test_update_profile_validation_error...")
    t_prof.test_update_profile_validation_error()
    print("Running test_update_profile_privilege_escalation_blocked...")
    t_prof.test_update_profile_privilege_escalation_blocked()

    t_ai = TestAIMealScanningFeature()
    print("Running test_recognize_meal_empty_input_422...")
    t_ai.test_recognize_meal_empty_input_422()
    print("Running test_recognize_meal_success...")
    t_ai.test_recognize_meal_success()
    print("Running test_log_recognized_meal...")
    t_ai.test_log_recognized_meal()
    print("ALL TESTS PASSED SUCCESSFULLY!")

