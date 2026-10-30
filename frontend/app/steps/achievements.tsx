/**
 * Achievements Gallery Screen
 *
 * Displays all achievements categorized by type, level progress, XP totals,
 * and locked/unlocked states with dark mode support.
 */

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "@/src/theme";
import { useActivityAchievements } from "@/src/modules/activity/hooks";
import { AchievementCard, useActivityColors } from "@/src/modules/activity/components";
import type { AchievementCategory } from "@/src/modules/activity/types";

const CATEGORIES: { id: AchievementCategory | "all"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "all", label: "All", icon: "ribbon-outline" },
  { id: "steps", label: "Steps", icon: "footsteps-outline" },
  { id: "streaks", label: "Streaks", icon: "flame-outline" },
  { id: "distance", label: "Distance", icon: "walk-outline" },
  { id: "calories", label: "Calories", icon: "heart-outline" },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const theme = useActivityColors();
  const { achievements, levelInfo, unlockedCount, totalCount } = useActivityAchievements();
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | "all">("all");

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === "all") return achievements;
    return achievements.filter((a) => a.definition?.category === selectedCategory);
  }, [achievements, selectedCategory]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.surfaceBg }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky Header */}
      <View style={[styles.header, { borderBottomColor: theme.divider }]} testID="achievements-header">
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="achievements-back-btn">
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Achievements</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Level & XP Header ── */}
        <View style={[styles.levelCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.levelRow}>
            <View style={[styles.levelBadge, { backgroundColor: theme.steps }]}>
              <Text style={styles.levelNumber}>{levelInfo.level}</Text>
            </View>
            <View style={styles.levelTextCol}>
              <Text style={[styles.levelTitle, { color: theme.textPrimary }]}>{levelInfo.title}</Text>
              <Text style={[styles.xpSub, { color: theme.textSecondary }]}>
                {levelInfo.totalXP.toLocaleString()} Total XP
              </Text>
            </View>
            <View style={styles.unlockedCountPill}>
              <Text style={[styles.unlockedCountText, { color: theme.steps }]}>
                {unlockedCount}/{totalCount}
              </Text>
            </View>
          </View>

          {/* Level Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.fillBar,
                {
                  width: `${Math.round(levelInfo.progressToNextLevel * 100)}%`,
                  backgroundColor: theme.steps,
                },
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={[styles.metaText, { color: theme.textTertiary }]}>
              Level {levelInfo.level}
            </Text>
            <Text style={[styles.metaText, { color: theme.textTertiary }]}>
              {levelInfo.xpForNextLevel > 0
                ? `${levelInfo.xpForNextLevel - levelInfo.xpInCurrentLevel} XP to Level ${levelInfo.level + 1}`
                : "Max Level!"}
            </Text>
          </View>
        </View>

        {/* ── Category Filters ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isActive ? theme.steps : theme.cardBg,
                    borderColor: isActive ? theme.steps : theme.border,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                testID={`category-chip-${cat.id}`}
              >
                <Ionicons
                  name={cat.icon}
                  size={16}
                  color={isActive ? "#FFFFFF" : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? "#FFFFFF" : theme.textPrimary },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Achievement Cards Grid ── */}
        <View style={styles.grid}>
          {filteredAchievements.map((item) => (
            <AchievementCard key={item.id} achievement={item} testID={`achievement-card-${item.id}`} />
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
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
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  levelCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadow,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  levelNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  levelTextCol: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  xpSub: {
    fontSize: 13,
    fontWeight: "600",
  },
  unlockedCountPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(168, 85, 247, 0.1)",
  },
  unlockedCountText: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  fillBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  categoryRow: {
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    gap: spacing.md,
  },
});
