/**
 * Notification Engine
 *
 * Local notification scheduling for activity events. Built behind an
 * interface so push notifications can be added later without changing
 * business logic.
 *
 * Uses the existing expo-notifications integration.
 *
 * @module activity/engines/notification
 */

let NotificationsModule: typeof import("expo-notifications") | null = null;
try {
  // Dynamic require so environments missing native modules (e.g. Expo Go on Android) do not crash at module evaluation time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NotificationsModule = require("expo-notifications");
} catch {
  // Silently fall back to no-op channel if native module is unavailable
}

import type {
  ActivityNotification,
  NotificationPreferences,
  Achievement,
  WeeklyData,
  MonthlyData,
} from "../types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../types";
import { ACHIEVEMENT_DEFINITIONS } from "../constants";

// ─── Notification Channel Interface ──────────────────────────────────────────

/**
 * Channel abstraction — currently only local notifications.
 * Swap this implementation to add push notifications later.
 */
interface NotificationChannel {
  send(notification: ActivityNotification): Promise<string | null>;
  schedule(notification: ActivityNotification, triggerDate: Date): Promise<string | null>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
}

// ─── Local Notification Channel ──────────────────────────────────────────────

const localChannel: NotificationChannel = {
  async send(notification) {
    if (!NotificationsModule?.scheduleNotificationAsync) return null;
    try {
      const id = await NotificationsModule.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: "default",
        },
        trigger: null, // Immediate
      });
      return id;
    } catch {
      return null;
    }
  },

  async schedule(notification, triggerDate) {
    if (!NotificationsModule?.scheduleNotificationAsync) return null;
    try {
      const now = Date.now();
      const target = triggerDate.getTime();
      if (target <= now) return null;

      const id = await NotificationsModule.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: "default",
        },
        trigger: {
          date: triggerDate,
          type: NotificationsModule.SchedulableTriggerInputTypes?.DATE ?? "date",
        },
      });
      return id;
    } catch {
      return null;
    }
  },

  async cancel(id) {
    if (!NotificationsModule?.cancelScheduledNotificationAsync) return;
    try {
      await NotificationsModule.cancelScheduledNotificationAsync(id);
    } catch {
      // Silently fail
    }
  },

  async cancelAll() {
    if (!NotificationsModule?.cancelAllScheduledNotificationsAsync) return;
    try {
      await NotificationsModule.cancelAllScheduledNotificationsAsync();
    } catch {
      // Silently fail
    }
  },
};

// Active channel — swap this for push notifications later
let activeChannel: NotificationChannel = localChannel;

/**
 * Set a custom notification channel (for push notification integration).
 */
export function setChannel(channel: NotificationChannel): void {
  activeChannel = channel;
}

// ─── Notification Factories ──────────────────────────────────────────────────

/**
 * Send a "goal reached" notification.
 */
export async function notifyGoalReached(
  steps: number,
  goal: number,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.goalReachedEnabled) return;

  await activeChannel.send({
    type: "goal_reached",
    title: "🎉 Goal Reached!",
    body: `Amazing! You hit ${steps.toLocaleString()} steps today — ${Math.round((steps / goal) * 100)}% of your goal!`,
    data: { type: "goal_reached", steps, goal },
    scheduledAt: null,
  });
}

/**
 * Send a streak milestone notification.
 */
export async function notifyStreakMilestone(
  streak: number,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.streakReminderEnabled) return;

  await activeChannel.send({
    type: "streak_milestone",
    title: "🔥 Streak Milestone!",
    body: `Incredible! You've maintained a ${streak}-day streak. Keep the fire burning!`,
    data: { type: "streak_milestone", streak },
    scheduledAt: null,
  });
}

/**
 * Send an achievement unlocked notification.
 */
export async function notifyAchievementUnlocked(
  achievement: Achievement,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.achievementUnlockedEnabled) return;

  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === achievement.id);
  if (!def) return;

  await activeChannel.send({
    type: "achievement_unlocked",
    title: "🏆 Achievement Unlocked!",
    body: `${def.title} — ${def.description}. +${def.xpReward} XP!`,
    data: { type: "achievement_unlocked", achievementId: achievement.id, xp: def.xpReward },
    scheduledAt: null,
  });
}

/**
 * Send a personal record notification.
 */
export async function notifyPersonalRecord(
  metric: string,
  value: number,
  previousBest: number,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.achievementUnlockedEnabled) return;

  const improvement = previousBest > 0 ? Math.round(((value - previousBest) / previousBest) * 100) : 100;
  await activeChannel.send({
    type: "personal_record",
    title: "🏅 New Personal Record!",
    body: `You set a new ${metric} record: ${value.toLocaleString()}! That's ${improvement}% better than your previous best.`,
    data: { type: "personal_record", metric, value, previousBest },
    scheduledAt: null,
  });
}

