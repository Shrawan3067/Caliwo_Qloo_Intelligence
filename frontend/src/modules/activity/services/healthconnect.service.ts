/**
 * Google Health Connect Service
 *
 * Production-grade, read-only Health Connect integration for Android.
 * Wraps react-native-health-connect v3.5.3 behind a clean async interface.
 *
 * - Safe to call on any platform — returns empty defaults when unavailable.
 * - Uses aggregateRecord for efficient data reads.
 * - getChanges() for incremental/anchor-based sync.
 * - Multi-device source detection (Samsung Watch, Pixel Watch, phone).
 * - All errors wrapped in typed ActivityError subclasses.
 *
 * @module activity/services/healthconnect
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform, Linking } from "react-native";
import type {
  DailyActivity,
  ExerciseSession,
  HourlyActivity,
  ActivitySource,
  PermissionStatus,
  ActivityMetricId,
} from "../types";
import { createEmptyDailyActivity, SOURCE_QUALITY } from "../types";
import { AVG_STRIDE_M, KCAL_PER_STEP, HEALTH_CONNECT_PLAY_STORE_URI } from "../constants";
import {
  HealthConnectMissingError,
  HealthUnavailableError,
  PermissionDeniedError,
  toActivityError,
} from "../errors";

// ─── Lazy Module Loading ─────────────────────────────────────────────────────

let HC: any = null;

if (Platform.OS === "android") {
  try {
    HC = require("react-native-health-connect");
  } catch {
    // Native module not linked.
  }
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** YYYY-MM-DD from a Date. */
function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Midnight of the given date. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** End of the given date. */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Build a Health Connect time range filter. */
function timeRange(start: Date, end: Date) {
  return {
    operator: "between" as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

/** Infer an ActivitySource from a Health Connect data origin package name. */
function inferSource(packageName?: string): ActivitySource {
  if (!packageName) return "healthconnect";
  const lower = packageName.toLowerCase();
  if (lower.includes("samsung") || lower.includes("shealth")) return "samsung_watch";
  if (lower.includes("google.android.apps.fitness") || lower.includes("pixel")) return "pixel_watch";
  if (lower.includes("fitbit")) return "healthconnect";
  return "healthconnect";
}

/** Pick the highest quality source. */
function bestSource(sources: ActivitySource[]): ActivitySource {
  if (sources.length === 0) return "healthconnect";
  return sources.reduce((best, s) =>
    SOURCE_QUALITY[s] > SOURCE_QUALITY[best] ? s : best,
  );
}

// ─── SDK Status Constants ────────────────────────────────────────────────────

const SDK_AVAILABLE = 3;

// ─── Required Permissions ────────────────────────────────────────────────────

function getReadPermissions(): { accessType: "read"; recordType: string }[] {
  return [
    { accessType: "read", recordType: "Steps" },
    { accessType: "read", recordType: "Distance" },
    { accessType: "read", recordType: "ActiveCaloriesBurned" },
    { accessType: "read", recordType: "TotalCaloriesBurned" },
    { accessType: "read", recordType: "FloorsClimbed" },
    { accessType: "read", recordType: "ExerciseSession" },
  ];
}

// ─── Public API: Availability ────────────────────────────────────────────────

/**
 * Check whether Health Connect SDK is available on this device.
 */
export function isAvailable(): boolean {
  return Platform.OS === "android" && HC != null;
}

/**
 * Check if the Health Connect app is installed and the SDK is usable.
 */
export async function isInstalled(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const status = await HC.getSdkStatus();
    return status === SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * Open the Google Play Store page for Health Connect.
 */
export async function openPlayStore(): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(HEALTH_CONNECT_PLAY_STORE_URI);
    if (canOpen) {
      await Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URI);
    }
  } catch {
    // Silently fail — user can install manually.
  }
}

/**
 * Open Health Connect settings screen.
 */
export function openSettings(): void {
  if (!isAvailable()) return;
  try {
    HC.openHealthConnectSettings();
  } catch {
    // Silently fail.
  }
}

/**
 * Initialize the Health Connect SDK.
 * Must be called before any data reads.
 */
export async function initialize(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    return await HC.initialize();
  } catch {
    return false;
  }
}

// ─── Public API: Permissions ─────────────────────────────────────────────────

/**
 * Request read-only Health Connect permissions.
 */
