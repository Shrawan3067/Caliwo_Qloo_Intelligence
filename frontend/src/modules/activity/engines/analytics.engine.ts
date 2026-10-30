/**
 * Analytics Engine
 *
 * Pure functions that compute moving averages, trend scores, consistency
 * scores, personal records, heatmaps, and goal predictions from
 * historical activity data.
 *
 * Optimized for large datasets — all computations are O(n) single-pass
 * where possible.
 *
 * @module activity/engines/analytics
 */

import type {
  DailyActivity,
  ActivityAnalytics,
  MovingAveragePoint,
  PersonalRecord,
  HeatmapCell,
  WeeklyAggregate,
  AggregatedStats,
  ActivityMetricId,
} from "../types";

// ─── Full Analytics Report ───────────────────────────────────────────────────

/**
 * Compute a complete analytics report from historical data.
 *
 * @param entries — daily entries sorted by date ascending
 * @param goal — daily step goal
 */
export function computeAnalytics(
  entries: readonly DailyActivity[],
  goal: number,
): ActivityAnalytics {
  if (entries.length === 0) {
    return createEmptyAnalytics();
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const dailyAverage = computeDailyAverage(sorted, "steps");
  const weeklyAverage = computeWeeklyAverage(sorted, "steps");
  const monthlyAverage = computeMonthlyAverage(sorted, "steps");
  const movingAverage7Day = computeMovingAverage(sorted, 7);
  const movingAverage30Day = computeMovingAverage(sorted, 30);
  const trendScore = computeTrendScore(sorted);
  const consistencyScore = computeConsistencyScore(sorted, goal);
  const activeDayPercentage = computeActiveDayPercentage(sorted, goal);
  const bestDay = findBestDay(sorted);
  const bestWeek = findBestWeek(sorted);
  const personalRecords = detectPersonalRecords(sorted);
  const monthlyHeatmap = generateHeatmap(sorted, goal);
  const goalPrediction = predictGoalCompletion(sorted, goal);

  return {
    dailyAverage,
    weeklyAverage,
    monthlyAverage,
    movingAverage7Day,
    movingAverage30Day,
    trendScore,
    consistencyScore,
    activeDayPercentage,
    bestDay,
    bestWeek,
    personalRecords,
    monthlyHeatmap,
    goalPredictionDate: goalPrediction.date,
    goalPredictionStepsRemaining: goalPrediction.stepsRemaining,
  };
}

// ─── Averages ────────────────────────────────────────────────────────────────

/**
 * Compute daily average for a metric.
 */
export function computeDailyAverage(
  entries: readonly DailyActivity[],
  metric: "steps" | "caloriesActive" | "distanceTotalMeters",
): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, e) => sum + (e[metric] ?? 0), 0);
  return Math.round(total / entries.length);
}

/**
 * Compute weekly average steps (last 4 weeks).
 */
export function computeWeeklyAverage(
  entries: readonly DailyActivity[],
  metric: "steps" | "caloriesActive" | "distanceTotalMeters",
): number {
  if (entries.length === 0) return 0;
  const last28 = entries.slice(-28);
  const total = last28.reduce((sum, e) => sum + (e[metric] ?? 0), 0);
  const weeks = Math.max(1, Math.ceil(last28.length / 7));
  return Math.round(total / weeks);
}

/**
 * Compute monthly average steps.
 */
export function computeMonthlyAverage(
  entries: readonly DailyActivity[],
  metric: "steps" | "caloriesActive" | "distanceTotalMeters",
): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, e) => sum + (e[metric] ?? 0), 0);
  const months = Math.max(1, Math.ceil(entries.length / 30));
  return Math.round(total / months);
}

// ─── Moving Averages ─────────────────────────────────────────────────────────

/**
 * Compute N-day moving average for step counts.
 * Returns one data point per day in the input.
 */
export function computeMovingAverage(
  entries: readonly DailyActivity[],
  windowDays: number,
): MovingAveragePoint[] {
  if (entries.length === 0) return [];

  const result: MovingAveragePoint[] = [];
  let windowSum = 0;

  for (let i = 0; i < entries.length; i++) {
    windowSum += entries[i].steps;

    if (i >= windowDays) {
      windowSum -= entries[i - windowDays].steps;
    }

    const windowSize = Math.min(i + 1, windowDays);
    result.push({
      date: entries[i].date,
      value: Math.round(windowSum / windowSize),
    });
  }

  return result;
}

// ─── Trend Score ─────────────────────────────────────────────────────────────

/**
 * Compute a trend score from -100 (strong decline) to +100 (strong increase).
 *
 * Compares the most recent 7-day average against the previous 7-day average.
 */
