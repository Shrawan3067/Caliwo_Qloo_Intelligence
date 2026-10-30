/**
 * Activity Tracking Module — Type System
 *
 * Exhaustive type definitions for the Nutriva activity tracking system.
 * Covers metrics, sync, permissions, goals, streaks, achievements,
 * charts, analytics, notifications, widgets, AI insights, and theming.
 *
 * @module activity/types
 */

// ─── Metric Identifiers ─────────────────────────────────────────────────────

/** All health metrics the module can read. */
export type ActivityMetricId =
  | "steps"
  | "distance_walking"
  | "distance_running"
  | "flights_climbed"
  | "calories_total"
  | "calories_active"
  | "workout_duration"
  | "exercise_sessions";

/** Metric unit labels for display. */
export const METRIC_UNITS: Record<ActivityMetricId, string> = {
  steps: "steps",
  distance_walking: "km",
  distance_running: "km",
  flights_climbed: "flights",
  calories_total: "kcal",
  calories_active: "kcal",
  workout_duration: "min",
  exercise_sessions: "sessions",
};

// ─── Platform & Source ───────────────────────────────────────────────────────

/** Health data platform. */
export type HealthPlatform = "healthkit" | "healthconnect";

/** Concrete data source for provenance tracking. */
export type ActivitySource =
  | "healthkit"
  | "healthconnect"
  | "pedometer"
  | "manual"
  | "apple_watch"
  | "iphone"
  | "samsung_watch"
  | "pixel_watch"
  | "unknown";

/** Source quality ranking — higher is better. */
export const SOURCE_QUALITY: Record<ActivitySource, number> = {
  apple_watch: 100,
  samsung_watch: 95,
  pixel_watch: 95,
  iphone: 80,
  healthkit: 70,
  healthconnect: 70,
  pedometer: 40,
  manual: 10,
  unknown: 0,
};

/** Device information for multi-device merge. */
export interface DeviceInfo {
  /** Unique device identifier (anonymised). */
  readonly id: string;
  /** Human-readable name ("Apple Watch Series 9"). */
  readonly name: string;
  /** Source type for quality ranking. */
  readonly source: ActivitySource;
  /** Device manufacturer. */
  readonly manufacturer: string;
  /** Device model identifier. */
  readonly model: string;
}

// ─── Core Data Models ────────────────────────────────────────────────────────

/** A single workout / exercise session record. */
export interface ExerciseSession {
  /** ISO 8601 start time. */
  readonly startTime: string;
  /** ISO 8601 end time. */
  readonly endTime: string;
  /** Duration in minutes. */
  readonly durationMinutes: number;
  /** Exercise type (e.g. "WALKING", "RUNNING", "CYCLING"). */
  readonly exerciseType: string;
  /** Calories burned during this session. */
  readonly caloriesBurned: number;
  /** Distance covered in meters (if applicable). */
  readonly distanceMeters: number;
  /** Source device. */
  readonly source: ActivitySource;
}

/** Hourly activity breakdown for intra-day visualization. */
export interface HourlyActivity {
  /** Hour of day (0-23). */
  readonly hour: number;
  /** Steps taken in this hour. */
  readonly steps: number;
  /** Active calories burned in this hour. */
  readonly activeCalories: number;
  /** Distance in meters in this hour. */
  readonly distanceMeters: number;
}

