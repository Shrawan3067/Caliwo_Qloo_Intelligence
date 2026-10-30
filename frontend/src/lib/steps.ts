/**
 * Legacy steps library facade
 *
 * Provides full backward compatibility for existing consumers
 * by delegating to the new modular activity tracking engine.
 */

import { PlatformService } from "@/src/modules/activity/services";
import { SyncEngine } from "@/src/modules/activity/engines";
import { ActivityRepo } from "@/src/modules/activity/repositories";
import { AVG_STRIDE_M, KCAL_PER_STEP, GOAL_DEFAULTS } from "@/src/modules/activity/constants";

export type StepPermissionStatus = "granted" | "denied" | "undetermined" | "unavailable";

export type DailySteps = {
  date: string;
  steps: number;
  distance_m: number;
  calories: number;
};

export function estimateDistance(steps: number): number {
  return Math.round(steps * AVG_STRIDE_M * 10) / 10;
}

export function estimateCalories(steps: number): number {
  return Math.round(steps * KCAL_PER_STEP * 10) / 10;
}

export async function detectAvailability(): Promise<boolean> {
  return PlatformService.isAnyStepSourceAvailable();
}

export async function requestPermission(): Promise<StepPermissionStatus> {
  const status = await PlatformService.requestPermissions();
  if (status === "granted") return "granted";
  if (status === "denied" || status === "revoked") return "denied";
  return "unavailable";
}

export async function getPermission(): Promise<StepPermissionStatus> {
  const status = await PlatformService.checkPermissionStatus();
  if (status === "granted") return "granted";
  if (status === "denied" || status === "revoked") return "denied";
  return "unavailable";
}

export async function readTodaySteps(): Promise<number> {
  return PlatformService.readTodaySteps();
}

export async function readHistoricalSteps(days: number): Promise<DailySteps[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));

  const list = await PlatformService.readHistoricalActivity(startDate, endDate);
  return list.map((item) => ({
    date: item.date,
    steps: item.steps,
    distance_m: item.distanceTotalMeters,
    calories: item.caloriesActive,
  }));
}

export async function syncNow(): Promise<{ ok: boolean; permission: StepPermissionStatus; synced: number }> {
  const perm = await getPermission();
  if (perm !== "granted") return { ok: false, permission: perm, synced: 0 };

  const result = await SyncEngine.syncToday(GOAL_DEFAULTS.standard.steps);
  return {
    ok: result.ok,
    permission: perm,
    synced: result.daysSynced,
  };
}

export async function getCachedTodaySteps(): Promise<number | null> {
  const cached = await ActivityRepo.getCachedTodayData();
  return cached ? cached.steps : null;
}

export async function getLastSyncAt(): Promise<Date | null> {
  const ts = await ActivityRepo.getLastSyncTimestamp();
  return ts ? new Date(ts) : null;
}

export function connectedPlatformLabel(): string {
  return PlatformService.getPlatformName();
}