/**
 * Send a sync failed notification.
 */
export async function notifySyncFailed(
  errorMessage: string,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.syncFailedEnabled) return;

  await activeChannel.send({
    type: "sync_failed",
    title: "⚠️ Sync Issue",
    body: "Activity data couldn't sync. We'll retry automatically.",
    data: { type: "sync_failed", error: errorMessage },
    scheduledAt: null,
  });
}

/**
 * Send a permission revoked notification.
 */
export async function notifyPermissionRevoked(
  platformName: string,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.permissionRevokedEnabled) return;

  await activeChannel.send({
    type: "permission_revoked",
    title: "📱 Permission Required",
    body: `${platformName} access was revoked. Open Settings to re-enable activity tracking.`,
    data: { type: "permission_revoked", platform: platformName },
    scheduledAt: null,
  });
}

// ─── Scheduled Notifications ─────────────────────────────────────────────────

/**
 * Schedule a daily activity reminder.
 */
export async function scheduleDailyReminder(
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<string | null> {
  if (!prefs.dailyReminderEnabled) return null;

  // Schedule for today at the configured hour, or tomorrow if past that time
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(prefs.dailyReminderHour, 0, 0, 0);

  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  return activeChannel.schedule(
    {
      type: "daily_reminder",
      title: "👟 Time to Move!",
      body: "Don't forget to hit your step goal today. Every step counts!",
      data: { type: "daily_reminder" },
      scheduledAt: reminderTime.toISOString(),
    },
    reminderTime,
  );
}

/**
 * Schedule a streak reminder for the evening.
 */
export async function scheduleStreakReminder(
  currentStreak: number,
  stepsRemaining: number,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<string | null> {
  if (!prefs.streakReminderEnabled || currentStreak === 0) return null;

  const reminderTime = new Date();
  reminderTime.setHours(21, 0, 0, 0); // 9 PM

  if (reminderTime <= new Date()) return null; // Past 9 PM

  return activeChannel.schedule(
    {
      type: "streak_reminder",
      title: `🔥 ${currentStreak}-Day Streak at Risk!`,
      body: `You need ${stepsRemaining.toLocaleString()} more steps to keep your streak alive. You've got this!`,
      data: { type: "streak_reminder", streak: currentStreak, remaining: stepsRemaining },
      scheduledAt: reminderTime.toISOString(),
    },
    reminderTime,
  );
}

/**
 * Generate and send a weekly summary notification.
 */
export async function sendWeeklySummary(
  weeklyData: WeeklyData,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.weeklySummaryEnabled) return;

  const { stats } = weeklyData;
  const daysStr = stats.daysGoalReached === 7 ? "every day" : `${stats.daysGoalReached}/7 days`;

  await activeChannel.send({
    type: "weekly_summary",
    title: "📊 Weekly Activity Summary",
    body: `This week: ${stats.totalSteps.toLocaleString()} steps (avg ${stats.averageSteps.toLocaleString()}/day). Goal hit ${daysStr}. ${stats.daysGoalReached >= 5 ? "Great work! 💪" : "Keep pushing! 🚀"}`,
    data: {
      type: "weekly_summary",
      totalSteps: stats.totalSteps,
      avgSteps: stats.averageSteps,
      daysGoalReached: stats.daysGoalReached,
    },
    scheduledAt: null,
  });
}

/**
 * Generate and send a monthly summary notification.
 */
export async function sendMonthlySummary(
  monthlyData: MonthlyData,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  if (!prefs.monthlySummaryEnabled) return;

  const { stats } = monthlyData;
  const distKm = (stats.totalDistanceMeters / 1000).toFixed(1);

  await activeChannel.send({
    type: "monthly_summary",
    title: "📅 Monthly Activity Report",
    body: `This month: ${stats.totalSteps.toLocaleString()} steps, ${distKm} km walked, goal hit ${stats.daysGoalReached}/${stats.totalDays} days. ${stats.activeDayPercentage >= 70 ? "Outstanding! 🌟" : "Every step counts! 💪"}`,
    data: {
      type: "monthly_summary",
      totalSteps: stats.totalSteps,
      daysGoalReached: stats.daysGoalReached,
      activeDayPct: stats.activeDayPercentage,
    },
    scheduledAt: null,
  });
}

// ─── Batch Setup ─────────────────────────────────────────────────────────────

/**
 * Set up all recurring scheduled notifications.
 * Call on app launch after permissions are granted.
 */
export async function setupScheduledNotifications(
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<void> {
  // Cancel existing to avoid duplicates
  await activeChannel.cancelAll();

  await scheduleDailyReminder(prefs);
}

/**
 * Cancel all activity notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await activeChannel.cancelAll();
}
