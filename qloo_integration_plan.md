# Caliwo x Qloo: FINAL Integration Plan
## Aligned with Actual Hackathon Requirements

---

## Critical Submission Requirements (What Judges Actually Need)

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| **Live working demo** judges can interact with | You have `http://3.92.206.205:8000` on AWS EC2 | Redeploy with Qloo integration, ensure it stays up |
| **Public code repository** (GitHub/GitLab/Bitbucket) | Currently **PRIVATE** repo | **BLOCKER: Must make repo public or create new public fork** |
| **Open source license** visible in repo | Currently proprietary evaluation license | **BLOCKER: Switch to MIT/Apache 2.0** |
| **Written description** on Devpost | Not yet created | Write compelling Devpost project page |
| **Qloo API integration** that is central | Not yet built | This plan |
| **Agentic architecture** | Already have MCP + agent orchestrator | Extend with Qloo tools |

> [!CAUTION]
> **Two blockers to fix immediately:**
> 1. Repository must be **PUBLIC** with an **open source license**
> 2. Live demo must be **accessible** — judges will click the URL and test it

---

## Judging Criteria (How to Score Maximum Points)

### 1. Technological Implementation (How deeply does it use Qloo?)
**Strategy**: Qloo in the mandatory pipeline. Every recommendation flows through it. Show entity IDs, taste scores, cross-domain insights in the response metadata.

### 2. Design (Complete product, not a proof-of-concept?)
**Strategy**: You already have a polished web simulator with voice, telemetry cards, and chat. Add taste DNA visualization and alignment scores to the UI.

### 3. Potential Impact (Real problem, real audience?)
**Strategy**: "People abandon nutrition apps because recommendations are boring and generic. Cultural personalization solves retention." Back with real data.

### 4. Quality of the Idea (Creative, non-obvious use of Qloo?)
**Strategy**: Cross-domain cultural connections. Music taste influences cuisine preference. Travel history shapes dining style. This is the WOW factor.

---

## Architecture: Qloo as Core Engine

```
┌─────────────────────────────────────────────────────────────┐
│  JUDGE CLICKS LIVE DEMO URL                                 │
│  http://3.92.206.205:8000/assistant                         │
│                                                              │
│  1. Signs in (demo@caliwo.app / Demo1234!)                  │
│  2. Taste Onboarding: "Name 3 restaurants you love"         │
│     -> Qloo /search resolves to entity IDs                  │
│     -> Qloo /v2/insights builds Taste DNA                   │
│  3. "What should I eat for dinner?"                         │
│     -> Nutrition gaps + Qloo taste recs (MANDATORY)         │
│     -> Returns meals with alignment scores                  │
│  4. "Log that" -> Meal logged + taste feedback loop         │
└─────────────────────────────────────────────────────────────┘

BEHIND THE SCENES:

User Profile (taste_dna stored in JSONB)
         │
         ▼
┌──────────────────────────────────────────┐
│  Qloo Service (MANDATORY PIPELINE)       │
│                                          │
│  GET /search                             │
│    -> Resolve "Nobu" to entity ID        │
│    -> Resolve "Thai cuisine" to entity   │
│                                          │
│  GET /v2/insights                        │
│    -> Input: user's taste entity IDs     │
│    -> Output: culturally-aligned dining  │
│       recommendations with scores        │
│                                          │
│  Cached (in-memory, 1hr TTL)             │
│  Graceful fallback: marks response as    │
│  "generic - Qloo unavailable"            │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Agent Orchestrator (ENHANCED)           │
│                                          │
│  BEFORE (generic):                       │
│    gaps -> LLM suggests "chicken breast" │
│                                          │
│  AFTER (Qloo-powered):                   │
│    gaps -> Qloo taste recs -> LLM        │
│    composes culturally-personalized      │
│    response with alignment scores        │
└──────────────────────────────────────────┘
```

---

## 7-Day Sprint (Adjusted for Live Demo Priority)