export function computeTrendScore(
  entries: readonly DailyActivity[],
): number {
  if (entries.length < 14) return 0;

  const recent7 = entries.slice(-7);
  const previous7 = entries.slice(-14, -7);

  const recentAvg = recent7.reduce((s, e) => s + e.steps, 0) / 7;
  const previousAvg = previous7.reduce((s, e) => s + e.steps, 0) / 7;

  if (previousAvg === 0) return recentAvg > 0 ? 100 : 0;

  const change = ((recentAvg - previousAvg) / previousAvg) * 100;
  return Math.round(Math.max(-100, Math.min(100, change)));
}

// ─── Consistency Score ───────────────────────────────────────────────────────

/**
 * Compute consistency score from 0 (never hits goal) to 100 (always hits goal).
 *
 * Based on the last 30 days.
 */
export function computeConsistencyScore(
  entries: readonly DailyActivity[],
  goal: number,
): number {
  const last30 = entries.slice(-30);
  if (last30.length === 0) return 0;

  const daysGoalMet = last30.filter((e) => e.steps >= goal).length;
  return Math.round((daysGoalMet / last30.length) * 100);
}

/**
 * Compute active day percentage.
 */
export function computeActiveDayPercentage(
  entries: readonly DailyActivity[],
  goal: number,
): number {
  if (entries.length === 0) return 0;
  const active = entries.filter((e) => e.steps >= goal).length;
  return Math.round((active / entries.length) * 100);
}

// ─── Best Day / Best Week ────────────────────────────────────────────────────

/**
 * Find the day with the highest step count.
 */
export function findBestDay(
  entries: readonly DailyActivity[],
): DailyActivity | null {
  if (entries.length === 0) return null;
  return entries.reduce((best, e) => (e.steps > best.steps ? e : best));
}

/**
 * Find the best week (highest total steps).
 */
export function findBestWeek(
  entries: readonly DailyActivity[],
): WeeklyAggregate | null {
  if (entries.length < 7) return null;

  const weeklyAggs = computeWeeklyAggregates(entries, 10_000);
  if (weeklyAggs.length === 0) return null;

  return weeklyAggs.reduce((best, w) =>
    w.totalSteps > best.totalSteps ? w : best,
  );
}

// ─── Weekly Aggregates ───────────────────────────────────────────────────────

/**
 * Aggregate daily entries into weekly buckets.
 */
export function computeWeeklyAggregates(
  entries: readonly DailyActivity[],
  goal: number,
): WeeklyAggregate[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const aggregates: WeeklyAggregate[] = [];

  for (let i = 0; i < sorted.length; i += 7) {
    const weekEntries = sorted.slice(i, i + 7);
    if (weekEntries.length === 0) continue;

    const totalSteps = weekEntries.reduce((s, e) => s + e.steps, 0);
    const averageSteps = Math.round(totalSteps / weekEntries.length);
    const daysGoalReached = weekEntries.filter((e) => e.steps >= goal).length;

    // Compute ISO week number
    const startDate = new Date(weekEntries[0].date + "T00:00:00");
    const weekNumber = getISOWeekNumber(startDate);

    aggregates.push({
      weekNumber,
      startDate: weekEntries[0].date,
      endDate: weekEntries[weekEntries.length - 1].date,
      totalSteps,
      averageSteps,
      daysGoalReached,
    });
  }

  return aggregates;
}

// ─── Aggregated Stats ────────────────────────────────────────────────────────

/**
 * Compute aggregated statistics from a set of daily entries.
 */
export function computeAggregatedStats(
  entries: readonly DailyActivity[],
  goal: number,
): AggregatedStats {
  if (entries.length === 0) {
    return {
      totalSteps: 0,
      averageSteps: 0,
      highestSteps: 0,
      lowestSteps: 0,
      totalDistanceMeters: 0,
      averageDistanceMeters: 0,
      totalActiveCalories: 0,
      averageActiveCalories: 0,
      totalWorkoutMinutes: 0,
      totalFlightsClimbed: 0,
      daysGoalReached: 0,
      totalDays: 0,
      activeDayPercentage: 0,
    };
  }

  let totalSteps = 0;
  let highestSteps = 0;
  let lowestSteps = Infinity;
  let totalDistance = 0;
  let totalCalories = 0;
  let totalWorkout = 0;
  let totalFlights = 0;
  let daysGoalReached = 0;

  for (const entry of entries) {
    totalSteps += entry.steps;
    totalDistance += entry.distanceTotalMeters;
    totalCalories += entry.caloriesActive;
    totalWorkout += entry.workoutDurationMinutes;
    totalFlights += entry.flightsClimbed;

    if (entry.steps > highestSteps) highestSteps = entry.steps;
    if (entry.steps < lowestSteps) lowestSteps = entry.steps;
    if (entry.steps >= goal) daysGoalReached++;
  }

  const count = entries.length;

  return {
    totalSteps,
    averageSteps: Math.round(totalSteps / count),
    highestSteps,
    lowestSteps: lowestSteps === Infinity ? 0 : lowestSteps,
    totalDistanceMeters: Math.round(totalDistance),
    averageDistanceMeters: Math.round(totalDistance / count),
    totalActiveCalories: Math.round(totalCalories),
    averageActiveCalories: Math.round(totalCalories / count),
    totalWorkoutMinutes: Math.round(totalWorkout),
    totalFlightsClimbed: Math.round(totalFlights),
    daysGoalReached,
    totalDays: count,
    activeDayPercentage: Math.round((daysGoalReached / count) * 100),
  };
}