export async function requestPermissions(): Promise<PermissionStatus> {
  if (!isAvailable()) return "unavailable";

  try {
    const initialized = await initialize();
    if (!initialized) return "health_app_missing";

    const sdkStatus = await HC.getSdkStatus();
    if (sdkStatus !== SDK_AVAILABLE) return "health_app_missing";

    const granted = await HC.requestPermission(getReadPermissions());

    // Check if any permissions were granted
    if (Array.isArray(granted) && granted.length > 0) {
      return "granted";
    }
    return "denied";
  } catch {
    return "denied";
  }
}

/**
 * Check currently granted permissions.
 */
export async function checkPermissionStatus(): Promise<PermissionStatus> {
  if (!isAvailable()) return "unavailable";

  try {
    const initialized = await initialize();
    if (!initialized) return "health_app_missing";

    const granted = await HC.getGrantedPermissions();
    if (!Array.isArray(granted) || granted.length === 0) return "denied";

    // Check if at least Steps read is granted
    const hasSteps = granted.some(
      (p: any) => p.recordType === "Steps" && p.accessType === "read",
    );
    return hasSteps ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/**
 * Get the list of metric IDs that are currently granted.
 */
export async function getGrantedMetrics(): Promise<ActivityMetricId[]> {
  if (!isAvailable()) return [];

  try {
    const granted = await HC.getGrantedPermissions();
    if (!Array.isArray(granted)) return [];

    const metrics: ActivityMetricId[] = [];
    const recordMap: Record<string, ActivityMetricId> = {
      Steps: "steps",
      Distance: "distance_walking",
      ActiveCaloriesBurned: "calories_active",
      FloorsClimbed: "flights_climbed",
      ExerciseSession: "exercise_sessions",
    };

    for (const p of granted) {
      if (p.accessType === "read" && recordMap[p.recordType]) {
        metrics.push(recordMap[p.recordType]);
      }
    }
    return metrics;
  } catch {
    return [];
  }
}

// ─── Public API: Data Reads ──────────────────────────────────────────────────

/**
 * Read today's total step count using aggregation.
 */
export async function readTodaySteps(): Promise<number> {
  if (!isAvailable()) return 0;

  try {
    const result = await HC.aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
    });
    return Math.max(0, Math.round(result?.COUNT_TOTAL ?? result?.count ?? 0));
  } catch {
    // Fallback to readRecords
    try {
      const records = await HC.readRecords("Steps", {
        timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
      });
      const data = records?.records ?? records;
      if (!Array.isArray(data)) return 0;
      return data.reduce((sum: number, r: any) => sum + (r.count ?? 0), 0);
    } catch {
      return 0;
    }
  }
}

/**
 * Read today's total distance in meters using aggregation.
 */
export async function readTodayDistance(): Promise<number> {
  if (!isAvailable()) return 0;

  try {
    const result = await HC.aggregateRecord({
      recordType: "Distance",
      timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
    });
    return Math.max(0, result?.LENGTH_TOTAL ?? result?.distance?.inMeters ?? 0);
  } catch {
    try {
      const records = await HC.readRecords("Distance", {
        timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
      });
      const data = records?.records ?? records;
      if (!Array.isArray(data)) return 0;
      return data.reduce((sum: number, r: any) => sum + (r.distance?.inMeters ?? 0), 0);
    } catch {
      return 0;
    }
  }
}

/**
 * Read today's active calories burned.
 */
export async function readTodayActiveCalories(): Promise<number> {
  if (!isAvailable()) return 0;

  try {
    const result = await HC.aggregateRecord({
      recordType: "ActiveCaloriesBurned",
      timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
    });
    return Math.max(0, Math.round(result?.ENERGY_TOTAL ?? result?.energy?.inKilocalories ?? 0));
  } catch {
    try {
      const records = await HC.readRecords("ActiveCaloriesBurned", {
        timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
      });
      const data = records?.records ?? records;
      if (!Array.isArray(data)) return 0;
      return data.reduce((sum: number, r: any) => sum + (r.energy?.inKilocalories ?? 0), 0);
    } catch {
      return 0;
    }
  }
}

/**
 * Read today's floors climbed.
 */