/** Complete activity record for a single day — the fundamental data unit. */
export interface DailyActivity {
  /** Calendar date in YYYY-MM-DD format. */
  readonly date: string;
  /** Total step count. */
  readonly steps: number;
  /** Walking distance in meters. */
  readonly distanceWalkingMeters: number;
  /** Running distance in meters. */
  readonly distanceRunningMeters: number;
  /** Total distance (walking + running) in meters. */
  readonly distanceTotalMeters: number;
  /** Flights of stairs climbed. */
  readonly flightsClimbed: number;
  /** Total calories burned (BMR + active). */
  readonly caloriesTotal: number;
  /** Active calories burned (exercise only). */
  readonly caloriesActive: number;
  /** Total workout/exercise duration in minutes. */
  readonly workoutDurationMinutes: number;
  /** Individual exercise sessions. */
  readonly exerciseSessions: readonly ExerciseSession[];
  /** Hourly breakdown (24 entries). */
  readonly hourlyBreakdown: readonly HourlyActivity[];
  /** Primary data source for this record. */
  readonly source: ActivitySource;
  /** ISO 8601 timestamp of when this record was last updated. */
  readonly lastUpdated: string;
  /** Whether the daily step goal was met. */
  readonly goalReached: boolean;
}

/** Factory for an empty DailyActivity with sensible defaults. */
export function createEmptyDailyActivity(date: string): DailyActivity {
  return {
    date,
    steps: 0,
    distanceWalkingMeters: 0,
    distanceRunningMeters: 0,
    distanceTotalMeters: 0,
    flightsClimbed: 0,
    caloriesTotal: 0,
    caloriesActive: 0,
    workoutDurationMinutes: 0,
    exerciseSessions: [],
    hourlyBreakdown: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      steps: 0,
      activeCalories: 0,
      distanceMeters: 0,
    })),
    source: "unknown",
    lastUpdated: new Date().toISOString(),
    goalReached: false,
  };
}

// ─── Aggregated Stats ────────────────────────────────────────────────────────

/** Shared statistical fields across time ranges. */
export interface AggregatedStats {
  /** Total steps across the period. */
  readonly totalSteps: number;
  /** Average daily steps. */
  readonly averageSteps: number;
  /** Highest single-day step count. */
  readonly highestSteps: number;
  /** Lowest single-day step count. */
  readonly lowestSteps: number;
  /** Total distance in meters. */
  readonly totalDistanceMeters: number;
  /** Average daily distance in meters. */
  readonly averageDistanceMeters: number;
  /** Total active calories. */
  readonly totalActiveCalories: number;
  /** Average daily active calories. */
  readonly averageActiveCalories: number;
  /** Total workout minutes. */
  readonly totalWorkoutMinutes: number;
  /** Total flights climbed. */
  readonly totalFlightsClimbed: number;
  /** Number of days the goal was reached. */
  readonly daysGoalReached: number;
  /** Total days in the period. */
  readonly totalDays: number;
  /** Percentage of active (goal-met) days. */
  readonly activeDayPercentage: number;
}

/** Weekly data bundle with entries and computed stats. */
export interface WeeklyData {
  /** Step goal for comparison. */
  readonly goal: number;
  /** 7 daily entries (Sun–Sat or Mon–Sun depending on locale). */
  readonly entries: readonly DailyActivity[];
  /** Computed statistics. */
  readonly stats: AggregatedStats;
  /** Percentage change vs the previous week. */
  readonly trendVsPreviousWeekPct: number;
  /** Current streak count (from API). */
  readonly currentStreak: number;
  /** Longest streak count (from API). */
  readonly longestStreak: number;
}

/** Monthly data bundle. */
export interface MonthlyData {
  readonly goal: number;
  readonly entries: readonly DailyActivity[];
  readonly stats: AggregatedStats;
  readonly bestDay: DailyActivity | null;
  readonly trendVsPreviousMonthPct: number;
}

/** Yearly data bundle — aggregated by week for chart efficiency. */
export interface YearlyData {
  readonly goal: number;
  /** 52 weekly aggregated entries. */
  readonly weeklyAggregates: readonly WeeklyAggregate[];
  readonly stats: AggregatedStats;
  readonly bestWeek: WeeklyAggregate | null;
  readonly bestDay: DailyActivity | null;
}

