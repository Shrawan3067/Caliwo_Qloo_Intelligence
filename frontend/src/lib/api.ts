import axios from "axios";
import type { AxiosInstance } from "axios";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { storage } from "@/src/utils/storage";

// Local FastAPI backend development
const LOCAL_BACKEND_URL = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";

function getDevHostIp(): string | null {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;

    if (hostUri && typeof hostUri === "string") {
      const ip = hostUri.split(":")[0];
      if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
        return ip;
      }
    }
  } catch {
    // Ignore and fallback
  }
  return null;
}

function getFallbackBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL;
  const devHostIp = getDevHostIp();

  // When running in Expo Go or on physical mobile device, localhost/127.0.0.1
  // points to the phone itself, not the Mac/dev machine. Replace with Metro host LAN IP.
  if (devHostIp) {
    if (envUrl) {
      if (
        envUrl.includes("localhost") ||
        envUrl.includes("127.0.0.1") ||
        envUrl.includes("10.0.2.2")
      ) {
        return envUrl
          .replace("localhost", devHostIp)
          .replace("127.0.0.1", devHostIp)
          .replace("10.0.2.2", devHostIp);
      }
      return envUrl;
    }
    return `http://${devHostIp}:8000`;
  }

  if (envUrl) {
    return envUrl;
  }

  // Fallback to local FastAPI instance
  return LOCAL_BACKEND_URL;
}

export const BASE_URL = getFallbackBaseUrl().replace(/\/+$/, "");

if (__DEV__) {
  console.log("[Caliwo API] Initialized BASE_URL:", BASE_URL);
}

export const TOKEN_KEY = "caliwo.auth.token";

// eslint-disable-next-line import/no-named-as-default-member
const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 60000,
});

api.interceptors.request.use(async (config) => {
  const token = await storage.secureGet(TOKEN_KEY, "");
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Global response error handler — shows user-friendly messages
// ---------------------------------------------------------------------------
let _lastErrorToastTime = 0;
const ERROR_TOAST_THROTTLE_MS = 3000; // Don't spam alerts

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const now = Date.now();
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    const url = error?.config?.url || "";
    const isAuthEndpoint = url.includes("/auth/");

    if (!isAuthEndpoint && __DEV__) {
      console.warn("[API Error] URL:", url, "Status:", status, "Message:", error?.message);
    }

    // Expired / invalidated session on a protected endpoint: clear the stored
    // token so the app's auth guard sends the user back to sign-in instead of
    // looping on 401s. Skip /auth/* (login & register 401s are expected).
    if (status === 401 && !isAuthEndpoint) {
      clearToken().catch(() => {});
    }

    if (!isAuthEndpoint && now - _lastErrorToastTime > ERROR_TOAST_THROTTLE_MS) {
      if (!error.response) {
        // Network error — no internet or server unreachable
        _lastErrorToastTime = now;
        Alert.alert(
          "Connection Error",
          "Unable to reach the server. Please check your internet connection and try again.",
        );
      } else if (status === 429) {
        _lastErrorToastTime = now;
        Alert.alert("Slow Down", detail || "You're making requests too quickly. Please wait a moment.");
      } else if (status >= 500 && !url.includes("/taste/")) {
        _lastErrorToastTime = now;
        Alert.alert("Server Error", detail || "Something went wrong on our end. Please try again shortly.");
      }
    }

    return Promise.reject(error);
  },
);

export async function saveToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

export async function getToken(): Promise<string> {
  return (await storage.secureGet(TOKEN_KEY, "")) || "";
}

// ── Qloo Taste API ──────────────────────────────────────────────────────

export type TasteOnboardingInput = {
  favorite_restaurants: string[];
  favorite_cuisines: string[];
  food_influences: string[];
  // Cross-domain signals
  favorite_films: string[];
  favorite_music: string[];
  travel_destinations: string[];
};

