/**
 * useActivityAnalytics Hook
 *
 * Exposes analytics data, AI insights, and trend information.
 *
 * @module activity/hooks/useActivityAnalytics
 */

import { useEffect } from "react";
import { useActivityStore } from "../store/activity.store";

/**
 * Hook for analytics and AI insights.
 * Triggers background refresh of analytics on mount.
 */
export function useActivityAnalytics() {
  const analytics = useActivityStore((s) => s.analytics);
  const insights = useActivityStore((s) => s.insights);
  const isInitialized = useActivityStore((s) => s.isInitialized);
  const refreshAnalytics = useActivityStore((s) => s.refreshAnalytics);
  const refreshInsights = useActivityStore((s) => s.refreshInsights);

  // Auto-refresh analytics on mount if initialized and no data yet
  useEffect(() => {
    if (isInitialized && !analytics) {
      refreshAnalytics();
    }
  }, [isInitialized, analytics, refreshAnalytics]);

  // Auto-refresh insights on mount if initialized and no data yet
  useEffect(() => {
    if (isInitialized && !insights) {
      refreshInsights();
    }
  }, [isInitialized, insights, refreshInsights]);

  return {
    analytics,
    insights,
    trendScore: analytics?.trendScore ?? 0,
    consistencyScore: analytics?.consistencyScore ?? 0,
    activeDayPercentage: analytics?.activeDayPercentage ?? 0,
    bestDay: analytics?.bestDay ?? null,
    bestWeek: analytics?.bestWeek ?? null,
    personalRecords: analytics?.personalRecords ?? [],
    activityLevel: insights?.activityLevel ?? "sedentary",
    activityScore: insights?.activityScore ?? 0,
    calorieAdjustment: insights?.estimatedCalorieAdjustment ?? 0,
    movementSummary: insights?.dailyMovementSummary ?? "",
    isConsistentlyActive: insights?.isConsistentlyActive ?? false,
    refreshAnalytics,
    refreshInsights,
  };
}
