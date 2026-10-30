from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Any
from datetime import datetime

class BaseSchema(BaseModel):
    class Config:
        from_attributes = True
        extra = "forbid"

# --- User ---
class UserProfile(BaseModel):
    gender: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    activity_level: Optional[str] = None
    dietary_preferences: List[str] = Field(default_factory=list)

class UserSchema(BaseSchema):
    id: str
    email: EmailStr
    name: Optional[str] = None
    profile: UserProfile = Field(default_factory=UserProfile)
    pro_active: bool = False
    pro_expires_at: Optional[datetime] = None
    created_at: datetime

# --- Meal ---
class IngredientSchema(BaseModel):
    name: str
    amount: float
    unit: str

class MealSchema(BaseSchema):
    meal_id: str
    user_id: str
    title: str
    meal_type: str
    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: float = 0.0
    sugar_g: float = 0.0
    sodium_mg: float = 0.0
    magnesium_mg: float = 0.0
    ingredients: List[IngredientSchema] = Field(default_factory=list)
    
    # Optional image URLs generated dynamically (not stored in DB)
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    
    # Read-only Image metadata
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    image_content_type: Optional[str] = None
    image_size_bytes: Optional[int] = None
    image_uploaded_at: Optional[datetime] = None

    # Qloo Cultural Intelligence Telemetry
    bio_cultural_score: Optional[int] = None
    cultural_meta: Optional[dict] = None
    
    logged_at: datetime

# --- Daily Summary ---
class DailySummarySchema(BaseSchema):
    id: str
    user_id: str
    date_str: str
    total_calories: float = 0.0
    total_protein: float = 0.0
    total_carbs: float = 0.0
    total_fat: float = 0.0
    total_fiber: float = 0.0
    total_sugar: float = 0.0
    total_sodium: float = 0.0
    total_magnesium: float = 0.0
    water_ml: int = 0
    steps: int = 0
    sleep_hours: float = 0.0
    weight_kg: Optional[float] = None
