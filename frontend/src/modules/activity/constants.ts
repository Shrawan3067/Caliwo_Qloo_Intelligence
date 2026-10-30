/**
 * Activity Tracking Module — Constants
 *
 * All magic numbers, storage keys, achievement definitions, XP tables,
 * sync configuration, and static lookup data. Nothing here imports
 * React or platform APIs — pure data.
 *
 * @module activity/constants
 */

import type {
  AchievementDefinition,
  AchievementTier,
  GoalMode,
  StreakMilestone,
  ValidationThresholds,
} from "./types";

// ─── Storage Keys ────────────────────────────────────────────────────────────

/** Prefix for all activity module storage keys. */
const P = "caliwo.activity";

export const STORAGE_KEYS = {
  /** Cached DailyActivity for today. */
  TODAY_CACHE: `${P}.today_cache`,
  /** Cached WeeklyData. */
  WEEKLY_CACHE: `${P}.weekly_cache`,
  /** Cached MonthlyData. */
  MONTHLY_CACHE: `${P}.monthly_cache`,
  /** Cached YearlyData. */
  YEARLY_CACHE: `${P}.yearly_cache`,
  /** Persisted GoalConfig. */
  GOAL_CONFIG: `${P}.goal_config`,
  /** Goal completion history array. */
  GOAL_HISTORY: `${P}.goal_history`,
  /** Persisted StreakData. */
  STREAK_DATA: `${P}.streak_data`,
  /** Array of Achievement runtime state. */
  ACHIEVEMENTS: `${P}.achievements`,
  /** Total XP. */
  XP_TOTAL: `${P}.xp_total`,
  /** SyncState metadata. */
  SYNC_STATE: `${P}.sync_state`,
  /** Sync anchor / change token. */
  SYNC_ANCHOR: `${P}.sync_anchor`,
  /** Offline sync queue array. */
  OFFLINE_QUEUE: `${P}.offline_queue`,
  /** ISO 8601 timestamp of last successful sync. */
  LAST_SYNC_TS: `${P}.last_sync_ts`,
  /** Permission status string. */
  PERMISSION_STATUS: `${P}.permission_status`,
  /** NotificationPreferences object. */
  NOTIFICATION_PREFS: `${P}.notification_prefs`,
  /** Cached ActivityAnalytics. */
  ANALYTICS_CACHE: `${P}.analytics_cache`,
  /** Cached ActivityInsights for AI. */
  AI_INSIGHTS_CACHE: `${P}.ai_insights_cache`,
  /** Widget data cache. */
  WIDGET_DATA: `${P}.widget_data`,
  /** Personal records array. */
  PERSONAL_RECORDS: `${P}.personal_records`,
  /** Color scheme preference. */
  COLOR_SCHEME: `${P}.color_scheme`,
} as const;

// ─── Sync Configuration ─────────────────────────────────────────────────────

export const SYNC_CONFIG = {
  /** Minimum interval between automatic foreground syncs (ms). */
  FOREGROUND_THROTTLE_MS: 5 * 60 * 1_000, // 5 minutes
  /** Background sync interval (ms). */
  BACKGROUND_INTERVAL_MS: 30 * 60 * 1_000, // 30 minutes
  /** Maximum retry attempts before giving up. */
  MAX_RETRY_ATTEMPTS: 3,
  /** Base delay for exponential backoff (ms). */
  RETRY_BASE_DELAY_MS: 1_000,
  /** Exponential backoff multiplier. */
  RETRY_MULTIPLIER: 2,
  /** Maximum backoff delay (ms). */
  RETRY_MAX_DELAY_MS: 30_000,
  /** How many days of history to sync on initial sync. */
  INITIAL_SYNC_DAYS: 30,
  /** How many days of history to sync on incremental sync. */
  INCREMENTAL_SYNC_DAYS: 7,
  /** How many days of history to sync on recovery sync. */
  RECOVERY_SYNC_DAYS: 60,
  /** Sync operation timeout (ms). */
  SYNC_TIMEOUT_MS: 30_000,
  /** Maximum offline queue size before oldest entries are dropped. */
  MAX_OFFLINE_QUEUE_SIZE: 100,
  /** Cache TTL for today's data (ms). */
  TODAY_CACHE_TTL_MS: 2 * 60 * 1_000, // 2 minutes
  /** Cache TTL for weekly data (ms). */
  WEEKLY_CACHE_TTL_MS: 15 * 60 * 1_000, // 15 minutes
  /** Cache TTL for monthly data (ms). */
  MONTHLY_CACHE_TTL_MS: 60 * 60 * 1_000, // 1 hour
} as const;

