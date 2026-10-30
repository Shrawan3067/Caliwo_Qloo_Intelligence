/**
 * Goals Repository
 *
 * Persistence for goal configuration, completion history, and
 * goal-related preferences. Backs the goal engine with local storage.
 *
 * @module activity/repositories/goals
 */

import { storage } from "@/src/utils/storage";
import { STORAGE_KEYS } from "../constants";
import type { GoalConfig, GoalCompletion } from "../types";
import { DEFAULT_GOAL_CONFIG } from "../types";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw || raw === "null" || raw === "undefined") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Goal Configuration ──────────────────────────────────────────────────────

/**
 * Retrieve the persisted goal configuration.
 * Returns DEFAULT_GOAL_CONFIG if nothing is stored.
 */
export async function getGoalConfig(): Promise<GoalConfig> {
  const raw = await storage.getItem(STORAGE_KEYS.GOAL_CONFIG, "");
  return safeParse<GoalConfig>(raw as string) ?? { ...DEFAULT_GOAL_CONFIG };
}

/**
 * Persist goal configuration.
 */
export async function setGoalConfig(config: GoalConfig): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.GOAL_CONFIG, JSON.stringify(config));
}

/**
 * Quick accessor for the daily step goal value.
 */
export async function getDailyStepGoal(): Promise<number> {
  const config = await getGoalConfig();
  return config.dailySteps;
}

/**
 * Update only the daily step goal, preserving other config fields.
 */
export async function setDailyStepGoal(steps: number): Promise<boolean> {
  const current = await getGoalConfig();
  return setGoalConfig({
    ...current,
    dailySteps: steps,
    lastUpdated: new Date().toISOString(),
  });
}

// ─── Goal History ────────────────────────────────────────────────────────────

/**
 * Retrieve all goal completion records.
 */
export async function getGoalHistory(): Promise<GoalCompletion[]> {
  const raw = await storage.getItem(STORAGE_KEYS.GOAL_HISTORY, "");
  return safeParse<GoalCompletion[]>(raw as string) ?? [];
}

/**
 * Add a goal completion record.
 * Deduplicates by date + period + metric.
 */
export async function addGoalCompletion(completion: GoalCompletion): Promise<boolean> {
  const history = await getGoalHistory();

  // Check for duplicate
  const isDuplicate = history.some(
    (h) =>
      h.date === completion.date &&
      h.period === completion.period &&
      h.metric === completion.metric,
  );

  if (isDuplicate) return true; // Already recorded

  history.push(completion);

  // Keep last 365 entries to prevent unbounded growth
  const trimmed = history.slice(-365);

  return storage.setItem(STORAGE_KEYS.GOAL_HISTORY, JSON.stringify(trimmed));
}

/**
 * Get goal completions for a specific date.
 */
export async function getGoalCompletionsForDate(date: string): Promise<GoalCompletion[]> {
  const history = await getGoalHistory();
  return history.filter((h) => h.date === date);
}

/**
 * Count total goal completions for a given period type.
 */
export async function countGoalCompletions(
  period: "daily" | "weekly" | "monthly",
): Promise<number> {
  const history = await getGoalHistory();
  return history.filter((h) => h.period === period).length;
}

/**
 * Get goal completions within a date range.
 */
export async function getGoalCompletionsInRange(
  startDate: string,
  endDate: string,
): Promise<GoalCompletion[]> {
  const history = await getGoalHistory();
  return history.filter((h) => h.date >= startDate && h.date <= endDate);
}

/**
 * Clear all goal history. Used on account reset.
 */
export async function clearGoalHistory(): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.GOAL_HISTORY, JSON.stringify([]));
}
