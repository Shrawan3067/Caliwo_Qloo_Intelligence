/**
 * StreakBadge — Compact streak indicator with fire animation
 *
 * @module activity/components/StreakBadge
 */

import React, { useEffect, useRef } from "react";
import { Text, StyleSheet, Animated, Easing } from "react-native";
import { radius } from "@/src/theme";
import { useActivityColors } from "./theme";

interface StreakBadgeProps {
  /** Current streak count */
  currentStreak: number;
  /** Whether to show the fire animation */
  animated?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  testID?: string;
}

export function StreakBadge({
  currentStreak,
  animated = true,
  size = "md",
  testID,
}: StreakBadgeProps) {
  const theme = useActivityColors();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isActive = currentStreak > 0;
  const isOnFire = currentStreak >= 7;
  const isLegendary = currentStreak >= 30;

  // Pulse animation for active streaks
  useEffect(() => {
    if (!animated || !isActive) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [animated, isActive, pulseAnim]);

  const sizeConfig = SIZE_MAP[size];
  const emoji = isLegendary ? "💎" : isOnFire ? "🔥" : isActive ? "✨" : "❄️";
  const bgColor = isActive ? theme.streakFireLight : theme.surfaceBg;
  const textColor = isActive ? theme.streakFire : theme.textTertiary;

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor: isActive ? theme.streakFire : theme.border,
          borderWidth: isOnFire ? 1.5 : 1,
          paddingHorizontal: sizeConfig.px,
          paddingVertical: sizeConfig.py,
          transform: [{ scale: isOnFire ? pulseAnim : 1 }],
        },
      ]}
      testID={testID}
      accessibilityLabel={`${currentStreak} day streak${isOnFire ? ", on fire!" : ""}`}
    >
      <Text style={{ fontSize: sizeConfig.emoji }}>{emoji}</Text>
      <Text style={[styles.count, { color: textColor, fontSize: sizeConfig.font }]}>
        {currentStreak}
      </Text>
      {size !== "sm" && (
        <Text style={[styles.label, { color: textColor, fontSize: sizeConfig.labelFont }]}>
          {currentStreak === 1 ? "day" : "days"}
        </Text>
      )}
    </Animated.View>
  );
}

const SIZE_MAP = {
  sm: { px: 8, py: 4, font: 14, labelFont: 9, emoji: 12 },
  md: { px: 12, py: 6, font: 18, labelFont: 10, emoji: 16 },
  lg: { px: 16, py: 8, font: 24, labelFont: 12, emoji: 20 },
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    gap: 4,
  },
  count: {
    fontWeight: "800",
  },
  label: {
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
