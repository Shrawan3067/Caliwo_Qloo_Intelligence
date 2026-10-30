/**
 * useActivityCharts Hook
 *
 * Transforms activity data into chart-ready formats for visualization.
 * Supports bar, line, heatmap, and ring chart data shapes.
 *
 * @module activity/hooks/useActivityCharts
 */

import { useMemo } from "react";
import { useActivityStore } from "../store/activity.store";

// ─── Chart Color Palette ─────────────────────────────────────────────────────

const CHART_COLORS = {
  steps: "#4F8CFF",
  distance: "#34D399",
  calories: "#F97316",
  flights: "#A78BFA",
  workout: "#EC4899",
  goal: "#10B981",
  average: "#6366F1",
  text: "#94A3B8",
  grid: "#1E293B",
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BarChartData {
  labels: string[];
  datasets: {
    data: number[];
    color: string;
    label: string;
  }[];
}

export interface LineChartData {
  labels: string[];
  values: number[];
  color: string;
}

export interface RingChartData {
  progress: number; // 0–1
  current: number;
  target: number;
  color: string;
  label: string;
}

export interface HeatmapData {
  cells: {
    date: string;
    intensity: number; // 0–1
    value: number;
    goalReached: boolean;
  }[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook that produces chart-ready data structures from store state.
 */
export function useActivityCharts() {
  const todayData = useActivityStore((s) => s.todayData);
  const weeklyData = useActivityStore((s) => s.weeklyData);
  const monthlyData = useActivityStore((s) => s.monthlyData);
  const goalConfig = useActivityStore((s) => s.goalConfig);
  const goalProgress = useActivityStore((s) => s.goalProgress);
  const analytics = useActivityStore((s) => s.analytics);

  // ── Step Progress Ring ──
  const stepRing = useMemo<RingChartData>(() => ({
    progress: Math.min(1, goalProgress.percentage / 100),
    current: todayData.steps,
    target: goalConfig.dailySteps,
    color: CHART_COLORS.steps,
    label: "Steps",
  }), [goalProgress, todayData.steps, goalConfig.dailySteps]);

  // ── Calorie Progress Ring ──
  const calorieRing = useMemo<RingChartData>(() => ({
    progress: Math.min(1, todayData.caloriesActive / Math.max(1, goalConfig.dailyActiveCalories)),
    current: todayData.caloriesActive,
    target: goalConfig.dailyActiveCalories,
    color: CHART_COLORS.calories,
    label: "Active Cal",
  }), [todayData.caloriesActive, goalConfig.dailyActiveCalories]);

  // ── Distance Progress Ring ──
  const distanceRing = useMemo<RingChartData>(() => ({
    progress: Math.min(1, todayData.distanceTotalMeters / Math.max(1, goalConfig.dailyDistanceMeters)),
    current: Math.round(todayData.distanceTotalMeters),
    target: goalConfig.dailyDistanceMeters,
    color: CHART_COLORS.distance,
    label: "Distance (m)",
  }), [todayData.distanceTotalMeters, goalConfig.dailyDistanceMeters]);

  // ── Hourly Step Bar Chart ──
  const hourlyBarChart = useMemo<BarChartData>(() => {
    const breakdown = todayData.hourlyBreakdown;
    const currentHour = new Date().getHours();

    return {
      labels: breakdown.slice(0, currentHour + 1).map((h) => `${h.hour}`),
      datasets: [
        {
          data: breakdown.slice(0, currentHour + 1).map((h) => h.steps),
          color: CHART_COLORS.steps,
          label: "Steps",
        },
      ],
    };
  }, [todayData.hourlyBreakdown]);

  // ── Weekly Bar Chart ──
  const weeklyBarChart = useMemo<BarChartData | null>(() => {
    if (!weeklyData?.entries?.length) return null;

    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return {
      labels: weeklyData.entries.map((e, i) => {
        const date = new Date(e.date + "T00:00:00");
        return dayLabels[date.getDay() === 0 ? 6 : date.getDay() - 1] ?? `D${i + 1}`;
      }),
      datasets: [
        {
          data: weeklyData.entries.map((e) => e.steps),
          color: CHART_COLORS.steps,
          label: "Steps",
        },
      ],
    };
  }, [weeklyData?.entries]);

  // ── Monthly Line Chart ──
  const monthlyLineChart = useMemo<LineChartData | null>(() => {
    if (!monthlyData?.entries?.length) return null;

    return {
      labels: monthlyData.entries.map((e) => e.date.slice(-2)), // Day of month
      values: monthlyData.entries.map((e) => e.steps),
      color: CHART_COLORS.steps,
    };
  }, [monthlyData?.entries]);

  // ── Moving Average Line Chart ──
  const movingAverageChart = useMemo<LineChartData | null>(() => {
    if (!analytics?.movingAverage7Day?.length) return null;

    return {
      labels: analytics.movingAverage7Day.map((p) => p.date.slice(-2)),
      values: analytics.movingAverage7Day.map((p) => p.value),
      color: CHART_COLORS.average,
    };
  }, [analytics?.movingAverage7Day]);

  // ── Monthly Heatmap ──
  const heatmapData = useMemo<HeatmapData | null>(() => {
    if (!analytics?.monthlyHeatmap?.length) return null;

    return {
      cells: analytics.monthlyHeatmap.map((cell) => ({
        date: cell.date,
        intensity: cell.intensity,
        value: cell.steps,
        goalReached: cell.goalReached,
      })),
    };
  }, [analytics?.monthlyHeatmap]);

  return {
    stepRing,
    calorieRing,
    distanceRing,
    hourlyBarChart,
    weeklyBarChart,
    monthlyLineChart,
    movingAverageChart,
    heatmapData,
    colors: CHART_COLORS,
  };
}