| Day | Focus | Why This Order |
|-----|-------|----------------|
| **Day 1** | `qloo_service.py` + env config + make repo public | Foundation + fix blockers |
| **Day 2** | `qloo_tools.py` + register in `tools.py` + `taste_profile.py` | Wire Qloo into agent |
| **Day 3** | Rewrite `orchestrator.py` + `prompts.py` for mandatory Qloo pipeline | Core engine swap |
| **Day 4** | `mcp_server.py` new tools + `profile_service.py` + taste onboarding endpoint | Complete backend |
| **Day 5** | Frontend: taste onboarding UI + alignment scores in chat + taste DNA card | Judge-facing polish |
| **Day 6** | Deploy to AWS EC2 + E2E tests + seed demo data with taste profile | Live demo works |
| **Day 7** | Devpost submission: written description + test live demo + README | Submit |

---

## Complete File Changes

### NEW FILES (4)

#### 1. `backend/services/qloo_service.py`
The core Qloo API client. Every recommendation flows through this.

```python
"""
Qloo Cultural Intelligence Service.

This is the CORE ENGINE of Caliwo's taste personalization.
All meal recommendations MUST flow through this service.
"""

import hashlib
import httpx
import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

QLOO_BASE_URL = os.getenv("QLOO_BASE_URL", "https://api.qloo.com")
QLOO_API_KEY = os.getenv("QLOO_API_KEY", "")

# In-memory cache with TTL
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 3600  # 1 hour


def _cache_key(*args) -> str:
    return hashlib.md5(json.dumps(args, sort_keys=True).encode()).hexdigest()


def _cache_get(key: str) -> Optional[Any]:
    if key in _cache:
        ts, val = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return val
        del _cache[key]
    return None


def _cache_set(key: str, val: Any):
    _cache[key] = (time.time(), val)


def is_configured() -> bool:
    return bool(QLOO_API_KEY)


async def search_entities(
    query: str, entity_type: str = "", limit: int = 5
) -> list[dict]:
    """Resolve free text to Qloo entity IDs via GET /search"""
    ck = _cache_key("search", query, entity_type, limit)
    cached = _cache_get(ck)
    if cached is not None:
        return cached

    if not QLOO_API_KEY:
        return []

    params = {"query": query, "take": limit}
    if entity_type:
        params["type"] = entity_type

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{QLOO_BASE_URL}/search",
            params=params,
            headers={"X-Api-Key": QLOO_API_KEY},
        )
        resp.raise_for_status()
        data = resp.json()

    results = data.get("items", data.get("results", []))
    _cache_set(ck, results)
    return results


async def get_insights(
    entity_ids: list[str],
    target_type: str = "restaurant",
    limit: int = 10,
    location: Optional[dict] = None,
) -> list[dict]:
    """Get cross-domain recommendations via GET /v2/insights"""
    if not entity_ids or not QLOO_API_KEY:
        return []

    ck = _cache_key("insights", entity_ids, target_type, limit)
    cached = _cache_get(ck)
    if cached is not None:
        return cached

    params = {
        "entity_id": entity_ids,
        "target_type": target_type,
        "take": limit,
    }
    if location:
        params.update(location)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{QLOO_BASE_URL}/v2/insights",
            params=params,
            headers={"X-Api-Key": QLOO_API_KEY},
        )
        resp.raise_for_status()
        data = resp.json()

    results = data.get("items", data.get("results", []))
    _cache_set(ck, results)
    return results


async def build_taste_dna(
    favorite_restaurants: list[str],
    favorite_cuisines: list[str],
    food_influences: list[str],
) -> dict[str, Any]:
    """Build a user's Taste DNA from onboarding signals."""
    entity_ids = []
    cuisine_affinities = []
    cultural_tags = []

    # Resolve restaurants
    for r in favorite_restaurants:
        results = await search_entities(r, entity_type="restaurant", limit=2)
        for item in results:
            entity_ids.append(item.get("id", ""))
            cultural_tags.append(item.get("name", r))

    # Resolve cuisines
    for c in favorite_cuisines:
        results = await search_entities(c, entity_type="cuisine", limit=2)
        for item in results:
            entity_ids.append(item.get("id", ""))
            cuisine_affinities.append(item.get("name", c))
        if not results:
            cuisine_affinities.append(c)

    # Resolve influences (chefs, shows, food culture)
    for f in food_influences:
        results = await search_entities(f, limit=2)
        for item in results:
            entity_ids.append(item.get("id", ""))
            cultural_tags.append(item.get("name", f))

    # Get cross-domain dining insights
    cross_domain = []
    if entity_ids:
        insights = await get_insights(entity_ids[:10], "restaurant", limit=10)
        cross_domain = [
            {"name": i.get("name", ""), "score": i.get("score", 0)}
            for i in insights
        ]

    # Deduplicate entity_ids
    entity_ids = list(dict.fromkeys(eid for eid in entity_ids if eid))

    return {
        "entity_ids": entity_ids,
        "cuisine_affinities": list(dict.fromkeys(cuisine_affinities)),
        "cultural_tags": list(dict.fromkeys(cultural_tags)),
        "cross_domain_dining": cross_domain[:10],
        "built_at": time.time(),
    }


async def get_taste_aligned_meals(
    taste_dna: dict,
    nutrition_constraints: dict,
    meal_type: str = "dinner",
    limit: int = 5,
) -> list[dict]:
    """
    THE KEY FUNCTION.
    Get meal recs matching both nutrition AND cultural taste.
    """
    entity_ids = taste_dna.get("entity_ids", [])
    if not entity_ids:
        return []

    # Query Qloo for dining recommendations based on taste
    insights = await get_insights(entity_ids[:10], "restaurant", limit=limit * 2)

    # Build meal suggestions from Qloo dining insights
    meals = []
    for item in insights[:limit]:
        score = item.get("score", 0)
        # Normalize score to 0-100 percentage
        alignment = min(100, max(0, int(score * 100))) if score <= 1 else min(100, int(score))

        meals.append({
            "name": item.get("name", ""),
            "qloo_entity_id": item.get("id", ""),
            "cultural_alignment_score": alignment,
            "cuisine_tags": taste_dna.get("cuisine_affinities", []),
            "qloo_source": True,
        })

    return meals


async def update_taste_from_meal(
    taste_dna: dict, meal_title: str
) -> dict:
    """When user logs a meal, resolve it and update taste DNA."""
    results = await search_entities(meal_title, limit=2)
    new_ids = [r.get("id", "") for r in results if r.get("id")]

    existing = taste_dna.get("entity_ids", [])
    combined = list(dict.fromkeys(existing + new_ids))

    taste_dna["entity_ids"] = combined[-50]  # keep last 50
    taste_dna["last_updated"] = time.time()
    return taste_dna
```

