/**
 * Steps Settings Screen — Rewritten to use the Activity Module
 *
 * Manages step goal, permissions, sync status, and connection details.
 */

import React, { useState, useCallback } from "react";
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

// Activity module
import {
  useActivitySync,
  useActivityGoal,
  useActivityPermission,
  useActivityStore,
} from "@/src/modules/activity/hooks";
import {
  GoalSettingsSheet,
  useActivityColors,
} from "@/src/modules/activity/components";

export default function StepsSettingsScreen() {
  const router = useRouter();
  const theme = useActivityColors();

  const { isSyncing, lastSyncTime, onRefresh } = useActivitySync();
  const { goalConfig } = useActivityGoal();
  const {
    platformName,
    isGranted,
    isDenied,
    isUnavailable,
    requestPermissions,
    openSettings,
    getPermissionMessage,
  } = useActivityPermission();
  const offlineQueueSize = useActivityStore((s) => s.offlineQueueSize);

  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const handleSync = useCallback(async () => {
    await onRefresh();
    showToast("Sync complete");
  }, [onRefresh, showToast]);

  const handleRequestPermission = useCallback(async () => {
    const status = await requestPermissions();
    if (status === "granted") {
      showToast(`Connected to ${platformName}`);
    } else {
      showToast("Permission not granted");
    }
  }, [requestPermissions, platformName, showToast]);

  const syncStatusMessage = lastSyncTime
    ? `Last synced: ${new Date(lastSyncTime).toLocaleString()}`
    : "Never synced";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.surfaceBg }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.divider }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Settings</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Goal Section ── */}
        <SectionHeader title="Daily Goal" theme={theme} />
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          onPress={() => setGoalSheetVisible(true)}
          testID="settings-goal-card"
        >
          <View style={styles.cardRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.stepsLight }]}>
              <Ionicons name="flag-outline" size={20} color={theme.steps} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Daily step goal</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {goalConfig.dailySteps.toLocaleString()} steps
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </View>
        </TouchableOpacity>

        {/* ── Connection Section ── */}
        <SectionHeader title="Health Connection" theme={theme} />

        {/* Platform */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.cardRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.distanceLight }]}>
              <Ionicons
                name={Platform.OS === "ios" ? "heart-circle-outline" : "fitness-outline"}
                size={20}
                color={theme.distance}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Platform</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>{platformName}</Text>
            </View>
          </View>
        </View>

        {/* Permission */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          onPress={isDenied ? openSettings : isGranted ? undefined : handleRequestPermission}
          testID="settings-permission"
        >
          <View style={styles.cardRow}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isGranted
                    ? theme.goalReachedLight
                    : isDenied
                      ? "#FDECEC"
                      : theme.caloriesLight,
                },
              ]}
            >
              <Ionicons
                name={isGranted ? "checkmark-circle-outline" : isDenied ? "close-circle-outline" : "key-outline"}
                size={20}
                color={isGranted ? theme.goalReached : isDenied ? theme.error : theme.warning}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Permission</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {getPermissionMessage()}
              </Text>
            </View>
            {!isGranted && !isUnavailable && (
              <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
            )}
          </View>
        </TouchableOpacity>

        {/* ── Sync Section ── */}
        <SectionHeader title="Data Sync" theme={theme} />

        {/* Last sync */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.cardRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.flightsLight }]}>
              <Ionicons name="time-outline" size={20} color={theme.flights} />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Last synced</Text>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>{syncStatusMessage}</Text>
            </View>
          </View>
        </View>

        {/* Offline queue */}
        {offlineQueueSize > 0 && (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.warning }]}>
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, { backgroundColor: theme.caloriesLight }]}>
                <Ionicons name="cloud-offline-outline" size={20} color={theme.warning} />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Offline queue</Text>
                <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                  {offlineQueueSize} {offlineQueueSize === 1 ? "entry" : "entries"} pending
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Sync button */}
        <TouchableOpacity
          style={[
            styles.syncButton,
            {
              backgroundColor: isGranted ? theme.steps : theme.achievementLocked,
              opacity: isSyncing ? 0.7 : 1,
            },
          ]}
          onPress={handleSync}
          disabled={isSyncing || !isGranted}
          testID="settings-sync-btn"
        >
          <Ionicons name={isSyncing ? "sync" : "refresh-outline"} size={18} color="#FFFFFF" />
          <Text style={styles.syncButtonText}>
            {isSyncing ? "Syncing…" : "Sync Now"}
          </Text>
        </TouchableOpacity>

        {/* ── Privacy Note ── */}
        <View style={[styles.privacyNote, { backgroundColor: theme.cardBgAlt }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.textTertiary} />
          <Text style={[styles.privacyText, { color: theme.textTertiary }]}>
            Nutri AI only reads your activity data. We never write to or modify your health records.
            No health data is logged to analytics.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Toast */}
      {toast !== "" && (
        <View style={[styles.toast, { backgroundColor: theme.chartTooltipBg }]}>
          <Text style={[styles.toastText, { color: theme.chartTooltipText }]}>{toast}</Text>
        </View>
      )}

      {/* Goal Sheet */}
      <GoalSettingsSheet
        visible={goalSheetVisible}
        onClose={() => setGoalSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  theme,
}: {
  title: string;
  theme: ReturnType<typeof useActivityColors>;
}) {
  return (
    <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>{title}</Text>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  scroll: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingLeft: 4,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadow,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: 14,
    marginTop: spacing.md,
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  privacyNote: {
    flexDirection: "row",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  toast: {
    position: "absolute",
    bottom: 40,
    left: spacing.xl,
    right: spacing.xl,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
