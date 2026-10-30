/**
 * Data Validation Engine
 *
 * Pure functions that validate, normalize, and sanitize activity records
 * before they are cached or synced. Handles duplicate detection,
 * impossible value rejection, timestamp normalization, timezone handling,
 * and multi-device deduplication.
 *
 * @module activity/engines/validation
 */

import type {
  DailyActivity,
  ValidationResult,
  ValidationIssue,
  ValidationThresholds,
  ActivitySource,
} from "../types";
import { SOURCE_QUALITY } from "../types";
import { VALIDATION_THRESHOLDS } from "../constants";

// ─── Record Validation ───────────────────────────────────────────────────────

/**
 * Validate and clean a single DailyActivity record.
 * Returns a ValidationResult with cleaned data and any issues found.
 */
export function validateDailyActivity(
  record: DailyActivity,
  thresholds: ValidationThresholds = VALIDATION_THRESHOLDS,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let isValid = true;

  // Validate date format (YYYY-MM-DD)
  if (!isValidDateString(record.date)) {
    issues.push({
      field: "date",
      severity: "error",
      message: `Invalid date format: "${record.date}"`,
      originalValue: record.date,
      correctedValue: null,
    });
    return { isValid: false, issues, cleanedData: null };
  }

  // Validate date is not in the future
  const recordDate = new Date(record.date + "T00:00:00");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  if (recordDate >= tomorrow) {
    issues.push({
      field: "date",
      severity: "error",
      message: "Date is in the future",
      originalValue: record.date,
      correctedValue: null,
    });
    return { isValid: false, issues, cleanedData: null };
  }

  // Start building cleaned data
  let cleaned = { ...record };

  // Validate and clamp steps
  const stepsResult = validateNumericField(
    "steps",
    record.steps,
    0,
    thresholds.maxStepsPerDay,
  );
  if (stepsResult.issue) {
    issues.push(stepsResult.issue);
    if (stepsResult.issue.severity === "error") isValid = false;
  }
  cleaned = { ...cleaned, steps: stepsResult.value };

  // Validate and clamp distance
  const distResult = validateNumericField(
    "distanceTotalMeters",
    record.distanceTotalMeters,
    0,
    thresholds.maxDistanceMetersPerDay,
  );
  if (distResult.issue) {
    issues.push(distResult.issue);
  }
  cleaned = {
    ...cleaned,
    distanceTotalMeters: distResult.value,
    distanceWalkingMeters: Math.min(record.distanceWalkingMeters, distResult.value),
    distanceRunningMeters: Math.min(record.distanceRunningMeters, distResult.value),
  };

  // Validate and clamp calories
  const calResult = validateNumericField(
    "caloriesActive",
    record.caloriesActive,
    0,
    thresholds.maxCaloriesPerDay,
  );
  if (calResult.issue) {
    issues.push(calResult.issue);
  }
  cleaned = {
    ...cleaned,
    caloriesActive: calResult.value,
    caloriesTotal: Math.min(record.caloriesTotal, thresholds.maxCaloriesPerDay),
  };

  // Validate flights climbed
  const flightsResult = validateNumericField(
    "flightsClimbed",
    record.flightsClimbed,
    0,
    thresholds.maxFlightsPerDay,
  );
  if (flightsResult.issue) {
    issues.push(flightsResult.issue);
  }
  cleaned = { ...cleaned, flightsClimbed: flightsResult.value };

  // Validate workout duration
  const workoutResult = validateNumericField(
    "workoutDurationMinutes",
    record.workoutDurationMinutes,
    0,
    thresholds.maxWorkoutMinutesPerDay,
  );
  if (workoutResult.issue) {
    issues.push(workoutResult.issue);
  }
  cleaned = { ...cleaned, workoutDurationMinutes: workoutResult.value };

  // Normalize timestamp
  if (!record.lastUpdated || isNaN(new Date(record.lastUpdated).getTime())) {
    const corrected = new Date().toISOString();
    issues.push({
      field: "lastUpdated",
      severity: "warning",
      message: "Invalid or missing lastUpdated timestamp, using current time",
      originalValue: record.lastUpdated,
      correctedValue: corrected,
    });
    cleaned = { ...cleaned, lastUpdated: corrected };
  }

  return { isValid, issues, cleanedData: cleaned };
}

// ─── Batch Validation ────────────────────────────────────────────────────────

/**
 * Validate an array of daily activity records.
 * Removes duplicates and invalid records, returns only valid ones.
 */