/** A single week aggregated to one row for yearly view. */
export interface WeeklyAggregate {
  /** ISO week number (1-52). */
  readonly weekNumber: number;
  /** Start date of the week (YYYY-MM-DD). */
  readonly startDate: string;
  /** End date of the week (YYYY-MM-DD). */
  readonly endDate: string;
  /** Total steps for the week. */
  readonly totalSteps: number;
  /** Daily average steps for the week. */
  readonly averageSteps: number;
  /** Days goal was reached. */
  readonly daysGoalReached: number;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/** Moving average entry. */
export interface MovingAveragePoint {
  readonly date: string;
  readonly value: number;
}

/** Personal record entry. */
export interface PersonalRecord {
  readonly metric: ActivityMetricId;
  readonly value: number;
  readonly date: string;
  readonly previousBest: number;
  readonly isNew: boolean;
}

/** Monthly heatmap cell. */
export interface HeatmapCell {
  readonly date: string;
  /** Intensity from 0.0 (no activity) to 1.0 (max activity). */
  readonly intensity: number;
  readonly steps: number;
  readonly goalReached: boolean;
}

/** Full analytics report produced by the analytics engine. */
export interface ActivityAnalytics {
  readonly dailyAverage: number;
  readonly weeklyAverage: number;
  readonly monthlyAverage: number;
  readonly movingAverage7Day: readonly MovingAveragePoint[];
  readonly movingAverage30Day: readonly MovingAveragePoint[];
  /** Score from -100 (strong decline) to +100 (strong increase). */
  readonly trendScore: number;
  /** Score from 0 (inconsistent) to 100 (every day at goal). */
  readonly consistencyScore: number;
  readonly activeDayPercentage: number;
  readonly bestDay: DailyActivity | null;
  readonly bestWeek: WeeklyAggregate | null;
  readonly personalRecords: readonly PersonalRecord[];
  readonly monthlyHeatmap: readonly HeatmapCell[];
  /** Predicted date the user will reach their goal (null if already met or not enough data). */
  readonly goalPredictionDate: string | null;
  /** Estimated steps remaining today to hit goal. */
  readonly goalPredictionStepsRemaining: number;
}

// ─── Goal System ─────────────────────────────────────────────────────────────

/** Goal time period. */
export type GoalPeriod = "daily" | "weekly" | "monthly" | "custom";

/** Goal difficulty mode. */
export type GoalMode = "beginner" | "standard" | "advanced" | "recovery";

/** Goal configuration. */
export interface GoalConfig {
  /** Daily step goal. */
  readonly dailySteps: number;
  /** Weekly step goal (daily × 7 by default, or custom). */
  readonly weeklySteps: number;
  /** Monthly step goal (daily × 30 by default, or custom). */
  readonly monthlySteps: number;
  /** Active calories goal per day. */
  readonly dailyActiveCalories: number;
  /** Daily distance goal in meters. */
  readonly dailyDistanceMeters: number;
  /** Daily workout minutes goal. */
  readonly dailyWorkoutMinutes: number;
  /** Difficulty mode affecting recommendation curve. */
  readonly mode: GoalMode;
  /** Whether goals auto-adjust based on history. */
  readonly adaptiveEnabled: boolean;
  /** ISO 8601 timestamp of last goal change. */
  readonly lastUpdated: string;
}

/** Default goal configuration. */
export const DEFAULT_GOAL_CONFIG: GoalConfig = {
  dailySteps: 10_000,
  weeklySteps: 70_000,
  monthlySteps: 300_000,
  dailyActiveCalories: 500,
  dailyDistanceMeters: 5_000,
  dailyWorkoutMinutes: 30,
  mode: "standard",
  adaptiveEnabled: false,
  lastUpdated: new Date().toISOString(),
};

/** Goal progress snapshot for a single metric. */
export interface GoalProgress {
  /** Current value. */
  readonly current: number;
  /** Target value. */
  readonly target: number;
  /** 0-100 percentage. */
  readonly percentage: number;
  /** Remaining to reach goal (clamped to 0). */
  readonly remaining: number;
  /** Whether the goal has been completed. */
  readonly completed: boolean;
}

/** Goal completion record (persisted for history). */
export interface GoalCompletion {
  readonly date: string;
  readonly period: GoalPeriod;
  readonly metric: ActivityMetricId;
  readonly targetValue: number;
  readonly actualValue: number;
  readonly completedAt: string;
}

/** Goal celebration tier based on overshoot. */
export type GoalCelebrationTier =
  | "halfway"     // 50%
  | "almost"      // 75%
  | "reached"     // 100%
  | "crushed"     // 125%
  | "legendary";  // 150%+

/** Smart goal recommendation from the engine. */
export interface GoalRecommendation {
  readonly recommendedSteps: number;
  readonly reasoning: string;
  readonly basedOnDays: number;
  readonly currentAverage: number;
  readonly percentageIncrease: number;
  readonly mode: GoalMode;
}

// ─── Streak System ───────────────────────────────────────────────────────────

/** Full streak state. */
export interface StreakData {
  /** Days in a row with goal met. */
  readonly currentStreak: number;
  /** All-time longest streak. */
  readonly longestStreak: number;
  /** Dates that broke a streak. */
  readonly missedDays: readonly string[];
  /** Available freeze days. */
  readonly freezeDaysAvailable: number;
  /** Dates where a freeze was used. */
  readonly freezeDaysUsed: readonly string[];
  /** Date the current streak started (YYYY-MM-DD). */
  readonly streakStartDate: string;
  /** Date of the longest streak's start (YYYY-MM-DD). */
  readonly longestStreakStartDate: string;
  /** ISO 8601 timestamp of last evaluation. */
  readonly lastEvaluated: string;
}

/** Default streak data for new users. */
export const DEFAULT_STREAK_DATA: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  missedDays: [],
  freezeDaysAvailable: 3,
  freezeDaysUsed: [],
  streakStartDate: "",
  longestStreakStartDate: "",
  lastEvaluated: new Date().toISOString(),
};

