/**
 * Achievements Repository
 *
 * Persistence for achievement unlock state, XP, levels, and
 * personal records. Backs the achievement engine.
 *
 * @module activity/repositories/achievements
 */

import { storage } from "@/src/utils/storage";
import { STORAGE_KEYS, ACHIEVEMENT_DEFINITIONS, XP_LEVELS, LEVEL_TITLES } from "../constants";
import type { Achievement, LevelInfo, PersonalRecord } from "../types";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw || raw === "null" || raw === "undefined") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Achievement State ───────────────────────────────────────────────────────

/**
 * Retrieve all achievement states.
 * Initializes from definitions if no state is stored.
 */
export async function getAchievements(): Promise<Achievement[]> {
  const raw = await storage.getItem(STORAGE_KEYS.ACHIEVEMENTS, "");
  const stored = safeParse<Achievement[]>(raw as string);

  if (stored && stored.length > 0) {
    // Ensure new achievements from definitions are included
    return mergeWithDefinitions(stored);
  }

  // Initialize from definitions
  return ACHIEVEMENT_DEFINITIONS.map((def) => ({
    id: def.id,
    unlocked: false,
    progress: 0,
    unlockedAt: null,
    acknowledged: false,
  }));
}

/**
 * Persist achievement states.
 */
export async function setAchievements(achievements: readonly Achievement[]): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
}

/**
 * Unlock a specific achievement.
 * Returns the updated achievement, or null if not found.
 */
export async function unlockAchievement(id: string): Promise<Achievement | null> {
  const achievements = await getAchievements();
  const idx = achievements.findIndex((a) => a.id === id);
  if (idx < 0) return null;

  if (achievements[idx].unlocked) return achievements[idx]; // Already unlocked

  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id);
  const updated: Achievement = {
    ...achievements[idx],
    unlocked: true,
    progress: def?.threshold ?? achievements[idx].progress,
    unlockedAt: new Date().toISOString(),
    acknowledged: false,
  };

  achievements[idx] = updated;
  await setAchievements(achievements);

  // Award XP
  if (def) {
    await addXP(def.xpReward);
  }

  return updated;
}

/**
 * Update progress for a specific achievement.
 */
export async function updateAchievementProgress(
  id: string,
  progress: number,
): Promise<boolean> {
  const achievements = await getAchievements();
  const idx = achievements.findIndex((a) => a.id === id);
  if (idx < 0) return false;

  if (achievements[idx].unlocked) return true; // Already unlocked, no update needed

  achievements[idx] = {
    ...achievements[idx],
    progress: Math.max(achievements[idx].progress, progress),
  };

  return setAchievements(achievements);
}

/**
 * Mark an achievement as acknowledged (user has seen the unlock notification).
 */
export async function acknowledgeAchievement(id: string): Promise<boolean> {
  const achievements = await getAchievements();
  const idx = achievements.findIndex((a) => a.id === id);
  if (idx < 0) return false;

  achievements[idx] = { ...achievements[idx], acknowledged: true };
  return setAchievements(achievements);
}

/**
 * Get all unlocked achievements.
 */
export async function getUnlockedAchievements(): Promise<Achievement[]> {
  const achievements = await getAchievements();
  return achievements.filter((a) => a.unlocked);
}

/**
 * Get achievements that are unlocked but not yet acknowledged.
 */
export async function getUnacknowledgedAchievements(): Promise<Achievement[]> {
  const achievements = await getAchievements();
  return achievements.filter((a) => a.unlocked && !a.acknowledged);
}

/**
 * Get achievements filtered by category.
 */
export async function getAchievementsByCategory(
  category: string,
): Promise<Achievement[]> {
  const achievements = await getAchievements();
  const categoryIds = new Set(
    ACHIEVEMENT_DEFINITIONS.filter((d) => d.category === category).map((d) => d.id),
  );
  return achievements.filter((a) => categoryIds.has(a.id));
}

// ─── XP & Levels ─────────────────────────────────────────────────────────────

/**
 * Get total accumulated XP.
 */
export async function getXP(): Promise<number> {
  const raw = await storage.getItem(STORAGE_KEYS.XP_TOTAL, "");
  const val = Number(raw);
  return isNaN(val) ? 0 : val;
}

