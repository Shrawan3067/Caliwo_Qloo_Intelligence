"""
Backend tests for iteration 12/13: Sleep, Referrals, Share Weekly Card,
GDPR Export/Delete, and coach regression with sleep context.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "") or os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        env_path = os.path.join(os.path.dirname(__file__), "../../frontend/.env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    for key in ("REACT_APP_BACKEND_URL=", "EXPO_PUBLIC_BACKEND_URL="):
                        if line.startswith(key):
                            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                            break
                    if BASE_URL:
                        break
    except Exception:
        pass
if not BASE_URL:
    BASE_URL = "http://localhost:8000"
print(f"Using BASE_URL={BASE_URL}")

API = f"{BASE_URL}/api"


def _register(suffix=""):
    email = f"TEST_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}{suffix}@caliwo.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Demo123!", "name": "Tester"
    }, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token in register response: {data}"
    return {"email": email, "token": token, "user": data.get("user", {})}


@pytest.fixture(scope="module")
def user_a():
    return _register("_a")


@pytest.fixture(scope="module")
def user_b():
    return _register("_b")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Sleep ----------------
class TestSleep:
    def test_log_sleep(self, user_a):
        r = requests.post(f"{API}/sleep/log", json={"hours": 7.5, "quality": "good"},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json().get("log", r.json())
        assert float(d.get("hours", 0)) == 7.5
        assert d.get("quality") == "good"

    def test_log_sleep_idempotent(self, user_a):
        # second call same day should upsert (not duplicate)
        r = requests.post(f"{API}/sleep/log", json={"hours": 8.0, "quality": "excellent"},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json().get("log", r.json())
        assert float(d.get("hours", 0)) == 8.0

    def test_log_sleep_invalid_hours_high(self, user_a):
        r = requests.post(f"{API}/sleep/log", json={"hours": 30, "quality": "good"},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code in (400, 422), f"expected 400/422 got {r.status_code}: {r.text}"

    def test_log_sleep_invalid_hours_negative(self, user_a):
        r = requests.post(f"{API}/sleep/log", json={"hours": -1, "quality": "good"},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code in (400, 422)

    def test_sleep_today(self, user_a):
        r = requests.get(f"{API}/sleep/today", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("logged") is True
        assert d.get("goal_hours") is not None
        assert "progress_pct" in d
        assert float(d.get("hours", 0)) == 8.0

    def test_sleep_today_no_log(self, user_b):
        r = requests.get(f"{API}/sleep/today", headers=_auth(user_b["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("logged") is False
        assert float(d.get("hours", 0)) == 0
        assert float(d.get("goal_hours", 0)) == 8.0

    def test_sleep_history(self, user_a):
        r = requests.get(f"{API}/sleep/history?days=14", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Should contain 14 date entries
        entries = d.get("entries") or d.get("history") or d.get("days") or []
        assert isinstance(entries, list)
        assert len(entries) == 14, f"expected 14 entries, got {len(entries)}"
        assert d.get("logged_days", 0) >= 1
        assert d.get("avg_hours") is not None
        assert d.get("goal_hours") is not None

    def test_sleep_history_clamp(self, user_a):
        r = requests.get(f"{API}/sleep/history?days=500", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200
        entries = r.json().get("entries") or r.json().get("history") or r.json().get("days") or []
        assert len(entries) <= 90

    def test_sleep_goal_default(self, user_b):
        r = requests.get(f"{API}/sleep/goal", headers=_auth(user_b["token"]), timeout=15)
        assert r.status_code == 200
        assert float(r.json().get("daily_goal_hours", 0)) == 8.0

    def test_sleep_goal_set(self, user_a):
        r = requests.post(f"{API}/sleep/goal", json={"daily_goal_hours": 7.5},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200
        # verify persistence
        r2 = requests.get(f"{API}/sleep/goal", headers=_auth(user_a["token"]), timeout=15)
        assert float(r2.json().get("daily_goal_hours", 0)) == 7.5

    def test_sleep_goal_out_of_range(self, user_a):
        r = requests.post(f"{API}/sleep/goal", json={"daily_goal_hours": 15},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code in (400, 422)
        r = requests.post(f"{API}/sleep/goal", json={"daily_goal_hours": 2},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code in (400, 422)


# ---------------- Referrals ----------------
class TestReferrals:
    def test_get_referral_code_idempotent(self, user_a):
        r = requests.get(f"{API}/referrals/me", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d1 = r.json()
        code1 = d1.get("code")
        assert code1 and code1.isalnum() and code1 == code1.upper()
        assert d1.get("commission_rate") == 0.20
        assert "share_url" in d1
        # call again
        r2 = requests.get(f"{API}/referrals/me", headers=_auth(user_a["token"]), timeout=15)
        assert r2.json().get("code") == code1

    def test_referral_codes_unique(self, user_a, user_b):
        ca = requests.get(f"{API}/referrals/me", headers=_auth(user_a["token"])).json().get("code")
        cb = requests.get(f"{API}/referrals/me", headers=_auth(user_b["token"])).json().get("code")
        assert ca and cb and ca != cb

    def test_redeem_self_code_fails(self, user_a):
        code = requests.get(f"{API}/referrals/me", headers=_auth(user_a["token"])).json()["code"]
        r = requests.post(f"{API}/referrals/redeem", json={"code": code},
                          headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 400

    def test_redeem_unknown_code(self, user_b):
        r = requests.post(f"{API}/referrals/redeem", json={"code": "NOSUCH99"},
                          headers=_auth(user_b["token"]), timeout=15)
        assert r.status_code == 404

    def test_redeem_success_and_double_redeem(self, user_a, user_b):
        code_a = requests.get(f"{API}/referrals/me", headers=_auth(user_a["token"])).json()["code"]
        r = requests.post(f"{API}/referrals/redeem", json={"code": code_a},
                          headers=_auth(user_b["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # user_b flagged already_redeemed
        me_b = requests.get(f"{API}/referrals/me", headers=_auth(user_b["token"])).json()
        assert me_b.get("already_redeemed_a_code") is True
        # referrer redemptions incremented
        me_a = requests.get(f"{API}/referrals/me", headers=_auth(user_a["token"])).json()
        assert me_a.get("redemptions", 0) >= 1
        # second attempt should fail
        r2 = requests.post(f"{API}/referrals/redeem", json={"code": code_a},
                           headers=_auth(user_b["token"]), timeout=15)
        assert r2.status_code == 400


# ---------------- Weekly share card ----------------
class TestWeeklyCard:
    def test_weekly_card(self, user_a):
        r = requests.get(f"{API}/share/weekly-card", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("week_range", "user", "meals", "steps", "sleep", "brand", "generated_at"):
            assert key in d, f"missing key {key} in weekly card: {list(d.keys())}"
        assert "average_hours" in d["sleep"]
        assert "goal_hours" in d["sleep"]


# ---------------- Coach regression with sleep context ----------------
class TestCoachRegression:
    def test_coach_with_sleep_and_steps(self, user_a):
        # log steps
        rs = requests.post(f"{API}/steps/sync", json={"entries": [{"date": time.strftime("%Y-%m-%d"), "steps": 5000, "source": "manual"}]},
                           headers=_auth(user_a["token"]), timeout=15)
        assert rs.status_code in (200, 201), rs.text
        r = requests.post(f"{API}/coach/message", json={"message": "How am I doing today?"},
                          headers=_auth(user_a["token"]), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("reply") or d.get("message") or d.get("content")


# ---------------- Regression common endpoints ----------------
class TestCommonRegression:
    def test_login(self, user_a):
        r = requests.post(f"{API}/auth/login", json={
            "email": user_a["email"], "password": "Demo123!"
        }, timeout=15)
        assert r.status_code == 200

    def test_nutrition_today(self, user_a):
        r = requests.get(f"{API}/nutrition/today", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200

    def test_meals_list(self, user_a):
        r = requests.get(f"{API}/meals/list", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200

    def test_steps_today(self, user_a):
        r = requests.get(f"{API}/steps/today", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200

    def test_subscription_status(self, user_a):
        r = requests.get(f"{API}/subscription/status", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200


# ---------------- GDPR Export + Delete ----------------
class TestGDPR:
    def test_export(self, user_a):
        r = requests.get(f"{API}/account/export", headers=_auth(user_a["token"]), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("user", "meals", "sleep_logs", "step_entries"):
            assert key in d, f"missing key {key}"

    def test_delete_and_me_401(self):
        # Fresh user for delete
        u = _register("_del")
        # log some data
        requests.post(f"{API}/sleep/log", json={"hours": 7, "quality": "good"}, headers=_auth(u["token"]))
        r = requests.delete(f"{API}/account/delete", headers=_auth(u["token"]), timeout=30)
        assert r.status_code in (200, 204), r.text
        me = requests.get(f"{API}/auth/me", headers=_auth(u["token"]), timeout=15)
        assert me.status_code == 401