export async function readTodayFloorsClimbed(): Promise<number> {
  if (!isAvailable()) return 0;

  try {
    const result = await HC.aggregateRecord({
      recordType: "FloorsClimbed",
      timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
    });
    return Math.max(0, Math.round(result?.COUNT_TOTAL ?? result?.floors ?? 0));
  } catch {
    try {
      const records = await HC.readRecords("FloorsClimbed", {
        timeRangeFilter: timeRange(startOfDay(new Date()), new Date()),
      });
      const data = records?.records ?? records;
      if (!Array.isArray(data)) return 0;
      return data.reduce((sum: number, r: any) => sum + (r.floors ?? 0), 0);
    } catch {
      return 0;
    }
  }
}

/**
 * Read exercise sessions for a date range.
 */
export async function readExerciseSessions(
  start: Date,
  end: Date,
): Promise<ExerciseSession[]> {
  if (!isAvailable()) return [];

  try {
    const result = await HC.readRecords("ExerciseSession", {
      timeRangeFilter: timeRange(start, end),
    });

    const data = result?.records ?? result;
    if (!Array.isArray(data)) return [];

    return data.map((session: any): ExerciseSession => {
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);
      const durationMinutes = Math.max(0, (endTime.getTime() - startTime.getTime()) / 60_000);

      return {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: Math.round(durationMinutes),
        exerciseType: String(session.exerciseType ?? "UNKNOWN"),
        caloriesBurned: 0, // HC doesn't attach calories to sessions directly
        distanceMeters: 0,
        source: inferSource(session.metadata?.dataOrigin?.packageName),
      };
    });
  } catch {
    return [];
  }
}

// ─── Daily Activity ──────────────────────────────────────────────────────────

/**
 * Read step records (non-aggregated) for hourly breakdown.
 */
async function readStepRecords(
  start: Date,
  end: Date,
): Promise<{ startTime: string; endTime: string; count: number; source?: string }[]> {
  if (!isAvailable()) return [];

  try {
    const result = await HC.readRecords("Steps", {
      timeRangeFilter: timeRange(start, end),
    });
    const data = result?.records ?? result;
    if (!Array.isArray(data)) return [];

    return data.map((r: any) => ({
      startTime: r.startTime,
      endTime: r.endTime,
      count: r.count ?? 0,
      source: r.metadata?.dataOrigin?.packageName,
    }));
  } catch {
    return [];
  }
}

/**
 * Build hourly breakdown from step records.
 */
function buildHourlyBreakdown(
  records: { startTime: string; endTime: string; count: number }[],
  date: Date,
): HourlyActivity[] {
  const hours: HourlyActivity[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    steps: 0,
    activeCalories: 0,
    distanceMeters: 0,
  }));

  const dateStr = ymd(date);
  for (const record of records) {
    const recordDate = new Date(record.startTime);
    if (ymd(recordDate) !== dateStr) continue;
    const hour = recordDate.getHours();
    if (hour >= 0 && hour < 24) {
      hours[hour] = {
        ...hours[hour],
        steps: hours[hour].steps + Math.round(record.count),
        activeCalories: hours[hour].activeCalories + Math.round(record.count * KCAL_PER_STEP),
        distanceMeters: hours[hour].distanceMeters + Math.round(record.count * AVG_STRIDE_M),
      };
    }
  }
  return hours;
}

/**
 * Read complete activity data for a specific date.
 */