#### 2. `backend/services/taste_profile.py`
Taste DNA persistence layer.

```python
"""
Taste Profile Management.
Manages the user's Taste DNA stored in user.profile["taste_dna"].
"""

from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from models import User


async def get_taste_dna(user: User) -> dict[str, Any]:
    profile = user.profile if isinstance(user.profile, dict) else {}
    return profile.get("taste_dna", {})


async def save_taste_dna(
    session: AsyncSession, user: User, taste_dna: dict
) -> None:
    profile = dict(user.profile) if user.profile else {}
    profile["taste_dna"] = taste_dna
    user.profile = profile
    flag_modified(user, "profile")
    await session.commit()


async def has_taste_profile(user: User) -> bool:
    dna = await get_taste_dna(user)
    return bool(dna.get("entity_ids"))


def compute_alignment_score(
    qloo_score: float, nutrition_fit: float
) -> int:
    """0-100 blended score: 60% cultural taste + 40% nutrition fit."""
    cultural = min(100, max(0, qloo_score * 100 if qloo_score <= 1 else qloo_score))
    nutritional = min(100, max(0, nutrition_fit))
    return int(cultural * 0.6 + nutritional * 0.4)
```

#### 3. `backend/agent/qloo_tools.py`
Agent tool implementations powered by Qloo.

