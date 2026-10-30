/**
 * Analytics Engine — Unit Tests
 */

import * as AnalyticsEngine from "../engines/analytics.engine";
import { createEmptyDailyActivity } from "../types";

function makeDay(date: string, steps: number) {
  return { ...createEmptyDailyActivity(date), steps };
}

describe("AnalyticsEngine", () => {
  describe("computeAggregatedStats", () => {
    it("returns zero stats for empty entries", () => {
      const stats = AnalyticsEngine.computeAggregatedStats([], 10_000);
      expect(stats.totalSteps).toBe(0);
      expect(stats.averageSteps).toBe(0);
      expect(stats.highestSteps).toBe(0);
      expect(stats.daysGoalReached).toBe(0);
      expect(stats.totalDays).toBe(0);
    });

    it("computes correct totals", () => {
      const entries = [makeDay("2025-01-01", 8000), makeDay("2025-01-02", 12000)];
      const stats = AnalyticsEngine.computeAggregatedStats(entries, 10_000);
      expect(stats.totalSteps).toBe(20000);
      expect(stats.averageSteps).toBe(10000);
      expect(stats.highestSteps).toBe(12000);
      expect(stats.lowestSteps).toBe(8000);
      expect(stats.daysGoalReached).toBe(1);
      expect(stats.totalDays).toBe(2);
    });

    it("handles single entry", () => {
      const stats = AnalyticsEngine.computeAggregatedStats([makeDay("2025-01-01", 5000)], 10_000);
      expect(stats.totalSteps).toBe(5000);
      expect(stats.highestSteps).toBe(5000);
      expect(stats.lowestSteps).toBe(5000);
      expect(stats.totalDays).toBe(1);
    });
  });

  describe("computeMovingAverage", () => {
    it("returns empty for empty data", () => {
      const result = AnalyticsEngine.computeMovingAverage([], 7);
      expect(result).toEqual([]);
    });

    it("computes correct 7-day moving average", () => {
      const entries = Array.from({ length: 14 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 10_000),
      );
      const result = AnalyticsEngine.computeMovingAverage(entries, 7);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((point) => {
        expect(point.value).toBeCloseTo(10_000, -2);
      });
    });
  });

  describe("computeTrendScore", () => {
    it("returns positive score for increasing trend", () => {
      const entries = Array.from({ length: 14 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 5_000 + i * 500),
      );
      const score = AnalyticsEngine.computeTrendScore(entries);
      expect(score).toBeGreaterThan(0);
    });

    it("returns negative score for decreasing trend", () => {
      const entries = Array.from({ length: 14 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 15_000 - i * 500),
      );
      const score = AnalyticsEngine.computeTrendScore(entries);
      expect(score).toBeLessThan(0);
    });

    it("returns 0 for empty data", () => {
      expect(AnalyticsEngine.computeTrendScore([])).toBe(0);
    });
  });

  describe("computeConsistencyScore", () => {
    it("returns 100 for consistently meeting goal", () => {
      const entries = Array.from({ length: 7 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 12_000),
      );
      const score = AnalyticsEngine.computeConsistencyScore(entries, 10_000);
      expect(score).toBe(100);
    });

    it("returns 0 for never meeting goal", () => {
      const entries = Array.from({ length: 7 }, (_, i) =>
        makeDay(`2025-01-${String(i + 1).padStart(2, "0")}`, 2_000),
      );
      const score = AnalyticsEngine.computeConsistencyScore(entries, 10_000);
      expect(score).toBe(0);
    });
  });

  describe("findBestDay", () => {
    it("returns null for empty data", () => {
      expect(AnalyticsEngine.findBestDay([])).toBeNull();
    });

    it("returns the day with the most steps", () => {
      const entries = [
        makeDay("2025-01-01", 5000),
        makeDay("2025-01-02", 15000),
        makeDay("2025-01-03", 8000),
      ];
      const best = AnalyticsEngine.findBestDay(entries);
      expect(best?.steps).toBe(15000);
      expect(best?.date).toBe("2025-01-02");
    });
  });

  describe("generateHeatmap", () => {
    it("returns empty for empty entries", () => {
      expect(AnalyticsEngine.generateHeatmap([], 10_000)).toEqual([]);
    });

    it("returns cells with intensity and goalReached", () => {
      const entries = [
        makeDay("2025-01-01", 5_000),
        makeDay("2025-01-02", 10_000),
        makeDay("2025-01-03", 15_000),
      ];
      const heatmap = AnalyticsEngine.generateHeatmap(entries, 10_000);
      expect(heatmap).toHaveLength(3);
      heatmap.forEach((cell) => {
        expect(cell.intensity).toBeGreaterThanOrEqual(0);
        expect(cell.intensity).toBeLessThanOrEqual(1);
        expect(typeof cell.goalReached).toBe("boolean");
      });
      // Highest steps = intensity 1
      expect(heatmap[2].intensity).toBe(1);
      expect(heatmap[2].goalReached).toBe(true);
      expect(heatmap[0].goalReached).toBe(false);
    });
  });

  describe("computeDailyAverage", () => {
    it("returns 0 for empty data", () => {
      expect(AnalyticsEngine.computeDailyAverage([], "steps")).toBe(0);
    });

    it("computes average steps", () => {
      const entries = [makeDay("2025-01-01", 6_000), makeDay("2025-01-02", 10_000)];
      expect(AnalyticsEngine.computeDailyAverage(entries, "steps")).toBe(8_000);
    });
  });
});
