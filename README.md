# Caliwo — Culturally-Attuned Agentic AI Nutrition Platform
### *Bridging Physical Biometrics with Cultural Taste AI*

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Qloo Taste AI](https://img.shields.io/badge/Powered%20By-Qloo%20Taste%20AI-6366F1.svg)](https://qloo.com)
[![Agentic AI](https://img.shields.io/badge/Agentic-Multi--Turn%20Tool%20Calling-10B981.svg)](#-agentic-tool-calling-architecture)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11-0284C7.svg)](backend/)
[![Frontend](https://img.shields.io/badge/Mobile-React%20Native%20%7C%20Expo-EC4899.svg)](frontend/)

> **Built for the Qloo Agentic Hackathon 2026**  
> Caliwo eliminates **"Cultural Blindness"** in health and nutrition AI by harmonizing physiological macronutrient targets with Qloo's cross-domain cultural taste graph.

---

## 💡 The Core Problem: Cultural Blindness in Nutrition AI

Traditional calorie and macro trackers treat human beings like clinical spreadsheets. They tell a user they need *"42g of protein and 520 calories,"* and then suggest the exact same uninspired, culturally vacant meal to everyone: plain boiled chicken breast, white rice, and steamed broccoli.

**This is why users abandon nutrition apps.** Food is not merely fuel; food is identity, art, memory, travel, cinema, and music.

### The Caliwo Solution
Caliwo is an **autonomous, culturally-attuned AI nutrition platform**. It combines:
1. **Biometric Precision:** Real-time tracking of calories, protein, carbs, fats, fiber, sugar, sodium, and magnesium deficits.
2. **Qloo Cultural Intelligence:** Multi-domain taste analysis spanning favorite restaurants, cuisines, films/TV, music artists, travel destinations, and culinary inspirations.
3. **Autonomous Agent Loop:** Multi-turn tool calling that analyzes macro gaps, queries Qloo's taste graph, and synthesizes gourmet, culturally-resonant recipes tailored to the individual.

---

## 🧠 Agentic Tool-Calling Architecture

Rather than executing a single static prompt, Caliwo Coach employs an **autonomous multi-turn agent loop** (`MAX_TOOL_TURNS = 5`) powered by OpenAI/Anthropic function calling. The agent inspects the user's intent, dynamically executes specialized domain tools, and reasons across physiological and cultural constraints before formulating its response.

```
                               ┌─────────────────────────────────────────┐
                               │           User / Mobile App             │
                               │  "What should I eat tonight for dinner? │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │       FastAPI Agent Orchestrator        │
                               │          (backend/routers/coach.py)     │
                               └────────────────────┬────────────────────┘
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   ▼                                                                 ▼
      ┌─────────────────────────┐                                       ┌─────────────────────────┐
      │  Autonomous Tool Loop   │◄─────────────────┐                    │   AI Model Execution    │
      │   (agent_tools.py)      │                  │                    │ (OpenAI / Anthropic)    │
      └────────────┬────────────┘                  │                    └────────────┬────────────┘
                   │                               │                                 │
                   ├───────────────────────────────┼─────────────────────────────────┘
                   │ Tool Calls Executed:          │ Feed Tool Results
                   ▼                               │ Back to Model
┌───────────────────────────────────────┐          │
│ 1. get_biometrics_and_macro_gaps      │──────────┤
│    → Computes remaining protein/kcal  │          │
│                                       │          │
│ 2. query_qloo_taste_graph             │──────────┤
│    → Retrieves taste-aligned dining   │          │
│                                       │          │
│ 3. search_qloo_cultural_entity        │──────────┤
│    → Resolves film/artist/food links  │          │
│                                       │          │
│ 4. synthesize_culturally_aligned_recipe│─────────┘
│    → Combines macros + cultural DNA   │
└───────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Final Agent Synthesis:                                                 │
│ "Based on your remaining 38g of protein and love for Jiro Dreams of    │
│  Sushi and Chet Baker's Tokyo jazz sessions, here is a gourmet         │
│  Miso-Glazed Black Cod & Truffle Edamame Bowl..."                      │
└────────────────────────────────────────────────────────────────────────┘
```

### The 4 Autonomous Agent Tools

| Tool Name | Scope & Function |
|:---|:---|
| `get_biometrics_and_macro_gaps` | Queries the user's daily nutrition log to compute real-time deficits across calories, protein, carbs, fats, fiber, and micronutrients. |
| `query_qloo_taste_graph` | Queries Qloo's cultural intelligence API using the user's cross-domain entity IDs to find correlated dining and flavor profiles. |
| `search_qloo_cultural_entity` | Searches and resolves cultural entities (films, music, restaurants, travel hubs) directly against the Qloo Entity Search API. |
| `synthesize_culturally_aligned_recipe` | Generates a structured gourmet recipe meeting exact nutritional constraints while incorporating cultural references from the user's Taste DNA. |

---

## 🎨 6-Domain Taste DNA & User Experience

Caliwo maps cultural taste across 6 distinct domains, creating a rich multi-dimensional profile stored in `user.profile["taste_dna"]`:

1. **Dining & Restaurants:** Favorite dining spots (e.g., Nobu, Sweetgreen, Chipotle).
2. **Cuisines:** Deep affinities (e.g., Japanese, Mediterranean, Oaxacan, Nordic).
3. **Cinema & Television:** Films that evoke specific culinary cultures (e.g., *Jiro Dreams of Sushi*, *Midnight in Paris*, *Chef*).
4. **Music & Audio:** Artists whose vibe reflects dining preferences (e.g., Chet Baker, Frank Ocean, Bad Bunny).
5. **Travel Destinations:** Places that shaped the user's palate (e.g., Tokyo, Barcelona, Mexico City).
6. **Culinary Influences:** Philosophy and inspirations (e.g., Anthony Bourdain, Farm-to-Table, Street Food).

### Key Mobile Touchpoints (`frontend/`)
- **Seamless Post-Registration Onboarding:** Immediately following signup, new users enter an interactive 5-step Taste DNA onboarding flow (`taste-onboarding.tsx`).
- **Home Screen Cultural Recommendation Card:** Positioned directly below daily macro rings (`home.tsx`), surfacing real-time cultural match scores (`96% MATCH`), cross-domain tags, and a 1-tap *"Ask Coach for Recipe"* action.
- **Auto-Prompting Coach:** Tapping the recommendation card passes the intent directly into `coach.tsx`, autonomously triggering the agent tool loop.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- (Optional) Docker for local PostgreSQL

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `.env` and verify your API keys:
```ini
OPENAI_API_KEY=sk-...           # or ANTHROPIC_API_KEY
QLOO_API_KEY=your_qloo_api_key  # Required for cultural intelligence
DATABASE_URL=sqlite+aiosqlite:///./test.db # or Neon Postgres
JWT_SECRET=your_secret_key_here
```

Run database setup & seed the Demo Account:
```bash
# Seed the demo account with pre-configured 6-domain Taste DNA
python3 scripts/seed_demo.py

# Run backend unit & agent tool tests
python3 tests/test_coach_agent_tools.py

# Start FastAPI server
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup (Mobile App)

```bash
cd frontend

# Install dependencies
npm install

# Verify type safety
npx tsc --noEmit

# Start Expo development server
npx expo start
```

Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with the Expo Go app on your physical mobile device.

---

## 🔑 Demo Account Credentials

A fully configured demo account is pre-seeded with complete biometric targets and 6-domain Taste DNA:

- **Email:** `demo@caliwo.app`
- **Password:** `Demo1234!`
- **Pre-Seeded Taste DNA:**
  - *Restaurants:* Nobu, Sweetgreen, Chipotle
  - *Cuisines:* Japanese, Mediterranean, Mexican
  - *Cinema:* Jiro Dreams of Sushi, Midnight in Paris, Chef
  - *Music:* Chet Baker, Frank Ocean, Bad Bunny
  - *Travel:* Tokyo, Barcelona, Mexico City
  - *Influences:* Anthony Bourdain, Farm to Table

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── routers/
│   │   ├── auth.py                  # JWT authentication & registration
│   │   ├── coach.py                 # Autonomous Coach Agent with tool-calling loop
│   │   ├── taste.py                 # Qloo Taste DNA onboarding & recommendations
│   │   ├── meals.py                 # Meal logging & macronutrient tracking
│   │   └── nutrition.py             # Daily biometrics, gaps, and analytics
│   ├── services/
│   │   ├── agent_tools.py           # 4 autonomous Coach agent tools
│   │   ├── qloo_service.py          # Qloo API client (X-Api-Key, entity search, insights)
│   │   ├── taste_profile.py         # Taste DNA persistence & alignment scoring
│   │   ├── ai_provider.py           # Multi-turn OpenAI/Anthropic tool loop provider
│   │   └── nutrition_service.py     # Biometric calculations & macro gaps
│   ├── scripts/
│   │   └── seed_demo.py             # Demo account seeder with full Taste DNA
│   ├── tests/
│   │   └── test_coach_agent_tools.py# Test suite for autonomous agent tools
│   ├── server.py                    # FastAPI application entrypoint
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── (auth)/                  # Signup, signin, password recovery
│   │   ├── (tabs)/
│   │   │   ├── home.tsx             # Dashboard + Cultural Recommendation Card
│   │   │   ├── coach.tsx            # AI Coach chat interface with query param listener
│   │   │   └── profile.tsx          # User profile & Taste DNA summary
│   │   └── taste-onboarding.tsx     # 5-step interactive cultural onboarding
│   ├── src/
│   │   ├── components/              # UI components (QlooGate, Rings, Modals)
│   │   ├── context/                 # AuthContext & state providers
│   │   └── lib/api.ts               # Axios HTTP client
│   └── package.json
├── LICENSE                          # MIT Open Source License
└── README.md
```

---

## 🧪 Testing

Run the agent tools validation suite:
```bash
cd backend
python3 tests/test_coach_agent_tools.py
```
*Output:*
```
Testing: get_biometrics_and_macro_gaps...  OK
Testing: search_qloo_cultural_entity...     OK
Testing: query_qloo_taste_graph...          OK
Testing: synthesize_culturally_aligned_recipe... OK
Testing: execute_coach_tool dispatcher...    OK
✅ All Agent Tool Tests Passed Successfully!
```

Run frontend type checking:
```bash
cd frontend
npx tsc --noEmit
```
*Output: 0 errors.*

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
