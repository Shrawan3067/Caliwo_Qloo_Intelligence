/**
 * Activity Zustand Store
 *
 * Central state management for the activity module. All UI components
 * read from this store. All mutations flow through actions that
 * coordinate engines, repositories, and services.
 *
 * Architecture:
 * - State is the single source of truth for all activity UI
 * - Actions are the ONLY way to mutate state
 * - Derived data is computed via selectors (not stored)
 * - Async operations update loading/error states atomically
 *
 * @module activity/store/activity
 */

import { create } from "zustand";
import type {
  DailyActivity,
  WeeklyData,
  MonthlyData,
  YearlyData,
  GoalConfig,
  GoalProgress,
  StreakData,
  Achievement,
  LevelInfo,
  PersonalRecord,
  ActivityInsights,
  PermissionStatus,
  SyncResult,
  ActivityAnalytics,
  NotificationPreferences,
  GoalMode,
} from "../types";

import {
  DEFAULT_GOAL_CONFIG,
  DEFAULT_STREAK_DATA,
  DEFAULT_NOTIFICATION_PREFERENCES,
  createEmptyDailyActivity,
} from "../types";
import { PlatformService } from "../services";
import { ActivityRepo, GoalsRepo, AchievementsRepo, StreaksRepo } from "../repositories";
import * as SyncEngine from "../engines/sync.engine";
import * as GoalEngine from "../engines/goal.engine";
import * as StreakEngine from "../engines/streak.engine";
import * as AchievementEngine from "../engines/achievement.engine";
import * as AnalyticsEngine from "../engines/analytics.engine";
import * as AIInsightsEngine from "../engines/ai-insights.engine";
import * as NotificationEngine from "../engines/notification.engine";
import * as ValidationEngine from "../engines/validation.engine";

/** Time period for activity data views. */
export type TimePeriod = "daily" | "weekly" | "monthly" | "yearly";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface ActivityState {
  // ── Core Data ──
  todayData: DailyActivity;
  weeklyData: WeeklyData | null;
  monthlyData: MonthlyData | null;
  yearlyData: YearlyData | null;
  selectedPeriod: TimePeriod;

  // ── Goals ──
  goalConfig: GoalConfig;
  goalProgress: GoalProgress;

  // ── Streaks ──
  streakData: StreakData;

  // ── Achievements ──
  achievements: Achievement[];
  levelInfo: LevelInfo;
  personalRecords: PersonalRecord[];
  newlyUnlocked: Achievement[];

  // ── AI Insights ──
  insights: ActivityInsights | null;

  // ── Analytics ──
  analytics: ActivityAnalytics | null;

  // ── Permissions ──
  permissionStatus: PermissionStatus;
  platformName: string;

  // ── Sync ──
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  lastSyncTime: string | null;
  offlineQueueSize: number;

  // ── UI State ──
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // ── Notifications ──
  notificationPrefs: NotificationPreferences;
}

interface ActivityActions {
  // ── Initialization ──
  initialize: () => Promise<void>;
  reset: () => Promise<void>;

  // ── Sync ──
  syncToday: () => Promise<void>;
  syncFull: () => Promise<void>;
  syncManual: () => Promise<void>;
  cancelSync: () => void;

  // ── Permissions ──
  requestPermissions: () => Promise<PermissionStatus>;
  checkPermissions: () => Promise<PermissionStatus>;

  // ── Goals ──
  setDailyStepGoal: (steps: number) => Promise<void>;
  setGoalMode: (mode: GoalMode) => Promise<void>;

  // ── Streaks ──
  applyFreeze: (date: string) => Promise<boolean>;
  refreshStreaks: () => Promise<void>;

  // ── Achievements ──
  acknowledgeAchievement: (id: string) => Promise<void>;
  dismissNewlyUnlocked: () => void;
  refreshAchievements: () => Promise<void>;

