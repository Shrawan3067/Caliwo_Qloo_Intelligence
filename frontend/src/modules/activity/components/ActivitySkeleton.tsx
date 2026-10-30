/**
 * ActivitySkeleton — Loading skeleton placeholders
 *
 * @module activity/components/ActivitySkeleton
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { radius, spacing } from "@/src/theme";
import { useActivityColors } from "./theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function Skeleton({ width = "100%", height = 16, borderRadius: br = 8, style }: SkeletonProps) {
  const theme = useActivityColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: br,
          backgroundColor: theme.skeletonBase,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Full activity screen skeleton layout.
 */
export function ActivityScreenSkeleton() {
  const theme = useActivityColors();

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceBg }]}>
      {/* Step card skeleton */}
      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <View style={styles.cardRow}>
          <Skeleton width={120} height={120} borderRadius={60} />
          <View style={styles.cardMetrics}>
            <Skeleton width="80%" height={14} />
            <Skeleton width="60%" height={14} />
            <Skeleton width="70%" height={14} />
          </View>
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <Skeleton height={6} borderRadius={3} />
        </View>
      </View>

      {/* Streak + Stats row */}
      <View style={styles.row}>
        <View style={[styles.smallCard, { backgroundColor: theme.cardBg, flex: 1 }]}>
          <Skeleton width={60} height={12} />
          <Skeleton width={40} height={24} borderRadius={4} />
        </View>
        <View style={[styles.smallCard, { backgroundColor: theme.cardBg, flex: 1 }]}>
          <Skeleton width={60} height={12} />
          <Skeleton width={40} height={24} borderRadius={4} />
        </View>
        <View style={[styles.smallCard, { backgroundColor: theme.cardBg, flex: 1 }]}>
          <Skeleton width={60} height={12} />
          <Skeleton width={40} height={24} borderRadius={4} />
        </View>
      </View>

      {/* Chart skeleton */}
      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <Skeleton width="50%" height={14} />
        <View style={styles.chartBars}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              width={24}
              height={40 + Math.random() * 60}
              borderRadius={4}
            />
          ))}
        </View>
      </View>

      {/* Achievement list skeleton */}
      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <Skeleton width="40%" height={14} />
        <View style={styles.achievementRow}>
          <Skeleton width={48} height={48} borderRadius={24} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="90%" height={10} />
          </View>
        </View>
        <View style={styles.achievementRow}>
          <Skeleton width={48} height={48} borderRadius={24} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="80%" height={10} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Compact step card skeleton.
 */
export function StepCardSkeleton() {
  const theme = useActivityColors();

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
      <View style={styles.cardRow}>
        <Skeleton width={100} height={100} borderRadius={50} />
        <View style={styles.cardMetrics}>
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={14} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  smallCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
  },
  cardMetrics: {
    flex: 1,
    gap: spacing.md,
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
    marginTop: spacing.md,
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