// ─── Default Goals ───────────────────────────────────────────────────────────

export const GOAL_PRESETS = [5_000, 7_500, 10_000, 12_500, 15_000] as const;

export const GOAL_DEFAULTS: Record<GoalMode, { steps: number; calories: number; distanceM: number; workoutMin: number }> = {
  beginner:  { steps: 5_000,  calories: 200, distanceM: 3_000,  workoutMin: 15 },
  standard:  { steps: 10_000, calories: 500, distanceM: 5_000,  workoutMin: 30 },
  advanced:  { steps: 15_000, calories: 800, distanceM: 10_000, workoutMin: 60 },
  recovery:  { steps: 3_000,  calories: 150, distanceM: 2_000,  workoutMin: 10 },
};

/** Percentage above weekly average used for smart goal recommendations. */
export const GOAL_RECOMMENDATION_INCREASE_PCT = 10;
/** Minimum viable step goal. */
export const GOAL_MIN_STEPS = 1_000;
/** Maximum allowable step goal. */
export const GOAL_MAX_STEPS = 100_000;

// ─── Streak ──────────────────────────────────────────────────────────────────

/** Freeze days awarded per month. */
export const STREAK_FREEZE_DAYS_PER_MONTH = 3;
/** Maximum freeze days that can be banked. */
export const STREAK_MAX_FREEZE_DAYS = 10;
/** Streak milestones that trigger celebrations. */
export const STREAK_MILESTONES: readonly StreakMilestone[] = [3, 7, 14, 21, 30, 50, 100, 200, 365];

// ─── XP & Levels ─────────────────────────────────────────────────────────────

/** XP awarded per achievement tier. */
export const XP_PER_TIER: Record<AchievementTier, number> = {
  bronze: 50,
  silver: 100,
  gold: 250,
  platinum: 500,
  diamond: 1_000,
};

/** XP thresholds for each level (cumulative). Level N requires XP_LEVELS[N-1]. */
export const XP_LEVELS: readonly number[] = [
  0,       // Level 1
  100,     // Level 2
  300,     // Level 3
  600,     // Level 4
  1_000,   // Level 5
  1_500,   // Level 6
  2_200,   // Level 7
  3_000,   // Level 8
  4_000,   // Level 9
  5_200,   // Level 10
  6_600,   // Level 11
  8_200,   // Level 12
  10_000,  // Level 13
  12_000,  // Level 14
  14_500,  // Level 15
  17_500,  // Level 16
  21_000,  // Level 17
  25_000,  // Level 18
  30_000,  // Level 19
  36_000,  // Level 20
];

/** Display titles for each level. */
export const LEVEL_TITLES: readonly string[] = [
  "Beginner",       // 1
  "Walker",         // 2
  "Strider",        // 3
  "Hiker",          // 4
  "Pathfinder",     // 5
  "Trailblazer",    // 6
  "Explorer",       // 7
  "Adventurer",     // 8
  "Marathoner",     // 9
  "Champion",       // 10
  "Elite",          // 11
  "Master",         // 12
  "Legend",         // 13
  "Titan",          // 14
  "Mythic",         // 15
  "Ascendant",      // 16
  "Transcendent",   // 17
  "Immortal",       // 18
  "Celestial",      // 19
  "Apex",           // 20
];