/** Streak milestone thresholds. */
export type StreakMilestone = 3 | 7 | 14 | 21 | 30 | 50 | 100 | 200 | 365;

// ─── Achievement System ──────────────────────────────────────────────────────

/** Achievement tier / rarity. */
export type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/** Achievement category for filtering. */
export type AchievementCategory =
  | "steps"
  | "distance"
  | "calories"
  | "workouts"
  | "streaks"
  | "personal_records"
  | "weekend"
  | "monthly"
  | "seasonal"
  | "hidden";

/** Achievement definition (static). */
export interface AchievementDefinition {
  /** Unique achievement identifier. */
  readonly id: string;
  /** Display title. */
  readonly title: string;
  /** Description of how to unlock. */
  readonly description: string;
  /** Category for grouping/filtering. */
  readonly category: AchievementCategory;
  /** Rarity tier. */
  readonly tier: AchievementTier;
  /** Icon name (Ionicons). */
  readonly icon: string;
  /** XP awarded on unlock. */
  readonly xpReward: number;
  /** Numeric threshold to unlock (e.g. 10000 for "10k steps"). */
  readonly threshold: number;
  /** Metric this achievement tracks. */
  readonly metric: ActivityMetricId | "streak" | "level" | "special";
  /** Whether this achievement is hidden until unlocked. */
  readonly hidden: boolean;
}

/** Runtime achievement state (persisted per user). */
export interface Achievement {
  /** References AchievementDefinition.id. */
  readonly id: string;
  /** Whether the achievement is unlocked. */
  readonly unlocked: boolean;
  /** Current progress toward threshold (0–threshold). */
  readonly progress: number;
  /** ISO 8601 unlock timestamp (null if locked). */
  readonly unlockedAt: string | null;
  /** Whether the user has been notified / seen the unlock. */
  readonly acknowledged: boolean;
}