// ─── Personal Records ────────────────────────────────────────────────────────

/**
 * Detect personal records across all metrics from historical data.
 */
export function detectPersonalRecords(
  entries: readonly DailyActivity[],
): PersonalRecord[] {
  if (entries.length === 0) return [];

  const records: Map<ActivityMetricId, PersonalRecord> = new Map();

  const metricExtractors: { id: ActivityMetricId; extract: (e: DailyActivity) => number }[] = [
    { id: "steps", extract: (e) => e.steps },
    { id: "distance_walking", extract: (e) => e.distanceTotalMeters },
    { id: "calories_active", extract: (e) => e.caloriesActive },
    { id: "flights_climbed", extract: (e) => e.flightsClimbed },
    { id: "workout_duration", extract: (e) => e.workoutDurationMinutes },
  ];

  for (const { id, extract } of metricExtractors) {
    let bestValue = 0;
    let bestDate = "";
    let previousBest = 0;

    for (const entry of entries) {
      const value = extract(entry);
      if (value > bestValue) {
        previousBest = bestValue;
        bestValue = value;
        bestDate = entry.date;
      }
    }

    if (bestValue > 0) {
      records.set(id, {
        metric: id,
        value: bestValue,
        date: bestDate,
        previousBest,
        isNew: false, // Historical detection, not live
      });
    }
  }

  return Array.from(records.values());
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

/**
 * Generate a monthly heatmap from daily entries.
 */
export function generateHeatmap(
  entries: readonly DailyActivity[],
  goal: number,
): HeatmapCell[] {
  if (entries.length === 0) return [];

  const maxSteps = entries.reduce((max, e) => Math.max(max, e.steps), 1);

  return entries.map((entry) => ({
    date: entry.date,
    intensity: Math.min(1, entry.steps / maxSteps),
    steps: entry.steps,
    goalReached: entry.steps >= goal,
  }));
}

// ─── Goal Prediction ─────────────────────────────────────────────────────────

/**
 * Predict if/when the user will reach today's goal based on historical pace.
 */
function predictGoalCompletion(
  entries: readonly DailyActivity[],
  goal: number,
): { date: string | null; stepsRemaining: number } {
  if (entries.length === 0) {
    return { date: null, stepsRemaining: goal };
  }

  const today = entries[entries.length - 1];
  if (!today) return { date: null, stepsRemaining: goal };

  const remaining = Math.max(0, goal - today.steps);
  if (remaining === 0) return { date: null, stepsRemaining: 0 };

  // Use 7-day average pace
  const last7 = entries.slice(-7);
  const avgDaily = last7.reduce((s, e) => s + e.steps, 0) / last7.length;

  if (avgDaily <= 0) return { date: null, stepsRemaining: remaining };

  const daysNeeded = Math.ceil(remaining / avgDaily);
  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + daysNeeded);

  const y = predictedDate.getFullYear();
  const m = String(predictedDate.getMonth() + 1).padStart(2, "0");
  const d = String(predictedDate.getDate()).padStart(2, "0");

  return { date: `${y}-${m}-${d}`, stepsRemaining: remaining };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createEmptyAnalytics(): ActivityAnalytics {
  return {
    dailyAverage: 0,
    weeklyAverage: 0,
    monthlyAverage: 0,
    movingAverage7Day: [],
    movingAverage30Day: [],
    trendScore: 0,
    consistencyScore: 0,
    activeDayPercentage: 0,
    bestDay: null,
    bestWeek: null,
    personalRecords: [],
    monthlyHeatmap: [],
    goalPredictionDate: null,
    goalPredictionStepsRemaining: 0,
  };
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
