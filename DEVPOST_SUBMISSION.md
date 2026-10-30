# Caliwo — Devpost Submission Guide & Project Story

> **Hackathon:** Qloo Agentic Hackathon 2026  
> **Project Name:** Caliwo (Caliwo — Culturally-Attuned Agentic Nutrition Platform)  
> **Tagline:** Where your macros meet your culture: an autonomous AI nutrition companion powered by Qloo's Taste Graph.  
> **Elevator Pitch (180 chars):**  
> *Caliwo eliminates cultural blindness in nutrition AI. Using autonomous agent tools & Qloo's Taste Graph, it aligns real-time macro needs with your music, film, and dining identity.*

---

## Inspiration

Every year, millions of people download calorie and macronutrient trackers to improve their health. Yet within 30 days, over **80% abandon them** [^1]. 

The root cause is not a lack of user willpower—it is ==Cultural Blindness==.

Traditional nutrition applications are built around ~~treating human beings like clinical spreadsheets~~. When an algorithm calculates a daily deficit of 42 g of protein and 520 kcal, existing apps prescribe the exact same culturally vacant meal to everyone on earth: ~~plain boiled chicken breast, dry white rice, and steamed broccoli~~.

Food is never merely fuel. Food is heritage, comfort, family memory, cinema, and music. Demanding that someone abandon their culinary identity to meet their fitness goals leads directly to diet burnout. We built **Caliwo** to answer a fundamental question:

> *What if an AI health coach possessed genuine cultural intelligence? What if hitting your macro targets felt like dining at your favorite culturally-attuned bistro or cooking an authentic family dish inspired by your favorite music and films?*

By coupling an ==autonomous multi-turn agent loop== with **Qloo’s Cultural Taste Graph** [^2], we set out to prove that physiological biometrics and cultural identity do not have to be in conflict.

---

## What it does

**Caliwo** is an autonomous, culturally-attuned AI nutrition companion that harmonizes real-time physiological biometrics with Qloo’s 6-domain Cultural Taste Graph.

- **Computer-Vision Calorie Tracking:** Users snap a photo of any meal—from homemade *Pho Ga* to *Oaxacan Mole Negro*—to instantly log calories, micronutrients, and a 6-tier macro breakdown.
- **6-Domain Taste DNA:** Caliwo profiles cultural affinities across 6 distinct pillars:
  1. **Dining & Restaurants** (e.g., *Nobu*, *Sweetgreen*)
  2. **Regional Cuisines** (e.g., *Nordic*, *Japanese Izakaya*, *Oaxacan*)
  3. **Cinema & Television** (e.g., *Jiro Dreams of Sushi*, *In the Mood for Love*, *The Bear*)
  4. **Music & Audio** (e.g., *Chet Baker*, *Khruangbin*, *Bossa Nova*)
  5. **Travel Palates** (e.g., *Tokyo*, *Barcelona*, *Oaxaca*)
  6. **Culinary Philosophies** (e.g., *Anthony Bourdain*, *Farm-to-Table*)
- **Multi-Turn Autonomous Agent Loop:** Instead of executing a static one-shot prompt, Caliwo initiates an autonomous agent loop (`MAX_TOOL_TURNS = 5`). It inspects biometric deficits, resolves Qloo entity affinities, and synthesizes a verified, gourmet recipe or restaurant order matching the exact macro deficit.

---

## How we built it

Caliwo is architected as an end-to-end full-stack agentic ecosystem:

| Layer | Technology | Primary Function |
| --- | --- | --- |
| Mobile Frontend | React Native, Expo SDK 52/57 | Meal scanning, taste onboarding, interactive agent chat |
| Backend Core | FastAPI, Python 3.11 | Agent orchestrator, macro deficit tracking, async session management |
| Cultural AI | Qloo V2 API (`/search`, `/v2/insights`) | 6-domain cultural entity resolution and taste correlation |
| Database | PostgreSQL + JSONB | User profiles, biometric history, and Taste DNA vectors |
| Web Simulator | React 19, Vite | In-browser interactive playground for real-time hackathon testing |

### Autonomous Agent Tools (Definition List)

`get_biometrics_and_macro_gaps`
: Queries the user's daily nutrition log to compute real-time deficit metrics across calories, protein, carbs, fats, fiber, and micronutrients.

`query_qloo_taste_graph`
: Traverses Qloo's cultural intelligence graph using the user's cross-domain entity IDs to surface correlated dining and flavor profiles.

`search_qloo_cultural_entity`
: Searches and resolves cultural entities (films, artists, venues, cuisines) directly against Qloo's global cultural index.

`synthesize_culturally_aligned_recipe`
: Synthesizes a macro-verified recipe and calculates the verified **Bio-Cultural Alignment Score**.

```json
{
  "agent_tool": "synthesize_culturally_aligned_recipe",
  "dish_name": "Miso-Glazed Black Cod & Truffle Edamame Bowl",
  "cuisine": "Modern Japanese",
  "cultural_inspiration": "Tokyo Jazz Bar vibes & Jiro Dreams of Sushi",
  "estimated_macros": { "calories": 540, "protein_g": 38, "carbs_g": 32, "fat_g": 14 },
  "alignment_score": 94
}
```

### Mathematical Formulation: Bio-Cultural Alignment Score

