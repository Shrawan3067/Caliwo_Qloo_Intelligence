/**
 * Sync Engine
 *
 * Orchestrates all synchronization operations between device health data,
 * local cache, and the backend API. Supports all sync modes:
 * initial, incremental, background, foreground, recovery, resume,
 * manual, and silent.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Retry limits
 * - Conflict resolution (max-merge)
 * - Duplicate detection
 * - Cancellation support
 * - Offline queue processing
 * - Idempotent operations
 *
 * @module activity/engines/sync
 */

import { Platform } from "react-native";
import api from "@/src/lib/api";
import type {
  SyncMode,
  SyncResult,
  SyncState,
  DailyActivity,
  OfflineSyncEntry,
  StepSyncEntry,
} from "../types";
import { SYNC_CONFIG } from "../constants";
import { PlatformService } from "../services";
import { ActivityRepo } from "../repositories";
import * as ValidationEngine from "./validation.engine";
import {
  SyncCancelledError,
  toActivityError,
  computeBackoffDelay,
} from "../errors";

// ─── Cancellation ────────────────────────────────────────────────────────────

let cancelFlag = false;

/**
 * Request cancellation of the currently running sync.
 */
export function cancelSync(): void {
  cancelFlag = true;
}

function checkCancelled(): void {
  if (cancelFlag) {
    cancelFlag = false;
    throw new SyncCancelledError();
  }
}

// ─── Throttle ────────────────────────────────────────────────────────────────

let lastSyncTime = 0;

/**
 * Check if enough time has passed since the last sync.
 */
export function canSyncNow(): boolean {
  return Date.now() - lastSyncTime >= SYNC_CONFIG.FOREGROUND_THROTTLE_MS;
}

// ─── Main Sync Entry Points ─────────────────────────────────────────────────

/**
 * Full initial sync — reads up to 30 days of history and posts to backend.
 */
export async function syncInitial(goal: number): Promise<SyncResult> {
  return executeSyncWithRetry("initial", goal, SYNC_CONFIG.INITIAL_SYNC_DAYS);
}

/**
 * Incremental sync — reads only days since last sync.
 */
export async function syncIncremental(goal: number): Promise<SyncResult> {
  return executeSyncWithRetry("incremental", goal, SYNC_CONFIG.INCREMENTAL_SYNC_DAYS);
}

/**
 * Foreground sync — throttled, triggered by user action or screen focus.
 */
export async function syncForeground(goal: number): Promise<SyncResult> {
  if (!canSyncNow()) {
    return {
      ok: true,
      mode: "foreground",
      permission: "granted",
      daysSynced: 0,
      newAnchor: null,
      errorMessage: null,
      durationMs: 0,
    };
  }
  return executeSyncWithRetry("foreground", goal, SYNC_CONFIG.INCREMENTAL_SYNC_DAYS);
}

/**
 * Background sync — called by background task scheduler.
 */
export async function syncBackground(goal: number): Promise<SyncResult> {
  return executeSyncWithRetry("background", goal, SYNC_CONFIG.INCREMENTAL_SYNC_DAYS);
}

/**
 * Recovery sync — after reinstall or data loss, reads 60 days.
 */
export async function syncRecovery(goal: number): Promise<SyncResult> {
  return executeSyncWithRetry("recovery", goal, SYNC_CONFIG.RECOVERY_SYNC_DAYS);
}

/**
 * Resume sync — processes offline queue when connectivity returns.
 */
export async function syncResume(goal: number): Promise<SyncResult> {
  return executeSyncWithRetry("resume", goal, SYNC_CONFIG.INCREMENTAL_SYNC_DAYS);
}

/**
 * Manual sync — user-triggered, always runs.
 */
export async function syncManual(goal: number): Promise<SyncResult> {
  lastSyncTime = 0; // Reset throttle
  return executeSyncWithRetry("manual", goal, SYNC_CONFIG.INCREMENTAL_SYNC_DAYS);
}

/**
 * Silent sync — no UI feedback, used for today-only refresh.
 */
export async function syncSilent(goal: number): Promise<SyncResult> {
  return executeSyncWithRetry("silent", goal, 1);
}

/**
 * Sync today only — lightweight, no retry.
 */
