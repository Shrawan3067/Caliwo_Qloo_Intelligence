import pytest
from math_utils import calculate_bmr, calculate_tdee, get_calorie_goal, calculate_macros, calculate_water_goal

def test_calculate_bmr_male():
    # 25yo male, 80kg, 180cm
    # Base: (10*80) + (6.25*180) - (5*25) = 800 + 1125 - 125 = 1800
    # Male: 1800 + 5 = 1805
    bmr = calculate_bmr("male", 80, 180, 25)
    assert bmr == 1805.0

def test_calculate_bmr_female():
    # 30yo female, 65kg, 165cm
    # Base: (10*65) + (6.25*165) - (5*30) = 650 + 1031.25 - 150 = 1531.25
    # Female: 1531.25 - 161 = 1370.25
    bmr = calculate_bmr("female", 65, 165, 30)
    assert bmr == 1370.25

def test_calculate_bmr_invalid():
    assert calculate_bmr("male", -10, 180, 25) == 0.0
    assert calculate_bmr("female", 60, -10, 30) == 0.0
    assert calculate_bmr("male", 80, 180, -5) == 0.0

def test_calculate_tdee():
    bmr = 1500
    assert calculate_tdee(bmr, "sedentary") == 1500 * 1.2
    assert calculate_tdee(bmr, "lightly_active") == 1500 * 1.375
    assert calculate_tdee(bmr, "moderately_active") == 1500 * 1.55
    assert calculate_tdee(bmr, "very_active") == 1500 * 1.725
    assert calculate_tdee(bmr, "extra_active") == 1500 * 1.9
    # fallback to lightly active
    assert calculate_tdee(bmr, "unknown") == 1500 * 1.375

def test_get_calorie_goal():
    tdee = 2000
    assert get_calorie_goal(tdee, "maintain") == 2000
    assert get_calorie_goal(tdee, "lose") == 1500
    assert get_calorie_goal(tdee, "gain") == 2500

def test_calculate_macros():
    cals = 2000
    
    # Balanced: 30% P, 40% C, 30% F
    # P: 600 kcal / 4 = 150g
    # C: 800 kcal / 4 = 200g
    # F: 600 kcal / 9 = 67g
    bal = calculate_macros(cals, "balanced")
    assert bal["protein_g"] == 150
    assert bal["carbs_g"] == 200
    assert bal["fat_g"] == 67
    
    # Keto: 25% P, 5% C, 70% F
    # P: 500 kcal / 4 = 125g
    # C: 100 kcal / 4 = 25g
    # F: 1400 kcal / 9 = 156g
    keto = calculate_macros(cals, "keto")
    assert keto["protein_g"] == 125
    assert keto["carbs_g"] == 25
    assert keto["fat_g"] == 156

def test_calculate_macros_zero():
    res = calculate_macros(0, "balanced")
    assert res == {"protein_g": 0, "carbs_g": 0, "fat_g": 0}

def test_calculate_water_goal():
    # 80kg -> 80 * 35 = 2800
    assert calculate_water_goal(80, "sedentary") == 2800
    # moderate gets +500
    assert calculate_water_goal(80, "moderately_active") == 3300
    # extra gets +1000
    assert calculate_water_goal(80, "extra_active") == 3800

def test_parse_database_url():
    from database import parse_database_url

    # 1. postgresql with sslmode=require
    url, connect_args = parse_database_url("postgresql://usr:pwd@dbhost:5432/nutri?sslmode=require")
    assert url == "postgresql+asyncpg://usr:pwd@dbhost:5432/nutri"
    assert connect_args.get("ssl") == "require"
    assert connect_args.get("command_timeout") == 30

    # 2. postgresql with sslmode=disable
    url, connect_args = parse_database_url("postgresql+asyncpg://usr:pwd@dbhost:5432/nutri?sslmode=disable")
    assert url == "postgresql+asyncpg://usr:pwd@dbhost:5432/nutri"
    assert connect_args.get("ssl") is False
    assert connect_args.get("command_timeout") == 30

    # 3. plain postgresql URL without sslmode
    url, connect_args = parse_database_url("postgresql://usr:pwd@dbhost:5432/nutri")
    assert url == "postgresql+asyncpg://usr:pwd@dbhost:5432/nutri"
    assert "ssl" not in connect_args
    assert connect_args.get("command_timeout") == 30

    # 4. sqlite URL
    url, connect_args = parse_database_url("sqlite+aiosqlite:///sql_app.db")
    assert url == "sqlite+aiosqlite:///sql_app.db"
    assert connect_args == {}

