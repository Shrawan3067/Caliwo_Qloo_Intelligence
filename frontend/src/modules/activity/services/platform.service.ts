/**
 * Platform Health Service
 *
 * Unified adapter that delegates to HealthKit (iOS), Health Connect (Android),
 * or the Expo Pedometer fallback. Consumers import this module instead of
 * platform-specific services.
 *
 * @module activity/services/platform
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { Pedometer } from "expo-sensors";
import type {
  DailyActivity,
  ExerciseSession,
  HealthPlatform,
  PermissionStatus,
  ActivityMetricId,
  ActivitySource,
} from "../types";
import { createEmptyDailyActivity } from "../types";
import { AVG_STRIDE_M, KCAL_PER_STEP } from "../constants";
import {
  DeviceUnsupportedError,
  SimulatorDetectedError,
} from "../errors";
import * as HealthKitService from "./healthkit.service";
import * as HealthConnectService from "./healthconnect.service";

// ─── Platform Detection ──────────────────────────────────────────────────────

/**
 * Returns the health platform for the current device.
 * Returns null on web or unsupported platforms.
 */
export function getHealthPlatform(): HealthPlatform | null {
  if (Platform.OS === "ios") return "healthkit";
  if (Platform.OS === "android") return "healthconnect";
  return null;
}

/**
 * Human-readable platform name for UI display.
 */
export function getPlatformName(): string {
  if (Platform.OS === "ios") return "Apple Health";
  if (Platform.OS === "android") return "Health Connect";
  return "Unavailable";
}

/**
 * Whether we are running in a simulator / emulator.
 */
export function isSimulator(): boolean {
  if (Platform.OS === "web") return false;

  // Expo provides this via Constants
  const isDevice = Constants.isDevice ?? true;
  return !isDevice;
}

/**
 * Whether the device/platform is supported for health data.
 */
export function isDeviceSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * Whether a native health service (HealthKit or Health Connect) is available.
 * Does NOT check permissions — only capability.
 */
export async function isHealthServiceAvailable(): Promise<boolean> {
  if (Platform.OS === "ios") return HealthKitService.isAvailable();
  if (Platform.OS === "android") {
    if (!HealthConnectService.isAvailable()) return false;
    return HealthConnectService.isInstalled();
  }
  return false;
}

/**
 * Whether ANY step-counting capability is available (including Pedometer fallback).
 */
export async function isAnyStepSourceAvailable(): Promise<boolean> {
  const nativeAvailable = await isHealthServiceAvailable();
  if (nativeAvailable) return true;

  // Fallback: check Expo Pedometer
  if (Platform.OS !== "web") {
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  }
  return false;
}

// ─── Permissions ─────────────────────────────────────────────────────────────

/**
 * Request health data permissions on the current platform.
 */
export async function requestPermissions(): Promise<PermissionStatus> {
  if (isSimulator()) return "simulator";
  if (!isDeviceSupported()) return "unsupported_device";

  if (Platform.OS === "ios") {
    return HealthKitService.requestPermissions();
  }

  if (Platform.OS === "android") {
    const installed = await HealthConnectService.isInstalled();
    if (!installed) return "health_app_missing";
    return HealthConnectService.requestPermissions();
  }

  // Fallback: Expo Pedometer
  try {
    const result = await Pedometer.requestPermissionsAsync();
    return result.granted ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

/**
 * Check current permission status without prompting.
 */
export async function checkPermissionStatus(): Promise<PermissionStatus> {
  if (isSimulator()) return "simulator";
  if (!isDeviceSupported()) return "unsupported_device";

  if (Platform.OS === "ios") {
    return HealthKitService.checkPermissionStatus();
  }

  if (Platform.OS === "android") {
    const installed = await HealthConnectService.isInstalled();
    if (!installed) return "health_app_missing";
    return HealthConnectService.checkPermissionStatus();
  }

  try {
    const result = await Pedometer.getPermissionsAsync();
    return result.granted ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

/**
 * Get the list of metrics that are currently granted.
 */
export async function getGrantedPermissions(): Promise<ActivityMetricId[]> {
  if (Platform.OS === "ios") {
    return HealthKitService.getGrantedPermissions();
  }
  if (Platform.OS === "android") {
    return HealthConnectService.getGrantedMetrics();
  }
  return ["steps"]; // Pedometer only
}

// ─── Data Reads ──────────────────────────────────────────────────────────────

/**
 * Read today's step count from the best available source.
 */
export async function readTodaySteps(): Promise<number> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readTodaySteps();
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    return HealthConnectService.readTodaySteps();
  }

  // Pedometer fallback
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const result = await Pedometer.getStepCountAsync(start, new Date());
    return Math.max(0, Math.round(result?.steps ?? 0));
  } catch {
    return 0;
  }
}

/**
 * Read today's walking+running distance in meters.
 */
export async function readTodayDistance(): Promise<number> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readTodayDistance();
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    return HealthConnectService.readTodayDistance();
  }

  // Estimate from steps
  const steps = await readTodaySteps();
  return Math.round(steps * AVG_STRIDE_M);
}

/**
 * Read today's active calories burned.
 */
