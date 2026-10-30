/**
 * Goal Engine
 *
 * Pure business logic for goal evaluation, progress computation,
 * smart recommendations, adaptive adjustments, and celebration tiers.
 *
 * @module activity/engines/goal
 */

import type {
  GoalConfig,
  GoalProgress,
  GoalRecommendation,
  GoalCelebrationTier,
  GoalMode,
  DailyActivity,
} from "../types";
import {
  GOAL_RECOMMENDATION_INCREASE_PCT,
  GOAL_MIN_STEPS,
  GOAL_MAX_STEPS,
  GOAL_DEFAULTS,
} from "../constants";

// ─── Progress Computation ────────────────────────────────────────────────────

/**
 * Compute goal progress for a single metric.
 */
export function computeGoalProgress(
  current: number,
  target: number,
): GoalProgress {
  const clamped = Math.max(0, current);
  const safeTarget = Math.max(1, target);
  const percentage = Math.min(100, Math.round((clamped / safeTarget) * 100));
  const remaining = Math.max(0, safeTarget - clamped);
  const completed = clamped >= safeTarget;

  return { current: clamped, target: safeTarget, percentage, remaining, completed };
}

/**
 * Compute step goal progress from today's data.
 */
export function computeStepGoalProgress(
  steps: number,
  goal: GoalConfig,
): GoalProgress {
  return computeGoalProgress(steps, goal.dailySteps);
}

/**
 * Compute weekly step goal progress.
 */
export function computeWeeklyGoalProgress(
  weeklySteps: number,
  goal: GoalConfig,
): GoalProgress {
  return computeGoalProgress(weeklySteps, goal.weeklySteps);
}

/**
 * Compute monthly step goal progress.
 */
export function computeMonthlyGoalProgress(
  monthlySteps: number,
  goal: GoalConfig,
): GoalProgress {
  return computeGoalProgress(monthlySteps, goal.monthlySteps);
}

// ─── Goal Evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluate whether a daily goal is met.
 */
export function evaluateDailyGoal(steps: number, goal: number): boolean {
  return steps >= goal;
}

/**
 * Evaluate weekly goal completion.
 * Returns the number of days the goal was reached.
 */
export function evaluateWeeklyGoal(
  entries: readonly DailyActivity[],
  dailyGoal: number,
): { daysReached: number; totalDays: number; weeklyGoalMet: boolean } {
  const daysReached = entries.filter((e) => e.steps >= dailyGoal).length;
  // Weekly goal is met if at least 5 of 7 days hit the daily goal
  const weeklyGoalMet = daysReached >= 5;
  return { daysReached, totalDays: entries.length, weeklyGoalMet };
}

// ─── Smart Recommendations ───────────────────────────────────────────────────

/**
 * Generate a smart goal recommendation based on recent activity.
 *
 * Strategy:
 * - Beginner: 10% above current average (gentle onboarding)
 * - Standard: 10% above average, minimum 10,000
 * - Advanced: 20% above average, minimum 15,000
 * - Recovery: 50% of average (for post-injury/illness)
 */
export function recommendGoal(
  recentEntries: readonly DailyActivity[],
  mode: GoalMode = "standard",
): GoalRecommendation {
  if (recentEntries.length === 0) {
    const defaults = GOAL_DEFAULTS[mode];
    return {
      recommendedSteps: defaults.steps,
      reasoning: "No recent activity data. Using default goal for your selected mode.",
      basedOnDays: 0,
      currentAverage: 0,
      percentageIncrease: 0,
      mode,
    };
  }

  const totalSteps = recentEntries.reduce((sum, e) => sum + e.steps, 0);
  const average = Math.round(totalSteps / recentEntries.length);

  let multiplier: number;
  let minGoal: number;
  let reasoning: string;

  switch (mode) {
    case "beginner":
      multiplier = 1 + GOAL_RECOMMENDATION_INCREASE_PCT / 100;
      minGoal = GOAL_DEFAULTS.beginner.steps;
      reasoning = `Based on your ${recentEntries.length}-day average of ${average.toLocaleString()} steps, we recommend a gentle 10% increase.`;
      break;
    case "advanced":
      multiplier = 1.2;
      minGoal = GOAL_DEFAULTS.advanced.steps;
      reasoning = `Based on your ${recentEntries.length}-day average of ${average.toLocaleString()} steps, we recommend an ambitious 20% increase.`;
      break;
    case "recovery":
      multiplier = 0.5;
      minGoal = GOAL_DEFAULTS.recovery.steps;
      reasoning = `Recovery mode: targeting 50% of your ${recentEntries.length}-day average to help you ease back in.`;
      break;
    default: // standard
      multiplier = 1 + GOAL_RECOMMENDATION_INCREASE_PCT / 100;
      minGoal = GOAL_DEFAULTS.standard.steps;
      reasoning = `Based on your ${recentEntries.length}-day average of ${average.toLocaleString()} steps, we recommend a 10% increase.`;
  }

  const computed = Math.round(average * multiplier);
  const recommended = clampGoal(Math.max(computed, minGoal));
  const percentageIncrease = average > 0
    ? Math.round(((recommended - average) / average) * 100)
    : 0;

  return {
    recommendedSteps: recommended,
    reasoning,
    basedOnDays: recentEntries.length,
    currentAverage: average,
    percentageIncrease,
    mode,
  };
}

