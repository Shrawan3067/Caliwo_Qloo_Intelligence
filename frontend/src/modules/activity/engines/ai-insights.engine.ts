/**
 * AI Insights Engine
 *
 * Computes activity-derived insights that the AI nutrition engine
 * can consume. Provides calorie adjustments, protein/water recommendations,
 * recovery meal suggestions, activity scoring, and movement summaries.
 *
 * This module is intentionally decoupled from the nutrition system.
 * It exposes structured data; the nutrition AI decides how to use it.
 *
 * @module activity/engines/ai-insights
 */

import type {
  DailyActivity,
  ActivityInsights,
  ActivityLevel,
} from "../types";
import {
  ACTIVITY_LEVEL_THRESHOLDS,
  CALORIE_ADJUSTMENT_PER_STEP,
  CALORIE_ADJUSTMENT_BASELINE_STEPS,
  PROTEIN_ADJUSTMENT_PER_5K_STEPS,
  WATER_ADJUSTMENT_PER_5K_STEPS,
  RECOVERY_MEAL_STEP_THRESHOLD,
} from "../constants";

// ─── Activity Level Classification ───────────────────────────────────────────

/**
 * Classify activity level from daily step count.
 */
export function classifyActivityLevel(steps: number): ActivityLevel {
  if (steps >= ACTIVITY_LEVEL_THRESHOLDS.active) return "very_active";
  if (steps >= ACTIVITY_LEVEL_THRESHOLDS.moderately_active) return "active";
  if (steps >= ACTIVITY_LEVEL_THRESHOLDS.lightly_active) return "moderately_active";
  if (steps >= ACTIVITY_LEVEL_THRESHOLDS.sedentary) return "lightly_active";
  return "sedentary";
}

/**
 * Get a human-readable label for an activity level.
 */
export function getActivityLevelLabel(level: ActivityLevel): string {
  switch (level) {
    case "sedentary": return "Sedentary";
    case "lightly_active": return "Lightly Active";
    case "moderately_active": return "Moderately Active";
    case "active": return "Active";
    case "very_active": return "Very Active";
  }
}

// ─── Calorie Adjustment ─────────────────────────────────────────────────────

/**
 * Estimate the calorie adjustment based on steps above/below baseline.
 *
 * Positive = user burned more than expected → may need more food.
 * Negative = user burned less than expected → may need less food.
 */
export function computeCalorieAdjustment(steps: number): number {
  const delta = steps - CALORIE_ADJUSTMENT_BASELINE_STEPS;
  return Math.round(delta * CALORIE_ADJUSTMENT_PER_STEP);
}

// ─── Protein Adjustment ──────────────────────────────────────────────────────

/**
 * Compute protein recommendation adjustment in grams.
 * Higher activity = more protein needed for muscle recovery.
 */
export function computeProteinAdjustment(steps: number): number {
  const stepsAboveBaseline = Math.max(0, steps - CALORIE_ADJUSTMENT_BASELINE_STEPS);
  const blocks = Math.floor(stepsAboveBaseline / 5_000);
  return blocks * PROTEIN_ADJUSTMENT_PER_5K_STEPS;
}

// ─── Water Adjustment ────────────────────────────────────────────────────────

/**
 * Compute additional water intake recommendation in ml.
 * More activity = more hydration needed.
 */
export function computeWaterAdjustment(steps: number): number {
  const stepsAboveBaseline = Math.max(0, steps - CALORIE_ADJUSTMENT_BASELINE_STEPS);
  const blocks = Math.floor(stepsAboveBaseline / 5_000);
  return blocks * WATER_ADJUSTMENT_PER_5K_STEPS;
}

// ─── Recovery Meal ───────────────────────────────────────────────────────────

/**
 * Determine if a recovery meal is recommended based on extreme activity.
 */
export function isRecoveryMealRecommended(steps: number, workoutMinutes: number): boolean {
  return steps >= RECOVERY_MEAL_STEP_THRESHOLD || workoutMinutes >= 90;
}

