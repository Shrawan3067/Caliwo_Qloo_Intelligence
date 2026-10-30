/**
 * Streak Engine
 *
 * Pure business logic for streak computation, freeze day management,
 * milestone detection, and streak calendar generation.
 *
 * @module activity/engines/streak
 */

import type {
  StreakData,
  DailyActivity,
  StreakMilestone,
} from "../types";
import { DEFAULT_STREAK_DATA } from "../types";
import { STREAK_MILESTONES } from "../constants";

// ─── Streak Computation ──────────────────────────────────────────────────────

/**
 * Compute the current streak from a sorted array of daily activity entries.
 * A streak is consecutive days where the step goal is met.
 *
 * @param entries — daily entries sorted by date ascending
 * @param goal — daily step goal
 * @param frozenDates — dates where a freeze was used (count as goal-met)
 */
export function computeCurrentStreak(
  entries: readonly DailyActivity[],
  goal: number,
  frozenDates: readonly string[] = [],
): number {
  if (entries.length === 0) return 0;

  const frozenSet = new Set(frozenDates);
  let streak = 0;

  // Walk backward from the most recent entry
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const goalMet = entry.steps >= goal || frozenSet.has(entry.date);

    if (goalMet) {
      streak++;
    } else {
      break;
    }

    // Ensure consecutive days (no gaps)
    if (i > 0) {
      const currentDate = new Date(entries[i].date + "T00:00:00");
      const prevDate = new Date(entries[i - 1].date + "T00:00:00");
      const diffDays = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays > 1) {
        // Check if the gap days are all frozen
        const gapDates = getDatesBetween(entries[i - 1].date, entries[i].date);
        const allGapsFrozen = gapDates.every((d) => frozenSet.has(d));
        if (allGapsFrozen) {
          streak += gapDates.length;
        } else {
          break;
        }
      }
    }
  }

  return streak;
}

/**
 * Compute the longest streak from all daily entries.
 */
export function computeLongestStreak(
  entries: readonly DailyActivity[],
  goal: number,
  frozenDates: readonly string[] = [],
): { length: number; startDate: string } {
  if (entries.length === 0) return { length: 0, startDate: "" };

  const frozenSet = new Set(frozenDates);
  let longest = 0;
  let longestStart = "";
  let current = 0;
  let currentStart = "";

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const goalMet = entry.steps >= goal || frozenSet.has(entry.date);

    if (goalMet) {
      if (current === 0) currentStart = entry.date;
      current++;

      // Check for gap from previous entry
      if (i > 0) {
        const currentDate = new Date(entry.date + "T00:00:00");
        const prevDate = new Date(entries[i - 1].date + "T00:00:00");
        const diffDays = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays > 1) {
          const gapDates = getDatesBetween(entries[i - 1].date, entry.date);
          const allGapsFrozen = gapDates.every((d) => frozenSet.has(d));
          if (!allGapsFrozen) {
            // Gap breaks the streak — restart
            current = 1;
            currentStart = entry.date;
          } else {
            current += gapDates.length;
          }
        }
      }
    } else {
      current = 0;
      currentStart = "";
    }

    if (current > longest) {
      longest = current;
      longestStart = currentStart;
    }
  }

  return { length: longest, startDate: longestStart };
}

/**
 * Detect missed days (dates where goal was not met and no freeze was used).
 */
export function detectMissedDays(
  entries: readonly DailyActivity[],
  goal: number,
  frozenDates: readonly string[] = [],
): string[] {
  const frozenSet = new Set(frozenDates);
  return entries
    .filter((e) => e.steps < goal && !frozenSet.has(e.date))
    .map((e) => e.date);
}

// ─── Full Streak Evaluation ──────────────────────────────────────────────────

/**
 * Evaluate all streak metrics from activity history.
 * Returns a complete StreakData object ready for persistence.
 */
export function evaluateStreaks(
  entries: readonly DailyActivity[],
  goal: number,
  existingData: StreakData = DEFAULT_STREAK_DATA,
): StreakData {
  if (entries.length === 0) return existingData;

  // Sort by date ascending
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const frozenDates = existingData.freezeDaysUsed;

  const currentStreak = computeCurrentStreak(sorted, goal, frozenDates);
  const longest = computeLongestStreak(sorted, goal, frozenDates);
  const missedDays = detectMissedDays(sorted, goal, frozenDates);

  // Determine streak start date
  let streakStartDate = existingData.streakStartDate;
  if (currentStreak > 0 && sorted.length >= currentStreak) {
    streakStartDate = sorted[sorted.length - currentStreak].date;
  } else if (currentStreak === 0) {
    streakStartDate = "";
  }

  return {
    currentStreak,
    longestStreak: Math.max(existingData.longestStreak, longest.length),
    missedDays,
    freezeDaysAvailable: existingData.freezeDaysAvailable,
    freezeDaysUsed: [...frozenDates],
    streakStartDate,
    longestStreakStartDate:
      longest.length > existingData.longestStreak
        ? longest.startDate
        : existingData.longestStreakStartDate,
    lastEvaluated: new Date().toISOString(),
  };
}

// ─── Freeze Days ─────────────────────────────────────────────────────────────

/**
 * Check if a freeze day can be used.
 */
export function canUseFreeze(streakData: StreakData): boolean {
  return streakData.freezeDaysAvailable > 0 && streakData.currentStreak > 0;
}

/**
 * Apply a freeze day and return updated streak data.
 */
export function applyFreeze(
  date: string,
  streakData: StreakData,
): StreakData {
  if (!canUseFreeze(streakData)) return streakData;
  if (streakData.freezeDaysUsed.includes(date)) return streakData; // Already frozen

  return {
    ...streakData,
    freezeDaysAvailable: streakData.freezeDaysAvailable - 1,
    freezeDaysUsed: [...streakData.freezeDaysUsed, date],
    lastEvaluated: new Date().toISOString(),
  };
}

// ─── Milestones ──────────────────────────────────────────────────────────────

/**
 * Check which streak milestones have been reached.
 * Returns newly reached milestones (not previously reported).
 */
export function getReachedMilestones(
  currentStreak: number,
  previousStreak: number = 0,
): StreakMilestone[] {
  return STREAK_MILESTONES.filter(
    (m) => currentStreak >= m && previousStreak < m,
  );
}

/**
 * Get the next milestone the user is working toward.
 */
export function getNextMilestone(currentStreak: number): StreakMilestone | null {
  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak < milestone) return milestone;
  }
  return null;
}

/**
 * Get progress toward the next milestone as a percentage.
 */
export function getMilestoneProgress(currentStreak: number): {
  next: StreakMilestone | null;
  progress: number;
  remaining: number;
} {
  const next = getNextMilestone(currentStreak);
  if (!next) return { next: null, progress: 100, remaining: 0 };

  const previous = STREAK_MILESTONES[STREAK_MILESTONES.indexOf(next) - 1] ?? 0;
  const range = next - previous;
  const current = currentStreak - previous;
  const progress = range > 0 ? Math.min(100, Math.round((current / range) * 100)) : 0;

  return { next, progress, remaining: next - currentStreak };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get all dates between two dates (exclusive of both).
 */
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  const current = new Date(start);
  current.setDate(current.getDate() + 1);

  while (current < end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
