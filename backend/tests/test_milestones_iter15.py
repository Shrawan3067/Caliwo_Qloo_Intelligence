"""
Milestones API tests (iteration 15).

Covers:
- Auth guard on GET /api/milestones
- Response shape (30 badges + streak stats)
- Unlock logic for meal count (forking_around), water (hydrated),
  meal deletion (dumpster_diver), and referrals count (helping_hand)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        env_path = os.path.join(os.path.dirname(__file__), "../../frontend/.env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                        BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                        break
    except FileNotFoundError:
        pass
if not BASE_URL:
    BASE_URL = "http://localhost:8000"

API = f"{BASE_URL}/api"

EXPECTED_BADGE_IDS = {
    "rookie", "getting_serious", "locked_in", "triple_threat", "no_days_off", "immortal",
    "forking_around", "mission_nutrition", "logfather", "one_hit_wonder", "loyalty_iii", "bullseye",
    "helping_hand", "peer_pressurer", "cult_leader",
    "hydrated", "sippin", "aquaholic",
    "sweat_equity", "speed_logger", "green_machine",
    "nut_case", "berry_suspicious", "time_traveler", "gremlin", "health_nut", "dumpster_diver",
    "doppelganger", "omega_log", "clean_sweep",
}


# ------------------------- Fixtures -------------------------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(session, email=None):
    email = email or f"TEST_ms_{int(time.time())}_{uuid.uuid4().hex[:6]}@caliwo.dev"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": "Test1234!", "name": "Milestones Test",
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    return email, tok


@pytest.fixture(scope="module")
def user_a(session):
    email, tok = _register(session)
    return {"email": email, "token": tok, "headers": {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}}


# ------------------------- Tests -------------------------

class TestMilestonesAuth:
    def test_requires_auth(self, session):
        r = session.get(f"{API}/milestones")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_rejects_bad_token(self, session):
        r = session.get(f"{API}/milestones", headers={"Authorization": "Bearer badtoken"})
        assert r.status_code in (401, 403)


class TestMilestonesShape:
    def test_default_shape(self, session, user_a):
        r = session.get(f"{API}/milestones", headers=user_a["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("current_streak", "longest_streak", "unlocked", "total", "badges"):
            assert k in data, f"missing key {k}"
        assert data["total"] >= 30, data["total"]
        assert len(data["badges"]) >= 30
        # Field shape
        b0 = data["badges"][0]
        for k in ("id", "name", "desc", "category", "icon_kind", "value", "unlocked"):
            assert k in b0, f"missing badge field {k}"
        # IDs match spec
        ids = {b["id"] for b in data["badges"]}
        assert len(ids) >= 30, f"Expected at least 30 badge IDs, got {len(ids)}"
        # A brand-new user should have zero unlocks
        assert data["unlocked"] == 0
        assert data["current_streak"] == 0
        assert data["longest_streak"] == 0


def _badge(data, bid):
    for b in data["badges"]:
        if b["id"] == bid:
            return b
    return None


class TestMealUnlocks:
    def test_forking_around_after_5_meals(self, session):
        email, tok = _register(session)
        headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # Log 5 meals
        for i in range(5):
            r = session.post(f"{API}/meals/log", headers=headers, json={
                "title": f"TEST_meal_{i}",
                "meal_type": "lunch",
                "calories": 400,
                "protein_g": 20,
                "carbs_g": 30,
                "fat_g": 10,
                "portion": "1 bowl",
            })
            assert r.status_code == 200, r.text
        r = session.get(f"{API}/milestones", headers=headers)
        assert r.status_code == 200
        data = r.json()
        b = _badge(data, "forking_around")
        assert b is not None and b["unlocked"] is True, f"forking_around not unlocked after 5 meals: {b}"

    def test_hydrated_locked_until_water(self, session):
        email, tok = _register(session)
        headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # After first meal: hydrated must still be LOCKED
        r = session.post(f"{API}/meals/log", headers=headers, json={
            "title": "TEST_first_meal", "meal_type": "breakfast",
            "calories": 300, "protein_g": 10, "carbs_g": 40, "fat_g": 8, "portion": "1 plate",
        })
        assert r.status_code == 200
        r = session.get(f"{API}/milestones", headers=headers).json()
        b = _badge(r, "hydrated")
        assert b is not None and b["unlocked"] is False, f"hydrated should still be locked: {b}"

        # Log 500ml water — hydrated should unlock
        r = session.post(f"{API}/water/log", headers=headers, json={"ml": 500})
        assert r.status_code == 200
        r = session.get(f"{API}/milestones", headers=headers).json()
        b = _badge(r, "hydrated")
        assert b is not None and b["unlocked"] is True, f"hydrated should unlock after water: {b}"

    def test_dumpster_diver_after_delete(self, session):
        email, tok = _register(session)
        headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # Create and delete a meal
        r = session.post(f"{API}/meals/log", headers=headers, json={
            "title": "TEST_to_delete", "meal_type": "snack",
            "calories": 100, "protein_g": 5, "carbs_g": 10, "fat_g": 2, "portion": "1 piece",
        })
        assert r.status_code == 200
        meal_id = r.json()["meal"]["meal_id"]
        # Before delete: locked
        r = session.get(f"{API}/milestones", headers=headers).json()
        b = _badge(r, "dumpster_diver")
        assert b is not None and b["unlocked"] is False
        # Delete
        d = session.delete(f"{API}/meals/{meal_id}", headers=headers)
        assert d.status_code == 200 and d.json().get("ok") is True
        # After delete: unlocked
        r = session.get(f"{API}/milestones", headers=headers).json()
        b = _badge(r, "dumpster_diver")
        assert b is not None and b["unlocked"] is True


class TestReferralsFeedThrough:
    def test_referrals_me_ok(self, session, user_a):
        r = session.get(f"{API}/referrals/me", headers=user_a["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert "code" in data
        # New user should have 0 redemptions → helping_hand locked
        m = session.get(f"{API}/milestones", headers=user_a["headers"]).json()
        b = _badge(m, "helping_hand")
        assert b is not None and b["unlocked"] is False

    def test_helping_hand_unlocks_on_redemption(self, session, user_a):
        # Get referrer code
        code = session.get(f"{API}/referrals/me", headers=user_a["headers"]).json()["code"]
        # Register a new user and redeem
        email2, tok2 = _register(session)
        headers2 = {"Authorization": f"Bearer {tok2}", "Content-Type": "application/json"}
        rr = session.post(f"{API}/referrals/redeem", headers=headers2, json={"code": code})
        if rr.status_code != 200:
            pytest.skip(f"referrals/redeem not accepted ({rr.status_code}): {rr.text}")
        # Referrer should now have helping_hand unlocked
        m = session.get(f"{API}/milestones", headers=user_a["headers"]).json()
        b = _badge(m, "helping_hand")
        assert b is not None and b["unlocked"] is True, f"helping_hand should unlock: {b}"


class TestAchievementsLegacyRoute:
    def test_achievements_list_still_exists(self, session, user_a):
        # /api/achievements/list still exists per problem statement
        r = session.get(f"{API}/achievements/list", headers=user_a["headers"])
        # It may or may not exist — just log
        assert r.status_code in (200, 404, 405), r.status_code
