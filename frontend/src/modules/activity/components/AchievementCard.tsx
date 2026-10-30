/**
 * AchievementCard — Single achievement display with tier-based styling
 *
 * @module activity/components/AchievementCard
 */

import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "@/src/theme";
import { useActivityColors } from "./theme";
import type { Achievement, AchievementDefinition } from "../types";

interface AchievementCardProps {
  achievement: Achievement & { definition: AchievementDefinition | null };
  onPress?: () => void;
  testID?: string;
}

export function AchievementCard({ achievement, onPress, testID }: AchievementCardProps) {
  const theme = useActivityColors();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const def = achievement.definition;

  const isUnlocked = achievement.unlocked;

  // Pop-in animation for newly unlocked
  useEffect(() => {
    if (isUnlocked && !achievement.acknowledged) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isUnlocked, achievement.acknowledged, scaleAnim]);

  const tierColor = isUnlocked
    ? getTierColor(def?.tier ?? "bronze", theme)
    : theme.achievementLocked;

  const icon = def?.icon ?? "trophy-outline";
  const title = def?.title ?? "Unknown";
  const description = def?.description ?? "";
  const xp = def?.xpReward ?? 0;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isUnlocked ? theme.cardBg : theme.surfaceBg,
            borderColor: isUnlocked ? tierColor : theme.border,
            borderWidth: isUnlocked ? 1.5 : 1,
            opacity: pressed ? 0.9 : isUnlocked ? 1 : 0.6,
          },
        ]}
        onPress={onPress}
        testID={testID}
        accessibilityLabel={`${title}: ${isUnlocked ? "Unlocked" : "Locked"}. ${description}`}
      >
        <View style={[styles.iconContainer, { backgroundColor: isUnlocked ? tierColor + "20" : theme.surfaceBg }]}>
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={24}
            color={isUnlocked ? tierColor : theme.achievementLocked}
          />
        </View>

        <View style={styles.content}>
          <Text
            style={[styles.title, { color: isUnlocked ? theme.textPrimary : theme.textTertiary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[styles.description, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {description}
          </Text>
          {isUnlocked && (
            <View style={styles.xpRow}>
              <Ionicons name="star" size={12} color={theme.xpBar} />
              <Text style={[styles.xpText, { color: theme.xpBar }]}>+{xp} XP</Text>
            </View>
          )}
        </View>

        {!isUnlocked && (
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={16} color={theme.achievementLocked} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function getTierColor(
  tier: string,
  theme: ReturnType<typeof useActivityColors>,
): string {
  switch (tier) {
    case "gold": return theme.achievementGold;
    case "silver": return theme.achievementSilver;
    case "bronze": return theme.achievementBronze;
    default: return theme.achievementBronze;
  }
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  xpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  xpText: {
    fontSize: 11,
    fontWeight: "700",
  },
  lockIcon: {
    padding: spacing.xs,
  },
});