/** XP & level summary. */
export interface LevelInfo {
  /** Current level (1-based). */
  readonly level: number;
  /** Total accumulated XP. */
  readonly totalXP: number;
  /** XP required for next level. */
  readonly xpForNextLevel: number;
  /** XP earned in current level. */
  readonly xpInCurrentLevel: number;
  /** Progress to next level (0-1). */
  readonly progressToNextLevel: number;
  /** Display title for the current level. */
  readonly title: string;
}

// ─── Sync State Machine ─────────────────────────────────────────────────────

/** All sync modes. */
export type SyncMode =
  | "initial"
  | "incremental"
  | "background"
  | "foreground"
  | "recovery"
  | "resume"
  | "manual"
  | "silent";

/** Sync lifecycle status. */
export type SyncStatus = "idle" | "syncing" | "success" | "error" | "cancelled";

/** Full sync state. */
export interface SyncState {
  /** Current sync lifecycle status. */
  readonly status: SyncStatus;
  /** Currently executing sync mode, if any. */
  readonly mode: SyncMode | null;
  /** ISO 8601 timestamp of last successful sync. */
  readonly lastSuccessfulSync: string | null;
  /** ISO 8601 timestamp of last sync attempt. */
  readonly lastAttempt: string | null;
  /** Number of days synced in last operation. */
  readonly daysSynced: number;
  /** Current retry attempt (0 = first try). */
  readonly retryAttempt: number;
  /** Error message from the last failed sync. */
  readonly errorMessage: string | null;
  /** Whether the device is currently online. */
  readonly isOnline: boolean;
  /** Number of entries queued for sync when online. */
  readonly offlineQueueSize: number;
  /** Change-token / anchor for incremental sync. */
  readonly syncAnchor: string | null;
}

/** Default sync state. */
export const DEFAULT_SYNC_STATE: SyncState = {
  status: "idle",
  mode: null,
  lastSuccessfulSync: null,
  lastAttempt: null,
  daysSynced: 0,
  retryAttempt: 0,
  errorMessage: null,
  isOnline: true,
  offlineQueueSize: 0,
  syncAnchor: null,
};

/** Sync result returned from sync operations. */
export interface SyncResult {
  readonly ok: boolean;
  readonly mode: SyncMode;
  readonly permission: PermissionStatus;
  readonly daysSynced: number;
  readonly newAnchor: string | null;
  readonly errorMessage: string | null;
  readonly durationMs: number;
}

/** Queued sync entry for offline mode. */
export interface OfflineSyncEntry {
  /** Unique entry ID. */
  readonly id: string;
  /** Date this entry covers (YYYY-MM-DD). */
  readonly date: string;
  /** Steps read from device. */
  readonly steps: number;
  /** Distance in meters. */
  readonly distanceMeters: number;
  /** Active calories. */
  readonly activeCalories: number;
  /** ISO 8601 timestamp when queued. */
  readonly queuedAt: string;
  /** Number of delivery attempts so far. */
  readonly attempts: number;
}

// ─── Permission State Machine ────────────────────────────────────────────────

/** Fine-grained permission status. */
export type PermissionStatus =
  | "undetermined"
  | "granted"
  | "denied"
  | "revoked"
  | "unavailable"
  | "health_app_missing"
  | "unsupported_device"
  | "simulator";

/** Full permission state. */
export interface PermissionState {
  /** Current permission status. */
  readonly status: PermissionStatus;
  /** Whether the health platform is available on this device. */
  readonly isAvailable: boolean;
  /** Whether the health app (Apple Health / Health Connect) is installed. */
  readonly isHealthAppInstalled: boolean;
  /** Whether running in a simulator/emulator. */
  readonly isSimulator: boolean;
  /** Whether the device is supported. */
  readonly isDeviceSupported: boolean;
  /** ISO 8601 timestamp of last permission check. */
  readonly lastChecked: string | null;
  /** Platform name for UI display. */
  readonly platformName: string;
  /** Specific permissions that are granted. */
  readonly grantedPermissions: readonly ActivityMetricId[];
}