// ─── Achievement Definitions ─────────────────────────────────────────────────

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  // ── Step milestones ──
  { id: "steps_5k",    title: "First 5K",       description: "Walk 5,000 steps in a day",       category: "steps", tier: "bronze",   icon: "footsteps",   xpReward: 50,    threshold: 5_000,    metric: "steps", hidden: false },
  { id: "steps_10k",   title: "10K Club",       description: "Walk 10,000 steps in a day",      category: "steps", tier: "silver",   icon: "footsteps",   xpReward: 100,   threshold: 10_000,   metric: "steps", hidden: false },
  { id: "steps_15k",   title: "Power Walker",   description: "Walk 15,000 steps in a day",      category: "steps", tier: "silver",   icon: "footsteps",   xpReward: 150,   threshold: 15_000,   metric: "steps", hidden: false },
  { id: "steps_20k",   title: "Unstoppable",    description: "Walk 20,000 steps in a day",      category: "steps", tier: "gold",     icon: "footsteps",   xpReward: 250,   threshold: 20_000,   metric: "steps", hidden: false },
  { id: "steps_25k",   title: "Quarter Century", description: "Walk 25,000 steps in a day",     category: "steps", tier: "gold",     icon: "trophy",      xpReward: 300,   threshold: 25_000,   metric: "steps", hidden: false },
  { id: "steps_50k",   title: "Half Century",   description: "Walk 50,000 steps in a day",      category: "steps", tier: "platinum", icon: "trophy",      xpReward: 500,   threshold: 50_000,   metric: "steps", hidden: false },
  { id: "steps_100k",  title: "Centurion",      description: "Walk 100,000 steps in a day",     category: "steps", tier: "diamond",  icon: "diamond",     xpReward: 1_000, threshold: 100_000,  metric: "steps", hidden: false },

  // ── Distance milestones ──
  { id: "dist_5km",    title: "5K Runner",      description: "Cover 5 km in a day",             category: "distance", tier: "bronze",   icon: "navigate",  xpReward: 50,    threshold: 5_000,    metric: "distance_walking", hidden: false },
  { id: "dist_10km",   title: "10K Traveler",   description: "Cover 10 km in a day",            category: "distance", tier: "silver",   icon: "navigate",  xpReward: 100,   threshold: 10_000,   metric: "distance_walking", hidden: false },
  { id: "dist_21km",   title: "Half Marathon",  description: "Cover 21 km in a day",            category: "distance", tier: "gold",     icon: "medal",     xpReward: 300,   threshold: 21_000,   metric: "distance_walking", hidden: false },
  { id: "dist_42km",   title: "Marathon",       description: "Cover 42 km in a day",            category: "distance", tier: "platinum", icon: "medal",     xpReward: 500,   threshold: 42_000,   metric: "distance_walking", hidden: false },

  // ── Calorie milestones ──
  { id: "cal_250",     title: "Warm Up",        description: "Burn 250 active calories in a day",  category: "calories", tier: "bronze", icon: "flame",     xpReward: 50,    threshold: 250,      metric: "calories_active", hidden: false },
  { id: "cal_500",     title: "Calorie Crusher", description: "Burn 500 active calories in a day", category: "calories", tier: "silver", icon: "flame",     xpReward: 100,   threshold: 500,      metric: "calories_active", hidden: false },
  { id: "cal_1000",    title: "Inferno",        description: "Burn 1,000 active calories in a day", category: "calories", tier: "gold",   icon: "flame",     xpReward: 250,   threshold: 1_000,    metric: "calories_active", hidden: false },
  { id: "cal_2000",    title: "Furnace",        description: "Burn 2,000 active calories in a day", category: "calories", tier: "platinum", icon: "flame",   xpReward: 500,   threshold: 2_000,    metric: "calories_active", hidden: false },

  // ── Workout milestones ──
  { id: "workout_30",  title: "Getting Started", description: "Complete 30 minutes of exercise",    category: "workouts", tier: "bronze", icon: "barbell",   xpReward: 50,    threshold: 30,       metric: "workout_duration", hidden: false },
  { id: "workout_60",  title: "Hour Power",     description: "Complete 60 minutes of exercise",     category: "workouts", tier: "silver", icon: "barbell",   xpReward: 100,   threshold: 60,       metric: "workout_duration", hidden: false },
  { id: "workout_120", title: "Endurance",      description: "Complete 120 minutes of exercise",    category: "workouts", tier: "gold",   icon: "barbell",   xpReward: 250,   threshold: 120,      metric: "workout_duration", hidden: false },

  // ── Streak milestones ──
  { id: "streak_3",    title: "Getting Going",  description: "Maintain a 3-day streak",            category: "streaks", tier: "bronze",   icon: "flame",     xpReward: 50,    threshold: 3,        metric: "streak", hidden: false },
  { id: "streak_7",    title: "One Week",       description: "Maintain a 7-day streak",            category: "streaks", tier: "bronze",   icon: "flame",     xpReward: 75,    threshold: 7,        metric: "streak", hidden: false },
  { id: "streak_14",   title: "Fortnight",      description: "Maintain a 14-day streak",           category: "streaks", tier: "silver",   icon: "flame",     xpReward: 150,   threshold: 14,       metric: "streak", hidden: false },
  { id: "streak_21",   title: "Habit Formed",   description: "Maintain a 21-day streak",           category: "streaks", tier: "silver",   icon: "star",      xpReward: 200,   threshold: 21,       metric: "streak", hidden: false },
  { id: "streak_30",   title: "Monthly Master", description: "Maintain a 30-day streak",           category: "streaks", tier: "gold",     icon: "star",      xpReward: 300,   threshold: 30,       metric: "streak", hidden: false },
  { id: "streak_50",   title: "Fifty Fierce",   description: "Maintain a 50-day streak",           category: "streaks", tier: "gold",     icon: "star",      xpReward: 400,   threshold: 50,       metric: "streak", hidden: false },
  { id: "streak_100",  title: "Century Streak", description: "Maintain a 100-day streak",          category: "streaks", tier: "platinum", icon: "ribbon",    xpReward: 750,   threshold: 100,      metric: "streak", hidden: false },
  { id: "streak_200",  title: "Relentless",     description: "Maintain a 200-day streak",          category: "streaks", tier: "diamond",  icon: "ribbon",    xpReward: 1_000, threshold: 200,      metric: "streak", hidden: false },
  { id: "streak_365",  title: "Year Round",     description: "Maintain a 365-day streak",          category: "streaks", tier: "diamond",  icon: "diamond",   xpReward: 2_000, threshold: 365,      metric: "streak", hidden: false },

  // ── Personal records ──
  { id: "pr_steps",    title: "New Record!",    description: "Set a new personal step record",     category: "personal_records", tier: "silver", icon: "ribbon", xpReward: 100, threshold: 1, metric: "special", hidden: false },

  // ── Weekend achievements ──
  { id: "wknd_warrior", title: "Weekend Warrior", description: "Hit your step goal on both Saturday and Sunday", category: "weekend", tier: "silver", icon: "sunny", xpReward: 100, threshold: 2, metric: "special", hidden: false },
  { id: "wknd_hero",    title: "Weekend Hero",    description: "Hit your step goal every weekend for a month",   category: "weekend", tier: "gold",   icon: "sunny", xpReward: 300, threshold: 8, metric: "special", hidden: false },

  // ── Monthly achievements ──
  { id: "month_half",  title: "Halfway There",  description: "Hit your step goal 15 days in a month",           category: "monthly", tier: "silver", icon: "calendar", xpReward: 150, threshold: 15, metric: "special", hidden: false },
  { id: "month_full",  title: "Perfect Month",  description: "Hit your step goal every day for a full month",   category: "monthly", tier: "diamond", icon: "calendar", xpReward: 1_000, threshold: 30, metric: "special", hidden: false },

  // ── Seasonal achievements ──
  { id: "season_summer", title: "Summer Strider",  description: "Average 12,000+ steps/day in summer",          category: "seasonal", tier: "gold", icon: "sunny",   xpReward: 300, threshold: 12_000, metric: "special", hidden: false },
  { id: "season_winter", title: "Winter Walker",   description: "Average 8,000+ steps/day in winter",           category: "seasonal", tier: "gold", icon: "snow",    xpReward: 300, threshold: 8_000,  metric: "special", hidden: false },

  // ── Hidden achievements ──
  { id: "hidden_midnight", title: "Night Owl",      description: "Log steps after midnight",                    category: "hidden", tier: "bronze",   icon: "moon",    xpReward: 75,  threshold: 1,    metric: "special", hidden: true },
  { id: "hidden_early",    title: "Early Bird",     description: "Log 1,000 steps before 7 AM",                 category: "hidden", tier: "bronze",   icon: "sunny",   xpReward: 75,  threshold: 1,    metric: "special", hidden: true },
  { id: "hidden_exact",    title: "Bullseye",       description: "Hit your exact step goal (±10 steps)",         category: "hidden", tier: "silver",   icon: "bullseye", xpReward: 150, threshold: 1,   metric: "special", hidden: true },
  { id: "hidden_double",   title: "Double Down",    description: "Walk double your step goal in a day",          category: "hidden", tier: "gold",     icon: "flash",   xpReward: 300, threshold: 1,    metric: "special", hidden: true },
  { id: "hidden_palindrome", title: "Palindrome",   description: "End the day with a palindromic step count",    category: "hidden", tier: "platinum", icon: "infinite", xpReward: 200, threshold: 1,   metric: "special", hidden: true },
];

