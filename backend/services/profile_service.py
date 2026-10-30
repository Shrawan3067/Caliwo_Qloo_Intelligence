"""
User Profile Service — shared business logic for user data.

Used by:
  - GET /api/profile/me (REST)
"""

from typing import Any

from models import User


def get_user_profile_data(user: User) -> dict[str, Any]:
    """
    Extract profile data relevant for AI coach suggestions.
    Filters out sensitive fields — never exposes password hash, tokens, etc.
    """
    profile: dict = user.profile if isinstance(user.profile, dict) else {}
    goals_data = profile.get("goals", {})

    return {
        "name": user.name or "User",
        "email": user.email,
        "sex": profile.get("sex") or profile.get("gender"),
        "date_of_birth": profile.get("date_of_birth"),
        "height_cm": profile.get("height_cm"),
        "weight_kg": profile.get("weight_kg"),
        "goal": profile.get("goal", "maintain"),  # lose / maintain / gain
        "target_speed": profile.get("target_speed", "recommended"),
        "activity_level": profile.get("activity_level", "lightly_active"),
        "dietary_preferences": profile.get("dietary_preferences", []),
        "diet": profile.get("diet"),
        "obstacles": profile.get("obstacles", []),
        "workouts_per_week": profile.get("workouts_per_week"),
        "desired_weight_kg": profile.get("desired_weight_kg") or profile.get("goal_weight_kg"),
        "calorie_target": float(goals_data.get("calories") or profile.get("daily_calories") or 2000),
        "protein_target_g": float(goals_data.get("protein_g") or goals_data.get("protein") or profile.get("daily_protein_g") or 150),
        "carbs_target_g": float(goals_data.get("carbs_g") or profile.get("daily_carbs_g") or 200),
        "fat_target_g": float(goals_data.get("fat_g") or profile.get("daily_fat_g") or 65),
        "onboarded": profile.get("onboarded", False),
        # Qloo Taste DNA integration
        "taste_onboarded": bool(profile.get("taste_dna", {}).get("entity_ids")),
        "cuisine_affinities": profile.get("taste_dna", {}).get("cuisine_affinities", []),
        "taste_dna": profile.get("taste_dna", {}),
    }