// ─── Activity Score ──────────────────────────────────────────────────────────

/**
 * Compute an overall activity score from 0-100.
 *
 * Weighted formula:
 * - Steps contribution (50%): based on 10,000 step target
 * - Active calories contribution (20%): based on 500 kcal target
 * - Workout contribution (20%): based on 30 min target
 * - Consistency contribution (10%): based on weekly average
 */
export function computeActivityScore(
  todayData: DailyActivity,
  weeklyAverageSteps: number = 0,
): number {
  const stepScore = Math.min(100, (todayData.steps / 10_000) * 100);
  const calorieScore = Math.min(100, (todayData.caloriesActive / 500) * 100);
  const workoutScore = Math.min(100, (todayData.workoutDurationMinutes / 30) * 100);
  const consistencyScore = Math.min(100, (weeklyAverageSteps / 10_000) * 100);

  const weighted =
    stepScore * 0.5 +
    calorieScore * 0.2 +
    workoutScore * 0.2 +
    consistencyScore * 0.1;

  return Math.round(Math.min(100, Math.max(0, weighted)));
}

// ─── Movement Summary ────────────────────────────────────────────────────────

/**
 * Generate a human-readable daily movement summary for the AI.
 */
export function generateMovementSummary(
  todayData: DailyActivity,
  goal: number,
): string {
  const distKm = (todayData.distanceTotalMeters / 1_000).toFixed(1);
  const goalPct = Math.round((todayData.steps / goal) * 100);
  const level = classifyActivityLevel(todayData.steps);
  const levelLabel = getActivityLevelLabel(level);

  const parts: string[] = [
    `${todayData.steps.toLocaleString()} steps (${goalPct}% of ${goal.toLocaleString()} goal)`,
    `${distKm} km walked`,
    `${todayData.caloriesActive} active kcal burned`,
  ];

  if (todayData.workoutDurationMinutes > 0) {
    parts.push(`${todayData.workoutDurationMinutes} min exercise`);
  }

  if (todayData.flightsClimbed > 0) {
    parts.push(`${todayData.flightsClimbed} flights climbed`);
  }

  parts.push(`Activity level: ${levelLabel}`);

  if (todayData.goalReached) {
    parts.push("Daily goal achieved ✓");
  }

  return parts.join(". ") + ".";
}

// ─── Full Insights Computation ───────────────────────────────────────────────

/**
 * Compute complete activity insights for the AI nutrition engine.
 *
 * @param todayData — today's activity record
 * @param weeklyEntries — last 7 days of activity for consistency check
 * @param goal — daily step goal
 */
export function computeInsights(
  todayData: DailyActivity,
  weeklyEntries: readonly DailyActivity[] = [],
  goal: number = 10_000,
): ActivityInsights {
  const weeklyAverageSteps =
    weeklyEntries.length > 0
      ? Math.round(weeklyEntries.reduce((s, e) => s + e.steps, 0) / weeklyEntries.length)
      : 0;

  const consistentDays = weeklyEntries.filter((e) => e.steps >= goal).length;
  const isConsistentlyActive = weeklyEntries.length >= 5 && consistentDays >= 4;

  return {
    estimatedCalorieAdjustment: computeCalorieAdjustment(todayData.steps),
    proteinRecommendationAdjustmentG: computeProteinAdjustment(todayData.steps),
    waterIntakeRecommendationMl: computeWaterAdjustment(todayData.steps),
    recoveryMealRecommended: isRecoveryMealRecommended(
      todayData.steps,
      todayData.workoutDurationMinutes,
    ),
    activityScore: computeActivityScore(todayData, weeklyAverageSteps),
    dailyMovementSummary: generateMovementSummary(todayData, goal),
    activityLevel: classifyActivityLevel(todayData.steps),
    weeklyAverageSteps,
    isConsistentlyActive,
  };
}