// ─── Validation ──────────────────────────────────────────────────────────────

export const VALIDATION_THRESHOLDS: ValidationThresholds = {
  maxStepsPerDay: 100_000,
  maxCaloriesPerDay: 10_000,
  maxDistanceMetersPerDay: 100_000,
  maxFlightsPerDay: 500,
  maxWorkoutMinutesPerDay: 1_440,
  minStepsForValidDay: 0,
};

// ─── Estimation Factors ──────────────────────────────────────────────────────

/** Average stride length in meters. */
export const AVG_STRIDE_M = 0.762;
/** Rough kcal per step (active calories). */
export const KCAL_PER_STEP = 0.04;
/** Steps per flight of stairs (average). */
export const STEPS_PER_FLIGHT = 17;

// ─── AI Integration ──────────────────────────────────────────────────────────

/** Activity level thresholds (average daily steps). */
export const ACTIVITY_LEVEL_THRESHOLDS = {
  sedentary: 3_000,
  lightly_active: 7_000,
  moderately_active: 10_000,
  active: 15_000,
  // very_active is anything above 15,000
} as const;

/** Calorie adjustment factor per step above/below baseline. */
export const CALORIE_ADJUSTMENT_PER_STEP = 0.04;
/** Baseline step count for calorie adjustment calculation. */
export const CALORIE_ADJUSTMENT_BASELINE_STEPS = 8_000;
/** Additional protein (grams) recommended per 5,000 steps above baseline. */
export const PROTEIN_ADJUSTMENT_PER_5K_STEPS = 5;
/** Additional water (ml) recommended per 5,000 steps above baseline. */
export const WATER_ADJUSTMENT_PER_5K_STEPS = 250;
/** Step threshold above which a recovery meal is recommended. */
export const RECOVERY_MEAL_STEP_THRESHOLD = 20_000;

