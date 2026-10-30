import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";
import { getMealImageSource } from "@/src/lib/mealImages";
import { MacroIcon, MacroType } from "@/src/components/MacroIcon";
import { formatMealTime } from "@/src/utils/date";

type Food = {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
};

type Meal = {
  meal_id: string;
  title: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  portion?: string | null;
  image_base64?: string | null;
  foods?: Food[];
  logged_at: string;
};

const MEAL_TYPES: { type: Meal["meal_type"]; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "breakfast", label: "Breakfast", icon: "sunny-outline" },
  { type: "lunch", label: "Lunch", icon: "restaurant-outline" },
  { type: "dinner", label: "Dinner", icon: "moon-outline" },
  { type: "snack", label: "Snack", icon: "cafe-outline" },
];

const MACRO_LIST: { key: string; type: MacroType; label: string; color: string; unit: string }[] = [
  { key: "protein", type: "protein", label: "Protein", color: "#FF5E00", unit: "g" },
  { key: "carbs", type: "carbs", label: "Carbs", color: "#F59E0B", unit: "g" },
  { key: "fats", type: "fats", label: "Fats", color: "#0284C7", unit: "g" },
  { key: "fiber", type: "fiber", label: "Fiber", color: "#10B981", unit: "g" },
  { key: "sugar", type: "sugar", label: "Sugar", color: "#EC4899", unit: "g" },
  { key: "sodium", type: "sodium", label: "Sodium", color: "#8B5CF6", unit: "mg" },
];

const shadowSm = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
});

