/**
 * Streak Engine — Unit Tests
 */

import * as StreakEngine from "../engines/streak.engine";
import { createEmptyDailyActivity, DEFAULT_STREAK_DATA } from "../types";

function makeDay(date: string, steps: number) {
  return { ...createEmptyDailyActivity(date), steps };
}

describe("StreakEngine", () => {
  describe("computeCurrentStreak", () => {
    it("returns 0 with no data", () => {
      const result = StreakEngine.computeCurrentStreak([], 10_000);
      expect(result).toBe(0);
    });

    it("counts consecutive days meeting the goal from end", () => {
      const today = new Date();
      const entries = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (4 - i)); // ascending order
        return makeDay(d.toISOString().slice(0, 10), 12_000);
      });
      const result = StreakEngine.computeCurrentStreak(entries, 10_000);
      expect(result).toBeGreaterThanOrEqual(1);
    });
  });

  describe("computeLongestStreak", () => {
    it("returns 0 length for empty data", () => {
      const result = StreakEngine.computeLongestStreak([], 10_000);
      expect(result.length).toBe(0);
    });

    it("finds the longest consecutive run", () => {
      const entries = [
        makeDay("2025-01-01", 12_000),
        makeDay("2025-01-02", 12_000),
        makeDay("2025-01-03", 12_000),
        makeDay("2025-01-04", 3_000), // break
        makeDay("2025-01-05", 12_000),
        makeDay("2025-01-06", 12_000),
      ];
      const result = StreakEngine.computeLongestStreak(entries, 10_000);
      expect(result.length).toBe(3);
    });
  });

  describe("evaluateStreaks", () => {
    it("returns existing data for empty entries", () => {
      const result = StreakEngine.evaluateStreaks([], 10_000, DEFAULT_STREAK_DATA);
      expect(result.currentStreak).toBe(DEFAULT_STREAK_DATA.currentStreak);
    });

    it("computes both current and longest streaks", () => {
      const entries = [
        makeDay("2025-01-01", 12_000),
        makeDay("2025-01-02", 12_000),
        makeDay("2025-01-03", 12_000),
      ];
      const result = StreakEngine.evaluateStreaks(entries, 10_000);
      expect(result.longestStreak).toBeGreaterThanOrEqual(3);
    });

    it("updates longestStreak when current exceeds it", () => {
      const entries = Array.from({ length: 10 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 15_000),
      );
      const existing = { ...DEFAULT_STREAK_DATA, longestStreak: 5 };
      const result = StreakEngine.evaluateStreaks(entries, 10_000, existing);
      expect(result.longestStreak).toBeGreaterThanOrEqual(10);
    });
  });

  describe("getMilestoneProgress", () => {
    it("returns progress toward next milestone", () => {
      const result = StreakEngine.getMilestoneProgress(5);
      expect(result).toBeDefined();
      expect(result.next).not.toBeNull();
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(100);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it("returns 0 progress for 0 streak", () => {
      const result = StreakEngine.getMilestoneProgress(0);
      expect(result.progress).toBe(0);
      expect(result.next).not.toBeNull();
    });
  });

  describe("canUseFreeze", () => {
    it("returns true when freezes available and streak active", () => {
      const data = { ...DEFAULT_STREAK_DATA, freezeDaysAvailable: 2, currentStreak: 3 };
      expect(StreakEngine.canUseFreeze(data)).toBe(true);
    });

    it("returns false when no freezes available", () => {
      const data = { ...DEFAULT_STREAK_DATA, freezeDaysAvailable: 0 };
      expect(StreakEngine.canUseFreeze(data)).toBe(false);
    });
  });

  describe("getNextMilestone", () => {
    it("returns first milestone for streak of 0", () => {
      const next = StreakEngine.getNextMilestone(0);
      expect(next).not.toBeNull();
      expect(typeof next).toBe("number");
    });

    it("returns null when all milestones passed", () => {
      const next = StreakEngine.getNextMilestone(999_999);
      expect(next).toBeNull();
    });
  });
});
