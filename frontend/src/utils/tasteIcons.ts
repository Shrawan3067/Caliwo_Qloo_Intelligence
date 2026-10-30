import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

export type IoniconsName = ComponentProps<typeof Ionicons>["name"];

export type TasteEntityMeta = {
  icon: IoniconsName;
  color: string;
  bg: string;
};

// ── Curated Entity Dictionary ──────────────────────────────────────────────

const CURATED_TASTE_ENTITIES: Record<string, TasteEntityMeta> = {
  // Step 1: Restaurants
  "Nobu": { icon: "fish", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.16)" },
  "Olive Garden": { icon: "pizza", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
  "Chipotle": { icon: "flame", color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)" },
  "Panda Express": { icon: "restaurant", color: "#F97316", bg: "rgba(249, 115, 22, 0.16)" },
  "Shake Shack": { icon: "fast-food", color: "#10B981", bg: "rgba(16, 185, 129, 0.16)" },
  "Sweetgreen": { icon: "leaf", color: "#22C55E", bg: "rgba(34, 197, 94, 0.16)" },
  "Cheesecake Factory": { icon: "cafe", color: "#EC4899", bg: "rgba(236, 72, 153, 0.16)" },
  "Nando's": { icon: "bonfire", color: "#EA580C", bg: "rgba(234, 88, 12, 0.16)" },

  // Step 2: Cuisines
  "Italian": { icon: "pizza", color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)" },
  "Japanese": { icon: "fish", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.16)" },
  "Mexican": { icon: "flame", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
  "Thai": { icon: "leaf", color: "#10B981", bg: "rgba(16, 185, 129, 0.16)" },
  "Indian": { icon: "sparkles", color: "#F97316", bg: "rgba(249, 115, 22, 0.16)" },
  "Mediterranean": { icon: "water", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.16)" },
  "Korean": { icon: "bonfire", color: "#E11D48", bg: "rgba(225, 29, 72, 0.16)" },
  "Chinese": { icon: "restaurant", color: "#F43F5E", bg: "rgba(244, 63, 94, 0.16)" },
  "French": { icon: "wine", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" },
  "Vietnamese": { icon: "nutrition", color: "#14B8A6", bg: "rgba(20, 184, 166, 0.16)" },
  "Ethiopian": { icon: "earth", color: "#D97706", bg: "rgba(217, 119, 6, 0.16)" },
  "Peruvian": { icon: "color-palette", color: "#6366F1", bg: "rgba(99, 102, 241, 0.16)" },

  // Step 3: Films & TV
  "Midnight in Paris": { icon: "moon", color: "#818CF8", bg: "rgba(129, 140, 248, 0.16)" },
  "Jiro Dreams of Sushi": { icon: "fish", color: "#0EA5E9", bg: "rgba(14, 165, 233, 0.16)" },
  "Ratatouille": { icon: "sparkles", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
  "Eat Pray Love": { icon: "heart", color: "#EC4899", bg: "rgba(236, 72, 153, 0.16)" },
  "Chef": { icon: "flame", color: "#F97316", bg: "rgba(249, 115, 22, 0.16)" },
  "The Grand Budapest Hotel": { icon: "business", color: "#F472B6", bg: "rgba(244, 114, 182, 0.16)" },
  "Spirited Away": { icon: "planet", color: "#A855F7", bg: "rgba(168, 85, 247, 0.16)" },
  "Julie & Julia": { icon: "book", color: "#10B981", bg: "rgba(16, 185, 129, 0.16)" },
  "Burnt": { icon: "bonfire", color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)" },

  // Step 4: Music Artists
  "Bad Bunny": { icon: "disc", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
  "Taylor Swift": { icon: "sparkles", color: "#EC4899", bg: "rgba(236, 72, 153, 0.16)" },
  "Drake": { icon: "headset", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.16)" },
  "Chet Baker": { icon: "musical-notes", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.16)" },
  "Beyoncé": { icon: "trophy", color: "#EAB308", bg: "rgba(234, 179, 8, 0.16)" },
  "The Weeknd": { icon: "moon", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" },
  "Rosalía": { icon: "flame", color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)" },
  "Billie Eilish": { icon: "radio", color: "#10B981", bg: "rgba(16, 185, 129, 0.16)" },
  "Kendrick Lamar": { icon: "ribbon", color: "#6366F1", bg: "rgba(99, 102, 241, 0.16)" },
  "Dua Lipa": { icon: "play-circle", color: "#F43F5E", bg: "rgba(244, 63, 94, 0.16)" },
  "BTS": { icon: "heart", color: "#A855F7", bg: "rgba(168, 85, 247, 0.16)" },
  "Frank Ocean": { icon: "water", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.16)" },

  // Step 5: Places & Travel
  "Tokyo": { icon: "navigate", color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)" },
  "Paris": { icon: "rose", color: "#F472B6", bg: "rgba(244, 114, 182, 0.16)" },
  "Barcelona": { icon: "sunny", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
  "Mexico City": { icon: "color-palette", color: "#10B981", bg: "rgba(16, 185, 129, 0.16)" },
  "Bangkok": { icon: "boat", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.16)" },
  "Istanbul": { icon: "compass", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" },
  "Marrakech": { icon: "globe", color: "#D97706", bg: "rgba(217, 119, 6, 0.16)" },
  "New York": { icon: "trail-sign", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.16)" },

  // Step 5: Food Inspirations
  "Anthony Bourdain": { icon: "compass", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.16)" },
  "Gordon Ramsay": { icon: "ribbon", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
  "Street Food": { icon: "fast-food", color: "#F97316", bg: "rgba(249, 115, 22, 0.16)" },
  "Farm to Table": { icon: "leaf", color: "#22C55E", bg: "rgba(34, 197, 94, 0.16)" },
  "Fusion Cuisine": { icon: "git-merge", color: "#A855F7", bg: "rgba(168, 85, 247, 0.16)" },
  "Fine Dining": { icon: "wine", color: "#EC4899", bg: "rgba(236, 72, 153, 0.16)" },
};

// ── Smart Category & Keyword Fallbacks ─────────────────────────────────────

const KEYWORD_RULES: Array<{ pattern: RegExp; meta: TasteEntityMeta }> = [
  // Seafood & Sushi
  { pattern: /sushi|sashimi|poke|fish|salmon|tuna|seafood|lobster|oyster|ramen/i, meta: { icon: "fish", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.16)" } },
  // Pizza & Pasta & Bakery
  { pattern: /pizza|pasta|bread|bakery|croissant|pastry|dessert|cake/i, meta: { icon: "pizza", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" } },
  // Spicy & Mexican & BBQ
  { pattern: /taco|burrito|chili|spicy|bbq|grill|steak|meat|burger|fire|salsa/i, meta: { icon: "flame", color: "#EF4444", bg: "rgba(239, 68, 68, 0.16)" } },
  // Salads & Green & Vegan
  { pattern: /salad|vegan|vegetarian|greens|plant|organic|bowl|healthy|harvest/i, meta: { icon: "leaf", color: "#22C55E", bg: "rgba(34, 197, 94, 0.16)" } },
  // Coffee & Cafes
  { pattern: /coffee|espresso|cafe|tea|matcha|boba|latte/i, meta: { icon: "cafe", color: "#D97706", bg: "rgba(217, 119, 6, 0.16)" } },
  // Drinks & Wine & Bars
  { pattern: /wine|cocktail|bar|bistro|brew|beer|champagne/i, meta: { icon: "wine", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" } },
  // Asian / Wok / Dumplings
  { pattern: /noodle|dim sum|dumpling|curry|pho|wok|rice|pot/i, meta: { icon: "restaurant", color: "#F97316", bg: "rgba(249, 115, 22, 0.16)" } },
  // Fast Food & Street Food
  { pattern: /diner|fast|fries|shake|snack|truck/i, meta: { icon: "fast-food", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" } },
  // Music & Audio
  { pattern: /band|singer|dj|album|rap|rock|pop|jazz|hip-hop|orchestra|song/i, meta: { icon: "musical-notes", color: "#EC4899", bg: "rgba(236, 72, 153, 0.16)" } },
  // Film & Cinema
  { pattern: /movie|cinema|film|show|series|director|hollywood/i, meta: { icon: "film", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.16)" } },
  // Travel & Cities
  { pattern: /city|island|beach|mountain|hotel|resort|vacation|tour|trip/i, meta: { icon: "airplane", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" } },
];

const CATEGORY_DEFAULTS: Record<string, TasteEntityMeta> = {
  restaurants: { icon: "restaurant", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.16)" },
  cuisines: { icon: "earth", color: "#10B981", bg: "rgba(16, 185, 129, 0.16)" },
  films: { icon: "film", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.16)" },
  music: { icon: "musical-notes", color: "#EC4899", bg: "rgba(236, 72, 153, 0.16)" },
  travel: { icon: "airplane", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" },
  travel_influences: { icon: "compass", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.16)" },
  influences: { icon: "sparkles", color: "#C084FC", bg: "rgba(192, 132, 252, 0.16)" },
  general: { icon: "sparkles", color: "#A78BFA", bg: "rgba(167, 139, 250, 0.16)" },
};

/**
 * Returns a relevant, curated, production-ready icon, brand color, and soft background
 * for any taste entity, cuisine, restaurant, film, music artist, or cultural tag.
 */
export function getTasteEntityMeta(
  entityName: string | null | undefined,
  categoryHint?: string
): TasteEntityMeta {
  if (!entityName) {
    return CATEGORY_DEFAULTS[categoryHint || "general"] || CATEGORY_DEFAULTS.general;
  }

  const cleanName = entityName.trim();

  // 1. Exact match in curated dictionary
  if (CURATED_TASTE_ENTITIES[cleanName]) {
    return CURATED_TASTE_ENTITIES[cleanName];
  }

  // 2. Case-insensitive dictionary check
  const lowerName = cleanName.toLowerCase();
  for (const [key, meta] of Object.entries(CURATED_TASTE_ENTITIES)) {
    if (key.toLowerCase() === lowerName) {
      return meta;
    }
  }

  // 3. Keyword heuristic check
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(lowerName)) {
      return rule.meta;
    }
  }

  // 4. Category-specific fallback
  if (categoryHint && CATEGORY_DEFAULTS[categoryHint]) {
    return CATEGORY_DEFAULTS[categoryHint];
  }

  return CATEGORY_DEFAULTS.general;
}
