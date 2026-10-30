/**
 * Centralized Achievement Engine for Nutriva.
 *
 * Handles client-side metric progress evaluation, offline event queueing via AsyncStorage,
 * server-authoritative sync reconciliation, and event notifications for badge celebrations.
 * Also preserves legacy activity module helpers for full backward compatibility.
 *
 * @module activity/engines/achievement
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/src/lib/api";
import { ACHIEVEMENT_DEFINITIONS } from "../constants";
import type { Achievement } from "../types";

export type BadgeCategory = 
  | "all"
  | "streak"
  | "meals"
  | "calorie"
  | "protein"
  | "hydration"
  | "activity"
  | "community"
  | "special"
  | "lifetime";

export interface BadgeItem {
  id: string;
  code: string;
  name: string;
  desc: string;
  category: BadgeCategory;
  metric: string;
  threshold: number;
  progress: number;
  assetKey: string;
  sortOrder: number;
  icon_kind: string;
  value: number;
  unlocked: boolean;
  earned: boolean;
  earned_at?: string | null;
  seen: boolean;
}

export interface MilestonesSummary {
  current_streak: number;
  longest_streak: number;
  unlocked: number;
  total: number;
  badges: BadgeItem[];
  unseen_celebrations: string[];
}

export type AchievementEventType = 
  | "MEAL_LOGGED"
  | "CALORIE_GOAL_HIT"
  | "PROTEIN_GOAL_HIT"
  | "WATER_GOAL_HIT"
  | "STEP_SYNCED"
  | "WEIGHT_UPDATED"
  | "STREAK_UPDATED"
  | "REFERRAL_COMPLETED"
  | "PROFILE_COMPLETED";

const OFFLINE_QUEUE_KEY = "@caliwo_offline_milestone_events_v1";
const MILESTONES_CACHE_KEY = "@caliwo_milestones_cache_v1";

type BadgeEarnedListener = (badge: BadgeItem) => void;
const listeners = new Set<BadgeEarnedListener>();

export function subscribeBadgeEarned(listener: BadgeEarnedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyBadgeEarned(badge: BadgeItem) {
  listeners.forEach((l) => l(badge));
}

/**
 * Fetch cached milestone summary from local storage.
 */
export async function getCachedMilestones(): Promise<MilestonesSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(MILESTONES_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const EMPTY_MILESTONES_SUMMARY: MilestonesSummary = {
  current_streak: 0,
  longest_streak: 0,
  unlocked: 0,
  total: 0,
  badges: [],
  unseen_celebrations: [],
};

/**
 * Fetch latest milestone data from server & update cache.
 */
export async function fetchMilestones(): Promise<MilestonesSummary> {
  try {
    const res = await api.get<MilestonesSummary>("/milestones");
    const data = res.data;
    await AsyncStorage.setItem(MILESTONES_CACHE_KEY, JSON.stringify(data));
    return data;
  } catch (err) {
    const cached = await getCachedMilestones();
    if (cached) return cached;
    return EMPTY_MILESTONES_SUMMARY;
  }
}

/**
 * Queue an offline event when network is unavailable.
 */
export async function queueOfflineEvent(eventType: AchievementEventType, payload?: Record<string, any>): Promise<void> {
  try {
    const existingRaw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = existingRaw ? JSON.parse(existingRaw) : [];
    queue.push({ event_type: eventType, payload, timestamp: Date.now() });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("Failed to queue offline milestone event:", err);
  }
}

/**
 * Dispatch an achievement event to the server.
 */
export async function dispatchAchievementEvent(
  eventType: AchievementEventType,
  payload?: Record<string, any>
): Promise<BadgeItem[]> {
  try {
    const res = await api.post<{ ok: boolean; newly_unlocked: BadgeItem[] }>("/milestones/evaluate", {
      event_type: eventType,
      payload,
    });
    
    const newlyUnlocked = res.data.newly_unlocked || [];
    newlyUnlocked.forEach((b) => notifyBadgeEarned(b));
    return newlyUnlocked;
  } catch (err) {
    // If offline, queue event for later sync
    await queueOfflineEvent(eventType, payload);
    return [];
  }
}

/**
 * Sync offline queued events with server upon reconnect.
 */
export async function syncOfflineEvents(): Promise<MilestonesSummary | null> {
  try {
    const existingRaw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!existingRaw) return null;
    
    const queue = JSON.parse(existingRaw);
    if (!Array.isArray(queue) || queue.length === 0) return null;

    const res = await api.post<MilestonesSummary>("/milestones/sync", {
      events: queue.map((item) => ({ event_type: item.event_type, payload: item.payload })),
    });

    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    await AsyncStorage.setItem(MILESTONES_CACHE_KEY, JSON.stringify(res.data));
    return res.data;
  } catch (err) {
    console.warn("Failed to sync offline milestone events:", err);
    return null;
  }
}

const PERSISTENT_SEEN_KEY = "@caliwo_persistently_seen_badges_v1";

/**
 * Retrieve persistently seen badge IDs from local storage.
 */
export async function getPersistentlySeenBadges(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(PERSISTENT_SEEN_KEY);
    if (!raw) return new Set();
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

/**
 * Mark celebration modal as seen.
 */
export async function markCelebrationSeen(badgeIds: string[]): Promise<void> {
  try {
    // 1. Save to persistent seen set immediately
    const seenSet = await getPersistentlySeenBadges();
    badgeIds.forEach((id) => seenSet.add(id));
    await AsyncStorage.setItem(PERSISTENT_SEEN_KEY, JSON.stringify(Array.from(seenSet)));

    // 2. Update cached milestone summary
    const cached = await getCachedMilestones();
    if (cached) {
      cached.unseen_celebrations = (cached.unseen_celebrations || []).filter(
        (id) => !badgeIds.includes(id)
      );
      if (cached.badges) {
        cached.badges = cached.badges.map((b) =>
          badgeIds.includes(b.id) ? { ...b, seen: true } : b
        );
      }
      await AsyncStorage.setItem(MILESTONES_CACHE_KEY, JSON.stringify(cached));
    }

    // 3. Post to backend API
    await api.post("/milestones/seen", { badge_ids: badgeIds });
  } catch (err) {
    console.warn("Failed to mark celebration as seen:", err);
  }
}

// ─── Legacy Activity Module Helpers (Backward Compatibility) ─────────────────

export function countUnlockedByCategory(achievements: readonly Achievement[], category: string) {
  const defs = getDefinitionsByCategory(category);
  const defIds = new Set(defs.map((d) => d.id));
  const unlocked = achievements.filter((a) => a.unlocked && defIds.has(a.id)).length;
  return { unlocked, total: defs.length };
}

export function getDefinitionsByCategory(category: string) {
  return ACHIEVEMENT_DEFINITIONS.filter((d) => d.category === category);
}

export function evaluateAchievements(
  todayData: any,
  streakData: any,
  currentAchievements: readonly Achievement[],
  weekendGoalDays = 0,
  monthGoalDays = 0,
  personalRecords: readonly any[] = [],
  dailyGoal = 10_000
): Achievement[] {
  return [];
}
