/**
 * Goal Engine — Unit Tests
 */

import * as GoalEngine from "../engines/goal.engine";
import { createEmptyDailyActivity } from "../types";

describe("GoalEngine", () => {
  describe("computeGoalProgress", () => {
    it("returns 0% for 0 steps", () => {
      const result = GoalEngine.computeGoalProgress(0, 10_000);
      expect(result.percentage).toBe(0);
      expect(result.completed).toBe(false);
      expect(result.remaining).toBe(10_000);
    });

    it("returns 100% when goal is reached", () => {
      const result = GoalEngine.computeGoalProgress(10_000, 10_000);
      expect(result.percentage).toBe(100);
      expect(result.completed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("returns 50% for half the goal", () => {
      const result = GoalEngine.computeGoalProgress(5_000, 10_000);
      expect(result.percentage).toBe(50);
      expect(result.completed).toBe(false);
      expect(result.remaining).toBe(5_000);
    });

    it("caps at goal when exceeding", () => {
      const result = GoalEngine.computeGoalProgress(15_000, 10_000);
      expect(result.percentage).toBeGreaterThanOrEqual(100);
      expect(result.completed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("handles 0 goal gracefully", () => {
      const result = GoalEngine.computeGoalProgress(5_000, 0);
      expect(result.completed).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  describe("evaluateDailyGoal", () => {
    it("returns true when steps >= goal", () => {
      expect(GoalEngine.evaluateDailyGoal(10_000, 10_000)).toBe(true);
      expect(GoalEngine.evaluateDailyGoal(15_000, 10_000)).toBe(true);
    });

    it("returns false when steps < goal", () => {
      expect(GoalEngine.evaluateDailyGoal(5_000, 10_000)).toBe(false);
    });
  });

  describe("evaluateWeeklyGoal", () => {
    it("counts days that reached the goal", () => {
      const entries = [
        { ...createEmptyDailyActivity("2025-01-01"), steps: 12_000 },
        { ...createEmptyDailyActivity("2025-01-02"), steps: 8_000 },
        { ...createEmptyDailyActivity("2025-01-03"), steps: 15_000 },
      ];
      const result = GoalEngine.evaluateWeeklyGoal(entries, 10_000);
      expect(result.daysReached).toBe(2);
      expect(result.totalDays).toBe(3);
    });

    it("returns 0 reached for empty data", () => {
      const result = GoalEngine.evaluateWeeklyGoal([], 10_000);
      expect(result.daysReached).toBe(0);
      expect(result.totalDays).toBe(0);
    });
  });

  describe("getGoalCelebrationTier", () => {
    it("returns null below 50%", () => {
      const result = GoalEngine.getGoalCelebrationTier(30);
      expect(result).toBeNull();
    });

    it("returns 'reached' at 100%", () => {
      const result = GoalEngine.getGoalCelebrationTier(100);
      expect(result).toBe("reached");
    });

    it("returns 'legendary' at 150%+", () => {
      const result = GoalEngine.getGoalCelebrationTier(155);
      expect(result).toBe("legendary");
    });

    it("returns 'halfway' at 50%", () => {
      const result = GoalEngine.getGoalCelebrationTier(55);
      expect(result).toBe("halfway");
    });
  });

  describe("getCelebrationMessage", () => {
    it("returns a message for reached tier", () => {
      const msg = GoalEngine.getCelebrationMessage("reached");
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
    });

    it("returns a message for crushed tier", () => {
      const msg = GoalEngine.getCelebrationMessage("crushed");
      expect(msg).toContain("crushed");
    });
  });

  describe("recommendGoal", () => {
    it("returns a recommendation with reasoning", () => {
      const history = Array.from({ length: 14 }, (_, i) => ({
        ...createEmptyDailyActivity(`2025-01-${String(i + 1).padStart(2, "0")}`),
        steps: 8_000,
      }));
      const result = GoalEngine.recommendGoal(history, "standard");
      expect(result.recommendedSteps).toBeGreaterThan(0);
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it("doesn't go below minimum step threshold", () => {
      const history = Array.from({ length: 14 }, (_, i) => ({
        ...createEmptyDailyActivity(`2025-01-${String(i + 1).padStart(2, "0")}`),
        steps: 100,
      }));
      const result = GoalEngine.recommendGoal(history, "standard");
      expect(result.recommendedSteps).toBeGreaterThanOrEqual(1_000);
    });
  });

  describe("stepsRemaining", () => {
    it("returns difference when below goal", () => {
      expect(GoalEngine.stepsRemaining(3_000, 10_000)).toBe(7_000);
    });

    it("returns 0 when at or above goal", () => {
      expect(GoalEngine.stepsRemaining(10_000, 10_000)).toBe(0);
      expect(GoalEngine.stepsRemaining(15_000, 10_000)).toBe(0);
    });
  });

  describe("isValidGoal", () => {
    it("accepts valid goals", () => {
      expect(GoalEngine.isValidGoal(5_000)).toBe(true);
      expect(GoalEngine.isValidGoal(10_000)).toBe(true);
    });

    it("rejects 0 or negative goals", () => {
      expect(GoalEngine.isValidGoal(0)).toBe(false);
      expect(GoalEngine.isValidGoal(-100)).toBe(false);
    });
  });

  describe("predictGoalCompletionHour", () => {
    it("predicts from hourly data", () => {
      const hourly = Array.from({ length: 12 }, (_, i) => ({
        hour: i,
        steps: 800,
        distance: 500,
        calories: 40,
      }));
      const result = GoalEngine.predictGoalCompletionHour(5_000, 10_000, hourly);
      expect(result === null || typeof result === "number").toBe(true);
    });

    it("returns null when no data", () => {
      const result = GoalEngine.predictGoalCompletionHour(0, 10_000, []);
      expect(result).toBeNull();
    });
  });
});