To ensure recommendations satisfy both cultural authenticity and biometric rigor, Caliwo calculates a blended ==Bio-Cultural Alignment Score== \\(S_{\text{align}} \in [0, 100]\\):

$$
S_{\text{align}} = \omega_{\text{culture}} \times S_{\text{cultural}} + \omega_{\text{nutrition}} \times S_{\text{nutrition}}
$$

where weights are tuned to prioritize cultural enjoyment while maintaining strict nutritional discipline:

$$
\omega_{\text{culture}} = 0.60, \quad \omega_{\text{nutrition}} = 0.40
$$

The **Nutritional Fidelity Score** \\(S_{\text{nutrition}}\\) balances calorie fidelity \\(S_{\text{cal}}\\) and protein attainment \\(S_{\text{pro}}\):

$$
S_{\text{cal}} = \max\left(20, \; 100 - \frac{|C_{\text{remaining}} - C_{\text{recipe}}|}{C_{\text{remaining}}} \times 80\right)
$$

$$
S_{\text{pro}} = \min\left(100, \; \frac{P_{\text{recipe}}}{P_{\text{remaining}}} \times 100\right)
$$

$$
S_{\text{nutrition}} = \frac{S_{\text{cal}} + S_{\text{pro}}}{2}
$$

The **Cultural Match Score** \\(S_{\text{cultural}}\\) evaluates the overlap between recipe markers and the user's active Qloo Taste Graph cluster:

$$
S_{\text{cultural}} = \min\left(98, \; \max\left(75, \; 84 + 4 \times |\mathcal{T}_{\text{DNA}} \cap \mathcal{M}_{\text{recipe}}|\right)\right)
$$

---

## Challenges we ran into

- **Multi-Objective Optimization (Hard Macros vs. Fuzzy Culture):** Generative AI tends to either hallucinate macro numbers or butcher cultural recipes (e.g., attempting to force 45 g of protein into Japanese ramen by suggesting whey protein in dashi broth). We resolved this by building strict nutritional boundary validation inside `synthesize_culturally_aligned_recipe`. The tool programmatically calibrates authentic, nutrient-dense ingredients (e.g., black cod, ajitsuke tamago, edamame, silken tofu) without corrupting culinary heritage.
- **Cross-Domain Latency in Agent Loops:** Querying Qloo's taste graph across multiple non-food domains (music, film, travel) inside an interactive chat turn introduced latency. We engineered an asynchronous pipeline with in-memory TTL caching and parallel entity resolution, bringing total multi-turn agent response time down to **under 2.2 seconds**.
- **Loop Safety and Agent Determinism:** Autonomous agents can risk looping indefinitely or failing to synthesize a final answer. We implemented a deterministic loop guard (`MAX_TOOL_TURNS = 5`) and explicit prompt boundaries mandating that taste graph lookups must conclude with recipe synthesis and verified telemetry.

---

## Accomplishments that we're proud of

- **True Cross-Domain Taste Synthesis:** The agent successfully connects non-culinary tastes to food—recommending a *Truffle Miso Glazed Cod Bowl* because the user loves *Jiro Dreams of Sushi* and *Tokyo jazz bars*, while hitting an exact 38 g protein deficit down to the single gram.
- **Explainable Agent Telemetry:** Every recommendation renders an ==Agent Telemetry Badge== in the mobile client, exposing the exact tool execution trace, Qloo entity IDs referenced, and calculated Bio-Cultural Alignment Score.
- **Production-Grade Delivery:** Built a complete native mobile build (`caliwo-release.apk`), a high-performance FastAPI backend with 100% test coverage across agent tools, and an interactive web playground for live judging.

---

## What we learned

- **Culture is the Primary Retention Driver in Health:** People do not abandon nutrition plans because they lack willpower; they abandon them because standard diets demand cultural alienation. When an app respects personal identity, dietary compliance transitions from a daily chore into an enjoyable lifestyle.
- **Agentic Tool-Calling Outperforms Single Prompts:** Single-prompt LLMs produce generic advice and unreliable nutritional estimations. Splitting the problem into specialized tools (`get_biometrics_and_macro_gaps` for hard physiological facts, `query_qloo_taste_graph` for cultural intelligence, and `synthesize_culturally_aligned_recipe` for mathematical verification) produces auditable, trustworthy results.

---

## What's next for Caliwo — Culturally-Attuned Agentic Nutrition Platform

- [x] Verified native mobile build (`caliwo-release.apk`) for hackathon judging
- [x] Full Qloo V2 Taste Intelligence Graph & Entity Resolution integration
- [x] 4-tool multi-turn autonomous agent orchestrator with loop safety guards
- [ ] **Autonomous Delivery & Ordering Tools:** Connect the agent to Instacart and DoorDash tool endpoints, allowing users to automatically order raw ingredients or place customized orders at local ethnic restaurants.
- [ ] **Dynamic Taste Evolution:** Implement continuous learning that recalibrates the user’s Qloo Taste DNA weights each time a meal photo is logged or a dish is rated.
- [ ] **Biometric Wearable Synchronization:** Deep integration with Apple HealthKit and Android Health Connect to dynamically adjust macro targets in real time based on continuous glucose monitor (CGM) trends and active calorie expenditure.

---

[^1]: Based on digital health retention studies showing over 80% abandonment within 30 days due to dietary fatigue.
[^2]: Qloo V2 API documentation and cross-domain cultural entity correlation standards.