/** Default permission state. */
export const DEFAULT_PERMISSION_STATE: PermissionState = {
  status: "undetermined",
  isAvailable: false,
  isHealthAppInstalled: false,
  isSimulator: false,
  isDeviceSupported: true,
  lastChecked: null,
  platformName: "Unknown",
  grantedPermissions: [],
};

// ─── Chart Data ──────────────────────────────────────────────────────────────

/** Selectable chart metric. */
export type ChartMetric = "steps" | "calories" | "distance" | "workoutMinutes";

/** Selectable chart time range. */
export type ChartTimeRange = "week" | "month" | "year";

/** A single data point for charts. */
export interface ChartDataPoint {
  /** Label for the X axis (e.g. "Mon", "Jan", "W12"). */
  readonly label: string;
  /** Numeric value for the Y axis. */
  readonly value: number;
  /** ISO date for this data point. */
  readonly date: string;
  /** Whether this point should be visually highlighted. */
  readonly highlighted: boolean;
  /** Whether the goal was met for this point. */
  readonly goalReached: boolean;
}

/** Complete chart dataset. */
export interface ChartData {
  readonly metric: ChartMetric;
  readonly timeRange: ChartTimeRange;
  readonly points: readonly ChartDataPoint[];
  /** Goal threshold line value. */
  readonly goalValue: number;
  /** Maximum Y value (for scaling). */
  readonly maxValue: number;
  /** Average value. */
  readonly averageValue: number;
}

// ─── Notification System ─────────────────────────────────────────────────────

/** Notification type identifiers. */
export type ActivityNotificationType =
  | "daily_reminder"
  | "goal_reached"
  | "streak_reminder"
  | "streak_milestone"
  | "weekly_summary"
  | "monthly_summary"
  | "sync_failed"
  | "permission_revoked"
  | "achievement_unlocked"
  | "personal_record";

/** Notification payload. */
export interface ActivityNotification {
  readonly type: ActivityNotificationType;
  readonly title: string;
  readonly body: string;
  readonly data: Record<string, string | number | boolean>;
  /** ISO 8601 scheduled time (null for immediate). */
  readonly scheduledAt: string | null;
}

/** Notification preferences (user-configurable). */
export interface NotificationPreferences {
  readonly dailyReminderEnabled: boolean;
  /** Hour of day for daily reminder (0-23). */
  readonly dailyReminderHour: number;
  readonly goalReachedEnabled: boolean;
  readonly streakReminderEnabled: boolean;
  readonly weeklySummaryEnabled: boolean;
  readonly monthlySummaryEnabled: boolean;
  readonly syncFailedEnabled: boolean;
  readonly permissionRevokedEnabled: boolean;
  readonly achievementUnlockedEnabled: boolean;
}

/** Default notification preferences. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyReminderEnabled: true,
  dailyReminderHour: 20,
  goalReachedEnabled: true,
  streakReminderEnabled: true,
  weeklySummaryEnabled: true,
  monthlySummaryEnabled: true,
  syncFailedEnabled: true,
  permissionRevokedEnabled: true,
  achievementUnlockedEnabled: true,
};

// ─── Widget Integration ──────────────────────────────────────────────────────

/** Widget data payload for the existing widget system. */
export interface ActivityWidgetData {
  readonly steps: number;
  readonly stepGoal: number;
  readonly stepProgressPct: number;
  readonly calories: number;
  readonly calorieGoal: number;
  readonly distanceKm: number;
  readonly distanceGoalKm: number;
  readonly workoutMinutes: number;
  readonly workoutGoalMinutes: number;
  readonly currentStreak: number;
  readonly goalReached: boolean;
  readonly weeklyTotal: number;
  readonly weeklyAverage: number;
  readonly lastUpdated: string;
}

// ─── AI Integration ──────────────────────────────────────────────────────────

