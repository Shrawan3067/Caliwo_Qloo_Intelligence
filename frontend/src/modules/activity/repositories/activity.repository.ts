/**
 * Activity Repository
 *
 * Offline-first persistence for activity data. Provides cache/retrieve
 * operations for today, weekly, monthly, and yearly activity records,
 * plus sync state management and offline queue.
 *
 * All reads return `null` on miss — consumers must handle graceful degradation.
 * All writes return `boolean` success — failures are silent per project convention.
 *
 * Uses the existing `storage` abstraction from `@/src/utils/storage`.
 *
 * @module activity/repositories/activity
 */

import { storage } from "@/src/utils/storage";
import { STORAGE_KEYS, SYNC_CONFIG } from "../constants";
import type {
  DailyActivity,
  WeeklyData,
  MonthlyData,
  YearlyData,
  SyncState,
  OfflineSyncEntry,
} from "../types";
import { DEFAULT_SYNC_STATE } from "../types";

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** Safely parse stored JSON. Returns null on failure. */
function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw || raw === "null" || raw === "undefined") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD for today. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Check if cached data is still fresh based on TTL. */
function isFresh(timestampIso: string | null | undefined, ttlMs: number): boolean {
  if (!timestampIso) return false;
  const ts = new Date(timestampIso).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts < ttlMs;
}

// ─── Today Cache ─────────────────────────────────────────────────────────────

/**
 * Cache today's activity data.
 */
export async function cacheTodayData(data: DailyActivity): Promise<boolean> {
  const payload = JSON.stringify({ data, cachedAt: new Date().toISOString() });
  return storage.setItem(STORAGE_KEYS.TODAY_CACHE, payload);
}

/**
 * Retrieve cached today data.
 * Returns null if cache is empty, stale, or for a different date.
 */
export async function getCachedTodayData(): Promise<DailyActivity | null> {
  const raw = await storage.getItem(STORAGE_KEYS.TODAY_CACHE, "");
  const parsed = safeParse<{ data: DailyActivity; cachedAt: string }>(raw as string);
  if (!parsed?.data) return null;

  // Ensure it's for today
  if (parsed.data.date !== todayStr()) return null;

  // Check freshness
  if (!isFresh(parsed.cachedAt, SYNC_CONFIG.TODAY_CACHE_TTL_MS)) return null;

  return parsed.data;
}

/**
 * Get cached today data regardless of freshness (for offline mode).
 */
export async function getCachedTodayDataStale(): Promise<DailyActivity | null> {
  const raw = await storage.getItem(STORAGE_KEYS.TODAY_CACHE, "");
  const parsed = safeParse<{ data: DailyActivity; cachedAt: string }>(raw as string);
  if (!parsed?.data) return null;
  if (parsed.data.date !== todayStr()) return null;
  return parsed.data;
}

// ─── Weekly Cache ────────────────────────────────────────────────────────────

export async function cacheWeeklyData(data: WeeklyData): Promise<boolean> {
  const payload = JSON.stringify({ data, cachedAt: new Date().toISOString() });
  return storage.setItem(STORAGE_KEYS.WEEKLY_CACHE, payload);
}

export async function getCachedWeeklyData(): Promise<WeeklyData | null> {
  const raw = await storage.getItem(STORAGE_KEYS.WEEKLY_CACHE, "");
  const parsed = safeParse<{ data: WeeklyData; cachedAt: string }>(raw as string);
  if (!parsed?.data) return null;
  if (!isFresh(parsed.cachedAt, SYNC_CONFIG.WEEKLY_CACHE_TTL_MS)) return null;
  return parsed.data;
}

export async function getCachedWeeklyDataStale(): Promise<WeeklyData | null> {
  const raw = await storage.getItem(STORAGE_KEYS.WEEKLY_CACHE, "");
  const parsed = safeParse<{ data: WeeklyData; cachedAt: string }>(raw as string);
  return parsed?.data ?? null;
}

// ─── Monthly Cache ───────────────────────────────────────────────────────────

export async function cacheMonthlyData(data: MonthlyData): Promise<boolean> {
  const payload = JSON.stringify({ data, cachedAt: new Date().toISOString() });
  return storage.setItem(STORAGE_KEYS.MONTHLY_CACHE, payload);
}

export async function getCachedMonthlyData(): Promise<MonthlyData | null> {
  const raw = await storage.getItem(STORAGE_KEYS.MONTHLY_CACHE, "");
  const parsed = safeParse<{ data: MonthlyData; cachedAt: string }>(raw as string);
  if (!parsed?.data) return null;
  if (!isFresh(parsed.cachedAt, SYNC_CONFIG.MONTHLY_CACHE_TTL_MS)) return null;
  return parsed.data;
}

export async function getCachedMonthlyDataStale(): Promise<MonthlyData | null> {
  const raw = await storage.getItem(STORAGE_KEYS.MONTHLY_CACHE, "");
  const parsed = safeParse<{ data: MonthlyData; cachedAt: string }>(raw as string);
  return parsed?.data ?? null;
}

// ─── Yearly Cache ────────────────────────────────────────────────────────────

export async function cacheYearlyData(data: YearlyData): Promise<boolean> {
  const payload = JSON.stringify({ data, cachedAt: new Date().toISOString() });
  return storage.setItem(STORAGE_KEYS.YEARLY_CACHE, payload);
}

export async function getCachedYearlyData(): Promise<YearlyData | null> {
  const raw = await storage.getItem(STORAGE_KEYS.YEARLY_CACHE, "");
  const parsed = safeParse<{ data: YearlyData; cachedAt: string }>(raw as string);
  return parsed?.data ?? null;
}

