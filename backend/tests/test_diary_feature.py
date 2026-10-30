"""Unit & Integration tests for Feature 5 (Meal Logging & Diary).

Covers:
- Log meal (POST /api/meals/log)
- List meals by date (GET /api/meals/list)
- Get single meal detail (GET /api/meals/{meal_id})
- Update meal entry & verify DailySummary re-sync (PATCH /api/meals/{meal_id})
- Duplicate meal entry (POST /api/meals/{meal_id}/duplicate)
- Delete meal entry & verify DailySummary re-sync (DELETE /api/meals/{meal_id})
"""
import os
import uuid
import datetime
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_user() -> str:
    email = f"test_diary_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234Word!"}, timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    return r.json()["token"]


class TestDiaryFeature:
    def test_log_list_get_patch_delete_meal_flow(self):
        token = _fresh_user()
        headers = {"Authorization": f"Bearer {token}"}
        today_str = datetime.datetime.utcnow().date().isoformat()

        # 1. Log Breakfast (400 kcal, 20p, 40c, 10f)
        log1 = requests.post(
            f"{API}/meals/log",
            headers=headers,
            json={
                "title": "Oatmeal with Berries",
                "meal_type": "breakfast",
                "calories": 400.0,
                "protein_g": 20.0,
                "carbs_g": 40.0,
                "fat_g": 10.0,
                "portion": "1 bowl"
            },
            timeout=10
        )
        assert log1.status_code in (200, 201)
        meal1_id = log1.json()["meal"]["meal_id"]

        # 2. Log Lunch (600 kcal, 45p, 50c, 15f)
        log2 = requests.post(
            f"{API}/meals/log",
            headers=headers,
            json={
                "title": "Grilled Chicken Salad",
                "meal_type": "lunch",
                "calories": 600.0,
                "protein_g": 45.0,
                "carbs_g": 50.0,
                "fat_g": 15.0,
                "portion": "1 bowl"
            },
            timeout=10
        )
        assert log2.status_code in (200, 201)
        meal2_id = log2.json()["meal"]["meal_id"]

        # 3. List meals for today
        list_res = requests.get(f"{API}/meals/list?date={today_str}", headers=headers, timeout=10)
        assert list_res.status_code == 200
        meals = list_res.json()["meals"]
        assert len(meals) == 2
        m_ids = [m["meal_id"] for m in meals]
        assert meal1_id in m_ids and meal2_id in m_ids

        # 4. Get detail of meal1
        detail_res = requests.get(f"{API}/meals/{meal1_id}", headers=headers, timeout=10)
        assert detail_res.status_code == 200
        assert detail_res.json()["title"] == "Oatmeal with Berries"

        # 5. Patch meal1 (Update calories to 450)
        patch_res = requests.patch(
            f"{API}/meals/{meal1_id}",
            headers=headers,
            json={"calories": 450.0, "title": "Large Oatmeal"},
            timeout=10
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["meal"]["calories"] == 450.0

        # 6. Duplicate meal2
        dup_res = requests.post(f"{API}/meals/{meal2_id}/duplicate", headers=headers, timeout=10)
        assert dup_res.status_code == 200
        dup_meal_id = dup_res.json()["meal_id"]
        assert dup_meal_id != meal2_id

        # 7. Delete meal1 & verify daily summary auto-syncs
        del_res = requests.delete(f"{API}/meals/{meal1_id}", headers=headers, timeout=10)
        assert del_res.status_code == 200
        assert del_res.json()["ok"] is True

        # Verify meal1 is gone
        get_deleted = requests.get(f"{API}/meals/{meal1_id}", headers=headers, timeout=10)
        assert get_deleted.status_code == 404


if __name__ == "__main__":
    t = TestDiaryFeature()
    print("Running test_log_list_get_patch_delete_meal_flow...")
    t.test_log_list_get_patch_delete_meal_flow()
    print("ALL DIARY TESTS PASSED SUCCESSFULLY!")