/** Activity-derived insights for the AI nutrition engine. */
export interface ActivityInsights {
  /** Estimated additional calories burned today above baseline. */
  readonly estimatedCalorieAdjustment: number;
  /** Protein recommendation adjustment in grams. */
  readonly proteinRecommendationAdjustmentG: number;
  /** Water intake recommendation in ml (based on activity level). */
  readonly waterIntakeRecommendationMl: number;
  /** Whether the user needs a recovery meal. */
  readonly recoveryMealRecommended: boolean;
  /** Overall activity score (0-100). */
  readonly activityScore: number;
  /** Human-readable daily movement summary. */
  readonly dailyMovementSummary: string;
  /** Activity level classification. */
  readonly activityLevel: ActivityLevel;
  /** Average steps over the last 7 days. */
  readonly weeklyAverageSteps: number;
  /** Whether the user has been consistently active. */
  readonly isConsistentlyActive: boolean;
}

/** Activity level classifications. */
export type ActivityLevel =
  | "sedentary"       // < 3,000 steps
  | "lightly_active"  // 3,000 – 6,999
  | "moderately_active" // 7,000 – 9,999
  | "active"          // 10,000 – 14,999
  | "very_active";    // 15,000+

// ─── Data Validation ─────────────────────────────────────────────────────────

/** Validation result for a single record. */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly ValidationIssue[];
  /** Cleaned/normalized data (null if unrecoverable). */
  readonly cleanedData: DailyActivity | null;
}

/** A specific validation issue found. */
export interface ValidationIssue {
  readonly field: string;
  readonly severity: "warning" | "error";
  readonly message: string;
  /** The original value that was problematic. */
  readonly originalValue: unknown;
  /** The corrected value (null if discarded). */
  readonly correctedValue: unknown;
}

/** Validation thresholds for sanity checks. */
export interface ValidationThresholds {
  readonly maxStepsPerDay: number;
  readonly maxCaloriesPerDay: number;
  readonly maxDistanceMetersPerDay: number;
  readonly maxFlightsPerDay: number;
  readonly maxWorkoutMinutesPerDay: number;
  readonly minStepsForValidDay: number;
}

/** Default validation thresholds. */
export const DEFAULT_VALIDATION_THRESHOLDS: ValidationThresholds = {
  maxStepsPerDay: 100_000,
  maxCaloriesPerDay: 10_000,
  maxDistanceMetersPerDay: 100_000,
  maxFlightsPerDay: 500,
  maxWorkoutMinutesPerDay: 1_440,
  minStepsForValidDay: 0,
};

// ─── Theme Awareness ─────────────────────────────────────────────────────────

/** Color scheme preference. */
export type ColorSchemePreference = "light" | "dark" | "system";

/** Semantic color tokens consumed by activity components. */
export interface ActivityThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly border: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly success: string;
  readonly successSoft: string;
  readonly danger: string;
  readonly dangerSoft: string;
  readonly warning: string;
  readonly warningSoft: string;
  readonly chartBar: string;
  readonly chartBarGoalReached: string;
  readonly chartGoalLine: string;
  readonly ringTrack: string;
  readonly ringProgress: string;
  readonly skeletonBase: string;
  readonly skeletonHighlight: string;
  readonly cardBackground: string;
  readonly cardBorder: string;
}

// ─── Store Shape ─────────────────────────────────────────────────────────────

/** Complete activity module store state. */
export interface ActivityStoreState {
  // Data
  readonly todayData: DailyActivity | null;
  readonly weeklyData: WeeklyData | null;
  readonly monthlyData: MonthlyData | null;
  readonly yearlyData: YearlyData | null;

  // Permission
  readonly permission: PermissionState;

  // Sync
  readonly syncState: SyncState;

  // Goals
  readonly goalConfig: GoalConfig;
  readonly todayGoalProgress: GoalProgress | null;

  // Streaks
  readonly streakData: StreakData;

  // Achievements
  readonly achievements: readonly Achievement[];
  readonly newlyUnlockedAchievements: readonly Achievement[];
  readonly levelInfo: LevelInfo;