```python
"""
Qloo-Powered Agent Tools.

These tools make cultural intelligence central to every recommendation.
The agent MUST use these instead of generic suggestions.
"""

import logging
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from models import User

logger = logging.getLogger(__name__)


async def get_taste_recommendations(
    session: AsyncSession,
    user: User,
    meal_type: str = "dinner",
    cuisine_filter: Optional[str] = None,
    mood: Optional[str] = None,
) -> dict[str, Any]:
    """Get meal recs personalized to taste DNA via Qloo."""
    from services import qloo_service, taste_profile, nutrition_service

    taste_dna = await taste_profile.get_taste_dna(user)
    has_taste = bool(taste_dna.get("entity_ids"))

    # Get nutrition constraints
    gaps = await nutrition_service.get_nutrition_gaps(session, user)
    cal_remaining = gaps.get("gaps", {}).get("calories", {}).get("remaining", 600)
    pro_remaining = gaps.get("gaps", {}).get("protein_g", {}).get("remaining", 30)

    nutrition_constraints = {
        "max_calories": cal_remaining,
        "min_protein_g": max(0, pro_remaining),
        "meal_type": meal_type,
    }

    # Query Qloo for taste-aligned meals
    qloo_meals = []
    if has_taste and qloo_service.is_configured():
        try:
            qloo_meals = await qloo_service.get_taste_aligned_meals(
                taste_dna, nutrition_constraints, meal_type, limit=5
            )
        except Exception as e:
            logger.warning(f"Qloo taste recommendations failed: {e}")

    return {
        "taste_profile_active": has_taste,
        "qloo_powered": bool(qloo_meals),
        "cuisine_affinities": taste_dna.get("cuisine_affinities", []),
        "recommendations": qloo_meals,
        "nutrition_context": {
            "calories_remaining": cal_remaining,
            "protein_remaining": pro_remaining,
            "meal_type": meal_type,
        },
        "note": (
            "Recommendations ranked by cultural alignment score from Qloo taste graph."
            if qloo_meals else
            "No taste profile found. Ask the user to complete taste onboarding for personalized recommendations."
        ),
    }


async def discover_cultural_meals(
    session: AsyncSession,
    user: User,
    cuisine: Optional[str] = None,
    mood: Optional[str] = None,
) -> dict[str, Any]:
    """Cross-domain cultural meal discovery via Qloo."""
    from services import qloo_service, taste_profile

    taste_dna = await taste_profile.get_taste_dna(user)
    entity_ids = taste_dna.get("entity_ids", [])

    discoveries = []
    if entity_ids and qloo_service.is_configured():
        try:
            insights = await qloo_service.get_insights(
                entity_ids[:10], "restaurant", limit=8
            )
            discoveries = [
                {
                    "name": i.get("name", ""),
                    "score": i.get("score", 0),
                    "qloo_entity_id": i.get("id", ""),
                }
                for i in insights
            ]
        except Exception as e:
            logger.warning(f"Qloo discovery failed: {e}")

    return {
        "qloo_powered": bool(discoveries),
        "discoveries": discoveries,
        "cultural_tags": taste_dna.get("cultural_tags", []),
        "cross_domain_note": (
            "These discoveries are based on cross-domain cultural connections "
            "from Qloo's taste graph - connecting your preferences across "
            "music, dining, entertainment, and lifestyle."
        ),
    }


async def update_taste_profile_tool(
    session: AsyncSession,
    user: User,
    favorite_restaurants: Optional[list[str]] = None,
    favorite_cuisines: Optional[list[str]] = None,
    food_influences: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Build or update taste DNA via Qloo entity resolution."""
    from services import qloo_service, taste_profile

    if not qloo_service.is_configured():
        return {
            "success": False,
            "error": "Qloo API not configured",
        }

    try:
        taste_dna = await qloo_service.build_taste_dna(
            favorite_restaurants=favorite_restaurants or [],
            favorite_cuisines=favorite_cuisines or [],
            food_influences=food_influences or [],
        )

        # Merge with existing DNA if present
        existing = await taste_profile.get_taste_dna(user)
        if existing.get("entity_ids"):
            combined_ids = list(dict.fromkeys(
                existing["entity_ids"] + taste_dna["entity_ids"]
            ))
            taste_dna["entity_ids"] = combined_ids[-50]
            taste_dna["cuisine_affinities"] = list(dict.fromkeys(
                existing.get("cuisine_affinities", []) +
                taste_dna.get("cuisine_affinities", [])
            ))

        await taste_profile.save_taste_dna(session, user, taste_dna)

        return {
            "success": True,
            "taste_dna_summary": {
                "entity_count": len(taste_dna.get("entity_ids", [])),
                "cuisines": taste_dna.get("cuisine_affinities", []),
                "cultural_tags": taste_dna.get("cultural_tags", []),
                "dining_matches": len(taste_dna.get("cross_domain_dining", [])),
            },
            "message": "Taste profile updated with Qloo cultural intelligence.",
        }
    except Exception as e:
        logger.error(f"Taste profile update failed: {e}")
        return {"success": False, "error": str(e)}
```

