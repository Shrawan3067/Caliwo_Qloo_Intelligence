import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/src/lib/api";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

type PlannedMeal = {
  slot: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients?: string[];
  cuisine?: string;
  cultural_inspiration?: string;
  bio_cultural_score?: number;
};
type DayPlan = {
  day: number;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  meals: PlannedMeal[];
};
type MealPlan = {
  plan_id: string;
  generated_at: string;
  focus?: string;
  days: DayPlan[];
};
type Recipe = {
  recipe_id: string;
  title: string;
  description: string;
  calories_per_serving: number;
  prep_minutes: number;
  cook_minutes: number;
  tags?: string[];
  cultural_inspiration?: string;
  bio_cultural_score?: number;
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
  },
  android: { elevation: 3 },
  default: {},
});

import { useQueryClient } from "@tanstack/react-query";

export default function PlanScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genRecipe, setGenRecipe] = useState(false);
  const [prompt, setPrompt] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, rs] = await Promise.all([
        api.get("/meal-plans/current"),
        api.get("/recipes/list", { params: { limit: 10 } }),
      ]);
      setPlan(p.data?.plan || null);
      setRecipes(rs.data?.recipes || []);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const r = await api.post("/meal-plans/generate", {
        days: 7,
        focus: prompt || undefined,
      });
      setPlan(r.data);
      setSelectedDay(1);
    } catch (e: any) {
      Alert.alert(
        "Plan generation failed",
        e?.response?.data?.detail || "Try again",
      );
    } finally {
      setGenerating(false);
    }
  };

  const generateRecipe = async () => {
    if (!prompt.trim()) {
      Alert.alert(
        "Describe the recipe you want",
        "e.g. 'quick high-protein dinner with chicken'",
      );
      return;
    }
    setGenRecipe(true);
    try {
      const r = await api.post("/recipes/generate", {
        prompt,
        meal_type: "dinner",
        servings: 2,
      });
      setRecipes((prev) => [r.data, ...prev]);
      router.push(`/plan/recipe/${r.data.recipe_id}`);
    } catch (e: any) {
      Alert.alert(
        "Recipe generation failed",
        e?.response?.data?.detail || "Try again",
      );
    } finally {
      setGenRecipe(false);
    }
  };

  const logPlanMeal = async (day: number, slot: string) => {
    if (!plan) return;
    try {
      await api.post(`/meal-plans/${plan.plan_id}/log`, null, {
        params: { day, slot },
      });
      queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
      queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition_analytics"] });
      Alert.alert("Logged", "Meal added to today's diary");
    } catch (e: any) {
      Alert.alert("Failed to log", e?.response?.data?.detail || "Try again");
    }
  };


  const day = plan?.days.find((d) => d.day === selectedDay) || plan?.days[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Meal Plan</Text>
        <TouchableOpacity
          onPress={() => router.push("/grocery")}
          style={styles.groceryHeaderBtn}
          testID="plan-grocery-header-btn"
        >
          <Ionicons name="cart-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>What are you in the mood for?</Text>
          <View style={styles.inputWrap}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textTertiary}
              style={styles.inputIcon}
            />
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g. high-protein vegetarian meals..."
              placeholderTextColor={colors.textTertiary}
              style={styles.promptInput}
              testID="plan-prompt-input"
            />
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary, { flex: 2 }]}
              onPress={generatePlan}
              disabled={generating}
              testID="plan-generate-btn"
            >
              {generating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="calendar" size={16} color={colors.white} />
                  <Text style={[styles.actionText, { color: colors.white }]}>
                    Generate 7-day plan
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary, { flex: 1 }]}
              onPress={generateRecipe}
              disabled={genRecipe}
              testID="plan-recipe-btn"
            >
              {genRecipe ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color={colors.textPrimary}
                  />
                  <Text style={styles.actionText}>Recipe</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.groceryBanner}
          onPress={() => router.push("/grocery")}
          testID="plan-grocery-banner"
        >
          <View style={styles.groceryBannerIcon}>
            <Ionicons name="basket" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.groceryBannerTitle}>Grocery Intelligence</Text>
            <Text style={styles.groceryBannerSub}>Auto-built shopping list for your plan</Text>
          </View>
          <View style={styles.groceryBannerBadge}>
            <Text style={styles.groceryBannerBadgeText}>View List</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </View>
        </TouchableOpacity>

        {plan ? (
          <View style={{ marginTop: 24 }}>
            {plan.focus ? (
              <View style={styles.focusPill}>
                <Ionicons name="locate" size={14} color={colors.accent} />
                <Text style={styles.focusText}>{plan.focus}</Text>
              </View>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.daysRow}
            >
              {plan.days.map((d) => (
                <TouchableOpacity
                  key={d.day}
                  onPress={() => setSelectedDay(d.day)}
                  style={[
                    styles.dayChip,
                    selectedDay === d.day && styles.dayChipActive,
                  ]}
                  testID={`plan-day-${d.day}`}
                >
                  <Text
                    style={[
                      styles.dayChipLabel,
                      selectedDay === d.day && {
                        color: "rgba(255,255,255,0.8)",
                      },
                    ]}
                  >
                    {DAY_NAMES[(d.day - 1) % 7]}
                  </Text>
                  <Text
                    style={[
                      styles.dayChipDay,
                      selectedDay === d.day && { color: colors.white },
                    ]}
                  >
                    {d.day}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {day ? (
              <View style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>Day {day.day}</Text>
                  <Text style={styles.dayCal}>
                    {Math.round(day.total_calories)} cal
                  </Text>
                </View>
                <View style={styles.dayMacros}>
                  <View style={styles.macroPill}>
                    <Text style={styles.macroText}>
                      P {Math.round(day.total_protein_g)}g
                    </Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text style={styles.macroText}>
                      C {Math.round(day.total_carbs_g)}g
                    </Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text style={styles.macroText}>
                      F {Math.round(day.total_fat_g)}g
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 12 }}>
                  {day.meals.map((m, i) => (
                    <View key={`${m.slot}-${i}`} style={styles.mealRow}>
                      <View style={styles.slotBadge}>
                        <Text style={styles.slotText}>
                          {m.slot.slice(0, 3).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                          <Text style={styles.mealName}>{m.name}</Text>
                          {m.bio_cultural_score ? (
                            <View style={styles.culturalBadge}>
                              <Text style={styles.culturalBadgeText}>
                                {m.bio_cultural_score}% MATCH
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.mealMeta}>
                          {Math.round(m.calories)} cal · P {Math.round(m.protein_g)}g
                          {m.cuisine ? ` · ${m.cuisine}` : ""}
                        </Text>
                        {m.cultural_inspiration ? (
                          <Text style={styles.culturalInspirationText} numberOfLines={2}>
                            ✨ {m.cultural_inspiration}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => logPlanMeal(day.day, m.slot)}
                        style={styles.logBtn}
                        testID={`plan-log-${day.day}-${m.slot}`}
                      >
                        <Ionicons name="add" size={18} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="calendar-outline"
                size={32}
                color={colors.accent}
              />
            </View>
            <Text style={styles.emptyTitle}>No active plan</Text>
            <Text style={styles.emptySub}>
              Tap &apos;Generate 7-day plan&apos; to build a personalized, AI-powered
              weekly meal plan.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your recipes</Text>
        </View>
        {recipes.length === 0 ? (
          <View style={styles.emptyCard}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: colors.surface },
              ]}
            >
              <Ionicons
                name="restaurant-outline"
                size={28}
                color={colors.textTertiary}
              />
            </View>
            <Text style={[styles.emptyTitle, { fontSize: 15 }]}>
              No recipes yet
            </Text>
            <Text style={styles.emptySub}>
              AI-generated recipes will appear here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {recipes.map((r) => (
              <TouchableOpacity
                key={r.recipe_id}
                style={styles.recipeCard}
                onPress={() => router.push(`/plan/recipe/${r.recipe_id}`)}
                testID={`recipe-card-${r.recipe_id}`}
              >
                <View style={styles.recipeIcon}>
                  <Ionicons name="restaurant" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeTitle}>{r.title}</Text>
                  <Text style={styles.recipeSub}>
                    {Math.round(r.calories_per_serving)} cal ·{" "}
                    {r.prep_minutes + r.cook_minutes} min
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.white,
    ...shadowSm,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  promptCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.white,
    ...shadowMd,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  inputIcon: { marginRight: 8 },
  promptInput: {
    flex: 1,
    height: 52,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 999,
  },
  actionPrimary: { backgroundColor: colors.black, ...shadowSm },
  actionSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    ...shadowSm,
  },
  actionText: { fontWeight: "800", color: colors.textPrimary, fontSize: 13 },
  focusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    marginBottom: 14,
  },
  focusText: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  daysRow: { gap: 10, paddingBottom: 16, paddingRight: 16 },
  dayChip: {
    width: 60,
    height: 70,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...shadowSm,
  },
  dayChipActive: { backgroundColor: colors.black, ...shadowMd },
  dayChipLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dayChipDay: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textPrimary,
    marginTop: 4,
  },
  dayCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.white,
    ...shadowMd,
    marginTop: 8,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  dayCal: { fontSize: 18, fontWeight: "900", color: colors.accent },
  dayMacros: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 20 },
  macroPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  macroText: { fontSize: 12, color: colors.textSecondary, fontWeight: "800" },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    ...shadowSm,
  },
  slotBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  slotText: {
    color: colors.accent,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
  mealName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  mealMeta: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  logBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  emptyCard: {
    alignItems: "center",
    padding: 32,
    borderRadius: 24,
    backgroundColor: colors.white,
    marginTop: 12,
    ...shadowSm,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionHeaderRow: {
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.white,
    ...shadowSm,
  },
  recipeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  recipeSub: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  groceryHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.white,
    ...shadowSm,
  },
  groceryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.white,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    ...shadowSm,
  },
  groceryBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  groceryBannerTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  groceryBannerSub: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 2,
  },
  groceryBannerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  groceryBannerBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
  },
  culturalBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  culturalBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#059669",
    letterSpacing: 0.5,
  },
  culturalInspirationText: {
    fontSize: 11,
    color: "#4B5563",
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 15,
  },
});