  // ── Data ──
  selectPeriod: (period: TimePeriod) => Promise<void>;
  refreshTodayData: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  refreshInsights: () => Promise<void>;

  // ── Notifications ──
  updateNotificationPrefs: (prefs: Partial<NotificationPreferences>) => Promise<void>;

  // ── Utilities ──
  setError: (error: string | null) => void;
  clearError: () => void;
}

type ActivityStore = ActivityState & ActivityActions;

// ─── Initial State ───────────────────────────────────────────────────────────

const todayStr = ValidationEngine.todayLocal();

const INITIAL_STATE: ActivityState = {
  todayData: createEmptyDailyActivity(todayStr),
  weeklyData: null,
  monthlyData: null,
  yearlyData: null,
  selectedPeriod: "daily",

  goalConfig: { ...DEFAULT_GOAL_CONFIG },
  goalProgress: { current: 0, target: 10_000, percentage: 0, remaining: 10_000, completed: false },

  streakData: { ...DEFAULT_STREAK_DATA },

  achievements: [],
  levelInfo: { level: 1, totalXP: 0, xpForNextLevel: 500, xpInCurrentLevel: 0, progressToNextLevel: 0, title: "Beginner" },
  personalRecords: [],
  newlyUnlocked: [],

  insights: null,
  analytics: null,

  permissionStatus: "undetermined",
  platformName: PlatformService.getPlatformName(),

  isSyncing: false,
  lastSyncResult: null,
  lastSyncTime: null,
  offlineQueueSize: 0,

  isLoading: true,
  isInitialized: false,
  error: null,

  notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFERENCES },
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useActivityStore = create<ActivityStore>((set, get) => ({
  ...INITIAL_STATE,

  // ── Initialization ──────────────────────────────────────────────────

  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true, error: null });

    try {
      // Load persisted state in parallel
      const [goalConfig, streakData, achievements, levelInfo, personalRecords, cachedToday, lastSyncTime, offlineQueueSize, permissionStatus] =
        await Promise.all([
          GoalsRepo.getGoalConfig(),
          StreaksRepo.getStreakData(),
          AchievementsRepo.getAchievements(),
          AchievementsRepo.getLevelInfo(),
          AchievementsRepo.getPersonalRecords(),
          ActivityRepo.getCachedTodayDataStale(),
          ActivityRepo.getLastSyncTimestamp(),
          ActivityRepo.getOfflineQueueSize(),
          PlatformService.checkPermissionStatus(),
        ]);

      const goalProgress = GoalEngine.computeStepGoalProgress(
        cachedToday?.steps ?? 0,
        goalConfig,
      );

      set({
        goalConfig,
        streakData,
        achievements,
        levelInfo,
        personalRecords,
        todayData: cachedToday ?? createEmptyDailyActivity(todayStr),
        goalProgress,
        lastSyncTime,
        offlineQueueSize,
        permissionStatus,
        isLoading: false,
        isInitialized: true,
      });

      // Trigger background sync if permissions are granted
      if (permissionStatus === "granted") {
        get().syncToday();
      }
    } catch (e) {
      set({
        isLoading: false,
        isInitialized: true,
        error: e instanceof Error ? e.message : "Failed to initialize activity module",
      });
    }
  },

  reset: async () => {
    await Promise.all([
      ActivityRepo.clearAll(),
      GoalsRepo.clearGoalHistory(),
      AchievementsRepo.clearAll(),
      StreaksRepo.clearAll(),
    ]);
    set(INITIAL_STATE);
  },

  // ── Sync ────────────────────────────────────────────────────────────

  syncToday: async () => {
    const { goalConfig, isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, error: null });

    try {
      const result = await SyncEngine.syncToday(goalConfig.dailySteps);

      if (result.ok) {
        const cachedToday = await ActivityRepo.getCachedTodayData();
        if (cachedToday) {
          const goalProgress = GoalEngine.computeStepGoalProgress(cachedToday.steps, goalConfig);
          const previousProgress = get().goalProgress;

          set({
            todayData: cachedToday,
            goalProgress,
            lastSyncResult: result,
            lastSyncTime: new Date().toISOString(),
          });

          // Check for goal reached notification
          if (goalProgress.completed && !previousProgress.completed) {
            NotificationEngine.notifyGoalReached(cachedToday.steps, goalConfig.dailySteps, get().notificationPrefs);
          }

          // Evaluate achievements
          await evaluateAndUpdateAchievements(get, set, cachedToday);
        }
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      set({ isSyncing: false });
    }
  },

  syncFull: async () => {
    const { goalConfig, isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, error: null });

    try {
      const hasLastSync = !!get().lastSyncTime;
      const mode = SyncEngine.determineSyncMode(hasLastSync, !get().isInitialized, false);
      let result: SyncResult;

      switch (mode) {
        case "initial":
          result = await SyncEngine.syncInitial(goalConfig.dailySteps);
          break;
        case "resume":
          result = await SyncEngine.syncResume(goalConfig.dailySteps);
          break;
        default:
          result = await SyncEngine.syncIncremental(goalConfig.dailySteps);
      }

      set({ lastSyncResult: result, lastSyncTime: new Date().toISOString() });

      if (result.ok) {
        // Refresh all data
        await get().refreshTodayData();
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      set({ isSyncing: false });
    }
  },

  syncManual: async () => {
    const { goalConfig, isSyncing } = get();
    if (isSyncing) return;

    set({ isSyncing: true, error: null });

    try {
      const result = await SyncEngine.syncManual(goalConfig.dailySteps);
      set({ lastSyncResult: result, lastSyncTime: new Date().toISOString() });

      if (result.ok) {
        await get().refreshTodayData();
        await get().refreshStreaks();
        await get().refreshAchievements();
        const queueSize = await ActivityRepo.getOfflineQueueSize();
        set({ offlineQueueSize: queueSize });
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      set({ isSyncing: false });
    }
  },

  cancelSync: () => {
    SyncEngine.cancelSync();
  },

  // ── Permissions ─────────────────────────────────────────────────────

  requestPermissions: async () => {
    const status = await PlatformService.requestPermissions();
    set({ permissionStatus: status });
    await ActivityRepo.setPermissionStatus(status);

    if (status === "granted") {
      get().syncToday();
    }

    return status;
  },

  checkPermissions: async () => {
    const status = await PlatformService.checkPermissionStatus();
    set({ permissionStatus: status });
    return status;
  },

  // ── Goals ───────────────────────────────────────────────────────────

  setDailyStepGoal: async (steps: number) => {
    if (!GoalEngine.isValidGoal(steps)) return;

    const clamped = GoalEngine.clampGoal(steps);
    const current = get().goalConfig;
    const newConfig: GoalConfig = {
      ...current,
      dailySteps: clamped,
      weeklySteps: clamped * 7,
      monthlySteps: clamped * 30,
      lastUpdated: new Date().toISOString(),
    };

    await GoalsRepo.setGoalConfig(newConfig);

    const goalProgress = GoalEngine.computeStepGoalProgress(get().todayData.steps, newConfig);

    set({ goalConfig: newConfig, goalProgress });
  },

  setGoalMode: async (mode: GoalMode) => {
    const current = get().goalConfig;
    const newConfig: GoalConfig = {
      ...current,
      mode,
      lastUpdated: new Date().toISOString(),
    };
    await GoalsRepo.setGoalConfig(newConfig);
    set({ goalConfig: newConfig });
  },

  // ── Streaks ─────────────────────────────────────────────────────────

  applyFreeze: async (date: string) => {
    const success = await StreaksRepo.consumeFreeze(date);
    if (success) {
      const updated = await StreaksRepo.getStreakData();
      set({ streakData: updated });
    }
    return success;
  },

  refreshStreaks: async () => {
    const streakData = await StreaksRepo.getStreakData();
    set({ streakData });
  },

  // ── Achievements ────────────────────────────────────────────────────

  acknowledgeAchievement: async (id: string) => {
    await AchievementsRepo.acknowledgeAchievement(id);
    const achievements = await AchievementsRepo.getAchievements();
    set({ achievements });
  },

  dismissNewlyUnlocked: () => {
    set({ newlyUnlocked: [] });
  },

  refreshAchievements: async () => {
    const [achievements, levelInfo, personalRecords] = await Promise.all([
      AchievementsRepo.getAchievements(),
      AchievementsRepo.getLevelInfo(),
      AchievementsRepo.getPersonalRecords(),
    ]);
    set({ achievements, levelInfo, personalRecords });
  },

  // ── Data ────────────────────────────────────────────────────────────

  selectPeriod: async (period: TimePeriod) => {
    set({ selectedPeriod: period });

    const { goalConfig } = get();
    const goal = goalConfig.dailySteps;
    const now = new Date();

    if (period === "weekly" && !get().weeklyData) {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      const entries = await PlatformService.readHistoricalActivity(start, now, goal);
      const stats = AnalyticsEngine.computeAggregatedStats(entries, goal);
      const weeklyData: WeeklyData = {
        entries,
        stats,
        goal,
        trendVsPreviousWeekPct: 0,
        currentStreak: get().streakData.currentStreak,
        longestStreak: get().streakData.longestStreak,
      };
      await ActivityRepo.cacheWeeklyData(weeklyData);
      set({ weeklyData });
    }

    if (period === "monthly" && !get().monthlyData) {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      const entries = await PlatformService.readHistoricalActivity(start, now, goal);
      const stats = AnalyticsEngine.computeAggregatedStats(entries, goal);
      const bestDay = AnalyticsEngine.findBestDay(entries);
      const monthlyData: MonthlyData = {
        entries,
        stats,
        goal,
        bestDay,
        trendVsPreviousMonthPct: 0,
      };
      await ActivityRepo.cacheMonthlyData(monthlyData);
      set({ monthlyData });
    }
  },

  refreshTodayData: async () => {
    const cachedToday = await ActivityRepo.getCachedTodayData();
    const todayData = cachedToday ?? get().todayData;
    const goalProgress = GoalEngine.computeStepGoalProgress(todayData.steps, get().goalConfig);
    set({ todayData, goalProgress });
  },

  refreshAnalytics: async () => {
    const { goalConfig } = get();
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    const entries = await PlatformService.readHistoricalActivity(start, now, goalConfig.dailySteps);
    const analytics = AnalyticsEngine.computeAnalytics(entries, goalConfig.dailySteps);
    set({ analytics });
  },

  refreshInsights: async () => {
    const { todayData, goalConfig } = get();
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 6);

    let weeklyEntries: DailyActivity[] = [];
    const weeklyData = get().weeklyData;
    if (weeklyData) {
      weeklyEntries = [...weeklyData.entries];
    } else {
      weeklyEntries = await PlatformService.readHistoricalActivity(start, now, goalConfig.dailySteps);
    }

    const insights = AIInsightsEngine.computeInsights(todayData, weeklyEntries, goalConfig.dailySteps);
    set({ insights });
  },

  // ── Notifications ───────────────────────────────────────────────────

  updateNotificationPrefs: async (prefs: Partial<NotificationPreferences>) => {
    const current = get().notificationPrefs;
    const updated = { ...current, ...prefs };
    set({ notificationPrefs: updated });
    await NotificationEngine.setupScheduledNotifications(updated);
  },

  // ── Utilities ───────────────────────────────────────────────────────

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function evaluateAndUpdateAchievements(
  get: () => ActivityStore,
  set: (state: Partial<ActivityState>) => void,
  todayData: DailyActivity,
): Promise<void> {
  const { streakData, achievements, goalConfig, notificationPrefs } = get();

  const newlyUnlocked = AchievementEngine.evaluateAchievements(
    todayData,
    streakData,
    achievements,
    0, // weekendGoalDays — computed separately if needed
    0, // monthGoalDays
    get().personalRecords,
    goalConfig.dailySteps,
  );

  if (newlyUnlocked.length > 0) {
    // Persist unlocks
    for (const achievement of newlyUnlocked) {
      await AchievementsRepo.unlockAchievement(achievement.id);
    }

    // Refresh from persistence
    const [updatedAchievements, updatedLevel] = await Promise.all([
      AchievementsRepo.getAchievements(),
      AchievementsRepo.getLevelInfo(),
    ]);

    set({
      achievements: updatedAchievements,
      levelInfo: updatedLevel,
      newlyUnlocked,
    });

    // Send notifications
    for (const achievement of newlyUnlocked) {
      await NotificationEngine.notifyAchievementUnlocked(achievement, notificationPrefs);
    }
  }

  // Check personal records
  const metrics: { metric: PersonalRecord["metric"]; value: number }[] = [
    { metric: "steps", value: todayData.steps },
    { metric: "distance_walking", value: todayData.distanceTotalMeters },
    { metric: "calories_active", value: todayData.caloriesActive },
  ];

  for (const { metric, value } of metrics) {
    const newRecord = await AchievementsRepo.checkAndUpdatePersonalRecord(
      metric,
      value,
      todayData.date,
    );
    if (newRecord) {
      await NotificationEngine.notifyPersonalRecord(
        metric,
        value,
        newRecord.previousBest,
        notificationPrefs,
      );
    }
  }

  // Evaluate streaks
  const weeklyData = get().weeklyData;
  if (weeklyData && weeklyData.entries.length > 0) {
    const updatedStreak = StreakEngine.evaluateStreaks(
      weeklyData.entries,
      goalConfig.dailySteps,
      streakData,
    );
    await StreaksRepo.setStreakData(updatedStreak);

    // Check streak milestones
    if (updatedStreak.currentStreak > streakData.currentStreak) {
      const milestones = StreakEngine.getReachedMilestones(
        updatedStreak.currentStreak,
        streakData.currentStreak,
      );
      for (const milestone of milestones) {
        await NotificationEngine.notifyStreakMilestone(milestone, notificationPrefs);
      }
    }

    set({ streakData: updatedStreak });
  }
}

