/**
 * useActivityGoal Hook
 *
 * Goal management, progress tracking, recommendations, and celebrations.
 *
 * @module activity/hooks/useActivityGoal
 */

import { useMemo, useCallback } from "react";
import { useActivityStore } from "../store/activity.store";
import * as GoalEngine from "../engines/goal.engine";
import type { GoalCelebrationTier } from "../types";

/**
 * Hook for goal management and progress tracking.
 */
export function useActivityGoal() {
  const goalConfig = useActivityStore((s) => s.goalConfig);
  const goalProgress = useActivityStore((s) => s.goalProgress);
  const todayData = useActivityStore((s) => s.todayData);
  const weeklyData = useActivityStore((s) => s.weeklyData);
  const setDailyStepGoal = useActivityStore((s) => s.setDailyStepGoal);
  const setGoalMode = useActivityStore((s) => s.setGoalMode);

  // Celebration tier
  const celebrationTier = useMemo<GoalCelebrationTier | null>(() => {
    return GoalEngine.getGoalCelebrationTier(goalProgress.percentage);
  }, [goalProgress.percentage]);

  const celebrationMessage = useMemo(() => {
    return celebrationTier ? GoalEngine.getCelebrationMessage(celebrationTier) : null;
  }, [celebrationTier]);

  // Goal prediction
  const predictedCompletionHour = useMemo(() => {
    return GoalEngine.predictGoalCompletionHour(
      todayData.steps,
      goalConfig.dailySteps,
      todayData.hourlyBreakdown,
    );
  }, [todayData.steps, goalConfig.dailySteps, todayData.hourlyBreakdown]);

  // Smart recommendation
  const recommendation = useMemo(() => {
    if (!weeklyData?.entries) return null;
    return GoalEngine.recommendGoal(weeklyData.entries, goalConfig.mode);
  }, [weeklyData?.entries, goalConfig.mode]);

  // Weekly goal evaluation
  const weeklyGoalStatus = useMemo(() => {
    if (!weeklyData?.entries) return null;
    return GoalEngine.evaluateWeeklyGoal(weeklyData.entries, goalConfig.dailySteps);
  }, [weeklyData?.entries, goalConfig.dailySteps]);

  // Remaining steps
  const stepsRemaining = useMemo(() => {
    return GoalEngine.stepsRemaining(todayData.steps, goalConfig.dailySteps);
  }, [todayData.steps, goalConfig.dailySteps]);

  const updateGoal = useCallback(
    async (steps: number) => {
      await setDailyStepGoal(steps);
    },
    [setDailyStepGoal],
  );

  const applyRecommendation = useCallback(async () => {
    if (recommendation) {
      await setDailyStepGoal(recommendation.recommendedSteps);
    }
  }, [recommendation, setDailyStepGoal]);

  return {
    goalConfig,
    goalProgress,
    celebrationTier,
    celebrationMessage,
    predictedCompletionHour,
    recommendation,
    weeklyGoalStatus,
    stepsRemaining,
    updateGoal,
    applyRecommendation,
    setGoalMode,
    isGoalReached: goalProgress.completed,
  };
}
