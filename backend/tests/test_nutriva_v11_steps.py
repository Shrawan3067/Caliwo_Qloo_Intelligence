"""Caliwo backend tests — iteration 11.

Focus: NEW Step Tracking endpoints (/api/steps/*) plus coach system prompt
integration when step data is available.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / "frontend" / ".env")
load_dotenv(ROOT_DIR / "backend" / ".env", override=False)

BASE_URL = os.environ.get("CALIWO_TEST_URL", "").rstrip("/") or os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8000").rstrip("/")

# Prefer public URL, but fall back to localhost:8001 if ingress is broken (returns 404 on /api/).
try:
    _probe = requests.get(f"{BASE_URL}/api/", timeout=5)
    if _probe.status_code == 404:
        _local = "http://localhost:8001"
        _lp = requests.get(f"{_local}/api/", timeout=5)
        if _lp.status_code == 200:
            print(f"[test_v11] Public URL {BASE_URL} returns 404 on /api/; falling back to {_local}")
            BASE_URL = _local
except Exception:
    pass

TEST_EMAIL = f"e2e-v11-steps-{uuid.uuid4().hex[:8]}@caliwo.example.com"
TEST_PASS = "Test@1234"


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _days_ago(n: int) -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=n)).isoformat()


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    r = session.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": TEST_EMAIL, "password": TEST_PASS, "name": "E2E V11"},
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


# ---------------- Auth guard ----------------
class TestStepsAuth:
    def test_today_requires_auth(self, session):
        r = session.get(f"{BASE_URL}/api/steps/today", timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text}"


# ---------------- Goal ----------------
class TestStepsGoal:
    def test_default_goal_is_10000(self, session, auth):
        r = session.get(f"{BASE_URL}/api/steps/goal", headers=auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("daily_goal") == 10000, f"default goal should be 10000, got {d}"

    def test_set_goal_persists(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/steps/goal",
            json={"daily_goal": 12000},
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("daily_goal") == 12000

        # GET back
        r2 = session.get(f"{BASE_URL}/api/steps/goal", headers=auth["headers"], timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("daily_goal") == 12000

    def test_goal_out_of_range_low(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/steps/goal",
            json={"daily_goal": 500},
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code in (400, 422), f"expected 4xx for low goal, got {r.status_code}"

    def test_goal_out_of_range_high(self, session, auth):
        r = session.post(
            f"{BASE_URL}/api/steps/goal",
            json={"daily_goal": 800000},
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code in (400, 422), f"expected 4xx for high goal, got {r.status_code}"

    def test_reset_goal_to_default(self, session, auth):
        # Set back to 10000 for downstream tests
        r = session.post(
            f"{BASE_URL}/api/steps/goal",
            json={"daily_goal": 10000},
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200


# ---------------- Sync + Today ----------------
class TestStepsSync:
    def test_sync_three_entries(self, session, auth):
        payload = {
            "platform": "ios",
            "source": "pedometer_ios",
            "entries": [
                {"date": _today(), "steps": 8000, "distance_m": 6000, "calories": 320,
                 "source": "pedometer_ios", "platform": "ios"},
                {"date": _days_ago(1), "steps": 11000, "distance_m": 8200, "calories": 420,
                 "source": "pedometer_ios", "platform": "ios"},
                {"date": _days_ago(2), "steps": 4500, "distance_m": 3300, "calories": 180,
                 "source": "pedometer_ios", "platform": "ios"},
            ],
        }
        r = session.post(
            f"{BASE_URL}/api/steps/sync",
            json=payload,
            headers=auth["headers"],
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("synced") == 3, f"expected synced=3, got {d}"

    def test_today_reflects_sync(self, session, auth):
        r = session.get(f"{BASE_URL}/api/steps/today", headers=auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("steps") == 8000, f"expected today=8000, got {d}"
        assert d.get("goal") == 10000
        assert d.get("remaining") == 2000
        assert d.get("source") == "pedometer_ios"
        assert d.get("last_sync") is not None
        # progress_pct = 80.0
        assert abs(float(d.get("progress_pct")) - 80.0) < 0.5

    def test_max_merge_idempotent(self, session, auth):
        # Send a LOWER value for today — server must keep the higher previous value
        r = session.post(
            f"{BASE_URL}/api/steps/sync",
            json={
                "platform": "ios",
                "source": "pedometer_ios",
                "entries": [
                    {"date": _today(), "steps": 100, "source": "pedometer_ios", "platform": "ios"}
                ],
            },
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("synced") == 1

        r2 = session.get(f"{BASE_URL}/api/steps/today", headers=auth["headers"], timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d.get("steps") == 8000, f"max-merge failed — steps should still be 8000, got {d.get('steps')}"


# ---------------- History ----------------
class TestStepsHistory:
    def test_history_7_days(self, session, auth):
        r = session.get(
            f"{BASE_URL}/api/steps/history?days=7",
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("goal") == 10000
        entries = d.get("entries")
        assert isinstance(entries, list) and len(entries) == 7, f"expected 7 entries, got {len(entries) if entries else None}"
        # each entry has date, steps, goal_reached
        for e in entries:
            assert "date" in e
            assert "steps" in e
            assert "goal_reached" in e
        # today entry
        today_entry = next(e for e in entries if e["date"] == _today())
        assert today_entry["steps"] == 8000
        assert today_entry["goal_reached"] is False
        # yesterday entry (11000) should be goal_reached=True
        y_entry = next(e for e in entries if e["date"] == _days_ago(1))
        assert y_entry["steps"] == 11000
        assert y_entry["goal_reached"] is True


# ---------------- Analytics ----------------
class TestStepsAnalytics:
    def test_weekly_analytics_shape(self, session, auth):
        r = session.get(
            f"{BASE_URL}/api/steps/analytics/weekly",
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        entries = d.get("entries")
        assert isinstance(entries, list) and len(entries) == 7
        stats = d.get("stats") or {}
        for k in ("total", "average", "highest", "lowest", "current_streak", "longest_streak", "days_goal_hit"):
            assert k in stats, f"missing stats key: {k} in {stats}"
        assert "trend_vs_prev_week_pct" in d
        # Only yesterday hit the goal so days_goal_hit >= 1
        assert stats["days_goal_hit"] >= 1
        assert stats["highest"] >= 11000

    def test_monthly_analytics_shape(self, session, auth):
        r = session.get(
            f"{BASE_URL}/api/steps/analytics/monthly",
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        entries = d.get("entries")
        assert isinstance(entries, list) and len(entries) == 30
        assert d.get("best_day") is not None
        assert d["best_day"]["steps"] >= 11000
        stats = d.get("stats") or {}
        assert stats.get("highest", 0) >= 11000


# ---------------- Streaks (full week) ----------------
class TestStepsStreaks:
    def test_streaks_computed_correctly(self, session, auth):
        """Sync a controlled 7-day pattern: last 3 days hit goal, day-3 miss, days
        4-6 hit goal. Expect current_streak=3 (today+yesterday+day-2 all hit),
        longest_streak=3."""
        # Reset today to a goal-hitting value (max-merge only goes up, so 12000 replaces 8000)
        entries = [
            {"date": _today(),      "steps": 12000},  # hit
            {"date": _days_ago(1),  "steps": 11000},  # hit (already 11000)
            {"date": _days_ago(2),  "steps": 15000},  # hit (max-merge from 4500)
            {"date": _days_ago(3),  "steps": 3000},   # miss
            {"date": _days_ago(4),  "steps": 12000},  # hit
            {"date": _days_ago(5),  "steps": 14000},  # hit
            {"date": _days_ago(6),  "steps": 9000},   # miss
        ]
        payload = {"platform": "ios", "source": "pedometer_ios",
                   "entries": [{**e, "source": "pedometer_ios", "platform": "ios"} for e in entries]}
        r = session.post(f"{BASE_URL}/api/steps/sync", json=payload,
                         headers=auth["headers"], timeout=20)
        assert r.status_code == 200, r.text

        r2 = session.get(f"{BASE_URL}/api/steps/analytics/weekly",
                         headers=auth["headers"], timeout=15)
        assert r2.status_code == 200
        stats = r2.json()["stats"]
        # current streak = today,-1,-2 all >=10000 -> 3, then -3 breaks
        assert stats["current_streak"] == 3, f"expected current_streak=3, got {stats}"
        # longest: 3 (recent) or 2 (days 4-5) -> 3
        assert stats["longest_streak"] == 3, f"expected longest_streak=3, got {stats}"
        assert stats["days_goal_hit"] == 5


# ---------------- Coach integration ----------------
class TestCoachWithSteps:
    def test_coach_message_after_step_sync(self, session, auth):
        # Ensure today is 8000 for a predictable prompt (max-merge, current is 12000 — that's fine)
        r = session.post(
            f"{BASE_URL}/api/coach/message",
            json={"message": "How am I doing on activity today?"},
            headers=auth["headers"],
            timeout=60,
        )
        assert r.status_code == 200, f"coach/message failed: {r.status_code} {r.text}"
        d = r.json()
        # Soft check: model call succeeded and produced a non-empty reply
        reply = d.get("reply") or d.get("message") or d.get("content") or ""
        assert isinstance(reply, str) and len(reply.strip()) > 0, f"empty coach reply: {d}"


# ---------------- Disconnect ----------------
class TestStepsDisconnect:
    def test_disconnect(self, session, auth):
        r = session.delete(
            f"{BASE_URL}/api/steps/disconnect",
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_profile_marked_disconnected(self, session, auth):
        # Confirm via /api/profile/me if it exposes steps_connected
        r = session.get(f"{BASE_URL}/api/profile/me", headers=auth["headers"], timeout=15)
        if r.status_code != 200:
            pytest.skip("profile/me not available")
        d = r.json()
        # steps_connected should be False (or absent -> treat as disconnected)
        val = d.get("steps_connected")
        if val is None:
            # nested profile object?
            prof = d.get("profile") or {}
            val = prof.get("steps_connected")
        assert val in (False, None), f"expected steps_connected False/None, got {val} in {d}"
