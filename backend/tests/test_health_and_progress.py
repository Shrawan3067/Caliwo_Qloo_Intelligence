"""Unit & Integration tests for Features 11-14 (Steps, Sleep, Water, Progress & Weight).

Covers:
- POST /api/water/log (Water intake tracking)
- POST /api/weight/log & GET /api/weight/history (Weight progress logs)
- POST /api/steps/sync & GET /api/steps/today (HealthKit & Health Connect step sync)
- POST /api/sleep/log & GET /api/sleep/today (Sleep hours and quality logging)
"""
import os
import uuid
import datetime
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_user() -> str:
    email = f"test_health_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234Word!"}, timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    return r.json()["token"]


class TestHealthAndProgressFeatures:
    def test_water_logging_flow(self):
        token = _fresh_user()
        headers = {"Authorization": f"Bearer {token}"}

        # Log 250ml
        w1 = requests.post(f"{API}/water/log", headers=headers, json={"ml": 250}, timeout=10)
        assert w1.status_code == 200
        assert w1.json()["total_ml"] == 250

        # Log 500ml
        w2 = requests.post(f"{API}/water/log", headers=headers, json={"ml": 500}, timeout=10)
        assert w2.status_code == 200
        assert w2.json()["total_ml"] == 750

    def test_weight_progress_flow(self):
        token = _fresh_user()
        headers = {"Authorization": f"Bearer {token}"}

        # Set user profile height and goal via onboarding
        onb_res = requests.post(
            f"{API}/profile/onboarding",
            headers=headers,
            json={"height_cm": 180.0, "desired_weight_kg": 70.0, "weight_kg": 75.0, "goal": "lose"},
            timeout=10
        )
        assert onb_res.status_code == 200

        # 1. Log weight in kg
        log_res = requests.post(f"{API}/weight/log", headers=headers, json={"weight_kg": 75.0, "notes": "Morning check"}, timeout=10)
        assert log_res.status_code == 200
        data = log_res.json()
        assert data["weight_kg"] == 75.0
        assert data["weight_lbs"] == 165.3
        assert data["bmi"] == 23.1
        assert data["bmi_category"] == "Normal weight"
        assert data["diff_to_goal_kg"] == 5.0

        # 2. Log weight in lbs (160 lbs ~ 72.57 kg)
        log_res2 = requests.post(f"{API}/weight/log", headers=headers, json={"weight": 160.0, "unit": "lbs"}, timeout=10)
        assert log_res2.status_code == 200
        data2 = log_res2.json()
        assert data2["weight_kg"] == 72.57

        # 3. Set weight goal
        goal_res = requests.post(f"{API}/weight/goal", headers=headers, json={"goal_weight_kg": 68.0}, timeout=10)
        assert goal_res.status_code == 200
        assert goal_res.json()["goal_weight_kg"] == 68.0

        # 4. Get history and check stats
        hist_res = requests.get(f"{API}/weight/history", headers=headers, timeout=10)
        assert hist_res.status_code == 200
        hist_data = hist_res.json()
        assert len(hist_data["history"]) >= 1
        assert hist_data["stats"]["current_weight_kg"] == 72.57
        assert hist_data["stats"]["goal_weight_kg"] == 68.0

        # 5. Invalid weight validation
        invalid_res = requests.post(f"{API}/weight/log", headers=headers, json={"weight_kg": 10.0}, timeout=10)
        assert invalid_res.status_code == 400

        # 6. Delete weight log
        today_str = datetime.datetime.utcnow().date().isoformat()
        del_res = requests.delete(f"{API}/weight/log?date={today_str}", headers=headers, timeout=10)
        assert del_res.status_code == 200
        assert del_res.json()["ok"] is True

    def test_steps_sync_and_today(self):
        token = _fresh_user()
        headers = {"Authorization": f"Bearer {token}"}
        today_str = datetime.datetime.utcnow().date().isoformat()

        # Sync steps
        sync_res = requests.post(
            f"{API}/steps/sync",
            headers=headers,
            json={
                "source": "HealthKit",
                "entries": [{"date": today_str, "steps": 8500, "distance_m": 6375.0, "calories": 340.0}]
            },
            timeout=10
        )
        assert sync_res.status_code == 200
        assert sync_res.json()["synced"] == 1

        # Get steps today
        today_res = requests.get(f"{API}/steps/today?date={today_str}", headers=headers, timeout=10)
        assert today_res.status_code == 200
        step_data = today_res.json()
        assert step_data["steps"] == 8500
        assert step_data["source"] == "HealthKit"

    def test_sleep_logging_flow(self):
        token = _fresh_user()
        headers = {"Authorization": f"Bearer {token}"}
        today_str = datetime.datetime.utcnow().date().isoformat()

        # Log sleep
        sleep_log = requests.post(
            f"{API}/sleep/log",
            headers=headers,
            json={"hours": 7.5, "quality": "deep", "date": today_str},
            timeout=10
        )
        assert sleep_log.status_code == 200
        assert sleep_log.json()["sleep_hours"] == 7.5

        # Get sleep today
        sleep_today = requests.get(f"{API}/sleep/today?date={today_str}", headers=headers, timeout=10)
        assert sleep_today.status_code == 200
        data = sleep_today.json()
        assert data["hours"] == 7.5
        assert data["quality"] == "deep"
        assert data["logged"] is True


if __name__ == "__main__":
    t = TestHealthAndProgressFeatures()
    print("Running test_water_logging_flow...")
    t.test_water_logging_flow()
    print("Running test_weight_progress_flow...")
    t.test_weight_progress_flow()
    print("Running test_steps_sync_and_today...")
    t.test_steps_sync_and_today()
    print("Running test_sleep_logging_flow...")
    t.test_sleep_logging_flow()
    print("ALL HEALTH & PROGRESS TESTS PASSED SUCCESSFULLY!")
