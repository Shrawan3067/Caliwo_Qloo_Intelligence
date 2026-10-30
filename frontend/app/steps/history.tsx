/**
 * Step History Screen — Rewritten to use the Activity Module
 *
 * Displays historical activity logs, 30-day aggregates, personal records,
 * and monthly trends with dark mode support.
 */

import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "@/src/theme";
import { useActivityStore } from "@/src/modules/activity/hooks";
import { useActivityColors } from "@/src/modules/activity/components";
import type { DailyActivity } from "@/src/modules/activity/types";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function StepsHistoryScreen() {
  const router = useRouter();
  const theme = useActivityColors();

  const selectPeriod = useActivityStore((s) => s.selectPeriod);
  const monthlyData = useActivityStore((s) => s.monthlyData);
  const isLoading = useActivityStore((s) => s.isLoading);
  const goalConfig = useActivityStore((s) => s.goalConfig);
  const onRefreshSync = useActivityStore((s) => s.syncManual);

  useEffect(() => {
    selectPeriod("monthly");
  }, [selectPeriod]);

  const handleRefresh = useCallback(async () => {
    await onRefreshSync();
    await selectPeriod("monthly");
  }, [onRefreshSync, selectPeriod]);

  const entries = monthlyData?.entries ? [...monthlyData.entries].reverse() : [];
  const stats = monthlyData?.stats;
  const goal = goalConfig.dailySteps;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.surfaceBg }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.divider }]} testID="history-header">
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="history-back-btn">
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Activity History</Text>
        <View style={styles.iconBtn} />
      </View>

      {isLoading && !monthlyData ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.steps} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.date}
          ListHeaderComponent={
            <View style={[styles.headerCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]} testID="history-stats-card">
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>30-Day Overview</Text>
              <View style={styles.gridRow}>
                <StatCell
                  label="Total Steps"
                  value={(stats?.totalSteps || 0).toLocaleString()}
                  theme={theme}
                />
                <StatCell
                  label="Daily Average"
                  value={(stats?.averageSteps || 0).toLocaleString()}
                  theme={theme}
                />
              </View>
              <View style={styles.gridRow}>
                <StatCell
                  label="Highest Day"
                  value={stats?.highestSteps ? stats.highestSteps.toLocaleString() : "—"}
                  theme={theme}
                />
                <StatCell
                  label="Goal Met Days"
                  value={`${stats?.daysGoalReached || 0}/${stats?.totalDays || 30}`}
                  sub={`Goal: ${goal.toLocaleString()}`}
                  theme={theme}
                />
              </View>
            </View>
          }
          renderItem={({ item }: { item: DailyActivity }) => {
            const goalReached = item.steps >= goal;
            return (
              <View
                style={[styles.rowItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                testID={`day-row-${item.date}`}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.dateText, { color: theme.textPrimary }]}>
                      {fmtDate(item.date)}
                    </Text>
                    {goalReached && (
                      <View style={[styles.badge, { backgroundColor: theme.goalReachedLight }]} testID={`goal-badge-${item.date}`}>
                        <Ionicons name="checkmark-circle" size={12} color={theme.goalReached} />
                        <Text style={[styles.badgeText, { color: theme.goalReached }]}>Goal</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.subText, { color: theme.textTertiary }]}>
                    {(item.distanceTotalMeters / 1000).toFixed(2)} km · {Math.round(item.caloriesActive)} kcal
                  </Text>
                </View>
                <Text style={[styles.stepsNumber, { color: theme.textPrimary }]}>
                  {(item.steps || 0).toLocaleString()}
                </Text>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={theme.textPrimary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function StatCell({
  label,
  value,
  sub,
  theme,
}: {
  label: string;
  value: string;
  sub?: string;
  theme: ReturnType<typeof useActivityColors>;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statLabel, { color: theme.textTertiary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.textPrimary }]}>{value}</Text>
      {sub ? <Text style={[styles.statSub, { color: theme.textTertiary }]}>{sub}</Text> : null}
    </View>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCell: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statSub: {
    fontSize: 11,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    ...shadow,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "700",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  subText: {
    fontSize: 12,
  },
  stepsNumber: {
    fontSize: 16,
    fontWeight: "800",
  },
});
