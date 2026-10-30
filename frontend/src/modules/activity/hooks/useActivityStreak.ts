/**
 * useActivityStreak Hook
 *
 * Streak visualization, milestone tracking, freeze management.
 *
 * @module activity/hooks/useActivityStreak
 */

import { useMemo } from "react";
import { useActivityStore } from "../store/activity.store";
import * as StreakEngine from "../engines/streak.engine";

/**
 * Hook for streak data and interactions.
 */
export function useActivityStreak() {
  const streakData = useActivityStore((s) => s.streakData);
  const applyFreeze = useActivityStore((s) => s.applyFreeze);
  const refreshStreaks = useActivityStore((s) => s.refreshStreaks);

  const milestoneProgress = useMemo(() => {
    return StreakEngine.getMilestoneProgress(streakData.currentStreak);
  }, [streakData.currentStreak]);

  const canUseFreezeToday = useMemo(() => {
    return StreakEngine.canUseFreeze(streakData);
  }, [streakData]);

  const isActive = streakData.currentStreak > 0;
  const isOnFire = streakData.currentStreak >= 7;
  const isLegendary = streakData.currentStreak >= 30;

  return {
    currentStreak: streakData.currentStreak,
    longestStreak: streakData.longestStreak,
    streakStartDate: streakData.streakStartDate,
    freezeDaysAvailable: streakData.freezeDaysAvailable,
    freezeDaysUsed: streakData.freezeDaysUsed,
    milestoneProgress,
    canUseFreezeToday,
    isActive,
    isOnFire,
    isLegendary,
    applyFreeze,
    refreshStreaks,
  };
}
