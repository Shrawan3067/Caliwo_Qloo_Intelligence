/**
 * useActivityAchievements Hook
 *
 * Achievement display, filtering, XP/level info, and unlock acknowledgment.
 *
 * @module activity/hooks/useActivityAchievements
 */

import { useMemo, useCallback } from "react";
import { useActivityStore } from "../store/activity.store";
import * as AchievementEngine from "../engines/achievement.engine";
import type { AchievementCategory } from "../types";
import { ACHIEVEMENT_DEFINITIONS } from "../constants";

/**
 * Hook for achievement system UI.
 */
export function useActivityAchievements() {
  const achievements = useActivityStore((s) => s.achievements);
  const levelInfo = useActivityStore((s) => s.levelInfo);
  const personalRecords = useActivityStore((s) => s.personalRecords);
  const newlyUnlocked = useActivityStore((s) => s.newlyUnlocked);
  const acknowledgeAchievement = useActivityStore((s) => s.acknowledgeAchievement);
  const dismissNewlyUnlocked = useActivityStore((s) => s.dismissNewlyUnlocked);
  const refreshAchievements = useActivityStore((s) => s.refreshAchievements);

  // Unlocked count
  const unlockedCount = useMemo(() => {
    return achievements.filter((a) => a.unlocked).length;
  }, [achievements]);

  const totalCount = ACHIEVEMENT_DEFINITIONS.length;

  // Achievements with definitions merged
  const enrichedAchievements = useMemo(() => {
    return achievements.map((a) => {
      const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === a.id);
      return { ...a, definition: def ?? null };
    });
  }, [achievements]);

  // Filter by category
  const getByCategory = useCallback(
    (category: AchievementCategory) => {
      const stats = AchievementEngine.countUnlockedByCategory(achievements, category);
      const defs = AchievementEngine.getDefinitionsByCategory(category);
      const items = defs.map((def) => {
        const state = achievements.find((a) => a.id === def.id);
        return { definition: def, state: state ?? null };
      });
      return { items, ...stats };
    },
    [achievements],
  );

  // Unacknowledged achievements
  const unacknowledgedCount = useMemo(() => {
    return achievements.filter((a) => a.unlocked && !a.acknowledged).length;
  }, [achievements]);

  // Progress percentage
  const overallProgress = useMemo(() => {
    return totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  }, [unlockedCount, totalCount]);

  return {
    achievements: enrichedAchievements,
    levelInfo,
    personalRecords,
    newlyUnlocked,
    unlockedCount,
    totalCount,
    unacknowledgedCount,
    overallProgress,
    getByCategory,
    acknowledgeAchievement,
    dismissNewlyUnlocked,
    refreshAchievements,
  };
}