export async function readDailyActivity(
  date: Date,
  goal: number = 10_000,
): Promise<DailyActivity> {
  if (!isAvailable()) return createEmptyDailyActivity(ymd(date));

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const tr = timeRange(dayStart, dayEnd);

  try {
    // Parallel aggregation reads
    const [stepsAgg, distAgg, activeCalAgg, floorsAgg, stepRecords, sessions] =
      await Promise.all([
        HC.aggregateRecord({ recordType: "Steps", timeRangeFilter: tr })
          .catch(() => null),
        HC.aggregateRecord({ recordType: "Distance", timeRangeFilter: tr })
          .catch(() => null),
        HC.aggregateRecord({ recordType: "ActiveCaloriesBurned", timeRangeFilter: tr })
          .catch(() => null),
        HC.aggregateRecord({ recordType: "FloorsClimbed", timeRangeFilter: tr })
          .catch(() => null),
        readStepRecords(dayStart, dayEnd),
        readExerciseSessions(dayStart, dayEnd),
      ]);

    const steps = Math.max(0, Math.round(stepsAgg?.COUNT_TOTAL ?? stepsAgg?.count ?? 0));
    const distance = Math.max(0, distAgg?.LENGTH_TOTAL ?? distAgg?.distance?.inMeters ?? 0);
    const activeCalories = Math.max(0, activeCalAgg?.ENERGY_TOTAL ?? activeCalAgg?.energy?.inKilocalories ?? 0);
    const floors = Math.max(0, Math.round(floorsAgg?.COUNT_TOTAL ?? floorsAgg?.floors ?? 0));
    const workoutMinutes = sessions.reduce((s, sess) => s + sess.durationMinutes, 0);

    // Determine best source
    const sources: ActivitySource[] = stepRecords
      .map((r) => inferSource(r.source))
      .filter(Boolean);
    const source = bestSource(sources.length > 0 ? sources : ["healthconnect"]);

    const hourlyBreakdown = buildHourlyBreakdown(stepRecords, date);

    return {
      date: ymd(date),
      steps,
      distanceWalkingMeters: distance,
      distanceRunningMeters: 0,
      distanceTotalMeters: distance,
      flightsClimbed: floors,
      caloriesTotal: Math.round(activeCalories),
      caloriesActive: Math.round(activeCalories),
      workoutDurationMinutes: Math.round(workoutMinutes),
      exerciseSessions: sessions,
      hourlyBreakdown,
      source,
      lastUpdated: new Date().toISOString(),
      goalReached: steps >= goal,
    };
  } catch (e) {
    throw toActivityError(e);
  }
}

/**
 * Read historical activity for a date range.
 */
export async function readHistoricalActivity(
  startDate: Date,
  endDate: Date,
  goal: number = 10_000,
): Promise<DailyActivity[]> {
  if (!isAvailable()) return [];

  const days: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Batch in groups of 7
  const batchSize = 7;
  const results: DailyActivity[] = [];
  for (let i = 0; i < days.length; i += batchSize) {
    const batch = days.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((d) => readDailyActivity(d, goal).catch(() => createEmptyDailyActivity(ymd(d)))),
    );
    results.push(...batchResults);
  }

  return results;
}

// ─── Incremental Sync (Change Tokens) ────────────────────────────────────────

/**
 * Get a change token for incremental sync.
 * Used to detect new/updated records since the last sync.
 */
export async function getChanges(
  token: string | null,
): Promise<{
  nextToken: string;
  hasMore: boolean;
  upsertedRecordIds: string[];
  deletedRecordIds: string[];
}> {
  if (!isAvailable() || !HC.getChanges) {
    return { nextToken: "", hasMore: false, upsertedRecordIds: [], deletedRecordIds: [] };
  }

  try {
    const request: any = { recordTypes: ["Steps", "Distance", "ActiveCaloriesBurned"] };
    if (token) request.changesToken = token;

    const result = await HC.getChanges(request);

    return {
      nextToken: result?.nextChangesToken ?? "",
      hasMore: result?.hasMore ?? false,
      upsertedRecordIds: (result?.upsertedRecords ?? []).map((r: any) => r.recordId ?? r.id ?? ""),
      deletedRecordIds: (result?.deletedRecords ?? []).map((r: any) => r.recordId ?? r.id ?? ""),
    };
  } catch {
    return { nextToken: "", hasMore: false, upsertedRecordIds: [], deletedRecordIds: [] };
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Estimate distance from steps.
 */
export function estimateDistance(steps: number): number {
  return Math.round(steps * AVG_STRIDE_M * 10) / 10;
}

/**
 * Estimate calories from steps.
 */
export function estimateCalories(steps: number): number {
  return Math.round(steps * KCAL_PER_STEP * 10) / 10;
}

/**
 * Assert Health Connect is available. Throws typed error if not.
 */
export function assertAvailable(): void {
  if (!isAvailable()) {
    throw new HealthUnavailableError("Google Health Connect");
  }
}

/**
 * Assert Health Connect is installed. Throws typed error if not.
 */
export async function assertInstalled(): Promise<void> {
  const installed = await isInstalled();
  if (!installed) {
    throw new HealthConnectMissingError();
  }
}

/**
 * Assert permissions are granted. Throws typed error if not.
 */
export async function assertPermission(): Promise<void> {
  const status = await checkPermissionStatus();
  if (status !== "granted") {
    throw new PermissionDeniedError();
  }
}