// ─── Selectors ───────────────────────────────────────────────────────────────

/** Select only today's step count (avoids re-renders from other state changes). */
export const selectSteps = (s: ActivityStore) => s.todayData.steps;
export const selectGoalProgress = (s: ActivityStore) => s.goalProgress;
export const selectStreak = (s: ActivityStore) => s.streakData.currentStreak;
export const selectLongestStreak = (s: ActivityStore) => s.streakData.longestStreak;
export const selectLevel = (s: ActivityStore) => s.levelInfo;
export const selectPermission = (s: ActivityStore) => s.permissionStatus;
export const selectIsSyncing = (s: ActivityStore) => s.isSyncing;
export const selectIsLoading = (s: ActivityStore) => s.isLoading;
export const selectError = (s: ActivityStore) => s.error;
export const selectTodayData = (s: ActivityStore) => s.todayData;
export const selectInsights = (s: ActivityStore) => s.insights;
export const selectAnalytics = (s: ActivityStore) => s.analytics;
export const selectAchievements = (s: ActivityStore) => s.achievements;
export const selectNewlyUnlocked = (s: ActivityStore) => s.newlyUnlocked;
export const selectSelectedPeriod = (s: ActivityStore) => s.selectedPeriod;
export const selectWeeklyData = (s: ActivityStore) => s.weeklyData;
export const selectMonthlyData = (s: ActivityStore) => s.monthlyData;
export const selectPlatformName = (s: ActivityStore) => s.platformName;
