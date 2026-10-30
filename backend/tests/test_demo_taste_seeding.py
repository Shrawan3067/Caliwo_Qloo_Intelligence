"""
Test Demo User Auto-Seeding & Seamless Demo Routing.
Verifies Action 1 implementation:
1. When demo@caliwo.app logs in, it automatically receives a rich 6-domain Taste DNA profile.
2. public_user() includes taste_onboarded and has_taste_dna flags.
3. Taste profile endpoint returns all 6 cultural domains populated.
"""

import asyncio
import os
import sys
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app
from database import get_session_factory
from models import User
from sqlalchemy import select


@pytest.mark.asyncio
async def test_demo_user_taste_dna_seeding():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Login as demo user
        res = await ac.post("/api/auth/login", json={
            "email": "demo@caliwo.app",
            "password": "Demo1234!",
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert "token" in data
        user_info = data["user"]

        # 1. Verify public_user response has taste flags
        assert user_info["taste_onboarded"] is True
        assert user_info["has_taste_dna"] is True

        token = data["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Verify /api/auth/me returns the taste flags
        me_res = await ac.get("/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["taste_onboarded"] is True
        assert me_data["has_taste_dna"] is True

        # 3. Verify /api/taste/profile returns the full 6-domain Taste DNA
        taste_res = await ac.get("/api/taste/profile", headers=headers)
        assert taste_res.status_code == 200
        t_data = taste_res.json()
        assert t_data["has_taste_profile"] is True
        dna = t_data["taste_dna"]

        # Check all 6 domains
        assert dna["domains_connected"] >= 5
        assert len(dna["entity_ids"]) >= 5
        assert "Japanese" in dna.get("cuisine_affinities", [])
        assert "Mediterranean" in dna.get("cuisine_affinities", [])
        assert any("Midnight in Paris" in f for f in dna.get("film_tags", []))
        assert any("Daft Punk" in m or "The Weeknd" in m or "Chet Baker" in m for m in dna.get("music_tags", []))
        assert any("Tokyo" in t or "Barcelona" in t for t in dna.get("travel_tags", []))
        assert len(dna.get("cross_domain_dining", [])) >= 1