/**
 * Add XP and persist.
 */
export async function addXP(amount: number): Promise<number> {
  const current = await getXP();
  const newTotal = current + Math.max(0, amount);
  await storage.setItem(STORAGE_KEYS.XP_TOTAL, JSON.stringify(newTotal));
  return newTotal;
}

/**
 * Compute the user's level from their total XP.
 */
export function computeLevel(totalXP: number): number {
  let level = 1;
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= XP_LEVELS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, XP_LEVELS.length);
}

/**
 * Compute full level info from total XP.
 */
export function computeLevelInfo(totalXP: number): LevelInfo {
  const level = computeLevel(totalXP);
  const currentThreshold = XP_LEVELS[level - 1] ?? 0;
  const nextThreshold = XP_LEVELS[level] ?? XP_LEVELS[XP_LEVELS.length - 1] + 5_000;
  const xpInCurrentLevel = totalXP - currentThreshold;
  const xpForNextLevel = nextThreshold - currentThreshold;
  const progressToNextLevel =
    xpForNextLevel > 0 ? Math.min(1, xpInCurrentLevel / xpForNextLevel) : 1;
  const title = LEVEL_TITLES[level - 1] ?? "Apex";

  return {
    level,
    totalXP,
    xpForNextLevel,
    xpInCurrentLevel,
    progressToNextLevel,
    title,
  };
}

/**
 * Get the full level info for the current user.
 */
export async function getLevelInfo(): Promise<LevelInfo> {
  const xp = await getXP();
  return computeLevelInfo(xp);
}

// ─── Personal Records ────────────────────────────────────────────────────────

/**
 * Get all personal records.
 */
export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  const raw = await storage.getItem(STORAGE_KEYS.PERSONAL_RECORDS, "");
  return safeParse<PersonalRecord[]>(raw as string) ?? [];
}

/**
 * Check and update a personal record if the new value exceeds the existing one.
 * Returns the record if it's a new PR, null otherwise.
 */
export async function checkAndUpdatePersonalRecord(
  metric: PersonalRecord["metric"],
  value: number,
  date: string,
): Promise<PersonalRecord | null> {
  const records = await getPersonalRecords();
  const existing = records.find((r) => r.metric === metric);

  if (existing && value <= existing.value) return null; // Not a new record

  const newRecord: PersonalRecord = {
    metric,
    value,
    date,
    previousBest: existing?.value ?? 0,
    isNew: true,
  };

  // Update or add
  const updatedRecords = existing
    ? records.map((r) => (r.metric === metric ? newRecord : r))
    : [...records, newRecord];

  await storage.setItem(STORAGE_KEYS.PERSONAL_RECORDS, JSON.stringify(updatedRecords));
  return newRecord;
}

/**
 * Get a personal record for a specific metric.
 */
export async function getPersonalRecord(
  metric: PersonalRecord["metric"],
): Promise<PersonalRecord | null> {
  const records = await getPersonalRecords();
  return records.find((r) => r.metric === metric) ?? null;
}

// ─── Internal ────────────────────────────────────────────────────────────────

/**
 * Merge stored achievements with current definitions.
 * Adds any new achievements from definitions that aren't in storage.
 */
function mergeWithDefinitions(stored: Achievement[]): Achievement[] {
  const storedIds = new Set(stored.map((a) => a.id));
  const newFromDefs: Achievement[] = ACHIEVEMENT_DEFINITIONS
    .filter((d) => !storedIds.has(d.id))
    .map((def) => ({
      id: def.id,
      unlocked: false,
      progress: 0,
      unlockedAt: null,
      acknowledged: false,
    }));

  return [...stored, ...newFromDefs];
}

/**
 * Clear all achievement data. Used on account reset.
 */
export async function clearAll(): Promise<void> {
  await Promise.all([
    storage.removeItem(STORAGE_KEYS.ACHIEVEMENTS),
    storage.removeItem(STORAGE_KEYS.XP_TOTAL),
    storage.removeItem(STORAGE_KEYS.PERSONAL_RECORDS),
  ]);
}
