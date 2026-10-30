/**
 * Steps Dashboard Screen — Rewritten to use the Activity Module
 *
 * Replaces the old inline state/API pattern with Zustand store,
 * hooks, and pre-built components from the activity module.
 */

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "@/src/theme";

// Activity module — hooks & components
import {
  useActivitySync,
  useActivityGoal,
  useActivityStreak,
  useActivityCharts,
  useActivityStore,
} from "@/src/modules/activity/hooks";
import {
  PermissionGate,
  StepCard,
  StreakBadge,
  WeeklyBarChart,
  GoalSettingsSheet,
  ActivityScreenSkeleton,
  useActivityColors,
} from "@/src/modules/activity/components";

export default function StepsScreen() {
  const router = useRouter();
  const theme = useActivityColors();

  // ── Hooks ──
  const { isSyncing, isInitialized, onRefresh } = useActivitySync();
  const { goalConfig, goalProgress, isGoalReached, celebrationMessage } = useActivityGoal();
  const { currentStreak, longestStreak } = useActivityStreak();
  const { weeklyBarChart } = useActivityCharts();

  // ── Store selectors ──
  const todayData = useActivityStore((s) => s.todayData);
  const error = useActivityStore((s) => s.error);
  const clearError = useActivityStore((s) => s.clearError);
  const syncManual = useActivityStore((s) => s.syncManual);
  const selectPeriod = useActivityStore((s) => s.selectPeriod);
  const weeklyData = useActivityStore((s) => s.weeklyData);

  // ── Local UI state ──
  const [refreshing, setRefreshing] = useState(false);
  const [goalSheetVisible, setGoalSheetVisible] = useState(false);

  // Load weekly data on focus
  useFocusEffect(
    useCallback(() => {
      selectPeriod("weekly");
    }, [selectPeriod]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  // Loading state
  if (!isInitialized) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.surfaceBg }]} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityScreenSkeleton />
      </SafeAreaView>
    );
  }

  const distKm = (todayData.distanceTotalMeters / 1_000).toFixed(1);
  const weeklyStats = weeklyData?.stats;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.surfaceBg }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky Header */}
      <View style={[styles.header, { borderBottomColor: theme.divider }]} testID="steps-header">
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="steps-back-btn">
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Activity</Text>
        <TouchableOpacity
          onPress={() => router.push("/steps/settings")}
          style={styles.iconBtn}
          testID="steps-settings-btn"
        >
          <Ionicons name="settings-outline" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <PermissionGate testID="steps-permission-gate">
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.textPrimary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Streak Badge ── */}
          <View style={styles.streakRow}>
            <StreakBadge currentStreak={currentStreak} size="md" testID="steps-streak" />
            {longestStreak > 0 && (
              <View style={[styles.longestStreak, { backgroundColor: theme.cardBgAlt }]}>
                <Text style={[styles.longestLabel, { color: theme.textTertiary }]}>Best</Text>
                <Text style={[styles.longestValue, { color: theme.textPrimary }]}>{longestStreak}</Text>
              </View>
            )}
          </View>

          {/* ── Hero Step Card ── */}
          <StepCard
            steps={todayData.steps}
            goal={goalConfig.dailySteps}
            goalProgress={goalProgress}
            distance={todayData.distanceTotalMeters}
            calories={todayData.caloriesActive}
            flights={todayData.flightsClimbed}
            isSyncing={isSyncing}
            onPress={() => setGoalSheetVisible(true)}
            testID="steps-today-card"
          />

          {/* ── Celebration Banner ── */}
          {isGoalReached && celebrationMessage && (
            <View style={[styles.celebration, { backgroundColor: theme.goalReachedLight }]}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <Text style={[styles.celebrationText, { color: theme.goalReached }]}>
                {celebrationMessage}
              </Text>
            </View>
          )}

          {/* ── Quick Stats Row ── */}
          <View style={styles.quickStats}>
            <QuickStat
              icon="walk-outline"
              label="Distance"
              value={`${distKm} km`}
              color={theme.distance}
              theme={theme}
            />
            <QuickStat
              icon="flame-outline"
              label="Calories"
              value={`${todayData.caloriesActive}`}
              color={theme.calories}
              theme={theme}
            />
            <QuickStat
              icon="sync-outline"
              label="Sync"
              value={isSyncing ? "Syncing…" : "Synced"}
              color={isSyncing ? theme.info : theme.success}
              theme={theme}
              onPress={syncManual}
            />
          </View>

          {/* ── Weekly Chart ── */}
          {weeklyBarChart && (
            <View style={[styles.card, { backgroundColor: theme.cardBg }]} testID="steps-weekly-card">
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Last 7 Days</Text>
                {weeklyStats && (
                  <View
                    style={[
                      styles.trendPill,
                      {
                        backgroundColor:
                          (weeklyData?.trendVsPreviousWeekPct ?? 0) >= 0
                            ? theme.goalReachedLight
                            : "#FDECEC",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        (weeklyData?.trendVsPreviousWeekPct ?? 0) >= 0
                          ? "trending-up"
                          : "trending-down"
                      }
                      size={14}
                      color={
                        (weeklyData?.trendVsPreviousWeekPct ?? 0) >= 0 ? theme.goalReached : theme.error
                      }
                    />
                    <Text
                      style={[
                        styles.trendText,
                        {
                          color:
                            (weeklyData?.trendVsPreviousWeekPct ?? 0) >= 0
                              ? theme.goalReached
                              : theme.error,
                        },
                      ]}
                    >
                      {(weeklyData?.trendVsPreviousWeekPct ?? 0) >= 0 ? "+" : ""}
                      {Math.round(weeklyData?.trendVsPreviousWeekPct ?? 0)}%
                    </Text>
                  </View>
                )}
              </View>

              <WeeklyBarChart
                labels={weeklyBarChart.labels}
                data={weeklyBarChart.datasets[0].data}
                goal={goalConfig.dailySteps}
                testID="steps-weekly-chart"
              />

              {weeklyStats && (
                <View style={styles.statSummary}>
                  <SmallStat label="Average" value={weeklyStats.averageSteps.toLocaleString()} theme={theme} />
                  <SmallStat label="Highest" value={weeklyStats.highestSteps.toLocaleString()} theme={theme} />
                  <SmallStat label="Total" value={weeklyStats.totalSteps.toLocaleString()} theme={theme} />
                </View>
              )}
            </View>
          )}

          {/* ── Navigation Links ── */}
          <View style={styles.linkRow}>
            <TouchableOpacity
              style={[styles.linkBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => router.push("/steps/history")}
              testID="steps-history-btn"
            >
              <Ionicons name="calendar-outline" size={18} color={theme.textPrimary} />
              <Text style={[styles.linkBtnText, { color: theme.textPrimary }]}>Full History</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* ── Error Banner ── */}
          {error && (
            <TouchableOpacity
              style={[styles.errorBanner, { backgroundColor: theme.error + "15" }]}
              onPress={clearError}
            >
              <Ionicons name="warning-outline" size={16} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              <Ionicons name="close-circle" size={16} color={theme.error} />
            </TouchableOpacity>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </PermissionGate>

      {/* ── Goal Settings Sheet ── */}
      <GoalSettingsSheet
        visible={goalSheetVisible}
        onClose={() => setGoalSheetVisible(false)}
        testID="steps-goal-sheet"
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function QuickStat({
  icon,
  label,
  value,
  color,
  theme,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  theme: ReturnType<typeof useActivityColors>;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.quickStatCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.quickStatValue, { color: theme.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.quickStatLabel, { color: theme.textTertiary }]}>{label}</Text>
    </Wrapper>
  );
}

function SmallStat({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useActivityColors>;
}) {
  return (
    <View style={styles.smallStat}>
      <Text style={[styles.smallStatValue, { color: theme.textPrimary }]}>{value}</Text>
      <Text style={[styles.smallStatLabel, { color: theme.textTertiary }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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

  // Header
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

  // Scroll content
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // Streak
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  longestStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  longestLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  longestValue: {
    fontSize: 14,
    fontWeight: "800",
  },

  // Celebration
  celebration: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  celebrationEmoji: {
    fontSize: 20,
  },
  celebrationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },

  // Quick stats
  quickStats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickStatCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
    ...shadow,
  },
  quickStatValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  quickStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Cards
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  // Trend pill
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Stat summary
  statSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  smallStat: {
    alignItems: "center",
    gap: 2,
  },
  smallStatValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  smallStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Links
  linkRow: {
    gap: spacing.sm,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  linkBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
});