// ─── Per-Day Cache ───────────────────────────────────────────────────────────

/**
 * Cache a single day's activity by date key.
 */
export async function cacheDailyActivity(date: string, data: DailyActivity): Promise<boolean> {
  const key = `${STORAGE_KEYS.TODAY_CACHE}.${date}`;
  return storage.setItem(key, JSON.stringify(data));
}

/**
 * Retrieve a single day's cached activity.
 */
export async function getCachedDailyActivity(date: string): Promise<DailyActivity | null> {
  const key = `${STORAGE_KEYS.TODAY_CACHE}.${date}`;
  const raw = await storage.getItem(key, "");
  return safeParse<DailyActivity>(raw as string);
}

// ─── Sync State ──────────────────────────────────────────────────────────────

/**
 * Persist sync state metadata.
 */
export async function setSyncState(state: SyncState): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(state));
}

/**
 * Retrieve persisted sync state.
 */
export async function getSyncState(): Promise<SyncState> {
  const raw = await storage.getItem(STORAGE_KEYS.SYNC_STATE, "");
  return safeParse<SyncState>(raw as string) ?? { ...DEFAULT_SYNC_STATE };
}

/**
 * Get last successful sync timestamp.
 */
export async function getLastSyncTimestamp(): Promise<string | null> {
  const raw = await storage.getItem(STORAGE_KEYS.LAST_SYNC_TS, "");
  return (raw as string) || null;
}

/**
 * Set last successful sync timestamp.
 */
export async function setLastSyncTimestamp(iso: string): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.LAST_SYNC_TS, iso);
}

/**
 * Get the sync anchor / change token for incremental sync.
 */
export async function getSyncAnchor(): Promise<string | null> {
  const raw = await storage.getItem(STORAGE_KEYS.SYNC_ANCHOR, "");
  return (raw as string) || null;
}

/**
 * Set the sync anchor / change token.
 */
export async function setSyncAnchor(anchor: string): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.SYNC_ANCHOR, anchor);
}

// ─── Offline Queue ───────────────────────────────────────────────────────────

/**
 * Retrieve the full offline sync queue.
 */
export async function getOfflineQueue(): Promise<OfflineSyncEntry[]> {
  const raw = await storage.getItem(STORAGE_KEYS.OFFLINE_QUEUE, "");
  return safeParse<OfflineSyncEntry[]>(raw as string) ?? [];
}

/**
 * Add an entry to the offline sync queue.
 * Deduplicates by date — if the date already exists, the entry is replaced
 * with the higher step count (idempotent max-merge).
 */
export async function enqueueOfflineSync(entry: OfflineSyncEntry): Promise<boolean> {
  const queue = await getOfflineQueue();

  const existingIdx = queue.findIndex((e) => e.date === entry.date);
  if (existingIdx >= 0) {
    const existing = queue[existingIdx];
    // Keep the higher step count
    if (entry.steps > existing.steps) {
      queue[existingIdx] = entry;
    }
  } else {
    queue.push(entry);
  }

  // Enforce max queue size — drop oldest entries
  while (queue.length > SYNC_CONFIG.MAX_OFFLINE_QUEUE_SIZE) {
    queue.shift();
  }

  return storage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

/**
 * Remove processed entries from the offline queue.
 */
export async function dequeueOfflineSync(ids: string[]): Promise<boolean> {
  const queue = await getOfflineQueue();
  const idSet = new Set(ids);
  const filtered = queue.filter((e) => !idSet.has(e.id));
  return storage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
}

/**
 * Clear the entire offline queue.
 */
export async function clearOfflineQueue(): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify([]));
}

/**
 * Get the number of entries in the offline queue.
 */
export async function getOfflineQueueSize(): Promise<number> {
  const queue = await getOfflineQueue();
  return queue.length;
}

// ─── Permission Cache ────────────────────────────────────────────────────────

/**
 * Cache permission status for fast UI reads.
 */
export async function setPermissionStatus(status: string): Promise<boolean> {
  return storage.setItem(STORAGE_KEYS.PERMISSION_STATUS, status);
}

/**
 * Get cached permission status.
 */
export async function getPermissionStatus(): Promise<string | null> {
  const raw = await storage.getItem(STORAGE_KEYS.PERMISSION_STATUS, "");
  return (raw as string) || null;
}

// ─── Cache Management ────────────────────────────────────────────────────────

/**
 * Clear all activity caches. Used on logout or data reset.
 */
export async function clearAll(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS);
  await Promise.all(keys.map((key) => storage.removeItem(key)));
}

/**
 * Validate cache integrity. Returns true if basic structure is intact.
 */
export async function validateCacheIntegrity(): Promise<boolean> {
  try {
    const [today, weekly, syncState] = await Promise.all([
      getCachedTodayDataStale(),
      getCachedWeeklyDataStale(),
      getSyncState(),
    ]);

    // Check today data structure if present
    if (today && (typeof today.steps !== "number" || typeof today.date !== "string")) {
      return false;
    }

    // Check weekly data structure if present
    if (weekly && (!Array.isArray(weekly.entries) || typeof weekly.goal !== "number")) {
      return false;
    }

    // Sync state should always parse
    if (!syncState || typeof syncState.status !== "string") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Repair corrupted cache by clearing invalid entries.
 */
export async function repairCache(): Promise<void> {
  const isValid = await validateCacheIntegrity();
  if (!isValid) {
    await clearAll();
  }
}
