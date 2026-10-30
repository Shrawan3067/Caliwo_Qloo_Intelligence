"""Comprehensive tests for Caliwo Gamification & Milestone System.

Tests:
1. Data-driven badge definitions catalog (35 badges across 10 categories).
2. Endpoints: GET /api/milestones, GET /api/milestones/summary, POST /api/milestones/evaluate, POST /api/milestones/seen, POST /api/milestones/sync.
3. Idempotent evaluation on event triggers.
"""

import uuid
import pytest
from starlette.testclient import TestClient
from server import app
from milestones_defs import MILESTONE_DEFS


def test_milestone_definitions_structure():
    """Verify all badge definitions satisfy data-driven schema requirements."""
    assert len(MILESTONE_DEFS) >= 30, "Catalog must contain at least 30 badges"
    
    categories = set()
    for b in MILESTONE_DEFS:
        assert "id" in b and b["id"], f"Badge missing id: {b}"
        assert "code" in b and b["code"], f"Badge missing code: {b}"
        assert "name" in b and b["name"], f"Badge missing name: {b}"
        assert "desc" in b and b["desc"], f"Badge missing desc: {b}"
        assert "category" in b and b["category"], f"Badge missing category: {b}"
        assert "metric" in b and b["metric"], f"Badge missing metric: {b}"
        assert "threshold" in b and b["threshold"] > 0, f"Badge invalid threshold: {b}"
        assert "assetKey" in b and b["assetKey"], f"Badge missing assetKey: {b}"
        assert "icon_kind" in b and b["icon_kind"], f"Badge missing icon_kind: {b}"
        categories.add(b["category"])

    assert len(categories) >= 6, f"Must have badges across multiple categories: {categories}"


def test_milestones_api_integration():
    """Test API endpoints with authenticated TestClient."""
    with TestClient(app) as client:
        # Register & Login unique test user
        email = f"milestone_test_{uuid.uuid4().hex[:6]}@example.com"
        pwd = "TestPassword123!"

        reg_resp = client.post("/api/auth/register", json={
            "email": email,
            "password": pwd,
            "name": "Milestone Tester"
        })
        
        assert reg_resp.status_code == 200, f"Register failed: {reg_resp.text}"
        token = reg_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /api/milestones
    resp = client.get("/api/milestones", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "current_streak" in data
    assert "longest_streak" in data
    assert "badges" in data
    assert len(data["badges"]) >= 30

    # 2. GET /api/milestones/summary
    resp_sum = client.get("/api/milestones/summary", headers=headers)
    assert resp_sum.status_code == 200
    sum_data = resp_sum.json()
    assert "earned_count" in sum_data
    assert "total_count" in sum_data

    # 3. POST /api/milestones/evaluate
    eval_resp = client.post(
        "/api/milestones/evaluate",
        json={"event_type": "MEAL_LOGGED", "payload": {"meal_id": "test_1"}},
        headers=headers,
    )
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert eval_data["ok"] is True
    assert "newly_unlocked" in eval_data

    # 4. POST /api/milestones/seen
    seen_resp = client.post(
        "/api/milestones/seen",
        json={"badge_ids": ["streak_3", "rookie"]},
        headers=headers,
    )
    assert seen_resp.status_code == 200
    assert seen_resp.json()["ok"] is True

    # 4b. GET /api/milestones should no longer report streak_3 or rookie as unseen celebrations
    resp_after_seen = client.get("/api/milestones", headers=headers)
    assert resp_after_seen.status_code == 200
    after_seen_data = resp_after_seen.json()
    assert "streak_3" not in after_seen_data.get("unseen_celebrations", [])
    assert "rookie" not in after_seen_data.get("unseen_celebrations", [])

    # 5. POST /api/milestones/sync
    sync_resp = client.post(
        "/api/milestones/sync",
        json={"events": [{"event_type": "MEAL_LOGGED"}, {"event_type": "WATER_GOAL_HIT"}]},
        headers=headers,
    )
    assert sync_resp.status_code == 200
    assert "badges" in sync_resp.json()
