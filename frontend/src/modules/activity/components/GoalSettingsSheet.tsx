/**
 * GoalSettingsSheet — Bottom sheet for setting daily step goal
 *
 * @module activity/components/GoalSettingsSheet
 */

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "@/src/theme";
import { useActivityColors } from "./theme";
import { useActivityGoal } from "../hooks/useActivityGoal";
import { GOAL_PRESETS, GOAL_MIN_STEPS, GOAL_MAX_STEPS } from "../constants";

interface GoalSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function GoalSettingsSheet({ visible, onClose, testID }: GoalSettingsSheetProps) {
  const theme = useActivityColors();
  const {
    goalConfig,
    recommendation,
    updateGoal,
    applyRecommendation,
  } = useActivityGoal();

  const [customValue, setCustomValue] = useState(String(goalConfig.dailySteps));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const handlePresetSelect = useCallback(
    async (steps: number) => {
      setSelectedPreset(steps);
      setCustomValue(String(steps));
      await updateGoal(steps);
    },
    [updateGoal],
  );

  const handleCustomSubmit = useCallback(async () => {
    const val = parseInt(customValue, 10);
    if (!isNaN(val) && val >= GOAL_MIN_STEPS && val <= GOAL_MAX_STEPS) {
      setSelectedPreset(null);
      await updateGoal(val);
    }
  }, [customValue, updateGoal]);

  const handleApplyRecommendation = useCallback(async () => {
    await applyRecommendation();
    if (recommendation) {
      setCustomValue(String(recommendation.recommendedSteps));
    }
  }, [applyRecommendation, recommendation]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.sheetBg }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Daily Step Goal</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close-circle" size={28} color={theme.textTertiary} />
              </Pressable>
            </View>

            {/* Current goal */}
            <View style={[styles.currentGoal, { backgroundColor: theme.stepsLight }]}>
              <Text style={[styles.currentLabel, { color: theme.steps }]}>Current Goal</Text>
              <Text style={[styles.currentValue, { color: theme.steps }]}>
                {goalConfig.dailySteps.toLocaleString()} steps
              </Text>
            </View>

            {/* Recommendation */}
            {recommendation && (
              <Pressable
                style={({ pressed }) => [
                  styles.recommendCard,
                  {
                    backgroundColor: theme.goalReachedLight,
                    borderColor: theme.goalReached,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                onPress={handleApplyRecommendation}
              >
                <Ionicons name="sparkles" size={20} color={theme.goalReached} />
                <View style={styles.recommendText}>
                  <Text style={[styles.recommendTitle, { color: theme.goalReached }]}>
                    AI Recommendation
                  </Text>
                  <Text style={[styles.recommendDesc, { color: theme.textSecondary }]}>
                    {recommendation.recommendedSteps.toLocaleString()} steps — {recommendation.reasoning}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.goalReached} />
              </Pressable>
            )}

            {/* Presets */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quick Presets</Text>
            <View style={styles.presetsGrid}>
              {GOAL_PRESETS.map((presetSteps) => {
                const isSelected = selectedPreset === presetSteps || goalConfig.dailySteps === presetSteps;
                const presetMeta = getPresetMeta(presetSteps);
                return (
                  <Pressable
                    key={presetSteps}
                    style={({ pressed }) => [
                      styles.presetCard,
                      {
                        backgroundColor: isSelected ? theme.steps : theme.cardBgAlt,
                        borderColor: isSelected ? theme.steps : theme.border,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                    onPress={() => handlePresetSelect(presetSteps)}
                  >
                    <Text style={{ fontSize: 18 }}>{presetMeta.emoji}</Text>
                    <Text
                      style={[
                        styles.presetSteps,
                        { color: isSelected ? "#FFFFFF" : theme.textPrimary },
                      ]}
                    >
                      {(presetSteps / 1000).toFixed(0)}k
                    </Text>
                    <Text
                      style={[
                        styles.presetLabel,
                        { color: isSelected ? "#FFFFFF" : theme.textSecondary },
                      ]}
                    >
                      {presetMeta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom input */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Custom Goal</Text>
            <View style={styles.customRow}>
              <TextInput
                style={[
                  styles.customInput,
                  {
                    backgroundColor: theme.cardBgAlt,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                  },
                ]}
                value={customValue}
                onChangeText={setCustomValue}
                keyboardType="number-pad"
                placeholder="e.g. 12000"
                placeholderTextColor={theme.textTertiary}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleCustomSubmit}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.customButton,
                  { backgroundColor: theme.steps, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={handleCustomSubmit}
              >
                <Text style={styles.customButtonText}>Set</Text>
              </Pressable>
            </View>

            <Text style={[styles.hint, { color: theme.textTertiary }]}>
              Min {GOAL_MIN_STEPS.toLocaleString()} · Max {GOAL_MAX_STEPS.toLocaleString()} steps
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function getPresetMeta(steps: number): { label: string; emoji: string } {
  switch (steps) {
    case 5_000: return { label: "Light", emoji: "🚶" };
    case 7_500: return { label: "Moderate", emoji: "🏃" };
    case 10_000: return { label: "Standard", emoji: "⭐" };
    case 12_500: return { label: "Active", emoji: "💪" };
    case 15_000: return { label: "Intense", emoji: "🔥" };
    default: return { label: `${(steps / 1000).toFixed(0)}k`, emoji: "👟" };
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 40 : spacing.xl,
    maxHeight: "80%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  currentGoal: {
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  currentLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  currentValue: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  recommendCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  recommendText: {
    flex: 1,
  },
  recommendTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  recommendDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  presetCard: {
    width: "31%",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  presetSteps: {
    fontSize: 18,
    fontWeight: "800",
  },
  presetLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  customRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  customInput: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  customButton: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  customButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
});