#### 4. `backend/tests/test_qloo_integration.py`
Tests proving Qloo is central.

---

### MODIFIED FILES (8)

#### 5. `backend/agent/tools.py`
- Add 3 new Qloo tool definitions to `TOOL_DEFINITIONS`
- Add routing in `execute_tool()` to `qloo_tools.py`

#### 6. `backend/agent/orchestrator.py`
- Add taste/culture intent patterns
- **CRITICAL**: When user asks for recommendations, ALWAYS call `get_taste_recommendations` (not just nutrition gaps + generic LLM)
- After meal log, call taste feedback update
- Fallback response shows alignment scores when available
- New `_format_fallback_response()` section for taste recommendations

#### 7. `backend/agent/prompts.py`
- Add Qloo Cultural Intelligence section to system prompt
- Instruct LLM to ALWAYS use taste tools, NEVER generic suggestions
- Mandate alignment scores in every recommendation
- Taste onboarding prompt when taste_dna is empty

#### 8. `backend/mcp_server.py`
- Add 3 new MCP tools: `get_taste_recommendations`, `discover_cultural_meals`, `update_taste_profile`

#### 9. `backend/services/profile_service.py`
- Add `taste_dna`, `taste_onboarded`, `cuisine_affinities` to profile output

#### 10. `backend/routers/agent.py`
- Add `POST /api/agent/taste-onboarding` endpoint
- Add `taste_preferences` to `ProfileSettingsUpdateInput`
- Update health check to show Qloo status

#### 11. `backend/.env` and `.env.example`
```env
QLOO_API_KEY=your_key_here
QLOO_BASE_URL=https://api.qloo.com
```

#### 12. `README.md`
- Complete rewrite for Qloo hackathon submission
- Judge testing instructions
- Architecture diagram showing Qloo in critical path

---

## Checklist Before Submission

- [ ] **Repository is PUBLIC** on GitHub
- [ ] **Open source license** (MIT) visible in repo root
- [ ] **Live demo URL** works: `http://3.92.206.205:8000/assistant`
- [ ] **Demo user seeded** with pre-built taste profile (demo@caliwo.app)
- [ ] **QLOO_API_KEY** configured in production `.env`
- [ ] **Judge testing script** in README:
  1. Go to live URL
  2. Login with demo credentials
  3. Ask "What should I eat for dinner?" -> see taste-aligned recs with scores
  4. Say "I love Thai food and ramen" -> see taste DNA update
  5. Ask again -> see recommendations shift toward Thai/Japanese
- [ ] **Devpost page** written with features, architecture, Qloo integration story
- [ ] **All E2E tests pass** including Qloo integration tests
- [ ] **Health endpoint** shows `"qloo_integration": "active"`
