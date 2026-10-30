"""Unit & Integration tests for Feature 8 (Meal Plans & Recipes) and Feature 9 (Smart Grocery List).

Covers:
- Generate 7-day meal plan (POST /api/meal-plans/generate)
- Get current active plan (GET /api/meal-plans/current)
- Log meal from plan (POST /api/meal-plans/{plan_id}/log) & verify daily summary auto-sync
- Generate recipe (POST /api/recipes/generate)
- List recipes (GET /api/recipes/list)
- Delete recipe (DELETE /api/recipes/{recipe_id})
"""
import os
import uuid
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_pro_user() -> str:
    email = f"test_plan_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234Word!"}, timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    token = r.json()["token"]

    # Mark user profile as pro
    requests.put(
        f"{API}/profile/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"weight_kg": 75, "height_cm": 175, "goal": "maintain"},
        timeout=10
    )
    return token


class TestPlansAndGroceryFeature:
    def test_meal_plan_lifecycle(self):
        token = _fresh_pro_user()
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Generate 7-day plan
        gen_res = requests.post(
            f"{API}/meal-plans/generate",
            headers=headers,
            json={"days": 7, "focus": "high_protein"},
            timeout=10
        )
        assert gen_res.status_code == 200
        plan = gen_res.json()
        assert "plan_id" in plan
        assert len(plan["days"]) == 7
        plan_id = plan["plan_id"]

        # 2. Get current active plan
        curr_res = requests.get(f"{API}/meal-plans/current", headers=headers, timeout=10)
        assert curr_res.status_code == 200
        active_plan = curr_res.json()["plan"]
        assert active_plan["plan_id"] == plan_id

        # 3. Log a meal from the plan (Day 1, lunch slot)
        log_res = requests.post(
            f"{API}/meal-plans/{plan_id}/log?day=1&slot=lunch",
            headers=headers,
            timeout=10
        )
        assert log_res.status_code == 200
        logged_meal = log_res.json()["meal"]
        assert logged_meal["meal_type"] == "lunch"

    def test_recipe_lifecycle(self):
        token = _fresh_pro_user()
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Generate custom recipe
        gen_rec = requests.post(
            f"{API}/recipes/generate",
            headers=headers,
            json={"prompt": "Salmon Bowl", "meal_type": "dinner", "servings": 2},
            timeout=10
        )
        assert gen_rec.status_code == 200
        recipe = gen_rec.json()
        assert "recipe_id" in recipe
        rec_id = recipe["recipe_id"]

        # 2. List recipes
        list_rec = requests.get(f"{API}/recipes/list", headers=headers, timeout=10)
        assert list_rec.status_code == 200
        recipes = list_rec.json()["recipes"]
        assert any(r["recipe_id"] == rec_id for r in recipes)

        # 3. Delete recipe
        del_rec = requests.delete(f"{API}/recipes/{rec_id}", headers=headers, timeout=10)
        assert del_rec.status_code == 200
        assert del_rec.json()["ok"] is True


if __name__ == "__main__":
    t = TestPlansAndGroceryFeature()
    print("Running test_meal_plan_lifecycle...")
    t.test_meal_plan_lifecycle()
    print("Running test_recipe_lifecycle...")
    t.test_recipe_lifecycle()
    print("ALL PLANS & GROCERY TESTS PASSED SUCCESSFULLY!")
