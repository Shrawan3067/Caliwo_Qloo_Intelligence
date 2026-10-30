/**
 * Subscription Constants & Credentials Configuration
 * Production-ready RevenueCat & In-App Purchase Constants for Caliwo
 *
 * Product IDs must match exactly what is configured in:
 *   - Google Play Console > Monetize > Products > Subscriptions
 *   - App Store Connect > In-App Purchases
 *   - RevenueCat Dashboard > Products
 */

export const SUBSCRIPTION_PRODUCTS = {
  PREMIUM_MONTHLY: "com.caliwo.ainutritioncoach.pro_monthly",
  PREMIUM_YEARLY: "com.caliwo.ainutritioncoach.pro_yearly",
  PREMIUM_LIFETIME: "com.caliwo.ainutritioncoach.pro_lifetime",
} as const;

export const ENTITLEMENT_ID = "premium";

export const REVENUECAT_CONFIG = {
  /** Public API keys — safe to include in client bundle */
  PUBLIC_ANDROID_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "goog_placeholder_android_api_key",
  PUBLIC_IOS_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "appl_placeholder_ios_api_key",
};

export const FEATURE_KEYS = {
  UNLIMITED_AI: "unlimited_ai",
  UNLIMITED_MEAL_SCAN: "unlimited_meal_scan",
  UNLIMITED_BARCODE_SCAN: "unlimited_barcode_scan",
  ADVANCED_NUTRITION: "advanced_nutrition",
  PREMIUM_REPORTS: "premium_reports",
  EXPORT_REPORTS: "export_reports",
  ADVANCED_AI_COACH: "advanced_ai_coach",
  FAMILY_SHARING: "family_sharing",
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];

export const ASYNC_STORAGE_CACHE_KEY = "@caliwo_subscription_customer_info";