export type TasteDnaSummary = {
  entity_count: number;
  cuisines: string[];
  cultural_tags: string[];
  film_tags: string[];
  music_tags: string[];
  travel_tags: string[];
  dining_matches: number;
  domains_connected: number;
};

export type TasteRecommendation = {
  name: string;
  dish_name?: string;
  restaurant_anchor?: string;
  qloo_entity_id: string;
  cultural_alignment_score: number;
  macro_precision_score?: number;
  bio_cultural_score?: number;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  cuisine_tags: string[];
  menu_highlights?: string[];
  key_ingredients?: string[];
  cultural_inspiration?: string;
  macro_context?: {
    calories_budget?: number;
    protein_target?: number;
    calories_within_budget?: boolean;
    protein_gap_closed_percent?: number;
  };
  qloo_source: boolean;
};

export async function submitTasteOnboarding(data: TasteOnboardingInput) {
  const res = await api.post("/taste/onboarding", data);
  return res.data as {
    success: boolean;
    taste_dna_summary?: TasteDnaSummary;
    message?: string;
    error?: string;
  };
}

export async function getTasteProfile() {
  const res = await api.get("/taste/profile");
  return res.data as {
    has_taste_profile: boolean;
    taste_dna: Record<string, any>;
    entities_map?: Record<string, any>;
    qloo_configured: boolean;
    simulate_blind?: boolean;
  };
}

export async function toggleBlindMode(simulateBlind: boolean) {
  const res = await api.post("/taste/toggle-blind", { simulate_blind: simulateBlind });
  return res.data as { success: boolean; simulate_blind: boolean; message: string };
}

export async function getTasteRecommendations(
  mealType: string = "dinner",
  location?: { lat: number; lng: number },
  simulateBlind?: boolean,
) {
  const params: Record<string, any> = { meal_type: mealType };
  if (location?.lat !== undefined && location?.lng !== undefined) {
    params.lat = location.lat;
    params.lng = location.lng;
  }
  if (simulateBlind !== undefined) {
    params.simulate_blind = simulateBlind;
  }
  const res = await api.get("/taste/recommendations", { params });
  return res.data as {
    taste_profile_active: boolean;
    blind_mode?: boolean;
    warning_banner?: string;
    qloo_powered: boolean;
    cuisine_affinities: string[];
    recommendations: TasteRecommendation[];
    nutrition_context: {
      calories_remaining: number;
      protein_remaining: number;
      meal_type: string;
    };
    note: string;
  };
}

export async function getTasteDiscoveries(location?: { lat: number; lng: number }) {
  const params: Record<string, any> = {};
  if (location?.lat !== undefined && location?.lng !== undefined) {
    params.lat = location.lat;
    params.lng = location.lng;
  }
  const res = await api.get("/taste/discover", { params });
  return res.data as {
    qloo_powered: boolean;
    discoveries: Array<{
      name: string;
      score: number;
      qloo_entity_id: string;
    }>;
    cultural_tags: string[];
    cross_domain_note: string;
  };
}

export async function sendTasteFeedback(mealTitle: string) {
  const res = await api.post("/taste/feedback", { meal_title: mealTitle });
  return res.data as { updated: boolean; entity_count?: number; reason?: string };
}

export async function searchTasteEntities(query: string, entityType: string = "") {
  const res = await api.get("/taste/search", {
    params: { q: query, entity_type: entityType },
  });
  return res.data as { results: Array<{ id: string; name: string; type: string; score?: number }>; count: number };
}

export type DemoPersona = {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  cuisines: string[];
  daily_calories: number;
  daily_protein_g: number;
  domains_connected: number;
};

export async function switchTastePersona(personaId: string) {
  const res = await api.post("/taste/persona", { persona_id: personaId });
  return res.data as {
    status: string;
    active_persona: string;
    persona: DemoPersona;
  };
}

export async function getTastePersonas() {
  const res = await api.get("/taste/personas");
  return res.data as { personas: DemoPersona[] };
}

export default api;
