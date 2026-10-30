import pytest
from httpx import ASGITransport, AsyncClient
from main import app

@pytest.mark.asyncio
async def test_feedback_hub_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Register or login test user for auth header
        reg_res = await ac.post("/api/auth/register", json={
            "email": "feedback_tester@nutri.ai",
            "password": "password123",
            "name": "Feedback Tester"
        })
        if reg_res.status_code == 200:
            token = reg_res.json()["token"]
        else:
            login_res = await ac.post("/api/auth/login", json={
                "email": "feedback_tester@nutri.ai",
                "password": "password123"
            })
            token = login_res.json()["token"]

        headers = {"Authorization": f"Bearer {token}"}

        # 1. Duplicate check
        dup_res = await ac.post("/api/feedback/check-duplicates", json={
            "title": "Add Lock Screen Widget for Macros",
            "category": "Widgets"
        })
        assert dup_res.status_code == 200
        assert "similar_posts" in dup_res.json()

        # 2. Get posts list
        feed_res = await ac.get("/api/feedback/posts", headers=headers)
        assert feed_res.status_code == 200
        assert "posts" in feed_res.json()

        # 3. Get changelog
        ch_res = await ac.get("/api/feedback/changelog", headers=headers)
        assert ch_res.status_code == 200
        assert "releases" in ch_res.json()
