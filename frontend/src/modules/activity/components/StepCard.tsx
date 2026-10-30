/**
 * StepCard — Hero card showing today's step count with progress ring
 *
 * @module activity/components/StepCard
 */

import React from "react";
import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "@/src/theme";
import { AnimatedRing } from "./AnimatedRing";
import { useActivityColors } from "./theme";
import type { GoalProgress } from "../types";

interface StepCardProps {
  steps: number;
  goal: number;
  goalProgress: GoalProgress;
  distance: number;
  calories: number;
  flights: number;
  isSyncing?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function StepCard({
  steps,
  goal,
  goalProgress,
  distance,
  calories,
  flights,
  isSyncing,
  onPress,
  testID,
}: StepCardProps) {
  const theme = useActivityColors();

  const distKm = (distance / 1_000).toFixed(1);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.cardBg,
          borderColor: goalProgress.completed ? theme.goalReached : theme.border,
          borderWidth: goalProgress.completed ? 1.5 : 1,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Steps today: ${steps.toLocaleString()} of ${goal.toLocaleString()}`}
    >
      {/* Sync indicator */}
      {isSyncing && (
        <View style={[styles.syncBadge, { backgroundColor: theme.info }]}>
          <Ionicons name="sync" size={10} color="#FFFFFF" />
        </View>
      )}

      <View style={styles.ringRow}>
        <AnimatedRing
          progress={goalProgress.percentage / 100}
          size={140}
          strokeWidth={12}
          color={goalProgress.completed ? theme.goalReached : theme.steps}
          value={steps.toLocaleString()}
          label="Steps"
        />

        <View style={styles.metricsColumn}>
          <MetricRow
            icon="walk-outline"
            label="Distance"
            value={`${distKm} km`}
            color={theme.distance}
            theme={theme}
          />
          <MetricRow
            icon="flame-outline"
            label="Calories"
            value={`${calories}`}
            color={theme.calories}
            theme={theme}
          />
          <MetricRow
            icon="trending-up-outline"
            label="Flights"
            value={`${flights}`}
            color={theme.flights}
            theme={theme}
          />
        </View>
      </View>

      {/* Goal progress bar */}
      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: goalProgress.completed ? theme.goalReached : theme.steps,
                width: `${Math.min(100, goalProgress.percentage)}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {goalProgress.completed
            ? "🎉 Goal reached!"
            : `${goalProgress.remaining.toLocaleString()} to go`}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricRow({
  icon,
  label,
  value,
  color,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  theme: ReturnType<typeof useActivityColors>;
}) {
  return (
    <View style={styles.metricRow}>
      <Ionicons name={icon} size={16} color={color} />
      <View style={styles.metricText}>
        <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const shadow = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
  default: {},
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow,
  },
  syncBadge: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  metricsColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metricText: {
    flex: 1,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressRow: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
