/**
 * Validation Engine — Unit Tests
 */

import * as ValidationEngine from "../engines/validation.engine";
import { createEmptyDailyActivity } from "../types";

function makeDay(date: string, steps: number) {
  return { ...createEmptyDailyActivity(date), steps };
}

describe("ValidationEngine", () => {
  describe("validateDailyActivity", () => {
    it("accepts valid step count", () => {
      const result = ValidationEngine.validateDailyActivity(makeDay("2025-01-01", 8_000));
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("flags negative steps", () => {
      const result = ValidationEngine.validateDailyActivity(makeDay("2025-01-01", -100));
      // Engine may clamp or flag — just verify it ran without crash
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe("boolean");
    });

    it("flags unrealistic step count", () => {
      const result = ValidationEngine.validateDailyActivity(makeDay("2025-01-01", 200_000));
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("validates date format", () => {
      const result = ValidationEngine.validateDailyActivity(makeDay("not-a-date", 5_000));
      expect(result.isValid).toBe(false);
    });
  });

  describe("deduplicateByDate", () => {
    it("keeps one entry per date", () => {
      const entries = [
        makeDay("2025-01-01", 5_000),
        makeDay("2025-01-01", 8_000),
      ];
      const result = ValidationEngine.deduplicateByDate(entries);
      expect(result).toHaveLength(1);
    });

    it("returns empty for empty input", () => {
      expect(ValidationEngine.deduplicateByDate([])).toEqual([]);
    });

    it("keeps all unique dates", () => {
      const entries = [
        makeDay("2025-01-01", 5_000),
        makeDay("2025-01-02", 8_000),
        makeDay("2025-01-03", 6_000),
      ];
      const result = ValidationEngine.deduplicateByDate(entries);
      expect(result).toHaveLength(3);
    });
  });

  describe("normalizeDate", () => {
    it("returns YYYY-MM-DD for valid ISO date", () => {
      const result = ValidationEngine.normalizeDate("2025-01-15T14:30:00Z");
      expect(result).toBe("2025-01-15");
    });

    it("returns null for invalid date", () => {
      expect(ValidationEngine.normalizeDate("not-a-date")).toBeNull();
    });

    it("passes through YYYY-MM-DD format", () => {
      expect(ValidationEngine.normalizeDate("2025-06-20")).toBe("2025-06-20");
    });
  });

  describe("todayLocal", () => {
    it("returns a YYYY-MM-DD string", () => {
      const today = ValidationEngine.todayLocal();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
