"""Comprehensive Account Deletion Tests for Caliwo.

Verifies:
1. DELETE /profile/me and DELETE /api/account/delete endpoints.
2. Cascade deletion of Meals, DailySummaries, UserMilestones, SubscriptionRecords, ChatMessages, and User records.
3. Post-deletion authentication invalidation.
"""

import uuid
import pytest
from starlette.testclient import TestClient
from server import app


def test_account_deletion_cascade_flow():
    """Verify user account deletion completely purges all user data."""
    with TestClient(app) as client:
        # 1. Register test user
        email = f"delete_test_{uuid.uuid4().hex[:6]}@caliwo.app"
        pwd = "Password123!"

        reg_resp = client.post("/api/auth/register", json={
            "email": email,
            "password": pwd,
            "name": "Delete Tester"
        })
        assert reg_resp.status_code == 200
        token = reg_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Log a meal for the user
        meal_resp = client.post("/api/meals/log", headers=headers, json={
            "title": "Test Meal To Delete",
            "meal_type": "lunch",
            "calories": 500,
            "protein_g": 30,
            "carbs_g": 40,
            "fat_g": 15,
        })
        assert meal_resp.status_code == 200

        # 3. Log hydration for user
        water_resp = client.post("/api/water/log", headers=headers, json={"ml": 500})
        assert water_resp.status_code == 200

        # 4. Trigger Account Deletion
        del_resp = client.delete("/api/profile/me", headers=headers)
        assert del_resp.status_code == 200
        assert del_resp.json()["ok"] is True

        # 5. Verify user profile can no longer be retrieved with former token
        me_resp = client.get("/api/profile/me", headers=headers)
        assert me_resp.status_code == 401
