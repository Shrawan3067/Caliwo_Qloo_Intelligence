"""
Caliwo Demo User Seeder.

Creates a demo user with realistic nutrition data for hackathon demonstrations.
Uses the real database, tools, and calculations — does NOT hardcode final answers.

Usage:
    cd backend
    python scripts/seed_demo.py
"""

import asyncio
import os
import sys

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from services.demo_service import (
    DEMO_USER_ID,
    DEMO_EMAIL,
    DEMO_PASSWORD,
    DEMO_NAME,
    DEMO_PROFILE,
    SEED_MEALS,
    reset_demo_user,
)


async def seed():
    result = await reset_demo_user()

    print("\n" + "=" * 50)
    print("✅ Demo user seeded successfully!")
    print("=" * 50)
    print(f"\n📧 Email:    {DEMO_EMAIL}")
    print(f"🔑 Password: {DEMO_PASSWORD}")
    print(f"🆔 User ID:  {DEMO_USER_ID}")
    print(f"\n🎯 Goal: {DEMO_PROFILE['goal']} weight")
    print(f"🔥 Calorie target: {DEMO_PROFILE['daily_calories']} kcal")
    print(f"💪 Protein target: {DEMO_PROFILE['daily_protein_g']}g")
    print(f"\n🧬 Taste DNA: Seeded across 6 cultural domains (Qloo)")
    print(f"   → Affinities: Japanese, Mediterranean, Mexican")
    print(f"   → Cultural tags: Nobu, Jiro Dreams of Sushi, Chet Baker, Tokyo, Anthony Bourdain")
    print(f"   → 4 cross-domain dining matches pre-computed")
    print(f"\n📝 Today's meals logged: 3 (breakfast, lunch, snack)")
    print(f"   → Consumed today: {result['consumed_today']} kcal")
    print(f"   → Remaining: {result['remaining_calories']} kcal, {result['remaining_protein_g']}g protein, {result['remaining_magnesium_mg']}mg magnesium")
    print(f"   → No dinner yet — perfect for 'What should I eat tonight?' demo")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())