/**
 * Compute an adaptive goal adjustment based on recent performance.
 *
 * - If user exceeded goal 6/7 days → increase by 5%
 * - If user missed goal 5/7 days → decrease by 10%
 * - Otherwise → no change
 */
export function computeAdaptiveAdjustment(
  currentGoal: number,
  recentEntries: readonly DailyActivity[],
): { newGoal: number; adjusted: boolean; reason: string } {
  if (recentEntries.length < 7) {
    return { newGoal: currentGoal, adjusted: false, reason: "Not enough data for adaptive adjustment" };
  }

  const lastWeek = recentEntries.slice(-7);
  const daysReached = lastWeek.filter((e) => e.steps >= currentGoal).length;

  if (daysReached >= 6) {
    const newGoal = clampGoal(Math.round(currentGoal * 1.05));
    return {
      newGoal,
      adjusted: newGoal !== currentGoal,
      reason: `You crushed your goal ${daysReached}/7 days! Increasing by 5%.`,
    };
  }

  if (daysReached <= 2) {
    const newGoal = clampGoal(Math.round(currentGoal * 0.9));
    return {
      newGoal,
      adjusted: newGoal !== currentGoal,
      reason: `You hit your goal only ${daysReached}/7 days. Adjusting down by 10% to keep you motivated.`,
    };
  }

  return { newGoal: currentGoal, adjusted: false, reason: "Goal is well-calibrated" };
}

// ─── Celebration Tiers ───────────────────────────────────────────────────────

/**
 * Determine the celebration tier based on goal completion percentage.
 */
export function getGoalCelebrationTier(
  percentage: number,
): GoalCelebrationTier | null {
  if (percentage >= 150) return "legendary";
  if (percentage >= 125) return "crushed";
  if (percentage >= 100) return "reached";
  if (percentage >= 75) return "almost";
  if (percentage >= 50) return "halfway";
  return null;
}

/**
 * Get the celebration message for a tier.
 */
export function getCelebrationMessage(tier: GoalCelebrationTier): string {
  switch (tier) {
    case "halfway":
      return "Halfway there! Keep going! 💪";
    case "almost":
      return "Almost there! Just a bit more! 🎯";
    case "reached":
      return "Goal reached! Amazing work! 🎉";
    case "crushed":
      return "You crushed it! Incredible! 🔥";
    case "legendary":
      return "LEGENDARY! Absolutely unstoppable! ⭐";
  }
}

// ─── Goal Prediction ─────────────────────────────────────────────────────────

/**
 * Predict when the user will reach their daily goal based on current pace.
 *
 * @param currentSteps — steps so far today
 * @param goal — daily step goal
 * @returns predicted completion hour (0-23) or null if unlikely
 */
export function predictGoalCompletionHour(
  currentSteps: number,
  goal: number,
  hourlyBreakdown: readonly { hour: number; steps: number }[],
): number | null {
  if (currentSteps >= goal) return null; // Already met

  const currentHour = new Date().getHours();
  if (currentHour === 0) return null; // No data yet

  // Calculate average steps per hour so far
  const stepsPerHour = currentSteps / currentHour;
  if (stepsPerHour <= 0) return null;

  const remaining = goal - currentSteps;
  const hoursNeeded = Math.ceil(remaining / stepsPerHour);
  const predictedHour = currentHour + hoursNeeded;

  // If predicted beyond midnight, goal is unlikely today
  if (predictedHour >= 24) return null;

  return predictedHour;
}

/**
 * Estimate remaining steps to hit goal.
 */
export function stepsRemaining(current: number, goal: number): number {
  return Math.max(0, goal - current);
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a goal value.
 */
export function isValidGoal(steps: number): boolean {
  return Number.isFinite(steps) && steps >= GOAL_MIN_STEPS && steps <= GOAL_MAX_STEPS;
}

/**
 * Clamp a goal to valid bounds.
 */
export function clampGoal(steps: number): number {
  return Math.max(GOAL_MIN_STEPS, Math.min(GOAL_MAX_STEPS, Math.round(steps)));
}
