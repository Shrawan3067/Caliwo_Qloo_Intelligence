/**
 * Activity Tracking Module — Public API
 *
 * Single import point for the entire activity module:
 *   import { DailyActivity, SYNC_CONFIG, ActivityError } from "@/src/modules/activity";
 *
 * @module activity
 */

// Types — all interfaces, enums, type aliases, factory functions, and defaults
export type {
  // Metric identifiers
  ActivityMetricId,
  // Platform & Source
  HealthPlatform,
  ActivitySource,
  DeviceInfo,
  // Core data models
  ExerciseSession,
  HourlyActivity,
  DailyActivity,
  // Aggregated stats
  AggregatedStats,
  WeeklyData,
  MonthlyData,
  YearlyData,
  WeeklyAggregate,
  // Analytics
  MovingAveragePoint,
  PersonalRecord,
  HeatmapCell,
  ActivityAnalytics,
  // Goal system
  GoalPeriod,
  GoalMode,
  GoalConfig,
  GoalProgress,
  GoalCompletion,
  GoalCelebrationTier,
  GoalRecommendation,
  // Streak system
  StreakData,
  StreakMilestone,
  // Achievement system
  AchievementTier,
  AchievementCategory,
  AchievementDefinition,
  Achievement,
  LevelInfo,
  // Sync state machine
  SyncMode,
  SyncStatus,
  SyncState,
  SyncResult,
  OfflineSyncEntry,
  // Permission state machine
  PermissionStatus,
  PermissionState,
  // Chart data
  ChartMetric,
  ChartTimeRange,
  ChartDataPoint,
  ChartData,
  // Notification system
  ActivityNotificationType,
  ActivityNotification,
  NotificationPreferences,
  // Widget integration
  ActivityWidgetData,
  // AI integration
  ActivityInsights,
  ActivityLevel,
  // Data validation
  ValidationResult,
  ValidationIssue,
  ValidationThresholds,
  // Theme awareness
  ColorSchemePreference,
  ActivityThemeColors,
  // Store shape
  ActivityStoreState,
  ActivityStoreActions,
  ActivityStore,
  // API contract
  StepSyncRequest,
  StepSyncEntry,
  StepSyncResponse,
  StepTodayResponse,
  StepWeeklyResponse,
  StepMonthlyResponse,
  StepGoalResponse,
} from "./types";

export {
  // Value exports from types
  METRIC_UNITS,
  SOURCE_QUALITY,
  createEmptyDailyActivity,
  DEFAULT_GOAL_CONFIG,
  DEFAULT_STREAK_DATA,
  DEFAULT_SYNC_STATE,
  DEFAULT_PERMISSION_STATE,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_VALIDATION_THRESHOLDS,
} from "./types";

// Constants — storage keys, sync config, achievement definitions, XP tables, etc.
export {
  STORAGE_KEYS,
  SYNC_CONFIG,
  GOAL_PRESETS,
  GOAL_DEFAULTS,
  GOAL_RECOMMENDATION_INCREASE_PCT,
  GOAL_MIN_STEPS,
  GOAL_MAX_STEPS,
  STREAK_FREEZE_DAYS_PER_MONTH,
  STREAK_MAX_FREEZE_DAYS,
  STREAK_MILESTONES,
  XP_PER_TIER,
  XP_LEVELS,
  LEVEL_TITLES,
  ACHIEVEMENT_DEFINITIONS,
  VALIDATION_THRESHOLDS,
  AVG_STRIDE_M,
  KCAL_PER_STEP,
  STEPS_PER_FLIGHT,
  ACTIVITY_LEVEL_THRESHOLDS,
  CALORIE_ADJUSTMENT_PER_STEP,
  CALORIE_ADJUSTMENT_BASELINE_STEPS,
  PROTEIN_ADJUSTMENT_PER_5K_STEPS,
  WATER_ADJUSTMENT_PER_5K_STEPS,
  RECOVERY_MEAL_STEP_THRESHOLD,
  ANIMATION,
  A11Y,
  HEALTH_CONNECT_PLAY_STORE_URI,
  HEALTH_CONNECT_PACKAGE,
  DAYS_OF_WEEK_SHORT,
  DAYS_OF_WEEK_LETTER,
  MONTHS_SHORT,
} from "./constants";

// Errors — class hierarchy and utilities
export {
  ActivityError,
  PermissionDeniedError,
  PermissionRevokedError,
  HealthUnavailableError,
  HealthConnectMissingError,
  HealthConnectOutdatedError,
  DeviceUnsupportedError,
  SimulatorDetectedError,
  SyncFailedError,
  SyncTimeoutError,
  SyncCancelledError,
  SyncConflictError,
  NoDataError,
  CorruptedDataError,
  PartialDataError,
  ValidationFailedError,
  NetworkUnavailableError,
  ApiError,
  RateLimitedError,
  StorageError,
  BackgroundFailureError,
  UnknownActivityError,
  toActivityError,
  isActivityError,
  shouldRetry,
  computeBackoffDelay,
} from "./errors";

export type { ActivityErrorCode } from "./errors";

// Services — platform health data abstraction
export { HealthKitService, HealthConnectService, PlatformService } from "./services";

// Repositories — offline-first persistence
export { ActivityRepo, GoalsRepo, AchievementsRepo, StreaksRepo } from "./repositories";

// Engines — pure business logic
export {
  SyncEngine,
  GoalEngine,
  StreakEngine,
  AchievementEngine,
  AnalyticsEngine,
  ValidationEngine,
  NotificationEngine,
  AIInsightsEngine,
} from "./engines";

// Hooks — React integration
export {
  useActivitySync,
  useActivityPermission,
  useActivityGoal,
  useActivityStreak,
  useActivityAchievements,
  useActivityCharts,
  useActivityAnalytics,
  useActivityStore,
  selectSteps,
  selectGoalProgress,
  selectStreak,
  selectLevel,
  selectPermission,
  selectIsSyncing,
  selectIsLoading,
  selectError,
  selectTodayData,
  selectInsights,
  selectAnalytics,
} from "./hooks";

// Providers
export { ActivityProvider } from "./providers/ActivityProvider";

// Components
export {
  useActivityColors,
  getActivityColors,
  AnimatedRing,
  StepCard,
  StreakBadge,
  AchievementCard,
  WeeklyBarChart,
  PermissionGate,
  GoalSettingsSheet,
  ActivityScreenSkeleton,
  StepCardSkeleton,
} from "./components";

// Store types
export type { TimePeriod } from "./store/activity.store";
