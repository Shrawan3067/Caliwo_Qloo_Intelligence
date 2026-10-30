/**
 * AI Insights Engine — Unit Tests
 */

import * as AIInsightsEngine from "../engines/ai-insights.engine";
import { createEmptyDailyActivity } from "../types";

function makeDay(date: string, steps: number) {
  return { ...createEmptyDailyActivity(date), steps };
}

describe("AIInsightsEngine", () => {
  describe("computeInsights", () => {
    it("returns sedentary for low step counts", () => {
      const today = makeDay("2025-01-07", 2_000);
      const weekly = Array.from({ length: 7 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 2_000),
      );
      const result = AIInsightsEngine.computeInsights(today, weekly, 10_000);
      expect(result.activityLevel).toBe("sedentary");
      expect(result.activityScore).toBeLessThan(50);
    });

    it("returns active for high step counts", () => {
      const today = makeDay("2025-01-07", 12_000);
      const weekly = Array.from({ length: 7 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 12_000),
      );
      const result = AIInsightsEngine.computeInsights(today, weekly, 10_000);
      expect(["active", "very_active"]).toContain(result.activityLevel);
      expect(result.activityScore).toBeGreaterThan(50);
    });

    it("provides calorie adjustment", () => {
      const today = makeDay("2025-01-07", 10_000);
      const weekly = Array.from({ length: 7 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 10_000),
      );
      const result = AIInsightsEngine.computeInsights(today, weekly, 10_000);
      expect(typeof result.estimatedCalorieAdjustment).toBe("number");
    });

    it("generates a movement summary string", () => {
      const today = makeDay("2025-01-01", 8_000);
      const result = AIInsightsEngine.computeInsights(today, [], 10_000);
      expect(result.dailyMovementSummary.length).toBeGreaterThan(0);
    });

    it("handles empty weekly data", () => {
      const today = { ...createEmptyDailyActivity("2025-01-01"), steps: 0 };
      const result = AIInsightsEngine.computeInsights(today, [], 10_000);
      expect(result.activityLevel).toBe("sedentary");
      expect(result.activityScore).toBe(0);
    });
  });

  describe("classifyActivityLevel", () => {
    it("classifies 0 steps as sedentary", () => {
      expect(AIInsightsEngine.classifyActivityLevel(0)).toBe("sedentary");
    });

    it("classifies 5000 steps as lightly active", () => {
      expect(AIInsightsEngine.classifyActivityLevel(5_000)).toBe("lightly_active");
    });

    it("classifies 15000 steps as very active", () => {
      expect(AIInsightsEngine.classifyActivityLevel(15_000)).toBe("very_active");
    });
  });

  describe("computeCalorieAdjustment", () => {
    it("returns a number for any step count", () => {
      const adj = AIInsightsEngine.computeCalorieAdjustment(5_000);
      expect(typeof adj).toBe("number");
    });

    it("returns positive adjustment for high steps", () => {
      const adj = AIInsightsEngine.computeCalorieAdjustment(15_000);
      expect(adj).toBeGreaterThan(0);
    });
  });

  describe("isRecoveryMealRecommended", () => {
    it("returns false for low activity", () => {
      expect(AIInsightsEngine.isRecoveryMealRecommended(3_000, 0)).toBe(false);
    });

    it("returns true for very high activity", () => {
      expect(AIInsightsEngine.isRecoveryMealRecommended(20_000, 60)).toBe(true);
    });
  });

  describe("computeActivityScore", () => {
    it("returns 0 for zero steps", () => {
      const today = { ...createEmptyDailyActivity("2025-01-01"), steps: 0 };
      expect(AIInsightsEngine.computeActivityScore(today, 0)).toBe(0);
    });

    it("returns higher score for more steps", () => {
      const low = AIInsightsEngine.computeActivityScore(makeDay("2025-01-01", 3_000), 3_000);
      const high = AIInsightsEngine.computeActivityScore(makeDay("2025-01-01", 15_000), 15_000);
      expect(high).toBeGreaterThan(low);
    });
  });
});