export async function readTodayActiveCalories(): Promise<number> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readTodayActiveCalories();
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    return HealthConnectService.readTodayActiveCalories();
  }

  // Estimate from steps
  const steps = await readTodaySteps();
  return Math.round(steps * KCAL_PER_STEP);
}

/**
 * Read today's flights climbed.
 */
export async function readTodayFlightsClimbed(): Promise<number> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readTodayFlightsClimbed();
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    return HealthConnectService.readTodayFloorsClimbed();
  }

  return 0;
}

/**
 * Read today's workout/exercise duration in minutes.
 */
export async function readTodayWorkoutMinutes(): Promise<number> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readTodayExerciseMinutes();
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    const sessions = await HealthConnectService.readExerciseSessions(
      (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(),
      new Date(),
    );
    return sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  }

  return 0;
}

/**
 * Read complete daily activity for a specific date.
 */
export async function readDailyActivity(
  date: Date,
  goal: number = 10_000,
): Promise<DailyActivity> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readDailyActivity(date, goal);
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    return HealthConnectService.readDailyActivity(date, goal);
  }

  // Pedometer fallback — steps only
  return readDailyActivityFallback(date, goal);
}

/**
 * Read historical activity for a date range.
 */
export async function readHistoricalActivity(
  startDate: Date,
  endDate: Date,
  goal: number = 10_000,
): Promise<DailyActivity[]> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readHistoricalActivity(startDate, endDate, goal);
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    return HealthConnectService.readHistoricalActivity(startDate, endDate, goal);
  }

  // Pedometer fallback
  return readHistoricalActivityFallback(startDate, endDate, goal);
}

/**
 * Read exercise sessions for a date range.
 */
export async function readExerciseSessions(
  startDate: Date,
  endDate: Date,
): Promise<ExerciseSession[]> {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.readExerciseSessions(startDate, endDate);
  }

  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    return HealthConnectService.readExerciseSessions(startDate, endDate);
  }

  return [];
}

// ─── Observers ───────────────────────────────────────────────────────────────

/** Observer subscription handle. */
export interface ObserverHandle {
  remove: () => void;
}

/**
 * Register for health data change notifications.
 * The callback is invoked when new data is available — caller should re-read.
 */
export function observeChanges(callback: () => void): ObserverHandle {
  if (Platform.OS === "ios" && HealthKitService.isAvailable()) {
    return HealthKitService.observeChanges(callback);
  }

  // Health Connect doesn't support push observers — use periodic polling
  // (handled at the sync engine level, not here).
  return { remove: () => {} };
}

// ─── Change Token (Incremental Sync) ────────────────────────────────────────

/**
 * Get changes since last sync token (Health Connect only).
 */
export async function getChanges(token: string | null): Promise<{
  nextToken: string;
  hasMore: boolean;
  hasChanges: boolean;
}> {
  if (Platform.OS === "android" && HealthConnectService.isAvailable()) {
    const result = await HealthConnectService.getChanges(token);
    return {
      nextToken: result.nextToken,
      hasMore: result.hasMore,
      hasChanges: result.upsertedRecordIds.length > 0 || result.deletedRecordIds.length > 0,
    };
  }

  return { nextToken: "", hasMore: false, hasChanges: false };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Get the data source string for the current platform (used in API sync payload).
 */
export function getSourceString(): string {
  if (Platform.OS === "ios") return "healthkit";
  if (Platform.OS === "android") return "healthconnect";
  return "pedometer";
}

/**
 * Get the ActivitySource type for the current device.
 */
export function getDeviceSource(): ActivitySource {
  if (Platform.OS === "ios") return "healthkit";
  if (Platform.OS === "android") return "healthconnect";
  return "pedometer";
}

/**
 * Assert that the platform is supported. Throws typed errors.
 */
export function assertSupported(): void {
  if (isSimulator()) {
    throw new SimulatorDetectedError();
  }
  if (!isDeviceSupported()) {
    throw new DeviceUnsupportedError("Platform is not iOS or Android");
  }
}

// ─── Pedometer Fallback ──────────────────────────────────────────────────────

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function readDailyActivityFallback(
  date: Date,
  goal: number,
): Promise<DailyActivity> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const now = new Date();
  const effectiveEnd = end.getTime() > now.getTime() ? now : end;

  let steps = 0;
  try {
    const result = await Pedometer.getStepCountAsync(start, effectiveEnd);
    steps = Math.max(0, Math.round(result?.steps ?? 0));
  } catch {
    // Pedometer unavailable
  }

  return {
    ...createEmptyDailyActivity(ymd(date)),
    steps,
    distanceWalkingMeters: Math.round(steps * AVG_STRIDE_M),
    distanceTotalMeters: Math.round(steps * AVG_STRIDE_M),
    caloriesActive: Math.round(steps * KCAL_PER_STEP),
    caloriesTotal: Math.round(steps * KCAL_PER_STEP),
    source: "pedometer",
    lastUpdated: new Date().toISOString(),
    goalReached: steps >= goal,
  };
}

async function readHistoricalActivityFallback(
  startDate: Date,
  endDate: Date,
  goal: number,
): Promise<DailyActivity[]> {
  const days: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const results: DailyActivity[] = [];
  for (const day of days) {
    const activity = await readDailyActivityFallback(day, goal);
    results.push(activity);
  }
  return results;
}