export async function syncToday(goal: number): Promise<SyncResult> {
  const start = Date.now();
  cancelFlag = false;

  try {
    const permission = await PlatformService.checkPermissionStatus();
    if (permission !== "granted") {
      return { ok: false, mode: "silent", permission, daysSynced: 0, newAnchor: null, errorMessage: "Permission not granted", durationMs: Date.now() - start };
    }

    const today = await PlatformService.readDailyActivity(new Date(), goal);
    const validated = ValidationEngine.validateDailyActivity(today);
    const cleanData = validated.cleanedData ?? today;

    await ActivityRepo.cacheTodayData(cleanData);

    // Post to backend (fire and forget on failure)
    try {
      await postToBackend([cleanData]);
    } catch {
      // Queue for later
      await queueForOfflineSync(cleanData);
    }

    lastSyncTime = Date.now();

    return {
      ok: true,
      mode: "silent",
      permission: "granted",
      daysSynced: 1,
      newAnchor: null,
      errorMessage: null,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const err = toActivityError(e);
    return {
      ok: false,
      mode: "silent",
      permission: "granted",
      daysSynced: 0,
      newAnchor: null,
      errorMessage: err.userMessage,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Core Sync Logic ─────────────────────────────────────────────────────────

async function executeSyncWithRetry(
  mode: SyncMode,
  goal: number,
  days: number,
): Promise<SyncResult> {
  let attempt = 0;
  let lastError: string | null = null;
  const start = Date.now();

  while (attempt <= SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
    try {
      checkCancelled();
      const result = await executeSync(mode, goal, days, attempt);
      lastSyncTime = Date.now();
      return result;
    } catch (e) {
      const err = toActivityError(e);
      lastError = err.userMessage;

      if (!err.retryable || attempt >= SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
        return {
          ok: false,
          mode,
          permission: "granted",
          daysSynced: 0,
          newAnchor: null,
          errorMessage: lastError,
          durationMs: Date.now() - start,
        };
      }

      // Wait with exponential backoff
      const delay = computeBackoffDelay(
        attempt,
        SYNC_CONFIG.RETRY_BASE_DELAY_MS,
        SYNC_CONFIG.RETRY_MULTIPLIER,
        SYNC_CONFIG.RETRY_MAX_DELAY_MS,
      );
      await sleep(delay);
      attempt++;
    }
  }

  return {
    ok: false,
    mode,
    permission: "granted",
    daysSynced: 0,
    newAnchor: null,
    errorMessage: lastError,
    durationMs: Date.now() - start,
  };
}

async function executeSync(
  mode: SyncMode,
  goal: number,
  days: number,
  attempt: number,
): Promise<SyncResult> {
  const start = Date.now();
  cancelFlag = false;

  // Check permission
  const permission = await PlatformService.checkPermissionStatus();
  if (permission !== "granted" && permission !== "simulator") {
    return {
      ok: false,
      mode,
      permission,
      daysSynced: 0,
      newAnchor: null,
      errorMessage: "Health data permission not granted",
      durationMs: Date.now() - start,
    };
  }

  checkCancelled();

  // Determine date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // For incremental mode, check if we can use change tokens
  let newAnchor: string | null = null;
  if (mode === "incremental" && Platform.OS === "android") {
    const currentAnchor = await ActivityRepo.getSyncAnchor();
    const changes = await PlatformService.getChanges(currentAnchor);
    if (changes.nextToken) {
      newAnchor = changes.nextToken;
      // If no changes detected and we have a token, skip the heavy read
      if (!changes.hasChanges && currentAnchor) {
        return {
          ok: true,
          mode,
          permission: "granted",
          daysSynced: 0,
          newAnchor,
          errorMessage: null,
          durationMs: Date.now() - start,
        };
      }
    }
  }

  checkCancelled();

  // Read data from device
  const entries = await PlatformService.readHistoricalActivity(startDate, endDate, goal);
  if (entries.length === 0) {
    return {
      ok: true,
      mode,
      permission: "granted",
      daysSynced: 0,
      newAnchor,
      errorMessage: null,
      durationMs: Date.now() - start,
    };
  }

  checkCancelled();

  // Validate and clean
  const { valid: validEntries } = ValidationEngine.validateBatch(entries);
  if (validEntries.length === 0) {
    return {
      ok: true,
      mode,
      permission: "granted",
      daysSynced: 0,
      newAnchor,
      errorMessage: null,
      durationMs: Date.now() - start,
    };
  }

  // Cache today's data locally
  const todayStr = ValidationEngine.todayLocal();
  const todayEntry = validEntries.find((e) => e.date === todayStr);
  if (todayEntry) {
    await ActivityRepo.cacheTodayData(todayEntry);
  }

  checkCancelled();

  // Post to backend
  try {
    await postToBackend(validEntries);
  } catch {
    // Queue entries for offline sync
    for (const entry of validEntries) {
      await queueForOfflineSync(entry);
    }
  }

  // Process offline queue
  if (mode === "resume" || mode === "manual" || mode === "foreground") {
    await processOfflineQueue();
  }

  // Save anchor
  if (newAnchor) {
    await ActivityRepo.setSyncAnchor(newAnchor);
  }

  // Update last sync timestamp
  const now = new Date().toISOString();
  await ActivityRepo.setLastSyncTimestamp(now);

  return {
    ok: true,
    mode,
    permission: "granted",
    daysSynced: validEntries.length,
    newAnchor,
    errorMessage: null,
    durationMs: Date.now() - start,
  };
}

// ─── Backend API ─────────────────────────────────────────────────────────────

/**
 * Post sync entries to the backend API.
 */
async function postToBackend(entries: readonly DailyActivity[]): Promise<void> {
  if (entries.length === 0) return;

  const syncEntries: StepSyncEntry[] = entries.map((e) => ({
    date: e.date,
    steps: e.steps,
    distance_m: e.distanceTotalMeters || null,
    calories: e.caloriesActive || null,
  }));

  const tzOffset = new Date().getTimezoneOffset();

  await api.post("/steps/sync", {
    platform: PlatformService.getSourceString(),
    source: PlatformService.getSourceString(),
    entries: syncEntries,
    tz_offset: tzOffset,
  });
}

// ─── Offline Queue ───────────────────────────────────────────────────────────

/**
 * Queue a daily entry for sync when connectivity returns.
 */
async function queueForOfflineSync(entry: DailyActivity): Promise<void> {
  const offlineEntry: OfflineSyncEntry = {
    id: `${entry.date}-${Date.now()}`,
    date: entry.date,
    steps: entry.steps,
    distanceMeters: entry.distanceTotalMeters,
    activeCalories: entry.caloriesActive,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  await ActivityRepo.enqueueOfflineSync(offlineEntry);
}

/**
 * Process the offline sync queue.
 */
export async function processOfflineQueue(): Promise<number> {
  const queue = await ActivityRepo.getOfflineQueue();
  if (queue.length === 0) return 0;

  const tzOffset = new Date().getTimezoneOffset();
  const entries: StepSyncEntry[] = queue.map((e) => ({
    date: e.date,
    steps: e.steps,
    distance_m: e.distanceMeters || null,
    calories: e.activeCalories || null,
  }));

  try {
    await api.post("/steps/sync", {
      platform: PlatformService.getSourceString(),
      source: PlatformService.getSourceString(),
      entries,
      tz_offset: tzOffset,
    });

    const processedIds = queue.map((e) => e.id);
    await ActivityRepo.dequeueOfflineSync(processedIds);
    return processedIds.length;
  } catch {
    // Queue remains for next attempt
    return 0;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine the appropriate sync mode based on context.
 */
export function determineSyncMode(
  hasLastSync: boolean,
  isFirstLaunch: boolean,
  isResuming: boolean,
): SyncMode {
  if (isFirstLaunch || !hasLastSync) return "initial";
  if (isResuming) return "resume";
  return "incremental";
}

/**
 * Get a human-readable sync status message.
 */
export function getSyncStatusMessage(state: SyncState): string {
  switch (state.status) {
    case "idle":
      if (state.lastSuccessfulSync) {
        return formatTimeSince(state.lastSuccessfulSync);
      }
      return "Never synced";
    case "syncing":
      return "Syncing...";
    case "success":
      return "Just now";
    case "error":
      return state.errorMessage ?? "Sync failed";
    case "cancelled":
      return "Sync cancelled";
  }
}

/**
 * Format "time since" for display.
 */
function formatTimeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
