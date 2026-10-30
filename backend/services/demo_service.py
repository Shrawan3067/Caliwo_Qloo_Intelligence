"""
Caliwo Demo User Service & Auto-Reset Safeguard.

Provides programmatic resetting and automatic safeguarding of the demo user account
(demo@caliwo.app) so that hackathon judges and demo viewers always experience the
ideal state: 1,120 kcal consumed today, leaving 980 kcal and 58g protein for dinner.
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from models import User, Meal, DailySummary, ChatMessage
from routers.auth import hash_password

logger = logging.getLogger(__name__)

DEMO_USER_ID = "demo_user_001"
DEMO_EMAIL = "demo@caliwo.app"
DEMO_PASSWORD = "Demo1234!"
DEMO_NAME = "Alex"

PERSONA_GROCERY_ITEMS: dict[str, list[str]] = {
    "alex": [
        "Saikyo Sweet Miso",
        "Forbidden Black Rice",
        "Baby Bok Choy",
        "Organic Edamame",
        "Wild Alaskan Salmon",
        "Wild Alaskan Cod",
        "Organic Quinoa",
        "Citrus Ponzu Glaze",
        "Shiitake Mushrooms",
        "Artisan Sourdough Loaf",
        "Organic Greek Yogurt",
        "Hass Avocado",
        "Pasture-Raised Eggs",
    ],
    "elena": [
        "Ancient Farro",
        "Kalamata Olives in Brine",
        "Mediterranean Sea Bass",
        "Free-Range Chicken Breast",
        "Meyer Lemon Zest",
        "Sun-Ripened Cherry Tomatoes",
        "Greek Feta Cheese",
        "Cold-Pressed Extra Virgin Olive Oil",
        "Artisan Sourdough Loaf",
        "Organic Greek Yogurt",
        "Organic Baby Spinach",
        "Pasture-Raised Eggs",
    ],
    "marcus": [
        "Guajillo Chili Adobo",
        "Charred Poblano Peppers",
        "Grass-Fed Flank Steak",
        "Cilantro Quinoa Base",
        "Organic Black Beans",
        "Artisan Cotija Cheese",
        "Fresh Corn Tortillas",
        "Fire-Roasted Salsa",
        "Hass Avocado",
        "Wood-Fired Chicken Breast",
        "Fresh Limes",
        "Pasture-Raised Eggs",
    ],
}


def build_persona_meal_plan(persona_id: str) -> dict:
    p_id = str(persona_id).lower().strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    if p_id == "elena":
        # Elena: Mediterranean Minimalist & Amalfi Coast (1,850 kcal, 125g protein)
        days_templates = [
            # Day 1
            [
                {"slot": "breakfast", "name": "Avocado & Poached Egg on Artisan Sourdough with Meyer Lemon", "calories": 410.0, "protein_g": 24.0, "carbs_g": 38.0, "fat_g": 18.0, "ingredients": ["Pasture-Raised Eggs", "Artisan Sourdough Loaf", "Hass Avocado", "Meyer Lemon Zest"], "cuisine": "Mediterranean Breakfast", "cultural_inspiration": "Amalfi coastal morning plate with healthy fats and lean protein", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Aegean Lemon Herb Chicken Salad with Sun-Ripened Tomatoes", "calories": 520.0, "protein_g": 42.0, "carbs_g": 35.0, "fat_g": 16.0, "ingredients": ["Free-Range Chicken Breast", "Sun-Ripened Cherry Tomatoes", "Organic Baby Spinach", "Cold-Pressed Extra Virgin Olive Oil"], "cuisine": "Mediterranean", "cultural_inspiration": "Light Positano trattoria midday lunch", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Amalfi Lemon-Herb Sea Bass & Ancient Farro with Kalamata Olives", "calories": 550.0, "protein_g": 46.0, "carbs_g": 48.0, "fat_g": 16.0, "ingredients": ["Mediterranean Sea Bass", "Ancient Farro", "Kalamata Olives in Brine", "Meyer Lemon Zest"], "cuisine": "Mediterranean", "cultural_inspiration": "Bridging your passion for Italian coastal dining and acoustic jazz with ancient grains", "bio_cultural_score": 96},
            ],
            # Day 2
            [
                {"slot": "breakfast", "name": "Greek Yogurt Granola Bowl with Honey & Toasted Almonds", "calories": 380.0, "protein_g": 26.0, "carbs_g": 44.0, "fat_g": 12.0, "ingredients": ["Organic Greek Yogurt", "Ancient Farro Granola", "Raw Almonds", "Wild Honey"], "cuisine": "Greek Breakfast", "cultural_inspiration": "Classic Aegean morning breakfast rich in bioavailable calcium", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Mediterranean Quinoa Bowl with Kalamata Olives & Crumbled Feta", "calories": 510.0, "protein_g": 38.0, "carbs_g": 52.0, "fat_g": 18.0, "ingredients": ["Organic Quinoa", "Kalamata Olives in Brine", "Greek Feta Cheese", "Sun-Ripened Cherry Tomatoes"], "cuisine": "Mediterranean", "cultural_inspiration": "High-fiber Aegean midday power bowl", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Herb-Crusted Free-Range Chicken Breast with Ancient Farro & Kalamata Olives", "calories": 580.0, "protein_g": 48.0, "carbs_g": 46.0, "fat_g": 18.0, "ingredients": ["Free-Range Chicken Breast", "Ancient Farro", "Kalamata Olives in Brine", "Cold-Pressed Extra Virgin Olive Oil"], "cuisine": "Mediterranean", "cultural_inspiration": "Positano rustic herbed chicken with magnesium-rich ancient grains", "bio_cultural_score": 97},
            ],
            # Day 3
            [
                {"slot": "breakfast", "name": "Mediterranean Egg White Frittata with Spinach & Feta", "calories": 390.0, "protein_g": 28.0, "carbs_g": 22.0, "fat_g": 16.0, "ingredients": ["Pasture-Raised Eggs", "Organic Baby Spinach", "Greek Feta Cheese", "Sun-Ripened Cherry Tomatoes"], "cuisine": "Mediterranean Breakfast", "cultural_inspiration": "Iron-rich spinach and savory Greek feta frittata", "bio_cultural_score": 95},
                {"slot": "lunch", "name": "Tuscan White Bean & Tuna Salad with Meyer Lemon", "calories": 520.0, "protein_g": 42.0, "carbs_g": 48.0, "fat_g": 14.0, "ingredients": ["Mediterranean Tuna", "Cannellini Beans", "Meyer Lemon Zest", "Cold-Pressed Extra Virgin Olive Oil"], "cuisine": "Italian Coastal", "cultural_inspiration": "Traditional Italian coastal recovery salad", "bio_cultural_score": 94},
                {"slot": "dinner", "name": "Pan-Roasted Mediterranean Sea Bass with Kalamata Tapenade & Farro", "calories": 560.0, "protein_g": 47.0, "carbs_g": 44.0, "fat_g": 16.0, "ingredients": ["Mediterranean Sea Bass", "Kalamata Olives in Brine", "Ancient Farro", "Sun-Ripened Cherry Tomatoes"], "cuisine": "Mediterranean", "cultural_inspiration": "Wild-caught sea bass topped with rich polyphenol olive tapenade", "bio_cultural_score": 98},
            ],
            # Day 4
            [
                {"slot": "breakfast", "name": "Toasted Artisan Sourdough with Ricotta, Lemon Zest & Honey", "calories": 410.0, "protein_g": 22.0, "carbs_g": 46.0, "fat_g": 15.0, "ingredients": ["Artisan Sourdough Loaf", "Part-Skim Ricotta", "Meyer Lemon Zest", "Wild Honey"], "cuisine": "Italian Breakfast", "cultural_inspiration": "Rustic sourdough breakfast with light lemon citrus aromatics", "bio_cultural_score": 93},
                {"slot": "lunch", "name": "Sweetgreen-Style Warm Ancient Farro Bowl with Roasted Chicken & Lemon", "calories": 540.0, "protein_g": 44.0, "carbs_g": 50.0, "fat_g": 16.0, "ingredients": ["Free-Range Chicken Breast", "Ancient Farro", "Organic Baby Spinach", "Meyer Lemon Zest"], "cuisine": "Mediterranean", "cultural_inspiration": "Sweetgreen-inspired warm ancient grain bowl", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Osteria Stellina Truffle Herb Chicken with Ancient Farro", "calories": 580.0, "protein_g": 49.0, "carbs_g": 45.0, "fat_g": 18.0, "ingredients": ["Free-Range Chicken Breast", "Ancient Farro", "Truffle Glaze", "Kalamata Olives in Brine"], "cuisine": "Italian Rustic", "cultural_inspiration": "Tuscan hill-town herbed roast with delicate truffle aroma", "bio_cultural_score": 97},
            ],
            # Day 5
            [
                {"slot": "breakfast", "name": "Soft-Boiled Eggs over Sautéed Baby Spinach & Tomatoes", "calories": 380.0, "protein_g": 26.0, "carbs_g": 20.0, "fat_g": 18.0, "ingredients": ["Pasture-Raised Eggs", "Organic Baby Spinach", "Sun-Ripened Cherry Tomatoes", "Artisan Sourdough Loaf"], "cuisine": "Mediterranean Breakfast", "cultural_inspiration": "Antioxidant-rich morning plate with leafy greens", "bio_cultural_score": 95},
                {"slot": "lunch", "name": "Grilled Calamari & Ancient Farro Salad with Arugula", "calories": 500.0, "protein_g": 40.0, "carbs_g": 48.0, "fat_g": 14.0, "ingredients": ["Mediterranean Calamari", "Ancient Farro", "Wild Arugula", "Meyer Lemon Zest"], "cuisine": "Mediterranean", "cultural_inspiration": "Coastal seafood salad with nutty ancient farro", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Wild Salmon with Kalamata Olive Crust, Sun-Ripened Tomatoes & Farro", "calories": 590.0, "protein_g": 50.0, "carbs_g": 44.0, "fat_g": 20.0, "ingredients": ["Wild Alaskan Salmon", "Kalamata Olives in Brine", "Sun-Ripened Cherry Tomatoes", "Ancient Farro"], "cuisine": "Mediterranean", "cultural_inspiration": "Rich omega-3 salmon crusted with crushed Kalamata olives", "bio_cultural_score": 97},
            ],
            # Day 6
            [
                {"slot": "breakfast", "name": "Organic Greek Yogurt with Toasted Walnuts & Blueberries", "calories": 390.0, "protein_g": 27.0, "carbs_g": 36.0, "fat_g": 16.0, "ingredients": ["Organic Greek Yogurt", "Raw Walnuts", "Fresh Blueberries", "Wild Honey"], "cuisine": "Greek Breakfast", "cultural_inspiration": "Brain-boosting morning bowl with protective antioxidants", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Mediterranean Grilled Chicken Wrap with Hummus & Kalamata Olives", "calories": 530.0, "protein_g": 41.0, "carbs_g": 52.0, "fat_g": 16.0, "ingredients": ["Free-Range Chicken Breast", "Whole Grain Flatbread", "Hummus", "Kalamata Olives in Brine"], "cuisine": "Aegean", "cultural_inspiration": "Portable Mediterranean wrap with savory olive tapenade", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Lemon-Herb Branzino with Ancient Farro Pilaf & Kalamata Olives", "calories": 560.0, "protein_g": 47.0, "carbs_g": 46.0, "fat_g": 16.0, "ingredients": ["Mediterranean Sea Bass", "Ancient Farro", "Kalamata Olives in Brine", "Meyer Lemon Zest"], "cuisine": "Mediterranean", "cultural_inspiration": "Whole roasted coastal branzino over warm farro pilaf", "bio_cultural_score": 98},
            ],
            # Day 7
            [
                {"slot": "breakfast", "name": "Artisan Sourdough Toast with Avocado & Poached Egg", "calories": 420.0, "protein_g": 25.0, "carbs_g": 38.0, "fat_g": 19.0, "ingredients": ["Artisan Sourdough Loaf", "Pasture-Raised Eggs", "Hass Avocado", "Cold-Pressed Extra Virgin Olive Oil"], "cuisine": "Mediterranean Breakfast", "cultural_inspiration": "Sunday morning artisan sourdough with rich avocado crema", "bio_cultural_score": 95},
                {"slot": "lunch", "name": "Caprese Salad with Grilled Chicken Breast & Aged Balsamic", "calories": 520.0, "protein_g": 44.0, "carbs_g": 32.0, "fat_g": 18.0, "ingredients": ["Free-Range Chicken Breast", "Sun-Ripened Cherry Tomatoes", "Fresh Mozzarella", "Cold-Pressed Extra Virgin Olive Oil"], "cuisine": "Italian Coastal", "cultural_inspiration": "Classic Capri island salad with lean grilled chicken", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Amalfi Lemon-Herb Chicken Breast with Ancient Farro & Roasted Vegetables", "calories": 570.0, "protein_g": 48.0, "carbs_g": 46.0, "fat_g": 17.0, "ingredients": ["Free-Range Chicken Breast", "Ancient Farro", "Kalamata Olives in Brine", "Meyer Lemon Zest"], "cuisine": "Mediterranean", "cultural_inspiration": "Positano lemon-marinated chicken closing out the weekly targets", "bio_cultural_score": 97},
            ],
        ]
    elif p_id == "marcus":
        # Marcus: Oaxacan Smoke & Strength Explorer (2,400 kcal, 175g protein)
        days_templates = [
            # Day 1
            [
                {"slot": "breakfast", "name": "Chilaquiles Verdes with Scrambled Eggs & Queso Cotija", "calories": 520.0, "protein_g": 35.0, "carbs_g": 48.0, "fat_g": 22.0, "ingredients": ["Pasture-Raised Eggs", "Fresh Corn Tortillas", "Artisan Cotija Cheese", "Fire-Roasted Salsa"], "cuisine": "Mexican Breakfast", "cultural_inspiration": "Oaxacan morning energy plate with high-satiety protein", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Grilled Citrus Flank Steak Bowl with Cilantro Quinoa & Black Beans", "calories": 680.0, "protein_g": 52.0, "carbs_g": 62.0, "fat_g": 22.0, "ingredients": ["Grass-Fed Flank Steak", "Cilantro Quinoa Base", "Organic Black Beans", "Hass Avocado"], "cuisine": "Modern Mexican", "cultural_inspiration": "High-protein recovery bowl with complex carbohydrates", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Oaxacan Braised Beef Barbacoa Bowl with Guajillo Adobo & Charred Poblanos", "calories": 720.0, "protein_g": 56.0, "carbs_g": 58.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Guajillo Chili Adobo", "Charred Poblano Peppers", "Cilantro Quinoa Base", "Organic Black Beans"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Correlated with your taste for smoky Mexican heritage and hip-hop rhythms, fueling your strength targets", "bio_cultural_score": 96},
            ],
            # Day 2
            [
                {"slot": "breakfast", "name": "High-Protein Huevos Rancheros with Black Beans & Fresh Corn Tortillas", "calories": 510.0, "protein_g": 34.0, "carbs_g": 50.0, "fat_g": 20.0, "ingredients": ["Pasture-Raised Eggs", "Organic Black Beans", "Fresh Corn Tortillas", "Artisan Cotija Cheese"], "cuisine": "Mexican Breakfast", "cultural_inspiration": "Oaxacan ranch-style eggs with slow-simmered black beans", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Wood-Fired Chicken Breast with Guajillo Chili Adobo & Poblano Quinoa", "calories": 660.0, "protein_g": 51.0, "carbs_g": 56.0, "fat_g": 20.0, "ingredients": ["Wood-Fired Chicken Breast", "Guajillo Chili Adobo", "Charred Poblano Peppers", "Cilantro Quinoa Base"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Smoky wood-fired chicken with capsaicin-rich guajillo adobo", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Casa Oaxaca Carne Asada with Charred Poblano Peppers & Black Beans", "calories": 740.0, "protein_g": 58.0, "carbs_g": 60.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Charred Poblano Peppers", "Organic Black Beans", "Artisan Cotija Cheese"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Inspired by Casa Oaxaca wood-fired skirt steak and poblano rajas", "bio_cultural_score": 98},
            ],
            # Day 3
            [
                {"slot": "breakfast", "name": "Mexican Omelette with Diced Poblanos, Tomatoes & Crumbled Cotija", "calories": 490.0, "protein_g": 36.0, "carbs_g": 28.0, "fat_g": 24.0, "ingredients": ["Pasture-Raised Eggs", "Charred Poblano Peppers", "Artisan Cotija Cheese", "Hass Avocado"], "cuisine": "Mexican Breakfast", "cultural_inspiration": "High-protein scramble with roasted poblano strips", "bio_cultural_score": 95},
                {"slot": "lunch", "name": "Chipotle Braised Beef Barbacoa Bowl with Guacamole & Black Beans", "calories": 690.0, "protein_g": 53.0, "carbs_g": 58.0, "fat_g": 22.0, "ingredients": ["Grass-Fed Flank Steak", "Organic Black Beans", "Hass Avocado", "Fresh Corn Tortillas"], "cuisine": "Modern Mexican", "cultural_inspiration": "Slow-braised barbacoa with fresh avocado fats", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Grilled Flank Steak Tacos with Guajillo Adobo & Roasted Salsa", "calories": 730.0, "protein_g": 55.0, "carbs_g": 56.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Guajillo Chili Adobo", "Fresh Corn Tortillas", "Fire-Roasted Salsa"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Street-style double-corn tacos with authentic guajillo marinade", "bio_cultural_score": 97},
            ],
            # Day 4
            [
                {"slot": "breakfast", "name": "Breakfast Tacos with Scrambled Eggs, Black Beans & Avocado", "calories": 520.0, "protein_g": 33.0, "carbs_g": 46.0, "fat_g": 22.0, "ingredients": ["Pasture-Raised Eggs", "Organic Black Beans", "Fresh Corn Tortillas", "Hass Avocado"], "cuisine": "Mexican Breakfast", "cultural_inspiration": "Austin-style morning breakfast tacos with fresh corn tortillas", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Oaxacan Grilled Chicken Bowl with Cilantro Quinoa & Charred Corn", "calories": 670.0, "protein_g": 52.0, "carbs_g": 60.0, "fat_g": 20.0, "ingredients": ["Wood-Fired Chicken Breast", "Cilantro Quinoa Base", "Charred Poblano Peppers", "Artisan Cotija Cheese"], "cuisine": "Modern Mexican", "cultural_inspiration": "Pujol-inspired grilled poultry bowl with fresh cotija", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Slow-Braised Barbacoa Beef with Guajillo Adobo & Charred Poblanos", "calories": 740.0, "protein_g": 57.0, "carbs_g": 58.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Guajillo Chili Adobo", "Charred Poblano Peppers", "Cilantro Quinoa Base"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Wood-smoked beef chuck shoulder with charred poblano rajas", "bio_cultural_score": 97},
            ],
            # Day 5
            [
                {"slot": "breakfast", "name": "High-Protein Scramble with Chorizo-Spiced Turkey, Eggs & Cotija", "calories": 530.0, "protein_g": 38.0, "carbs_g": 32.0, "fat_g": 25.0, "ingredients": ["Pasture-Raised Eggs", "Artisan Cotija Cheese", "Hass Avocado", "Fire-Roasted Salsa"], "cuisine": "Mexican Breakfast", "cultural_inspiration": "Savory high-protein breakfast scramble", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Guajillo Glazed Salmon Bowl with Quinoa & Charred Poblanos", "calories": 680.0, "protein_g": 50.0, "carbs_g": 56.0, "fat_g": 22.0, "ingredients": ["Wild Alaskan Salmon", "Guajillo Chili Adobo", "Charred Poblano Peppers", "Cilantro Quinoa Base"], "cuisine": "Modern Mexican", "cultural_inspiration": "Coastal Mexican grilled fish with smoky chile glaze", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Smoked Flank Steak with Charred Poblano Peppers & Chimichurri", "calories": 720.0, "protein_g": 56.0, "carbs_g": 54.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Charred Poblano Peppers", "Fresh Limes", "Organic Black Beans"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Wood-fired steak with bright citrus and herb chimichurri", "bio_cultural_score": 97},
            ],
            # Day 6
            [
                {"slot": "breakfast", "name": "Huevos a la Mexicana with Sliced Avocado & Corn Tortillas", "calories": 500.0, "protein_g": 32.0, "carbs_g": 44.0, "fat_g": 21.0, "ingredients": ["Pasture-Raised Eggs", "Fresh Corn Tortillas", "Hass Avocado", "Fire-Roasted Salsa"], "cuisine": "Mexican Breakfast", "cultural_inspiration": "Traditional tomato, onion, and serrano scrambled eggs", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Wood-Fired Chicken Fajita Bowl with Charred Poblanos & Quinoa", "calories": 670.0, "protein_g": 52.0, "carbs_g": 58.0, "fat_g": 20.0, "ingredients": ["Wood-Fired Chicken Breast", "Charred Poblano Peppers", "Cilantro Quinoa Base", "Artisan Cotija Cheese"], "cuisine": "Modern Mexican", "cultural_inspiration": "Sizzling skillet fajita plate over protein-rich quinoa", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Oaxacan Braised Beef Barbacoa Bowl with Guajillo Adobo", "calories": 730.0, "protein_g": 57.0, "carbs_g": 56.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Guajillo Chili Adobo", "Organic Black Beans", "Cilantro Quinoa Base"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Saturday evening culinary anchor fueled by Mexican wood smoke", "bio_cultural_score": 98},
            ],
            # Day 7
            [
                {"slot": "breakfast", "name": "Scrambled Egg & Black Bean Breakfast Burrito with Fire-Roasted Salsa", "calories": 540.0, "protein_g": 36.0, "carbs_g": 52.0, "fat_g": 22.0, "ingredients": ["Pasture-Raised Eggs", "Organic Black Beans", "Fresh Corn Tortillas", "Artisan Cotija Cheese"], "cuisine": "Mexican Breakfast", "cultural_inspiration": "High-protein Sunday wrap with hearty black beans", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Grilled Flank Steak Salad with Cotija Cheese, Avocado & Lime", "calories": 660.0, "protein_g": 51.0, "carbs_g": 42.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Artisan Cotija Cheese", "Hass Avocado", "Fresh Limes"], "cuisine": "Modern Mexican", "cultural_inspiration": "Light and protein-dense flank steak power salad", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Wood-Fired Beef Barbacoa with Charred Poblanos & Quinoa", "calories": 740.0, "protein_g": 58.0, "carbs_g": 58.0, "fat_g": 24.0, "ingredients": ["Grass-Fed Flank Steak", "Charred Poblano Peppers", "Guajillo Chili Adobo", "Cilantro Quinoa Base"], "cuisine": "Oaxacan Smoke", "cultural_inspiration": "Celebrating 7 days of disciplined macros with authentic Oaxacan smoke", "bio_cultural_score": 98},
            ],
        ]
    else:
        # Default Alex: Tokyo Omakase & Cinema Lover (2,100 kcal, 140g protein)
        days_templates = [
            # Day 1
            [
                {"slot": "breakfast", "name": "Japanese Tamagoyaki & Sliced Avocado on Artisan Sourdough", "calories": 450.0, "protein_g": 26.0, "carbs_g": 38.0, "fat_g": 22.0, "ingredients": ["Pasture-Raised Eggs", "Artisan Sourdough Loaf", "Hass Avocado", "Nori"], "cuisine": "Japanese Breakfast", "cultural_inspiration": "Japanese home-style breakfast calibrated for morning satiety", "bio_cultural_score": 95},
                {"slot": "lunch", "name": "Nobu-Style Sashimi Salmon & Edamame Quinoa Bowl", "calories": 620.0, "protein_g": 46.0, "carbs_g": 58.0, "fat_g": 20.0, "ingredients": ["Wild Alaskan Salmon", "Organic Quinoa", "Organic Edamame", "Citrus Ponzu Glaze"], "cuisine": "Japanese Fusion", "cultural_inspiration": "Inspired by Nobu NYC cold dishes with lean protein precision", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Miso-Glazed Chilean Sea Bass with Baby Bok Choy", "calories": 650.0, "protein_g": 50.0, "carbs_g": 52.0, "fat_g": 18.0, "ingredients": ["Wild Alaskan Cod", "Saikyo Sweet Miso", "Forbidden Black Rice", "Baby Bok Choy"], "cuisine": "Japanese", "cultural_inspiration": "Tokyo omakase signature dish bridging your cinema taste with dinner macros", "bio_cultural_score": 97},
            ],
            # Day 2
            [
                {"slot": "breakfast", "name": "Matcha Chia Seed Protein Pudding with Fresh Berries", "calories": 420.0, "protein_g": 28.0, "carbs_g": 45.0, "fat_g": 14.0, "ingredients": ["Organic Greek Yogurt", "Chia Seeds", "Matcha Powder", "Blueberries"], "cuisine": "Japanese Fusion", "cultural_inspiration": "Antioxidant-dense morning focus bowl", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "California Seared Chicken Breast with Ponzu & Jasmine Rice", "calories": 600.0, "protein_g": 48.0, "carbs_g": 56.0, "fat_g": 18.0, "ingredients": ["Free-Range Chicken Breast", "Citrus Ponzu Glaze", "Jasmine Rice", "Organic Edamame"], "cuisine": "California Fusion", "cultural_inspiration": "West Coast clean fuel with Tokyo umami accents", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Wild King Salmon with Saikyo Sweet Miso & Charred Broccolini", "calories": 660.0, "protein_g": 52.0, "carbs_g": 48.0, "fat_g": 22.0, "ingredients": ["Wild Alaskan Salmon", "Saikyo Sweet Miso", "Charred Broccolini", "Organic Quinoa"], "cuisine": "Japanese", "cultural_inspiration": "Heart-healthy omega-3s and rich fermented miso umami", "bio_cultural_score": 98},
            ],
            # Day 3
            [
                {"slot": "breakfast", "name": "Smoked Salmon & Soft Boiled Egg Rice Bowl with Furikake", "calories": 460.0, "protein_g": 32.0, "carbs_g": 36.0, "fat_g": 20.0, "ingredients": ["Wild Alaskan Salmon", "Pasture-Raised Eggs", "Organic Quinoa", "Nori Furikake"], "cuisine": "Japanese Breakfast", "cultural_inspiration": "High-protein morning recovery plate", "bio_cultural_score": 95},
                {"slot": "lunch", "name": "Izakaya Toranoko Truffle Ponzu Yellowtail & Brown Rice Plate", "calories": 610.0, "protein_g": 45.0, "carbs_g": 55.0, "fat_g": 19.0, "ingredients": ["Yellowtail", "Citrus Ponzu Glaze", "Truffle Oil", "Brown Rice"], "cuisine": "Japanese Fusion", "cultural_inspiration": "Inspired by Izakaya Toranoko signature lunch plates", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Pan-Seared Halibut with Shiitake Dashi Reduction & Bok Choy", "calories": 640.0, "protein_g": 50.0, "carbs_g": 46.0, "fat_g": 18.0, "ingredients": ["Wild Halibut", "Shiitake Mushrooms", "Baby Bok Choy", "Forbidden Black Rice"], "cuisine": "Japanese", "cultural_inspiration": "Clean umami broth with micronutrient-rich bok choy", "bio_cultural_score": 96},
            ],
            # Day 4
            [
                {"slot": "breakfast", "name": "Scrambled Eggs with Steamed Baby Bok Choy & Sourdough", "calories": 430.0, "protein_g": 27.0, "carbs_g": 35.0, "fat_g": 19.0, "ingredients": ["Pasture-Raised Eggs", "Baby Bok Choy", "Artisan Sourdough Loaf", "Sesame Oil"], "cuisine": "Japanese Breakfast", "cultural_inspiration": "Light, calcium-dense morning scramble", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Sweetgreen-Style Tokyo Warm Sesame Salmon Bowl", "calories": 620.0, "protein_g": 46.0, "carbs_g": 58.0, "fat_g": 20.0, "ingredients": ["Wild Alaskan Salmon", "Baby Bok Choy", "Forbidden Black Rice", "Sesame Dressing"], "cuisine": "California Fusion", "cultural_inspiration": "Sweetgreen-inspired warm bowl with Tokyo accents", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Miso Black Cod with Ginger Glaze & Roasted Asparagus", "calories": 670.0, "protein_g": 54.0, "carbs_g": 48.0, "fat_g": 20.0, "ingredients": ["Wild Alaskan Cod", "Saikyo Sweet Miso", "Roasted Asparagus", "Organic Quinoa"], "cuisine": "Japanese", "cultural_inspiration": "Signature Nobu-style black cod adapted to target calories", "bio_cultural_score": 97},
            ],
            # Day 5
            [
                {"slot": "breakfast", "name": "High-Protein Japanese Omelette with Nori & Avocado", "calories": 460.0, "protein_g": 30.0, "carbs_g": 32.0, "fat_g": 22.0, "ingredients": ["Pasture-Raised Eggs", "Hass Avocado", "Nori", "Artisan Sourdough Loaf"], "cuisine": "Japanese Breakfast", "cultural_inspiration": "Traditional rolled omelette with healthy unsaturated fats", "bio_cultural_score": 94},
                {"slot": "lunch", "name": "Wild Salmon Poke Bowl with Quinoa, Cucumber & Ponzu", "calories": 610.0, "protein_g": 45.0, "carbs_g": 56.0, "fat_g": 18.0, "ingredients": ["Wild Alaskan Salmon", "Organic Quinoa", "Organic Edamame", "Citrus Ponzu Glaze"], "cuisine": "Pacific Rim", "cultural_inspiration": "Fresh Pacific fish bowl with crisp edamame", "bio_cultural_score": 96},
                {"slot": "dinner", "name": "Grilled Flank Steak with Sesame Baby Bok Choy & Sweet Potato", "calories": 660.0, "protein_g": 52.0, "carbs_g": 50.0, "fat_g": 22.0, "ingredients": ["Grass-Fed Flank Steak", "Baby Bok Choy", "Sweet Potato", "Citrus Ponzu Glaze"], "cuisine": "Asian Fusion", "cultural_inspiration": "Lean red meat power dinner with ginger ponzu reduction", "bio_cultural_score": 95},
            ],
            # Day 6
            [
                {"slot": "breakfast", "name": "Organic Greek Yogurt Bowl with Chia Seeds, Almonds & Honey", "calories": 420.0, "protein_g": 28.0, "carbs_g": 42.0, "fat_g": 14.0, "ingredients": ["Organic Greek Yogurt", "Chia Seeds", "Raw Almonds", "Wild Honey"], "cuisine": "Artisan Breakfast", "cultural_inspiration": "Fast morning fuel with 28g natural dairy protein", "bio_cultural_score": 93},
                {"slot": "lunch", "name": "California Seared Ahi Tuna Salad with Citrus Ginger Dressing", "calories": 590.0, "protein_g": 46.0, "carbs_g": 44.0, "fat_g": 18.0, "ingredients": ["Ahi Tuna", "Mixed Baby Greens", "Organic Edamame", "Citrus Ponzu Glaze"], "cuisine": "California Fusion", "cultural_inspiration": "Crisp market greens with sushi-grade tuna", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Sweet Miso Glazed Salmon with Steamed Jasmine Rice & Edamame", "calories": 650.0, "protein_g": 51.0, "carbs_g": 54.0, "fat_g": 19.0, "ingredients": ["Wild Alaskan Salmon", "Saikyo Sweet Miso", "Organic Edamame", "Jasmine Rice"], "cuisine": "Japanese", "cultural_inspiration": "Fermented Saikyo miso coating over wild salmon fillet", "bio_cultural_score": 97},
            ],
            # Day 7
            [
                {"slot": "breakfast", "name": "Poached Eggs on Toasted Sourdough with Avocado & Furikake", "calories": 470.0, "protein_g": 29.0, "carbs_g": 38.0, "fat_g": 22.0, "ingredients": ["Pasture-Raised Eggs", "Artisan Sourdough Loaf", "Hass Avocado", "Furikake"], "cuisine": "Japanese Breakfast", "cultural_inspiration": "Artisan bakery bread with Japanese savory seasoning", "bio_cultural_score": 95},
                {"slot": "lunch", "name": "Teriyaki Grilled Chicken Breast with Bok Choy & Quinoa", "calories": 610.0, "protein_g": 48.0, "carbs_g": 56.0, "fat_g": 18.0, "ingredients": ["Free-Range Chicken Breast", "Baby Bok Choy", "Organic Quinoa", "Citrus Ponzu Glaze"], "cuisine": "Japanese Fusion", "cultural_inspiration": "Balanced Sunday midday plate", "bio_cultural_score": 95},
                {"slot": "dinner", "name": "Izakaya-Style Grilled Sea Bass with Saikyo Miso & Bok Choy", "calories": 660.0, "protein_g": 53.0, "carbs_g": 48.0, "fat_g": 20.0, "ingredients": ["Wild Alaskan Cod", "Saikyo Sweet Miso", "Baby Bok Choy", "Forbidden Black Rice"], "cuisine": "Japanese", "cultural_inspiration": "Chef-grade sea bass sealing the week under calorie budget", "bio_cultural_score": 98},
            ],
        ]

    days = []
    for day_idx, meals in enumerate(days_templates, start=1):
        tot_cal = sum(m["calories"] for m in meals)
        tot_pro = sum(m["protein_g"] for m in meals)
        tot_car = sum(m["carbs_g"] for m in meals)
        tot_fat = sum(m["fat_g"] for m in meals)
        days.append({
            "day": day_idx,
            "total_calories": round(tot_cal, 1),
            "total_protein_g": round(tot_pro, 1),
            "total_carbs_g": round(tot_car, 1),
            "total_fat_g": round(tot_fat, 1),
            "meals": meals,
        })

    return {
        "plan_id": f"mp_persona_{p_id}",
        "generated_at": now_iso,
        "days": days,
    }


DEMO_PROFILE = {
    "onboarded": True,
    "pro_active": True,
    "is_pro": True,
    "sex": "male",
    "date_of_birth": "1994-06-15",
    "height_cm": 175,
    "weight_kg": 78,
    "desired_weight_kg": 72,
    "goal": "lose",
    "target_speed": "recommended",
    "activity_level": "moderately_active",
    "workouts_per_week": "3-5",
    "dietary_preferences": ["balanced"],
    "daily_calories": 2100,
    "daily_protein_g": 140,
    "daily_carbs_g": 230,
    "daily_fat_g": 65,
    "daily_protein": 140,
    "daily_magnesium_mg": 400,
    "goals": {
        "calories": 2100,
        "protein": 140,
        "protein_g": 140,
        "carbs_g": 230,
        "fat_g": 65,
        "fiber_g": 28,
        "sugar_g": 30,
        "sodium_mg": 2000,
        "magnesium_mg": 400,
    },
    "current_plan": build_persona_meal_plan("alex"),
    "custom_grocery_items": PERSONA_GROCERY_ITEMS["alex"],
    "grocery_checked": [],
    "taste_onboarded": True,
    "cuisine_affinities": ["Japanese", "Mediterranean", "Mexican"],
    "taste_dna": {
        "entity_ids": [
            "57E97B92-9552-452D-A5EC-6B098C879918",  # Nobu (Place)
            "685BCE85-1F46-4A12-8CC8-7FF205B34943",  # Sweetgreen (Place)
            "572B5DEF-5EC1-402C-AC96-16B82F450848",  # Italian Restaurant (Place)
            "18B098FD-3D84-4609-BFF3-ADF9A0B00E40",  # Inception (Movie)
            "4BBEF799-A0C4-4110-AB01-39216993C312",  # Taylor Swift (Artist)
            "1EB0550F-0F82-43A2-B501-4D33B5488FD1",  # Tokyo (Destination)
        ],
        "cuisine_affinities": ["Japanese", "Mediterranean", "Mexican"],
        "cultural_tags": [
            "Nobu",
            "Sweetgreen",
            "Chipotle Mexican Grill",
            "Jiro Dreams of Sushi",
            "Midnight in Paris",
            "Chef",
            "Chet Baker",
            "Frank Ocean",
            "Bad Bunny",
            "Tokyo",
            "Barcelona",
            "Mexico City",
            "Anthony Bourdain",
            "Farm-to-Table Movement",
        ],
        "film_tags": ["Jiro Dreams of Sushi", "Midnight in Paris", "Chef"],
        "music_tags": ["Chet Baker", "Frank Ocean", "Bad Bunny"],
        "travel_tags": ["Tokyo", "Barcelona", "Mexico City"],
        "cross_domain_dining": [
            {
                "name": "Izakaya Toranoko (Japanese-French Fusion)",
                "score": 0.94,
                "qloo_entity_id": "urn:entity:dining:mock-r01",
            },
            {
                "name": "Casa Oaxaca (Modern Mexican)",
                "score": 0.91,
                "qloo_entity_id": "urn:entity:dining:mock-r02",
            },
            {
                "name": "Le Comptoir de Tunisie (Mediterranean-North African)",
                "score": 0.89,
                "qloo_entity_id": "urn:entity:dining:mock-r03",
            },
            {
                "name": "Farmhouse Kitchen Thai (Farm-to-Table Thai)",
                "score": 0.86,
                "qloo_entity_id": "urn:entity:dining:mock-r05",
            },
        ],
        "entities_map": {
            "film": [
                {"name": "Jiro Dreams of Sushi", "id": "18B098FD-3D84-4609-BFF3-ADF9A0B00E40", "score": 0.96},
                {"name": "Midnight in Paris", "id": "78A123BC-45DE-67FA-BCDE-901234567890", "score": 0.92},
            ],
            "music": [
                {"name": "Chet Baker", "id": "4BBEF799-A0C4-4110-AB01-39216993C312", "score": 0.94},
                {"name": "Frank Ocean", "id": "99CCE812-77AA-4411-BBAA-123456789ABC", "score": 0.91},
            ],
            "travel": [
                {"name": "Tokyo", "id": "1EB0550F-0F82-43A2-B501-4D33B5488FD1", "score": 0.98},
                {"name": "Kyoto", "id": "8805E82D-342B-42D0-9B2F-988DEBF13942", "score": 0.94},
            ],
            "restaurants": [
                {"name": "Nobu", "id": "57E97B92-9552-452D-A5EC-6B098C879918", "score": 0.97},
                {"name": "Sweetgreen", "id": "685BCE85-1F46-4A12-8CC8-7FF205B34943", "score": 0.93},
            ],
        },
        "cross_domain_signals": {
            "restaurants": 3,
            "cuisines": 3,
            "films": 3,
            "music": 3,
            "travel": 3,
            "influences": 2,
        },
        "domains_connected": 6,
        "built_at": 1729780000.0,
    },
}

SEED_MEALS = [
    # Today's meals (partial day: 1,120 kcal, 82g P, 114g C, 40g F, 165mg Mg) -> 980 kcal and 58g protein left for dinner!
    {
        "title": "Greek Yogurt with Granola & Berries",
        "meal_type": "breakfast",
        "calories": 380, "protein_g": 24, "carbs_g": 48, "fat_g": 10,
        "fiber_g": 4, "sugar_g": 18, "sodium_mg": 95, "magnesium_mg": 45,
        "day_offset": 0,
    },
    {
        "title": "Grilled Chicken Caesar Wrap",
        "meal_type": "lunch",
        "calories": 520, "protein_g": 38, "carbs_g": 42, "fat_g": 22,
        "fiber_g": 3, "sugar_g": 4, "sodium_mg": 680, "magnesium_mg": 55,
        "day_offset": 0,
    },
    {
        "title": "Protein Bar",
        "meal_type": "snack",
        "calories": 220, "protein_g": 20, "carbs_g": 24, "fat_g": 8,
        "fiber_g": 3, "sugar_g": 6, "sodium_mg": 150, "magnesium_mg": 65,
        "day_offset": 0,
    },

    # Yesterday's meals
    {
        "title": "Scrambled Eggs with Toast",
        "meal_type": "breakfast",
        "calories": 420, "protein_g": 28, "carbs_g": 32, "fat_g": 20,
        "fiber_g": 2, "sugar_g": 2, "sodium_mg": 420, "magnesium_mg": 35,
        "day_offset": 1,
    },
    {
        "title": "Turkey & Avocado Sandwich",
        "meal_type": "lunch",
        "calories": 580, "protein_g": 35, "carbs_g": 52, "fat_g": 24,
        "fiber_g": 7, "sugar_g": 5, "sodium_mg": 720, "magnesium_mg": 85,
        "day_offset": 1,
    },
    {
        "title": "Salmon with Roasted Vegetables",
        "meal_type": "dinner",
        "calories": 650, "protein_g": 48, "carbs_g": 35, "fat_g": 32,
        "fiber_g": 6, "sugar_g": 4, "sodium_mg": 540, "magnesium_mg": 115,
        "day_offset": 1,
    },
    {
        "title": "Mixed Nuts",
        "meal_type": "snack",
        "calories": 180, "protein_g": 6, "carbs_g": 8, "fat_g": 16,
        "fiber_g": 2, "sugar_g": 1, "sodium_mg": 80, "magnesium_mg": 70,
        "day_offset": 1,
    },

    # 2 days ago
    {
        "title": "Oatmeal with Banana & Honey",
        "meal_type": "breakfast",
        "calories": 350, "protein_g": 12, "carbs_g": 62, "fat_g": 8,
        "fiber_g": 6, "sugar_g": 22, "sodium_mg": 110, "magnesium_mg": 60,
        "day_offset": 2,
    },
    {
        "title": "Chicken Stir-Fry with Brown Rice",
        "meal_type": "lunch",
        "calories": 620, "protein_g": 42, "carbs_g": 68, "fat_g": 18,
        "fiber_g": 5, "sugar_g": 6, "sodium_mg": 680, "magnesium_mg": 95,
        "day_offset": 2,
    },
    {
        "title": "Lentil Soup with Bread",
        "meal_type": "dinner",
        "calories": 480, "protein_g": 22, "carbs_g": 65, "fat_g": 12,
        "fiber_g": 12, "sugar_g": 4, "sodium_mg": 520, "magnesium_mg": 85,
        "day_offset": 2,
    },

    # 3 days ago
    {
        "title": "Protein Smoothie",
        "meal_type": "breakfast",
        "calories": 310, "protein_g": 30, "carbs_g": 38, "fat_g": 6,
        "fiber_g": 4, "sugar_g": 18, "sodium_mg": 140, "magnesium_mg": 75,
        "day_offset": 3,
    },
    {
        "title": "Grilled Paneer Wrap",
        "meal_type": "lunch",
        "calories": 550, "protein_g": 32, "carbs_g": 48, "fat_g": 24,
        "fiber_g": 4, "sugar_g": 3, "sodium_mg": 580, "magnesium_mg": 65,
        "day_offset": 3,
    },
    {
        "title": "Baked Chicken with Sweet Potato",
        "meal_type": "dinner",
        "calories": 580, "protein_g": 45, "carbs_g": 55, "fat_g": 16,
        "fiber_g": 5, "sugar_g": 8, "sodium_mg": 460, "magnesium_mg": 80,
        "day_offset": 3,
    },
]

SEED_ACTIVITY = [
    {"day_offset": 0, "steps": 4200, "water_ml": 1500, "sleep_hours": 7.2},
    {"day_offset": 1, "steps": 8500, "water_ml": 2200, "sleep_hours": 7.8},
    {"day_offset": 2, "steps": 6100, "water_ml": 1800, "sleep_hours": 6.5},
    {"day_offset": 3, "steps": 10200, "water_ml": 2500, "sleep_hours": 8.0},
    {"day_offset": 4, "steps": 3800, "water_ml": 1200, "sleep_hours": 7.0},
    {"day_offset": 5, "steps": 7500, "water_ml": 2000, "sleep_hours": 7.5},
    {"day_offset": 6, "steps": 9200, "water_ml": 2400, "sleep_hours": 8.2},
]


async def reset_demo_user(session: Optional[AsyncSession] = None) -> dict:
    """
    Resets the demo user to the canonical pristine demonstration state:
    - Profile with 6-domain Qloo Taste DNA (Nobu, Jiro, Tokyo, Chet Baker, etc.)
    - 1,120 kcal consumed today across Breakfast, Lunch, and Snack
    - Exactly 980 kcal and 58g protein left for dinner
    - 400mg Magnesium target with 165mg tracked
    - Synced daily summaries & clean coach chat session
    """
    from database import AsyncSessionLocal
    from routers.meals import sync_daily_summary

    should_close = False
    if session is None:
        session = AsyncSessionLocal()
        should_close = True

    try:
        # 1. Upsert User
        res = await session.execute(select(User).where(User.id == DEMO_USER_ID))
        user = res.scalars().first()
        if user:
            user.email = DEMO_EMAIL
            user.password_hash = hash_password(DEMO_PASSWORD)
            user.name = DEMO_NAME
            user.profile = DEMO_PROFILE
            user.pro_active = True
            session.add(user)
        else:
            user = User(
                id=DEMO_USER_ID,
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                name=DEMO_NAME,
                profile=DEMO_PROFILE,
                pro_active=True,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            session.add(user)

        # 2. Clear old data for demo user
        await session.execute(delete(Meal).where(Meal.user_id == DEMO_USER_ID))
        await session.execute(delete(DailySummary).where(DailySummary.user_id == DEMO_USER_ID))
        await session.execute(delete(ChatMessage).where(ChatMessage.user_id == DEMO_USER_ID))
        await session.commit()

        # 3. Seed canonical meals
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        meal_hour_map = {"breakfast": 8, "lunch": 12, "dinner": 19, "snack": 15}
        for meal_template in SEED_MEALS:
            meal_data = dict(meal_template)
            day_offset = int(meal_data.pop("day_offset"))
            meal_type = str(meal_data["meal_type"])
            meal_date = (now - timedelta(days=day_offset)).replace(
                hour=meal_hour_map.get(meal_type, 12),
                minute=30, second=0, microsecond=0,
            )

            meal = Meal(
                meal_id="meal_" + uuid.uuid4().hex[:12],
                user_id=DEMO_USER_ID,
                title=meal_data["title"],
                meal_type=meal_type,
                calories=meal_data["calories"],
                protein_g=meal_data["protein_g"],
                carbs_g=meal_data["carbs_g"],
                fat_g=meal_data["fat_g"],
                fiber_g=meal_data.get("fiber_g", 0),
                sugar_g=meal_data.get("sugar_g", 0),
                sodium_mg=meal_data.get("sodium_mg", 0),
                magnesium_mg=meal_data.get("magnesium_mg", 0),
                ingredients=[],
                logged_at=meal_date,
            )
            session.add(meal)

        await session.commit()

        # 4. Seed activity summaries
        for activity in SEED_ACTIVITY:
            day_offset = activity["day_offset"]
            date_str = (now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
            summary = DailySummary(
                id="sum_" + uuid.uuid4().hex[:12],
                user_id=DEMO_USER_ID,
                date_str=date_str,
                steps=activity["steps"],
                water_ml=activity["water_ml"],
                sleep_hours=activity["sleep_hours"],
            )
            session.add(summary)

        await session.commit()

        # 5. Sync daily summaries from meals
        for day_offset in range(7):
            date_str = (now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
            await sync_daily_summary(DEMO_USER_ID, date_str, session)

        # 6. Seed initial coach message
        coach_session_id = f"coach-{DEMO_USER_ID}"
        msg_time = now - timedelta(minutes=15)
        user_msg = ChatMessage(
            id="msg_" + uuid.uuid4().hex[:12],
            user_id=DEMO_USER_ID,
            session_id=coach_session_id,
            role="user",
            content="Hey Caliwo! I'm planning dinner. What matches my taste and remaining macros?",
            created_at=msg_time,
        )
        asst_msg = ChatMessage(
            id="msg_" + uuid.uuid4().hex[:12],
            user_id=DEMO_USER_ID,
            session_id=coach_session_id,
            role="assistant",
            content=(
                "Welcome back, Alex! Based on your remaining budget (980 kcal, 58g protein) and your "
                "Qloo Taste DNA (Japanese & Mediterranean with Tokyo dining vibes), I've prepared a "
                "custom recipe recommendation for you below!"
            ),
            agent_telemetry={
                "tools_called": [
                    "get_biometrics_and_macro_gaps",
                    "query_qloo_taste_graph",
                    "synthesize_culturally_aligned_recipe",
                ],
                "execution_trace": [
                    "[1] Tool Executed: get_biometrics_and_macro_gaps -> Remaining: 58g Protein, 235mg Magnesium",
                    "[2] Tool Executed: query_qloo_taste_graph -> Correlated Cinema (Jiro) + Music (Chet Baker) -> Tokyo/Nobu Dining",
                    "[3] Tool Executed: synthesize_culturally_aligned_recipe -> Calibrated Miso Black Cod to hit 48g protein deficit under 650 kcal",
                    "[4] Verified Bio-Cultural Alignment: 96% (60% Cultural + 40% Macro Precision)",
                ],
                "bio_cultural_score": 96,
                "cultural_anchors": ["Nobu", "Jiro Dreams of Sushi", "Tokyo", "Chet Baker"],
                "qloo_correlation_insight": "Qloo Latent Graph: Fans of 'Jiro Dreams of Sushi' and 'Chet Baker' show an 88% affinity correlation with Tokyo craft dining and Saikyo miso preparations.",
                "synthesized_recipe": {
                    "dish_name": "Miso-Glazed Wild Salmon Bowl",
                    "cuisine": "Japanese",
                    "cultural_inspiration": "Inspired by your affinity for Nobu and Tokyo dining culture.",
                    "calories": 650.0,
                    "protein_g": 48.0,
                    "carbs_g": 45.0,
                    "fat_g": 18.0,
                    "magnesium_mg": 95.0,
                    "key_ingredients": ["Wild Salmon", "Red Miso", "Edamame", "Brown Rice", "Baby Bok Choy"],
                    "verified_alignment_score": 94,
                    "restaurant_anchor": "Nobu NYC",
                    "venue_name": "Nobu NYC",
                    "dining_order_guide": "Order the Miso Black Cod with steamed greens, sauce light — 48g Protein, 520 kcal",
                    "prep_instructions": [
                        "Marinate salmon or cod in Saikyo sweet white miso, mirin, and tamari for 20 minutes.",
                        "Pan-sear over medium-high heat for 4 minutes per side until caramelized with a tender center.",
                        "Serve over warm edamame brown rice with flash-steamed garlic baby bok choy.",
                    ],
                },
            },
            created_at=msg_time + timedelta(seconds=10),
        )
        session.add_all([user_msg, asst_msg])
        await session.commit()

        logger.info("[DEMO SAFEGUARD] Demo user %s reset successfully to canonical state.", DEMO_EMAIL)
        return {
            "status": "success",
            "message": "Demo user reset successfully.",
            "consumed_today": 1120.0,
            "remaining_calories": 980.0,
            "remaining_protein_g": 58.0,
            "remaining_magnesium_mg": 235.0,
        }
    finally:
        if should_close:
            await session.close()


async def check_and_safeguard_demo_user(user: User, session: AsyncSession) -> bool:
    """
    Checks if the user is the hackathon demo account and automatically resets
    their state if accumulated test runs have consumed excessive calories (> 1,500 kcal
    or < 400 kcal remaining for dinner).
    """
    email = (user.email or "").lower().strip()
    is_demo = (
        user.id == DEMO_USER_ID
        or email == DEMO_EMAIL
        or "demo@caliwo.app" in email
        or "judge" in email
    )
    if not is_demo:
        return False

    from services.nutrition_service import get_nutrition_gaps
    try:
        gaps_data = await get_nutrition_gaps(session, user)
        gaps = gaps_data.get("gaps", {})
        cal_data = gaps.get("calories", {})
        consumed = float(cal_data.get("consumed", 0))
        remaining = float(cal_data.get("remaining", 0))

        # If more than 1,500 calories have been logged today, or remaining is below 400 kcal,
        # or more than 4 meals are logged today from past test runs:
        meals_count = gaps_data.get("meals_logged", 0)
        if consumed > 1500.0 or remaining < 400.0 or meals_count > 3:
            logger.info(
                f"[DEMO SAFEGUARD] Detected over-accumulated demo data ({consumed} kcal consumed, "
                f"{meals_count} meals). Auto-resetting demo account for pristine judge experience."
            )
            await reset_demo_user(session)
            return True
    except Exception as e:
        logger.warning(f"[DEMO SAFEGUARD] Non-blocking check error: {e}")

    return False


# ── Hackathon Judge Personas (1-Click Switcher) ─────────────────────────

DEMO_PERSONAS: dict[str, Any] = {
    "alex": {
        "id": "alex",
        "name": "Alex",
        "avatar": "🍣",
        "tagline": "Tokyo Omakase & Cinema Lover",
        "cuisines": ["Japanese", "California Fusion", "Asian Fusion"],
        "daily_calories": 2100,
        "daily_protein_g": 140,
        "daily_carbs_g": 230,
        "daily_fat_g": 65,
        "daily_magnesium_mg": 400,
        "taste_dna": {
            "entity_ids": [
                "57E97B92-9552-452D-A5EC-6B098C879918",  # Nobu (Place)
                "685BCE85-1F46-4A12-8CC8-7FF205B34943",  # Sweetgreen (Place)
                "572B5DEF-5EC1-402C-AC96-16B82F450848",  # Italian Restaurant (Place)
                "18B098FD-3D84-4609-BFF3-ADF9A0B00E40",  # Inception (Movie)
                "4BBEF799-A0C4-4110-AB01-39216993C312",  # Taylor Swift (Artist)
                "1EB0550F-0F82-43A2-B501-4D33B5488FD1",  # Tokyo (Destination)
            ],
            "cuisine_affinities": ["Japanese", "California Fusion", "Asian Fusion"],
            "cultural_tags": ["Nobu", "Sweetgreen", "Jiro Dreams of Sushi", "Midnight in Paris", "Chet Baker", "Tokyo", "Farm-to-Table Movement"],
            "film_tags": ["Jiro Dreams of Sushi", "Midnight in Paris", "Chef"],
            "music_tags": ["Chet Baker", "Daft Punk", "Frank Ocean"],
            "travel_tags": ["Tokyo", "Kyoto", "San Francisco"],
            "cross_domain_dining": [
                {"name": "Izakaya Toranoko (Japanese-French Fusion)", "score": 0.96, "qloo_entity_id": "urn:entity:dining:mock-r01", "menu_highlights": ["Miso Black Cod", "Truffle Ponzu Yellowtail"]},
                {"name": "Farmhouse Kitchen Thai", "score": 0.88, "qloo_entity_id": "urn:entity:dining:mock-r05", "menu_highlights": ["Panang Curry Salmon"]},
            ],
            "cross_domain_signals": {"restaurants": 3, "cuisines": 3, "films": 3, "music": 3, "travel": 3, "influences": 2},
            "entities_map": {
                "film": [
                    {"name": "Jiro Dreams of Sushi", "id": "18B098FD-3D84-4609-BFF3-ADF9A0B00E40", "score": 0.96},
                    {"name": "Midnight in Paris", "id": "78A123BC-45DE-67FA-BCDE-901234567890", "score": 0.92},
                ],
                "music": [
                    {"name": "Chet Baker", "id": "4BBEF799-A0C4-4110-AB01-39216993C312", "score": 0.94},
                    {"name": "Frank Ocean", "id": "99CCE812-77AA-4411-BBAA-123456789ABC", "score": 0.91},
                ],
                "travel": [
                    {"name": "Tokyo", "id": "1EB0550F-0F82-43A2-B501-4D33B5488FD1", "score": 0.98},
                    {"name": "Kyoto", "id": "8805E82D-342B-42D0-9B2F-988DEBF13942", "score": 0.94},
                ],
                "restaurants": [
                    {"name": "Nobu", "id": "57E97B92-9552-452D-A5EC-6B098C879918", "score": 0.97},
                    {"name": "Sweetgreen", "id": "685BCE85-1F46-4A12-8CC8-7FF205B34943", "score": 0.93},
                ],
            },
            "domains_connected": 6,
            "built_at": 1729780000.0,
        },
        "recipe": {
            "dish_name": "Miso-Glazed Wild Salmon Bowl",
            "cuisine": "Japanese",
            "cultural_inspiration": "Inspired by your affinity for Nobu NYC and Tokyo Ginza dining vibes.",
            "calories": 648.0,
            "protein_g": 48.0,
            "carbs_g": 52.0,
            "fat_g": 18.0,
            "magnesium_mg": 95.0,
            "key_ingredients": ["Wild Salmon", "Saikyo Sweet Miso", "Forbidden Black Rice", "Baby Bok Choy", "Edamame"],
            "verified_alignment_score": 96,
            "restaurant_anchor": "Nobu NYC",
            "venue_name": "Nobu NYC",
            "dining_order_guide": "Order the Miso Black Cod with steamed greens, sauce light — 48g Protein, 520 kcal",
            "prep_instructions": [
                "Marinate salmon or cod in Saikyo sweet white miso, mirin, and tamari for 20 minutes.",
                "Pan-sear over medium-high heat for 4 minutes per side until caramelized with a tender center.",
                "Serve over warm edamame brown rice with flash-steamed garlic baby bok choy.",
            ],
        },
        "coach_greeting": "Welcome back, Alex! Based on your remaining budget (980 kcal, 58g protein) and your Qloo Taste DNA (Japanese & California Fusion with Tokyo dining vibes), I've prepared a custom recipe recommendation for you below!",
    },
    "elena": {
        "id": "elena",
        "name": "Elena",
        "avatar": "🍋",
        "tagline": "Mediterranean Minimalist & Acoustic Jazz",
        "cuisines": ["Mediterranean", "Southern Italian", "Greek"],
        "daily_calories": 1850,
        "daily_protein_g": 125,
        "daily_carbs_g": 195,
        "daily_fat_g": 55,
        "daily_magnesium_mg": 380,
        "taste_dna": {
            "entity_ids": [
                "685BCE85-1F46-4A12-8CC8-7FF205B34943",  # Sweetgreen
                "572B5DEF-5EC1-402C-AC96-16B82F450848",  # Italian Place
                "urn:entity:destination:paris-001",
                "urn:entity:dining:mock-r06",
            ],
            "cuisine_affinities": ["Mediterranean", "Southern Italian", "Greek"],
            "cultural_tags": ["Sweetgreen", "Osteria Stellina", "Midnight in Paris", "Call Me By Your Name", "Bill Evans", "Amalfi Coast", "Santorini"],
            "film_tags": ["Midnight in Paris", "Call Me By Your Name", "The Grand Budapest Hotel"],
            "music_tags": ["Bill Evans", "Norah Jones", "Leon Bridges"],
            "travel_tags": ["Amalfi Coast", "Santorini", "Rome"],
            "cross_domain_dining": [
                {"name": "Osteria Stellina (Rustic Italian)", "score": 0.95, "qloo_entity_id": "urn:entity:dining:mock-r06", "menu_highlights": ["Truffle Ricotta Gnocchi", "Wild Boar Ragu"]},
                {"name": "Le Comptoir de Tunisie", "score": 0.92, "qloo_entity_id": "urn:entity:dining:mock-r03", "menu_highlights": ["Harissa Spiced Sea Bass"]},
            ],
            "cross_domain_signals": {"restaurants": 3, "cuisines": 3, "films": 3, "music": 3, "travel": 3, "influences": 2},
            "entities_map": {
                "film": [
                    {"name": "Midnight in Paris", "id": "78A123BC-45DE-67FA-BCDE-901234567890", "score": 0.95},
                    {"name": "Call Me By Your Name", "id": "89BC4567-DEFA-1234-BCDE-567890123456", "score": 0.93},
                ],
                "music": [
                    {"name": "Bill Evans", "id": "67FA1234-BCDE-5678-9012-3456789ABCDE", "score": 0.96},
                    {"name": "Norah Jones", "id": "4BBEF799-A0C4-4110-AB01-39216993C312", "score": 0.90},
                ],
                "travel": [
                    {"name": "Amalfi Coast", "id": "urn:entity:destination:amalfi-001", "score": 0.97},
                    {"name": "Santorini", "id": "urn:entity:destination:santorini-002", "score": 0.94},
                ],
                "restaurants": [
                    {"name": "Osteria Stellina", "id": "572B5DEF-5EC1-402C-AC96-16B82F450848", "score": 0.96},
                    {"name": "Sweetgreen", "id": "685BCE85-1F46-4A12-8CC8-7FF205B34943", "score": 0.92},
                ],
            },
            "domains_connected": 6,
            "built_at": 1729780000.0,
        },
        "recipe": {
            "dish_name": "Amalfi Lemon-Herb Sea Bass & Farro",
            "cuisine": "Mediterranean",
            "cultural_inspiration": "Bridging your passion for Italian coastal dining and acoustic jazz with ancient grains.",
            "calories": 540.0,
            "protein_g": 44.0,
            "carbs_g": 46.0,
            "fat_g": 15.0,
            "magnesium_mg": 85.0,
            "key_ingredients": ["Mediterranean Sea Bass", "Ancient Farro", "Meyer Lemon Zest", "Sun-Ripened Tomatoes", "Kalamata Olives"],
            "verified_alignment_score": 95,
            "restaurant_anchor": "Osteria Stellina",
            "venue_name": "Osteria Stellina",
            "dining_order_guide": "Order the Pan-Roasted Mediterranean Sea Bass with steamed broccolini, tapenade on side — 44g Protein, 490 kcal",
            "prep_instructions": [
                "Season fresh sea bass fillets with sea salt, cracked black pepper, and fresh garden thyme.",
                "Sear skin-side down in cold-pressed olive oil for 4 mins until crispy, then gently flip for 2 mins.",
                "Plate over warm simmered farro, sun-ripened tomatoes, and finish with a light Meyer lemon drizzle.",
            ],
        },
        "coach_greeting": "Ciao Elena! Grounded in your remaining budget (780 kcal, 45g protein) and your Qloo Taste DNA (Mediterranean coastal flavors with acoustic jazz & Amalfi vibes), here is your bespoke dinner synthesis!",
    },
    "marcus": {
        "id": "marcus",
        "name": "Marcus",
        "avatar": "🌮",
        "tagline": "Oaxacan Smoke & Strength Explorer",
        "cuisines": ["Mexican", "Oaxacan", "Modern Smoke"],
        "daily_calories": 2400,
        "daily_protein_g": 175,
        "daily_carbs_g": 250,
        "daily_fat_g": 75,
        "daily_magnesium_mg": 450,
        "taste_dna": {
            "entity_ids": [
                "urn:entity:dining:mock-r02",
                "urn:entity:dining:chipotle-001",
                "urn:entity:destination:mexicocity-001",
                "57E97B92-9552-452D-A5EC-6B098C879918",
            ],
            "cuisine_affinities": ["Mexican", "Oaxacan", "Modern Smoke"],
            "cultural_tags": ["Casa Oaxaca", "Chipotle Mexican Grill", "Burnt", "Chef", "Kendrick Lamar", "Kaytranada", "Oaxaca", "Mexico City"],
            "film_tags": ["Burnt", "Chef", "Interstellar"],
            "music_tags": ["Kendrick Lamar", "Kaytranada", "Bad Bunny"],
            "travel_tags": ["Oaxaca", "Mexico City", "Austin"],
            "cross_domain_dining": [
                {"name": "Casa Oaxaca (Modern Mexican)", "score": 0.96, "qloo_entity_id": "urn:entity:dining:mock-r02", "menu_highlights": ["Mole Negro Chicken", "Grilled Flank Steak Tacos"]},
                {"name": "Cevichería La Mar", "score": 0.90, "qloo_entity_id": "urn:entity:dining:mock-r10", "menu_highlights": ["Clásico Halibut Ceviche"]},
            ],
            "cross_domain_signals": {"restaurants": 3, "cuisines": 3, "films": 3, "music": 3, "travel": 3, "influences": 2},
            "entities_map": {
                "film": [
                    {"name": "Burnt", "id": "45DE6789-BCDE-1234-5678-901234567890", "score": 0.95},
                    {"name": "Chef", "id": "56EF7890-CDEF-2345-6789-012345678901", "score": 0.92},
                ],
                "music": [
                    {"name": "Kendrick Lamar", "id": "34CD5678-ABCD-0123-4567-890123456789", "score": 0.96},
                    {"name": "Kaytranada", "id": "4BBEF799-A0C4-4110-AB01-39216993C312", "score": 0.91},
                ],
                "travel": [
                    {"name": "Oaxaca", "id": "urn:entity:destination:oaxaca-001", "score": 0.99},
                    {"name": "Mexico City", "id": "1EB0550F-0F82-43A2-B501-4D33B5488FD1", "score": 0.95},
                ],
                "restaurants": [
                    {"name": "Casa Oaxaca", "id": "338FE2A1-0D44-4822-86EC-348FA0316410", "score": 0.98},
                    {"name": "Chipotle Mexican Grill", "id": "685BCE85-1F46-4A12-8CC8-7FF205B34943", "score": 0.92},
                ],
            },
            "domains_connected": 6,
            "built_at": 1729780000.0,
        },
        "recipe": {
            "dish_name": "Oaxacan Braised Beef Barbacoa Bowl",
            "cuisine": "Mexican",
            "cultural_inspiration": "Correlated with your taste for smoky Mexican heritage and hip-hop rhythms, fueling your strength targets.",
            "calories": 710.0,
            "protein_g": 54.0,
            "carbs_g": 56.0,
            "fat_g": 22.0,
            "magnesium_mg": 110.0,
            "key_ingredients": ["Grass-Fed Flank Steak", "Guajillo Adobo", "Charred Poblano Peppers", "Cilantro Quinoa", "Black Beans"],
            "verified_alignment_score": 94,
            "restaurant_anchor": "Casa Oaxaca",
            "venue_name": "Casa Oaxaca",
            "dining_order_guide": "Order the Wood-Fired Carne Asada with grilled rajas & black beans, double corn tortillas — 54g Protein, 680 kcal",
            "prep_instructions": [
                "Rub grass-fed flank steak in smoky guajillo chili adobo paste, minced garlic, and fresh lime juice.",
                "Char on a smoking grill pan for 3-4 minutes per side until medium-rare, then rest 5 minutes.",
                "Slice against the grain and assemble with warm corn tortillas, simmered black beans, and charred rajas.",
            ],
        },
        "coach_greeting": "Hey Marcus! Based on your strength training targets (1,050 kcal, 65g protein remaining) and your Qloo Taste DNA (Oaxacan smoke, hip-hop rhythm, and wood-fired Mexican dining), I've synthesized this high-protein dinner for you!",
    },
}


async def switch_persona(user: User, persona_id: str, session: AsyncSession) -> dict:
    """Instantly switch the user's cultural persona, Taste DNA, biometrics, and coach context."""
    persona: dict[str, Any] = DEMO_PERSONAS.get(persona_id.lower().strip()) or DEMO_PERSONAS["alex"]

    p_id = persona["id"]
    user.name = persona["name"]
    user.pro_active = True
    profile = dict(user.profile) if user.profile else {}
    profile["name"] = persona["name"]
    profile["active_persona_id"] = p_id
    profile["pro_active"] = True
    profile["is_pro"] = True
    profile["taste_onboarded"] = True
    profile["cuisine_affinities"] = persona["cuisines"]
    profile["taste_dna"] = persona["taste_dna"]
    profile["daily_calories"] = persona["daily_calories"]
    profile["daily_protein_g"] = persona["daily_protein_g"]
    profile["daily_carbs_g"] = persona["daily_carbs_g"]
    profile["daily_fat_g"] = persona["daily_fat_g"]
    profile["daily_magnesium_mg"] = persona["daily_magnesium_mg"]
    profile["goals"] = {
        "calories": persona["daily_calories"],
        "protein": persona["daily_protein_g"],
        "protein_g": persona["daily_protein_g"],
        "carbs_g": persona["daily_carbs_g"],
        "fat_g": persona["daily_fat_g"],
        "fiber_g": 28,
        "sugar_g": 30,
        "sodium_mg": 2000,
        "magnesium_mg": persona["daily_magnesium_mg"],
    }
    profile["current_plan"] = build_persona_meal_plan(p_id)
    profile["custom_grocery_items"] = PERSONA_GROCERY_ITEMS.get(p_id, PERSONA_GROCERY_ITEMS["alex"])
    profile["grocery_checked"] = []
    user.profile = profile
    flag_modified(user, "profile")
    session.add(user)

    # Clean today's meals and replace with persona's partial day meals
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    await session.execute(delete(Meal).where(Meal.user_id == user.id, Meal.logged_at >= today_start))

    # Add persona breakfast & lunch
    daily_cal = float(persona["daily_calories"])
    daily_pro = float(persona["daily_protein_g"])
    b_cal = round(daily_cal * 0.25)
    b_pro = round(daily_pro * 0.25)
    l_cal = round(daily_cal * 0.35)
    l_pro = round(daily_pro * 0.35)

    if persona["id"] == "alex":
        b_title, l_title = "Greek Yogurt with Granola & Berries", "California Grilled Chicken Caesar Wrap"
    elif persona["id"] == "elena":
        b_title, l_title = "Avocado & Poached Egg on Artisan Sourdough", "Aegean Lemon Herb Chicken Salad"
    else:
        b_title, l_title = "Chilaquiles with Scrambled Eggs & Queso Fresco", "Grilled Citrus Flank Steak Bowl"

    m1 = Meal(
        meal_id="meal_" + uuid.uuid4().hex[:12],
        user_id=user.id,
        title=b_title,
        meal_type="breakfast",
        calories=b_cal,
        protein_g=b_pro,
        carbs_g=round(b_cal * 0.5 / 4),
        fat_g=round(b_cal * 0.25 / 9),
        logged_at=now.replace(hour=8, minute=30, second=0, microsecond=0),
    )
    m2 = Meal(
        meal_id="meal_" + uuid.uuid4().hex[:12],
        user_id=user.id,
        title=l_title,
        meal_type="lunch",
        calories=l_cal,
        protein_g=l_pro,
        carbs_g=round(l_cal * 0.45 / 4),
        fat_g=round(l_cal * 0.25 / 9),
        logged_at=now.replace(hour=12, minute=30, second=0, microsecond=0),
    )
    session.add_all([m1, m2])

    # Reset coach messages for this persona
    coach_session_id = f"coach-{user.id}"
    await session.execute(delete(ChatMessage).where(ChatMessage.user_id == user.id))

    msg_time = now - timedelta(minutes=5)
    u_msg = ChatMessage(
        id="msg_" + uuid.uuid4().hex[:12],
        user_id=user.id,
        session_id=coach_session_id,
        role="user",
        content="Hey Caliwo! I'm planning dinner. What matches my taste and remaining macros?",
        created_at=msg_time,
    )
    if persona["id"] == "alex":
        exec_trace = [
            "[1] Tool Executed: get_biometrics_and_macro_gaps -> Remaining: 58g Protein, 235mg Magnesium",
            "[2] Tool Executed: query_qloo_taste_graph -> Correlated Cinema (Jiro) + Music (Chet Baker) -> Tokyo/Nobu Dining",
            "[3] Tool Executed: synthesize_culturally_aligned_recipe -> Calibrated Miso Black Cod to hit 48g protein deficit under 650 kcal",
            "[4] Verified Bio-Cultural Alignment: 96% (60% Cultural + 40% Macro Precision)",
        ]
        qloo_corr_insight = "Qloo Latent Graph: Fans of 'Jiro Dreams of Sushi' and 'Chet Baker' show an 88% affinity correlation with Tokyo craft dining and Saikyo miso preparations."
    elif persona["id"] == "elena":
        exec_trace = [
            "[1] Tool Executed: get_biometrics_and_macro_gaps -> Remaining: 45g Protein, 210mg Magnesium",
            "[2] Tool Executed: query_qloo_taste_graph -> Correlated Film (Midnight in Paris) + Music (Bill Evans) -> Amalfi Coast / Osteria Stellina Dining",
            "[3] Tool Executed: synthesize_culturally_aligned_recipe -> Calibrated Mediterranean Sea Bass & Farro to hit 44g protein deficit under 550 kcal",
            "[4] Verified Bio-Cultural Alignment: 95% (60% Cultural + 40% Macro Precision)",
        ]
        qloo_corr_insight = "Qloo Latent Graph: Fans of 'Midnight in Paris' and 'Bill Evans' show a 92% affinity correlation with Amalfi coastal dining and ancient farro preparations."
    else:
        exec_trace = [
            "[1] Tool Executed: get_biometrics_and_macro_gaps -> Remaining: 65g Protein, 240mg Magnesium",
            "[2] Tool Executed: query_qloo_taste_graph -> Correlated Film (Chef) + Music (Kendrick Lamar) -> Oaxaca / Wood-Fired Taquerias",
            "[3] Tool Executed: synthesize_culturally_aligned_recipe -> Calibrated Oaxacan Guajillo Flank Steak to hit 54g protein deficit under 720 kcal",
            "[4] Verified Bio-Cultural Alignment: 94% (60% Cultural + 40% Macro Precision)",
        ]
        qloo_corr_insight = "Qloo Latent Graph: Fans of 'Chef' and 'Kendrick Lamar' show a 91% affinity correlation with Oaxacan wood-fired taquerias and guajillo chili preparations."

    a_msg = ChatMessage(
        id="msg_" + uuid.uuid4().hex[:12],
        user_id=user.id,
        session_id=coach_session_id,
        role="assistant",
        content=persona["coach_greeting"],
        agent_telemetry={
            "tools_called": [
                "get_biometrics_and_macro_gaps",
                "query_qloo_taste_graph",
                "synthesize_culturally_aligned_recipe",
            ],
            "execution_trace": exec_trace,
            "bio_cultural_score": persona["recipe"]["verified_alignment_score"],
            "cultural_anchors": persona["taste_dna"]["cultural_tags"][:4],
            "synthesized_recipe": persona["recipe"],
            "qloo_correlation_insight": qloo_corr_insight,
        },
        created_at=msg_time + timedelta(seconds=5),
    )
    session.add_all([u_msg, a_msg])
    await session.commit()

    from routers.meals import sync_daily_summary
    await sync_daily_summary(user.id, now.date().isoformat(), session)

    # Invalidate caches
    from cache import cache_invalidate
    await cache_invalidate("profile", str(user.id))
    await cache_invalidate("dashboard", str(user.id))
    await cache_invalidate("coach_suggestions", str(user.id))
    await cache_invalidate("plan", str(user.id))
    await cache_invalidate("grocery", str(user.id))

    logger.info("Successfully switched user %s to persona %s (%s)", user.id, persona["id"], persona["name"])
    return {
        "status": "success",
        "active_persona": persona["id"],
        "persona": {
            "id": persona["id"],
            "name": persona["name"],
            "avatar": persona["avatar"],
            "tagline": persona["tagline"],
            "cuisines": persona["cuisines"],
            "daily_calories": persona["daily_calories"],
            "daily_protein_g": persona["daily_protein_g"],
            "domains_connected": persona["taste_dna"]["domains_connected"],
        },
    }
