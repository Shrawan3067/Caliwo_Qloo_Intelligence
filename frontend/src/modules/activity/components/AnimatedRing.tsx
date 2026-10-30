/**
 * AnimatedRing — Animated circular progress ring for activity metrics
 *
 * Features:
 * - Smooth spring animation on progress changes
 * - Configurable size, stroke, and colors
 * - Label/value/unit rendering inside ring
 * - Dark mode support via activity theme
 * - Accessible with proper labels
 *
 * @module activity/components/AnimatedRing
 */

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useActivityColors } from "./theme";
import { ANIMATION } from "../constants";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnimatedRingProps {
  /** Progress 0–1 */
  progress: number;
  /** Ring diameter in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Progress bar color */
  color?: string;
  /** Track color (behind progress) */
  trackColor?: string;
  /** Current value to display */
  value?: number | string;
  /** Label below value */
  label?: string;
  /** Unit after value */
  unit?: string;
  /** Whether to show percentage inside */
  showPercentage?: boolean;
  /** Accessibility label */
  accessibilityLabel?: string;
  testID?: string;
}

export function AnimatedRing({
  progress,
  size = 120,
  strokeWidth = 10,
  color,
  trackColor,
  value,
  label,
  unit,
  showPercentage = false,
  accessibilityLabel,
  testID,
}: AnimatedRingProps) {
  const theme = useActivityColors();
  const animValue = useRef(new Animated.Value(0)).current;

  const ringColor = color ?? theme.steps;
  const ringTrackColor = trackColor ?? theme.progressTrack;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: clampedProgress,
      duration: ANIMATION.RING_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, animValue]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const percentage = Math.round(clampedProgress * 100);
  const displayValue = showPercentage ? `${percentage}%` : value;
  const a11yLabel =
    accessibilityLabel ??
    `${label ?? "Progress"}: ${percentage}%${value != null ? `, ${value}${unit ?? ""}` : ""}`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={a11yLabel}
      accessibilityValue={{ min: 0, max: 100, now: percentage }}
      testID={testID}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.content}>
        {displayValue != null && (
          <Text
            style={[
              styles.value,
              { color: theme.textPrimary, fontSize: size > 100 ? 24 : 16 },
            ]}
            numberOfLines={1}
          >
            {displayValue}
            {unit && !showPercentage && (
              <Text style={[styles.unit, { color: theme.textTertiary }]}> {unit}</Text>
            )}
          </Text>
        )}
        {label && (
          <Text
            style={[styles.label, { color: theme.textSecondary, fontSize: size > 100 ? 12 : 10 }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontWeight: "800",
    textAlign: "center",
  },
  unit: {
    fontWeight: "600",
    fontSize: 12,
  },
  label: {
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