const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  android: { elevation: 4 },
  default: {},
});

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [mealType, setMealType] = useState<Meal["meal_type"]>("snack");
  const [portion, setPortion] = useState<string>("");
  const [calories, setCalories] = useState<string>("");
  const [proteinG, setProteinG] = useState<string>("");
  const [carbsG, setCarbsG] = useState<string>("");
  const [fatG, setFatG] = useState<string>("");
  const [fiberG, setFiberG] = useState<string>("");
  const [sugarG, setSugarG] = useState<string>("");
  const [sodiumMg, setSodiumMg] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<Meal>(`/meals/${id}`);
      setMeal(r.data);
      setTitle(r.data.title);
      setMealType(r.data.meal_type);
      setPortion(r.data.portion || "");
      setCalories(String(Math.round(r.data.calories || 0)));
      setProteinG(String(Math.round(r.data.protein_g || 0)));
      setCarbsG(String(Math.round(r.data.carbs_g || 0)));
      setFatG(String(Math.round(r.data.fat_g || 0)));
      setFiberG(String(Math.round(r.data.fiber_g || 0)));
      setSugarG(String(Math.round(r.data.sugar_g || 0)));
      setSodiumMg(String(Math.round(r.data.sodium_mg || 0)));
    } catch {
      Alert.alert("Meal not found");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/meals/${id}`, {
        title: title.trim() || meal?.title,
        meal_type: mealType,
        portion: portion || null,
        calories: calories ? parseFloat(calories) : meal?.calories,
        protein_g: proteinG ? parseFloat(proteinG) : meal?.protein_g,
        carbs_g: carbsG ? parseFloat(carbsG) : meal?.carbs_g,
        fat_g: fatG ? parseFloat(fatG) : meal?.fat_g,
        fiber_g: fiberG ? parseFloat(fiberG) : meal?.fiber_g,
        sugar_g: sugarG ? parseFloat(sugarG) : meal?.sugar_g,
        sodium_mg: sodiumMg ? parseFloat(sodiumMg) : meal?.sodium_mg,
      });
      queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
      queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition_analytics"] });
      router.back();
    } catch (e: any) {
      Alert.alert("Save failed", e?.response?.data?.detail || "Try again");
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    try {
      await api.post(`/meals/${id}/duplicate`);
      queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
      queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      router.back();
    } catch (e: any) {
      Alert.alert("Duplicate failed", e?.response?.data?.detail || "Try again");
    }
  };

  const remove = async () => {
    Alert.alert("Delete Meal?", "Are you sure you want to remove this meal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/meals/${id}`);
            queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
            queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
            queryClient.invalidateQueries({ queryKey: ["milestones"] });
            router.back();
          } catch (e: any) {
            Alert.alert("Delete failed", e?.response?.data?.detail || "Try again");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!meal) return null;

  const getMacroValState = (key: string) => {
    switch (key) {
      case "protein": return { val: proteinG, set: setProteinG };
      case "carbs": return { val: carbsG, set: setCarbsG };
      case "fats": return { val: fatG, set: setFatG };
      case "fiber": return { val: fiberG, set: setFiberG };
      case "sugar": return { val: sugarG, set: setSugarG };
      case "sodium": return { val: sodiumMg, set: setSodiumMg };
      default: return { val: "0", set: () => {} };
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Premium Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          testID="meal-back-btn"
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Meal Log</Text>
        <TouchableOpacity
          onPress={remove}
          style={styles.iconBtnDanger}
          testID="meal-delete-btn"
        >
          <Ionicons name="trash-outline" size={18} color="#E11D48" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero Image Banner with Soft Overlays */}
        <View style={styles.heroWrap}>
          <Image
            source={getMealImageSource(meal)}
            style={styles.heroImage}
          />
          <LinearGradient
            colors={["transparent", "rgba(15, 23, 42, 0.85)"]}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadgesRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="time-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>
                {formatMealTime(meal.logged_at)}
              </Text>
            </View>

            <View style={[styles.heroBadge, { backgroundColor: "rgba(255, 94, 0, 0.9)" }]}>
              <Text style={styles.heroBadgeText}>
                {mealType.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Calories Featured Header Banner */}
        <View style={styles.calCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.calCardSubTitle}>ENERGY TOTAL</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 }}>
              <TextInput
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                style={styles.calInput}
              />
              <Text style={styles.calUnit}>kcal</Text>
            </View>
          </View>

          <View style={styles.calFlameWrap}>
            <Ionicons name="flame" size={26} color="#FF5E00" />
          </View>
        </View>

        {/* Meal Details Form Inputs */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>MEAL INFORMATION</Text>

          {/* Title Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Meal Title</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="create-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                placeholder="Meal name"
                placeholderTextColor="#94A3B8"
                testID="meal-title-input"
              />
            </View>
          </View>

          {/* Meal Type Chip Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Meal Category</Text>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map((t) => {
                const active = mealType === t.type;
                return (
                  <TouchableOpacity
                    key={t.type}
                    onPress={() => setMealType(t.type)}
                    activeOpacity={0.8}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Ionicons
                      name={t.icon}
                      size={15}
                      color={active ? "#FFFFFF" : "#64748B"}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Portion Size Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Portion Size / Note</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="scale-outline" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                value={portion}
                onChangeText={setPortion}
                style={styles.input}
                placeholder="e.g. 1 bowl, 250g"
                placeholderTextColor="#94A3B8"
                testID="meal-portion-input"
              />
            </View>
          </View>
        </View>

        {/* 6-Macro Breakdown Grid (3x2 Premium Cards) */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>6-MACRO BREAKDOWN</Text>

          <View style={styles.macroGridContainer}>
            {MACRO_LIST.map((item) => {
              const state = getMacroValState(item.key);
              return (
                <View key={item.key} style={styles.macroTile}>
                  <MacroIcon type={item.type} size={28} showBadge={false} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.macroTileLabel}>{item.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                      <TextInput
                        value={state.val}
                        onChangeText={state.set}
                        keyboardType="numeric"
                        style={[styles.macroTileInput, { color: item.color }]}
                      />
                      <Text style={[styles.macroTileUnit, { color: item.color }]}>
                        {item.unit}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recognized Food Ingredients */}
        {meal.foods && meal.foods.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>INGREDIENTS DETECTED ({meal.foods.length})</Text>
            <View style={{ gap: 10 }}>
              {meal.foods.map((f, i) => (
                <View key={i} style={styles.foodRow}>
                  <View style={styles.foodIconWrap}>
                    <Ionicons name="nutrition" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodName}>{f.name}</Text>
                    <Text style={styles.foodPortion}>{f.portion || "Standard portion"}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.foodCal}>
                      {Math.round(f.calories)} <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "600" }}>kcal</Text>
                    </Text>
                    <Text style={styles.foodMacroSub}>
                      P:{Math.round(f.protein_g)}g · C:{Math.round(f.carbs_g)}g · F:{Math.round(f.fat_g)}g
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ marginTop: 24, gap: 12 }}>
          {/* Save Button */}
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={styles.saveBtn}
            activeOpacity={0.85}
            testID="meal-save-btn"
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Log Again Action */}
          <TouchableOpacity
            onPress={duplicate}
            style={styles.altBtn}
            testID="meal-dup-btn"
            activeOpacity={0.85}
          >
            <Ionicons name="copy-outline" size={18} color="#0F172A" />
            <Text style={styles.altBtnText}>Log this meal again</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#F8FAFC",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  iconBtnDanger: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFE4E6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "900", color: "#0F172A" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  /* Hero Image Banner */
  heroWrap: {
    width: "100%",
    height: 220,
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 4,
    backgroundColor: "#F1F5F9",
    position: "relative",
    ...shadowMd,
  },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  heroBadgesRow: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },

  /* Calories Card */
  calCard: {
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  calCardSubTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1,
  },
  calInput: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    padding: 0,
    margin: 0,
    minWidth: 60,
  },
  calUnit: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FF5E00",
  },
  calFlameWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Sections */
  sectionWrap: { marginTop: 22 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    ...shadowSm,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "700",
  },

  /* Meal Type Chips */
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  chipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  chipText: {
    fontWeight: "800",
    fontSize: 13,
    color: "#64748B",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },

  /* 6-Macro Grid (2 columns x 3 rows) */
  macroGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  macroTile: {
    width: "48.5%",
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  macroTileLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  macroTileInput: {
    fontSize: 17,
    fontWeight: "900",
    padding: 0,
    margin: 0,
    minWidth: 35,
  },
  macroTileUnit: {
    fontSize: 12,
    fontWeight: "800",
  },

  /* Food Rows */
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  foodIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  foodName: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  foodPortion: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  foodCal: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  foodMacroSub: { fontSize: 10, color: "#94A3B8", marginTop: 2, fontWeight: "700" },

  /* Buttons */
  saveBtn: {
    backgroundColor: colors.accent,
    height: 56,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    ...shadowMd,
  },
  saveBtnText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  altBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  altBtnText: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
});