// ─── Animation ───────────────────────────────────────────────────────────────

export const ANIMATION = {
  /** Ring progress fill duration (ms). */
  RING_DURATION_MS: 1_200,
  /** Chart bar enter stagger delay (ms). */
  CHART_BAR_STAGGER_MS: 60,
  /** Chart bar enter duration (ms). */
  CHART_BAR_DURATION_MS: 500,
  /** Achievement unlock confetti duration (ms). */
  CONFETTI_DURATION_MS: 3_000,
  /** Skeleton shimmer cycle duration (ms). */
  SKELETON_CYCLE_MS: 1_500,
  /** Value counter animation duration (ms). */
  COUNTER_DURATION_MS: 800,
  /** Spring damping ratio for animations. */
  SPRING_DAMPING: 0.7,
  /** Spring stiffness. */
  SPRING_STIFFNESS: 100,
} as const;

// ─── Accessibility ───────────────────────────────────────────────────────────

export const A11Y = {
  /** Minimum touch target size (points). */
  MIN_TOUCH_TARGET: 44,
  /** Chart bar minimum accessible width (points). */
  CHART_BAR_MIN_WIDTH: 24,
} as const;

// ─── Health Connect ──────────────────────────────────────────────────────────

/** Google Play Store URI for Health Connect installation. */
export const HEALTH_CONNECT_PLAY_STORE_URI =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

/** Health Connect package name for availability checks. */
export const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

// ─── Date Helpers ────────────────────────────────────────────────────────────

/** Days of the week abbreviations (Sunday-first). */
export const DAYS_OF_WEEK_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** Single-letter day labels for compact charts. */
export const DAYS_OF_WEEK_LETTER = ["S", "M", "T", "W", "T", "F", "S"] as const;
/** Month abbreviations. */
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
