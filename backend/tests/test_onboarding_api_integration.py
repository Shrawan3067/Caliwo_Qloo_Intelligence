"""Feature 2 (Onboarding) integration tests.

Creates fresh accounts per suite to avoid polluting shared users. Auth register/login are rate-limited 10/min per IP —
this file uses a small handful of registers (<10) and reuses tokens.

Run: pytest backend/tests/test_onboarding_api_integration.py -v
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_email() -> str:
    return f"TEST_onb_{uuid.uuid4().hex[:10]}@example.com"


def _register() -> tuple[str, dict]:
    """Register a fresh user and return (token, user)."""
    email = _fresh_email()
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "GoodPass123"}, timeout=20)
    if r.status_code == 429:
        pytest.skip("Auth rate limit hit; skipping (rerun after 60s)")
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    j = r.json()
    return j["token"], j["user"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Mass-assignment / privilege escalation ----------------
class TestMassAssignmentBlocked:
    def test_extra_keys_dropped(self):
        token, _ = _register()
        payload = {
            "sex": "male", "weight_kg": 80, "height_cm": 180,
            "date_of_birth": "1995-06-15", "goal": "lose",
            "target_speed": "recommended", "workouts_per_week": "3-5",
            # sensitive / non-allowlisted keys — MUST be dropped
            "pro_until": "2099-01-01",
            "is_admin": True,
            "entitlements": {"pro": True},
            "role": "admin",
        }
        r = requests.post(f"{API}/profile/onboarding", headers=_auth(token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        prof = r.json()["profile"]
        assert "pro_until" not in prof
        assert "is_admin" not in prof
        assert "entitlements" not in prof
        assert "role" not in prof
        # Verify persistence via GET
        g = requests.get(f"{API}/profile/me", headers=_auth(token), timeout=20).json()
        assert "pro_until" not in g["profile"]
        assert "is_admin" not in g["profile"]


# ---------------- Authoritative compute (ignore client calories) ----------------
class TestAuthoritativeCompute:
    def test_client_calories_ignored(self):
        token, _ = _register()
        payload = {
            "sex": "male", "weight_kg": 80, "height_cm": 180,
            "date_of_birth": "1995-06-15", "goal": "lose",
            "target_speed": "recommended", "workouts_per_week": "3-5",
            # Client-supplied garbage — must be recomputed server-side
            "daily_calories": 99999,
            "daily_protein_g": 99999,
            "daily_carbs_g": 99999,
            "daily_fat_g": 99999,
        }
        r = requests.post(f"{API}/profile/onboarding", headers=_auth(token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        prof = r.json()["profile"]
        # Should be ~2400 (2401 for age 31, 2409 for age 30)
        assert 2300 <= prof["daily_calories"] <= 2450, prof["daily_calories"]
        assert prof["daily_calories"] != 99999
        # Consistent goals object
        assert prof["goals"]["calories"] == prof["daily_calories"]
        assert prof["goals"]["protein_g"] == prof["daily_protein_g"]
        assert prof["goals"]["carbs_g"] == prof["daily_carbs_g"]
        assert prof["goals"]["fat_g"] == prof["daily_fat_g"]
        assert prof["onboarded"] is True


# ---------------- Input validation ----------------
class TestInputValidation:
    @classmethod
    def setup_class(cls):
        cls.token, _ = _register()

    def _bad(self, patch: dict):
        base = {
            "sex": "male", "weight_kg": 80, "height_cm": 180,
            "date_of_birth": "1995-06-15", "goal": "lose",
            "target_speed": "recommended", "workouts_per_week": "3-5",
        }
        base.update(patch)
        return requests.post(f"{API}/profile/onboarding", headers=_auth(self.token), json=base, timeout=20)

    def test_negative_weight(self):
        assert self._bad({"weight_kg": -5}).status_code == 422

    def test_huge_weight(self):
        assert self._bad({"weight_kg": 500}).status_code == 422

    def test_huge_height(self):
        assert self._bad({"height_cm": 500}).status_code == 422

    def test_tiny_height(self):
        assert self._bad({"height_cm": 50}).status_code == 422

    def test_dob_future_or_underage(self):
        # DOB 2020-01-01 => age ~6 in 2026 (< 13)
        assert self._bad({"date_of_birth": "2020-01-01"}).status_code == 422

    def test_bad_goal(self):
        assert self._bad({"goal": "shred"}).status_code == 422

    def test_bad_speed(self):
        assert self._bad({"target_speed": "warp"}).status_code == 422

    def test_bad_workouts(self):
        assert self._bad({"workouts_per_week": "10+"}).status_code == 422

    def test_bad_sex(self):
        assert self._bad({"sex": "attack-helicopter"}).status_code == 422


# ---------------- Macro math correctness ----------------
class TestMacroMath:
    def test_female_maintain_expected(self):
        token, _ = _register()
        payload = {
            "sex": "female", "weight_kg": 70, "height_cm": 165,
            "date_of_birth": "1990-01-01", "goal": "maintain",
            "target_speed": "recommended", "workouts_per_week": "0-2",
        }
        r = requests.post(f"{API}/profile/onboarding", headers=_auth(token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        prof = r.json()["profile"]
        assert prof["daily_calories"] == 1912, prof["daily_calories"]
        assert prof["daily_protein_g"] == 126, prof["daily_protein_g"]
        # goals internally consistent
        g = prof["goals"]
        assert g["calories"] == 1912
        assert g["protein_g"] == 126
        assert 1200 <= g["calories"] <= 6000
        # macros roughly add up (allow rounding drift)
        cals_from_macros = g["protein_g"] * 4 + g["carbs_g"] * 4 + g["fat_g"] * 9
        assert abs(cals_from_macros - g["calories"]) <= 20, (cals_from_macros, g["calories"])


# ---------------- Edit later (PUT /profile/me) ----------------
class TestEditLater:
    def test_put_before_onboarding_400(self):
        token, _ = _register()
        r = requests.put(
            f"{API}/profile/me",
            headers=_auth(token),
            json={"weight_kg": 85, "goal": "gain"},
            timeout=20,
        )
        assert r.status_code == 400, (r.status_code, r.text)

    def test_put_after_onboarding_recomputes(self):
        token, _ = _register()
        # Complete onboarding first
        r = requests.post(
            f"{API}/profile/onboarding",
            headers=_auth(token),
            json={
                "sex": "male", "weight_kg": 80, "height_cm": 180,
                "date_of_birth": "1995-06-15", "goal": "lose",
                "target_speed": "recommended", "workouts_per_week": "3-5",
            },
            timeout=20,
        )
        assert r.status_code == 200
        original_cal = r.json()["profile"]["daily_calories"]

        # Now edit: weight up + switch to gain
        r2 = requests.put(
            f"{API}/profile/me",
            headers=_auth(token),
            json={"weight_kg": 85, "goal": "gain"},
            timeout=20,
        )
        assert r2.status_code == 200, r2.text
        new_prof = r2.json()["profile"]
        assert new_prof["weight_kg"] == 85
        assert new_prof["goal"] == "gain"
        # Gain > lose (with everything else similar) => new calories higher
        assert new_prof["daily_calories"] > original_cal, (new_prof["daily_calories"], original_cal)
        # Protein tracks new weight (85 * 1.8 = 153)
        assert new_prof["daily_protein_g"] == 153

        # Verify GET reflects it
        g = requests.get(f"{API}/profile/me", headers=_auth(token), timeout=20).json()
        assert g["profile"]["weight_kg"] == 85
        assert g["profile"]["goal"] == "gain"
        assert g["profile"]["daily_calories"] == new_prof["daily_calories"]
        assert g["profile"]["onboarded"] is True


# ---------------- Persistence / GET shape ----------------
class TestGetShape:
    def test_get_returns_user_and_profile(self):
        token, user = _register()
        # Before onboarding
        r = requests.get(f"{API}/profile/me", headers=_auth(token), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "user" in j and "profile" in j
        assert j["user"]["email"] == user["email"]
        assert not j["profile"].get("onboarded")

        # After onboarding
        requests.post(
            f"{API}/profile/onboarding",
            headers=_auth(token),
            json={
                "sex": "male", "weight_kg": 75, "height_cm": 178,
                "date_of_birth": "1993-03-10", "goal": "maintain",
                "target_speed": "recommended", "workouts_per_week": "3-5",
            },
            timeout=20,
        )
        r2 = requests.get(f"{API}/profile/me", headers=_auth(token), timeout=20).json()
        assert r2["profile"]["onboarded"] is True
        assert r2["profile"]["daily_calories"] > 0
        assert "goals" in r2["profile"]


# ---------------- Auth regression (still intact) ----------------
class TestAuthRegression:
    def test_register_login_me_flow(self):
        # Reuse existing pre-seeded account to avoid burning rate-limit budget.
        r = requests.post(
            f"{API}/auth/login",
            json={"email": "authgood@example.com", "password": "GoodPass123"},
            timeout=20,
        )
        if r.status_code == 429:
            pytest.skip("login rate-limited; try again later")
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        me = requests.get(f"{API}/auth/me", headers=_auth(token), timeout=20)
        assert me.status_code == 200
        assert me.json()["email"] == "authgood@example.com"
