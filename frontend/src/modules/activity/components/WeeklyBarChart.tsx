/**
 * WeeklyBarChart — Animated bar chart for 7-day step history
 *
 * @module activity/components/WeeklyBarChart
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { spacing } from "@/src/theme";
import { useActivityColors } from "./theme";
import { ANIMATION } from "../constants";

interface WeeklyBarChartProps {
  labels: string[];
  data: number[];
  goal: number;
  color?: string;
  testID?: string;
}

export function WeeklyBarChart({
  labels,
  data,
  goal,
  color,
  testID,
}: WeeklyBarChartProps) {
  const theme = useActivityColors();
  const barColor = color ?? theme.steps;
  const maxValue = Math.max(...data, goal);
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Staggered bar animation
    const animations = barAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: ANIMATION.CHART_BAR_DURATION_MS,
        delay: i * ANIMATION.CHART_BAR_STAGGER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    );
    Animated.parallel(animations).start();
  }, [data, barAnims]);

  return (
    <View style={styles.container} testID={testID}>
      {/* Goal line */}
      <View
        style={[
          styles.goalLine,
          {
            bottom: `${Math.min(100, (goal / maxValue) * 100)}%`,
            borderColor: theme.goalReached + "60",
          },
        ]}
      >
        <Text style={[styles.goalLabel, { color: theme.goalReached }]}>
          {(goal / 1000).toFixed(0)}k
        </Text>
      </View>

      {/* Bars */}
      <View style={styles.barsRow}>
        {data.map((value, i) => {
          const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const reachedGoal = value >= goal;
          const animatedHeight = barAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", `${heightPct}%`],
          });

          return (
            <View key={labels[i] ?? i} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: animatedHeight,
                      backgroundColor: reachedGoal ? theme.goalReached : barColor,
                      borderRadius: 4,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barLabel,
                  {
                    color: reachedGoal ? theme.goalReached : theme.textTertiary,
                    fontWeight: reachedGoal ? "700" : "500",
                  },
                ]}
              >
                {labels[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 160,
    position: "relative",
  },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
    zIndex: 1,
  },
  goalLabel: {
    position: "absolute",
    right: 0,
    top: -14,
    fontSize: 10,
    fontWeight: "600",
  },
  barsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingBottom: spacing.xl,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    maxWidth: 32,
  },
  bar: {
    width: "100%",
    minHeight: 4,
  },
  barLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