  // Analytics
  readonly analytics: ActivityAnalytics | null;

  // AI
  readonly activityInsights: ActivityInsights | null;

  // Charts
  readonly selectedChartMetric: ChartMetric;
  readonly selectedChartTimeRange: ChartTimeRange;

  // Notifications
  readonly notificationPreferences: NotificationPreferences;

  // UI
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
}

/** Activity store actions. */
export interface ActivityStoreActions {
  // Data setters
  setTodayData: (data: DailyActivity) => void;
  setWeeklyData: (data: WeeklyData) => void;
  setMonthlyData: (data: MonthlyData) => void;
  setYearlyData: (data: YearlyData) => void;

  // Permission
  setPermission: (state: PermissionState) => void;

  // Sync
  setSyncState: (state: Partial<SyncState>) => void;

  // Goals
  setGoalConfig: (config: GoalConfig) => void;
  setTodayGoalProgress: (progress: GoalProgress) => void;

  // Streaks
  setStreakData: (data: StreakData) => void;

  // Achievements
  setAchievements: (achievements: readonly Achievement[]) => void;
  addNewlyUnlocked: (achievement: Achievement) => void;
  acknowledgeAchievement: (id: string) => void;
  clearNewlyUnlocked: () => void;
  setLevelInfo: (info: LevelInfo) => void;

  // Analytics
  setAnalytics: (analytics: ActivityAnalytics) => void;

  // AI
  setActivityInsights: (insights: ActivityInsights) => void;

  // Charts
  setSelectedChartMetric: (metric: ChartMetric) => void;
  setSelectedChartTimeRange: (range: ChartTimeRange) => void;

  // Notifications
  setNotificationPreferences: (prefs: NotificationPreferences) => void;

  // UI
  setIsLoading: (loading: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;

  // Reset
  resetStore: () => void;
}

/** Combined store type. */
export type ActivityStore = ActivityStoreState & ActivityStoreActions;

// ─── API Contract (mirrors existing backend) ─────────────────────────────────

/** Request body for POST /steps/sync. */
export interface StepSyncRequest {
  readonly platform: string;
  readonly source: string;
  readonly entries: readonly StepSyncEntry[];
}

/** Single entry in the sync payload. */
export interface StepSyncEntry {
  readonly date: string;
  readonly steps: number;
  readonly distance_m: number | null;
  readonly calories: number | null;
}

/** Response from POST /steps/sync. */
export interface StepSyncResponse {
  readonly ok: boolean;
  readonly synced: number;
}

/** Response from GET /steps/today. */
export interface StepTodayResponse {
  readonly date: string;
  readonly steps: number;
  readonly distance_m: number;
  readonly calories: number;
  readonly goal: number;
  readonly progress_pct: number;
  readonly remaining: number;
  readonly goal_reached: boolean;
  readonly last_sync: string | null;
  readonly source: string | null;
}

/** Response from GET /steps/analytics/weekly. */
export interface StepWeeklyResponse {
  readonly goal: number;
  readonly entries: readonly { date: string; steps: number; goal_reached?: boolean }[];
  readonly stats: {
    readonly total: number;
    readonly average: number;
    readonly highest: number;
    readonly lowest: number;
    readonly days_goal_hit: number;
    readonly current_streak: number;
    readonly longest_streak: number;
  };
  readonly trend_vs_prev_week_pct: number;
}

/** Response from GET /steps/analytics/monthly. */
export interface StepMonthlyResponse {
  readonly goal: number;
  readonly entries: readonly { date: string; steps: number; goal_reached?: boolean }[];
  readonly stats: {
    readonly total: number;
    readonly average: number;
    readonly highest: number;
    readonly lowest: number;
    readonly days_goal_hit: number;
    readonly current_streak: number;
    readonly longest_streak: number;
  };
  readonly best_day: { date: string; steps: number } | null;
}

/** Response from GET /steps/goal. */
export interface StepGoalResponse {
  readonly daily_goal: number;
}
