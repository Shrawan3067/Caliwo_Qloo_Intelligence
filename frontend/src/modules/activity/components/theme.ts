/**
 * Activity Theme Colors
 *
 * Extends the existing design system with activity-specific colors
 * that automatically adapt to light/dark mode.
 *
 * @module activity/components/theme
 */

import { useColorScheme } from "react-native";
import { colors } from "@/src/theme";

const lightColors = {
  // Backgrounds
  cardBg: "#FFFFFF",
  cardBgAlt: "#F8FAFC",
  surfaceBg: "#F1F5F9",
  sheetBg: "#FFFFFF",
  skeletonBase: "#E2E8F0",
  skeletonHighlight: "#F1F5F9",

  // Text
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textTertiary: colors.textTertiary,
  textInverse: "#FFFFFF",

  // Borders
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",

  // Activity-specific accent colors
  steps: "#4F8CFF",
  stepsLight: "#EBF2FF",
  distance: "#34D399",
  distanceLight: "#ECFDF5",
  calories: "#F97316",
  caloriesLight: "#FFF7ED",
  flights: "#A78BFA",
  flightsLight: "#F5F3FF",
  workout: "#EC4899",
  workoutLight: "#FDF2F8",

  // Progress & goals
  goalReached: "#10B981",
  goalReachedLight: "#ECFDF5",
  goalUnreached: "#94A3B8",
  progressTrack: "#F1F5F9",

  // Streaks
  streakFire: "#F97316",
  streakFireLight: "#FFF7ED",
  streakIce: "#60A5FA",
  streakIceLight: "#EFF6FF",

  // Achievements
  achievementGold: "#EAB308",
  achievementSilver: "#94A3B8",
  achievementBronze: "#D97706",
  achievementLocked: "#CBD5E1",

  // XP
  xpBar: "#8B5CF6",
  xpBarTrack: "#EDE9FE",

  // Charts
  chartGrid: "#F1F5F9",
  chartLabel: "#94A3B8",
  chartTooltipBg: "#1E293B",
  chartTooltipText: "#F8FAFC",

  // Status
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Shadows
  shadowColor: "#0F172A",
};

const darkColors = {
  // Backgrounds
  cardBg: "#1E293B",
  cardBgAlt: "#1A2332",
  surfaceBg: "#0F172A",
  sheetBg: "#1E293B",
  skeletonBase: "#334155",
  skeletonHighlight: "#475569",

  // Text
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textTertiary: "#64748B",
  textInverse: "#0F172A",

  // Borders
  border: "#334155",
  borderStrong: "#475569",
  divider: "#1E293B",

  // Activity-specific accent colors
  steps: "#60A5FA",
  stepsLight: "#1E3A5F",
  distance: "#34D399",
  distanceLight: "#064E3B",
  calories: "#FB923C",
  caloriesLight: "#431407",
  flights: "#C4B5FD",
  flightsLight: "#312E81",
  workout: "#F472B6",
  workoutLight: "#500724",

  // Progress & goals
  goalReached: "#34D399",
  goalReachedLight: "#064E3B",
  goalUnreached: "#475569",
  progressTrack: "#334155",

  // Streaks
  streakFire: "#FB923C",
  streakFireLight: "#431407",
  streakIce: "#60A5FA",
  streakIceLight: "#1E3A5F",

  // Achievements
  achievementGold: "#FACC15",
  achievementSilver: "#94A3B8",
  achievementBronze: "#F59E0B",
  achievementLocked: "#475569",

  // XP
  xpBar: "#A78BFA",
  xpBarTrack: "#312E81",

  // Charts
  chartGrid: "#1E293B",
  chartLabel: "#64748B",
  chartTooltipBg: "#F8FAFC",
  chartTooltipText: "#0F172A",

  // Status
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",

  // Shadows
  shadowColor: "#000000",
};

export type ActivityColors = typeof lightColors;

/**
 * Hook that returns activity-specific theme colors based on system color scheme.
 */
export function useActivityColors(): ActivityColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}

/**
 * Get activity colors for a specific scheme (non-hook, for StyleSheet creation).
 */
export function getActivityColors(scheme: "light" | "dark"): ActivityColors {
  return scheme === "dark" ? darkColors : lightColors;
}
