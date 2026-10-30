/**
 * Streaks Repository
 *
 * Persistence for streak data, freeze days, and streak history.
 * Backs the streak engine with local storage.
 *
 * @module activity/repositories/streaks
 */

import { storage } from "@/src/utils/storage";
import { STORAGE_KEYS, STREAK_MAX_FREEZE_DAYS } from "../constants";
import type { StreakData } from "../types";
import { DEFAULT_STREAK_DATA } from "../types";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw || raw === "null" || raw === "undefined") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Streak Data ─────────────────────────────────────────────────────────────

/**
 * Retrieve persisted streak data.
 * Returns DEFAULT_STREAK_DATA if nothing is stored.
 */
export async function getStreakData(): Promise<StreakData> {
  const raw = await storage.getItem(STORAGE_KEYS.STREAK_DATA, "");
  return safeParse<StreakData>(raw as string) ?? { ...DEFAULT_STREAK_DATA };
}

/**
 * Persist streak data.
 */
export async function setStreakData(data: StreakData): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(data));
}

/**
 * Update streak data with a partial update (merge with existing).
 */
export async function updateStreakData(
  update: Partial<StreakData>,
): Promise<StreakData> {
  const current = await getStreakData();
  const merged: StreakData = {
    ...current,
    ...update,
    lastEvaluated: new Date().toISOString(),
  };
  await setStreakData(merged);
  return merged;
}

// ─── Freeze Days ─────────────────────────────────────────────────────────────

/**
 * Get available freeze days count.
 */
export async function getFreezeDaysAvailable(): Promise<number> {
  const data = await getStreakData();
  return data.freezeDaysAvailable;
}

/**
 * Use a freeze day for a specific date.
 * Returns false if no freeze days are available or the date already has a freeze.
 */
export async function consumeFreeze(date: string): Promise<boolean> {
  const data = await getStreakData();

  if (data.freezeDaysAvailable <= 0) return false;

  // Check if this date already has a freeze
  if (data.freezeDaysUsed.includes(date)) return true; // Already frozen

  await updateStreakData({
    freezeDaysAvailable: data.freezeDaysAvailable - 1,
    freezeDaysUsed: [...data.freezeDaysUsed, date],
  });

  return true;
}

/**
 * Add freeze days (e.g., monthly renewal).
 * Caps at STREAK_MAX_FREEZE_DAYS.
 */
export async function addFreezeDays(count: number): Promise<number> {
  const data = await getStreakData();
  const newCount = Math.min(data.freezeDaysAvailable + count, STREAK_MAX_FREEZE_DAYS);
  await updateStreakData({ freezeDaysAvailable: newCount });
  return newCount;
}

/**
 * Check if a specific date has a freeze applied.
 */
export async function isDateFrozen(date: string): Promise<boolean> {
  const data = await getStreakData();
  return data.freezeDaysUsed.includes(date);
}

// ─── Streak History ──────────────────────────────────────────────────────────

/**
 * Get streak calendar — all dates that are part of the current or past streaks.
 * This is derived from the goal history, not stored separately.
 * Returns the start date and length of the current streak.
 */
export async function getStreakCalendar(): Promise<{
  activeDates: string[];
  frozenDates: string[];
  missedDates: string[];
}> {
  const data = await getStreakData();
  const frozenDates = [...data.freezeDaysUsed];
  const missedDates = [...data.missedDays];

  // Build active dates from the streak start date
  const activeDates: string[] = [];
  if (data.streakStartDate && data.currentStreak > 0) {
    const start = new Date(data.streakStartDate);
    for (let i = 0; i < data.currentStreak; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      activeDates.push(dateStr);
    }
  }

  return { activeDates, frozenDates, missedDates };
}

// ─── Reset ───────────────────────────────────────────────────────────────────

/**
 * Reset streak to zero (called when streak is broken).
 */
export async function resetStreak(): Promise<StreakData> {
  const current = await getStreakData();
  return updateStreakData({
    currentStreak: 0,
    streakStartDate: "",
    // Preserve longest streak
    longestStreak: current.longestStreak,
    longestStreakStartDate: current.longestStreakStartDate,
  });
}

/**
 * Clear all streak data. Used on account reset.
 */
export async function clearAll(): Promise<boolean> {
  return storage.removeItem(STORAGE_KEYS.STREAK_DATA);
}