export function validateBatch(
  records: DailyActivity[],
  thresholds: ValidationThresholds = VALIDATION_THRESHOLDS,
): { valid: DailyActivity[]; issues: ValidationIssue[] } {
  const allIssues: ValidationIssue[] = [];
  const validRecords: DailyActivity[] = [];

  for (const record of records) {
    const result = validateDailyActivity(record, thresholds);
    allIssues.push(...result.issues);

    if (result.isValid && result.cleanedData) {
      validRecords.push(result.cleanedData);
    }
  }

  // Remove duplicates by date — keep highest quality source
  const deduped = deduplicateByDate(validRecords);

  return { valid: deduped, issues: allIssues };
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Deduplicate records by date. When multiple records exist for the same date,
 * keeps the one from the highest quality source. If sources are equal,
 * keeps the one with the highest step count (max-merge).
 */
export function deduplicateByDate(records: DailyActivity[]): DailyActivity[] {
  const dateMap = new Map<string, DailyActivity>();

  for (const record of records) {
    const existing = dateMap.get(record.date);
    if (!existing) {
      dateMap.set(record.date, record);
      continue;
    }

    // Compare source quality
    const existingQuality = SOURCE_QUALITY[existing.source] ?? 0;
    const newQuality = SOURCE_QUALITY[record.source] ?? 0;

    if (newQuality > existingQuality) {
      dateMap.set(record.date, record);
    } else if (newQuality === existingQuality && record.steps > existing.steps) {
      dateMap.set(record.date, record);
    }
  }

  // Return sorted by date ascending
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merge two DailyActivity records for the same date from different devices.
 * Uses max-merge strategy: take the highest value for each metric.
 * Prefers the highest quality source for metadata.
 */
export function mergeMultiDeviceRecords(
  a: DailyActivity,
  b: DailyActivity,
): DailyActivity {
  if (a.date !== b.date) {
    throw new Error(`Cannot merge records for different dates: ${a.date} vs ${b.date}`);
  }

  const qualityA = SOURCE_QUALITY[a.source] ?? 0;
  const qualityB = SOURCE_QUALITY[b.source] ?? 0;
  const primarySource: ActivitySource = qualityA >= qualityB ? a.source : b.source;

  return {
    date: a.date,
    steps: Math.max(a.steps, b.steps),
    distanceWalkingMeters: Math.max(a.distanceWalkingMeters, b.distanceWalkingMeters),
    distanceRunningMeters: Math.max(a.distanceRunningMeters, b.distanceRunningMeters),
    distanceTotalMeters: Math.max(a.distanceTotalMeters, b.distanceTotalMeters),
    flightsClimbed: Math.max(a.flightsClimbed, b.flightsClimbed),
    caloriesTotal: Math.max(a.caloriesTotal, b.caloriesTotal),
    caloriesActive: Math.max(a.caloriesActive, b.caloriesActive),
    workoutDurationMinutes: Math.max(a.workoutDurationMinutes, b.workoutDurationMinutes),
    // Merge exercise sessions, deduplicating by start time
    exerciseSessions: mergeExerciseSessions(a.exerciseSessions, b.exerciseSessions),
    // Take hourly breakdown from the higher quality source
    hourlyBreakdown: qualityA >= qualityB ? a.hourlyBreakdown : b.hourlyBreakdown,
    source: primarySource,
    lastUpdated: new Date().toISOString(),
    goalReached: Math.max(a.steps, b.steps) >= 0, // Will be set by caller
  };
}

// ─── Timestamp Normalization ─────────────────────────────────────────────────

/**
 * Normalize a date string to YYYY-MM-DD format.
 * Handles various input formats.
 */
export function normalizeDate(input: string): string | null {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  // ISO 8601 datetime — extract date part
  const isoMatch = /^(\d{4}-\d{2}-\d{2})T/.exec(input);
  if (isoMatch) return isoMatch[1];

  // Try parsing as Date
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) return null;

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Normalize timezone offset for consistent date computation.
 */
export function getTimezoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Get today's date in YYYY-MM-DD format in local timezone.
 */
export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T00:00:00");
  return !isNaN(parsed.getTime());
}

function validateNumericField(
  field: string,
  value: number,
  min: number,
  max: number,
): { value: number; issue: ValidationIssue | null } {
  if (typeof value !== "number" || isNaN(value)) {
    return {
      value: 0,
      issue: {
        field,
        severity: "warning",
        message: `${field} is not a valid number, defaulting to 0`,
        originalValue: value,
        correctedValue: 0,
      },
    };
  }

  if (value < min) {
    return {
      value: min,
      issue: {
        field,
        severity: "warning",
        message: `${field} (${value}) is below minimum (${min}), clamping`,
        originalValue: value,
        correctedValue: min,
      },
    };
  }

  if (value > max) {
    return {
      value: max,
      issue: {
        field,
        severity: "warning",
        message: `${field} (${value}) exceeds maximum (${max}), clamping to max`,
        originalValue: value,
        correctedValue: max,
      },
    };
  }

  return { value, issue: null };
}

function mergeExerciseSessions(
  a: readonly import("../types").ExerciseSession[],
  b: readonly import("../types").ExerciseSession[],
): import("../types").ExerciseSession[] {
  const merged = [...a];
  const existingStartTimes = new Set(a.map((s) => s.startTime));

  for (const session of b) {
    if (!existingStartTimes.has(session.startTime)) {
      merged.push(session);
    }
  }

  return merged.sort((x, y) => x.startTime.localeCompare(y.startTime));
}
