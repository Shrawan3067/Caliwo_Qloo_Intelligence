/**
 * Activity Hooks — Barrel Export
 *
 * @module activity/hooks
 */

export { useActivitySync } from "./useActivitySync";
export { useActivityPermission } from "./useActivityPermission";
export { useActivityGoal } from "./useActivityGoal";
export { useActivityStreak } from "./useActivityStreak";
export { useActivityAchievements } from "./useActivityAchievements";
export { useActivityCharts } from "./useActivityCharts";
export { useActivityAnalytics } from "./useActivityAnalytics";

// Re-export the store for direct access when hooks aren't sufficient
export { useActivityStore } from "../store/activity.store";
export {
  selectSteps,
  selectGoalProgress,
  selectStreak,
  selectLongestStreak,
  selectLevel,
  selectPermission,
  selectIsSyncing,
  selectIsLoading,
  selectError,
  selectTodayData,
  selectInsights,
  selectAnalytics,
  selectAchievements,
  selectNewlyUnlocked,
  selectSelectedPeriod,
  selectWeeklyData,
  selectMonthlyData,
  selectPlatformName,
} from "../store/activity.store";
