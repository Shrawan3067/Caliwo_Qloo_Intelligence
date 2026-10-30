import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";

type WeightLogModalProps = {
  visible: boolean;
  initialWeightKg?: number;
  heightCm?: number;
  goalWeightKg?: number;
  onClose: () => void;
  onSuccess?: (loggedKg: number) => void;
};

export function WeightLogModal({
  visible,
  initialWeightKg = 70.0,
  heightCm,
  goalWeightKg,
  onClose,
  onSuccess,
}: WeightLogModalProps) {
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [inputValue, setInputValue] = useState<string>("");
  const [dateOption, setDateOption] = useState<"today" | "yesterday">("today");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize input value when modal opens
  useEffect(() => {
    if (visible) {
      const baseKg = initialWeightKg && initialWeightKg > 0 ? initialWeightKg : 70.0;
      if (unit === "kg") {
        setInputValue(baseKg.toFixed(1));
      } else {
        setInputValue((baseKg * 2.20462).toFixed(1));
      }
      setDateOption("today");
      setNotes("");
    }
  }, [visible, initialWeightKg, unit]);

  // Handle unit change with auto-conversion
  const handleUnitToggle = (newUnit: "kg" | "lbs") => {
    if (newUnit === unit) return;
    Haptics.selectionAsync().catch(() => {});
    const val = parseFloat(inputValue);
    if (!isNaN(val) && val > 0) {
      if (newUnit === "lbs") {
        setInputValue((val * 2.20462).toFixed(1));
      } else {
        setInputValue((val / 2.20462).toFixed(1));
      }
    }
    setUnit(newUnit);
  };

  // Adjust numeric value with stepper
  const adjustValue = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const current = parseFloat(inputValue) || 0;
    const nextVal = Math.max(10, Math.min(900, current + delta));
    setInputValue(nextVal.toFixed(1));
  };

  // Compute live weight in KG
  const numericVal = parseFloat(inputValue) || 0;
  const currentKg = unit === "kg" ? numericVal : numericVal * 0.45359237;

  // Live BMI calculation
  let bmi: number | null = null;
  let bmiCategory = "";
  let bmiColor = "#64748B";

  if (heightCm && heightCm > 50 && currentKg > 20) {
    bmi = parseFloat((currentKg / Math.pow(heightCm / 100, 2)).toFixed(1));
    if (bmi < 18.5) {
      bmiCategory = "Underweight";
      bmiColor = "#3B82F6";
    } else if (bmi < 25.0) {
      bmiCategory = "Healthy Weight";
      bmiColor = "#10B981";
    } else if (bmi < 30.0) {
      bmiCategory = "Overweight";
      bmiColor = "#F59E0B";
    } else {
      bmiCategory = "Obese";
      bmiColor = "#EF4444";
    }
  }

  // Live goal difference
  let goalDiffText: string | null = null;
  if (goalWeightKg && goalWeightKg > 0 && currentKg > 20) {
    const diffKg = currentKg - goalWeightKg;
    if (Math.abs(diffKg) < 0.2) {
      goalDiffText = "🎉 You are at your goal weight!";
    } else if (diffKg > 0) {
      const diffStr = unit === "kg" ? `${diffKg.toFixed(1)} kg` : `${(diffKg * 2.20462).toFixed(1)} lbs`;
      goalDiffText = `${diffStr} to lose to reach your goal (${unit === "kg" ? `${goalWeightKg} kg` : `${(goalWeightKg * 2.20462).toFixed(1)} lbs`})`;
    } else {
      const diffStr = unit === "kg" ? `${Math.abs(diffKg).toFixed(1)} kg` : `${(Math.abs(diffKg) * 2.20462).toFixed(1)} lbs`;
      goalDiffText = `${diffStr} to gain to reach your goal (${unit === "kg" ? `${goalWeightKg} kg` : `${(goalWeightKg * 2.20462).toFixed(1)} lbs`})`;
    }
  }

  const handleSave = async () => {
    if (!numericVal || currentKg < 20 || currentKg > 400) {
      Alert.alert(
        "Invalid Weight",
        unit === "kg"
          ? "Please enter a valid weight between 20 kg and 400 kg."
          : "Please enter a valid weight between 44 lbs and 880 lbs."
      );
      return;
    }

    setLoading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Calculate target date
      let dateStr: string | undefined = undefined;
      if (dateOption === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        dateStr = d.toISOString().split("T")[0];
      }

      await api.post("/weight/log", {
        weight_kg: parseFloat(currentKg.toFixed(2)),
        unit: "kg",
        date: dateStr,
        notes: notes.trim() || undefined,
        tz_offset: new Date().getTimezoneOffset(),
      });

      onClose();
      if (onSuccess) {
        onSuccess(currentKg);
      }
    } catch (e: any) {
      Alert.alert("Log Failed", e?.response?.data?.detail || "Could not save weight log. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalBg}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerIconTitle}>
              <View style={styles.iconCircle}>
                <Ionicons name="scale" size={20} color={colors.accent} />
              </View>
              <Text style={styles.modalTitle}>Log Body Weight</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Unit Selector Pill */}
            <View style={styles.unitToggleContainer}>
              <TouchableOpacity
                style={[styles.unitBtn, unit === "kg" && styles.unitBtnActive]}
                onPress={() => handleUnitToggle("kg")}
                activeOpacity={0.8}
              >
                <Text style={[styles.unitText, unit === "kg" && styles.unitTextActive]}>
                  Kilograms (kg)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitBtn, unit === "lbs" && styles.unitBtnActive]}
                onPress={() => handleUnitToggle("lbs")}
                activeOpacity={0.8}
              >
                <Text style={[styles.unitText, unit === "lbs" && styles.unitTextActive]}>
                  Pounds (lbs)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Main Number Display & Direct Input */}
            <View style={styles.weightDisplayCard}>
              <View style={styles.inputRow}>
                <TextInput
                  value={inputValue}
                  onChangeText={setInputValue}
                  keyboardType="decimal-pad"
                  style={styles.weightInputLarge}
                  selectTextOnFocus
                  placeholder="0.0"
                  placeholderTextColor="#CBD5E1"
                />
                <Text style={styles.unitLabelLarge}>{unit}</Text>
              </View>

              {/* Quick Stepper Adjusters */}
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustValue(-1.0)}>
                  <Text style={styles.stepBtnText}>-1.0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustValue(-0.1)}>
                  <Text style={styles.stepBtnText}>-0.1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustValue(+0.1)}>
                  <Text style={styles.stepBtnText}>+0.1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustValue(+1.0)}>
                  <Text style={styles.stepBtnText}>+1.0</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date Pill Selector */}
            <View style={styles.dateSelectorRow}>
              <TouchableOpacity
                style={[styles.datePill, dateOption === "today" && styles.datePillActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setDateOption("today");
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={dateOption === "today" ? colors.accent : "#64748B"}
                />
                <Text style={[styles.datePillText, dateOption === "today" && styles.datePillTextActive]}>
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.datePill, dateOption === "yesterday" && styles.datePillActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setDateOption("yesterday");
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={dateOption === "yesterday" ? colors.accent : "#64748B"}
                />
                <Text style={[styles.datePillText, dateOption === "yesterday" && styles.datePillTextActive]}>
                  Yesterday
                </Text>
              </TouchableOpacity>
            </View>

            {/* Live Metrics: BMI & Goal Progress */}
            {bmi !== null && (
              <View style={styles.metricsBox}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Calculated BMI</Text>
                  <View style={styles.bmiBadgeRow}>
                    <Text style={styles.bmiValue}>{bmi}</Text>
                    <View style={[styles.bmiCategoryBadge, { backgroundColor: `${bmiColor}15` }]}>
                      <Text style={[styles.bmiCategoryText, { color: bmiColor }]}>{bmiCategory}</Text>
                    </View>
                  </View>
                </View>

                {goalDiffText && (
                  <View style={styles.goalDiffRow}>
                    <Ionicons name="flag-outline" size={14} color={colors.accent} />
                    <Text style={styles.goalDiffText}>{goalDiffText}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Optional Notes Input */}
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Morning fasted, post-workout"
                placeholderTextColor="#94A3B8"
                style={styles.notesInput}
                maxLength={80}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Entry</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerIconTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFF0E5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 1.15 * 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  unitToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  unitBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  unitText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  unitTextActive: {
    fontWeight: "800",
    color: "#0F172A",
  },
  weightDisplayCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
  },
  weightInputLarge: {
    fontSize: 42,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    minWidth: 120,
  },
  unitLabelLarge: {
    fontSize: 20,
    fontWeight: "700",
    color: "#94A3B8",
  },
  stepperRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    justifyContent: "center",
  },
  stepBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  dateSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  datePillActive: {
    backgroundColor: "#FFF0E5",
    borderColor: "rgba(255, 94, 0, 0.3)",
  },
  datePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  datePillTextActive: {
    fontWeight: "700",
    color: colors.accent,
  },
  metricsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    gap: 8,
  },
  metricItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  bmiBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bmiValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  bmiCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bmiCategoryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  goalDiffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
    paddingTop: 8,
  },
  goalDiffText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  notesContainer: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  saveBtn: {
    flex: 1.6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
});
