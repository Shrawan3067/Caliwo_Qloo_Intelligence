export const FOOD_IMAGE_MAP: { keywords: string[]; url: string }[] = [
  {
    keywords: ["salad", "bowl", "greens", "kale", "caesar", "veggie bowl", "buddha", "cobb"],
    url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  },
  {
    keywords: ["chicken", "poultry", "breast", "wings", "roast chicken", "tender", "nugget"],
    url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400&q=80",
  },
  {
    keywords: ["egg", "toast", "avocado", "scrambled", "omelet", "poached", "breakfast", "benedict"],
    url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400&q=80",
  },
  {
    keywords: ["oat", "oatmeal", "porridge", "granola", "berry", "chia", "muesli"],
    url: "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&q=80",
  },
  {
    keywords: ["salmon", "fish", "tuna", "seafood", "cod", "shrimp", "prawn", "trout"],
    url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80",
  },
  {
    keywords: ["steak", "beef", "ribeye", "meat", "sirloin", "pork", "brisket", "lamb"],
    url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  },
  {
    keywords: ["pizza", "margherita", "slice", "pepperoni", "flatbread"],
    url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
  },
  {
    keywords: ["burger", "cheeseburger", "hamburger", "sandwich", "wrap", "sub", "slider"],
    url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  },
  {
    keywords: ["pasta", "spaghetti", "penne", "noodle", "ramen", "fettuccine", "macaroni", "lasagna"],
    url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&q=80",
  },
  {
    keywords: ["smoothie", "shake", "protein shake", "juice", "beverage", "drink", "acai"],
    url: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&q=80",
  },
  {
    keywords: ["sushi", "roll", "sashimi", "bento", "poke"],
    url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=80",
  },
  {
    keywords: ["coffee", "latte", "cappuccino", "espresso", "matcha"],
    url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80",
  },
  {
    keywords: ["rice", "grain", "curry", "biryani", "fried rice", "paella"],
    url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80",
  },
  {
    keywords: ["dessert", "cake", "cookie", "chocolate", "pancake", "waffle", "donut", "ice cream", "snack"],
    url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80",
  },
];

export const MEAL_TYPE_DEFAULT_IMAGES: Record<string, string> = {
  breakfast: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80",
  lunch: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
  dinner: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80",
  snack: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&q=80",
};

export function getMealImageSource(meal: { title?: string | null; meal_type?: string | null; image_base64?: string | null }) {
  if (meal.image_base64 && meal.image_base64.trim().length > 10) {
    const uri = meal.image_base64.startsWith("data:")
      ? meal.image_base64
      : `data:image/jpeg;base64,${meal.image_base64}`;
    return { uri };
  }

  const titleLower = (meal.title || "").toLowerCase();
  for (const entry of FOOD_IMAGE_MAP) {
    if (entry.keywords.some((kw) => titleLower.includes(kw))) {
      return { uri: entry.url };
    }
  }

  const typeLower = (meal.meal_type || "").toLowerCase();
  if (MEAL_TYPE_DEFAULT_IMAGES[typeLower]) {
    return { uri: MEAL_TYPE_DEFAULT_IMAGES[typeLower] };
  }

  return { uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80" };
}
