import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "@/src/lib/api";
import { colors } from "@/src/theme";

type Recipe = {
  recipe_id: string;
  title: string;
  description: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  ingredients: { name: string; quantity: string }[];
  steps: string[];
  calories_per_serving: number;
  protein_g_per_serving: number;
  carbs_g_per_serving: number;
  fat_g_per_serving: number;
  tags?: string[];
  cultural_inspiration?: string;
  bio_cultural_score?: number;
};

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<Recipe>(`/recipes/${id}`);
        setRecipe(r.data);
      } catch {
        Alert.alert("Recipe not found");
        router.back();
      }
    })();
  }, [id, router]);

  const logAsMeal = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      await api.post("/meals/log", {
        title: recipe.title,
        meal_type: "dinner",
        logged_at: new Date().toISOString(),
        calories: recipe.calories_per_serving,
        protein_g: recipe.protein_g_per_serving,
        carbs_g: recipe.carbs_g_per_serving,
        fat_g: recipe.fat_g_per_serving,
        portion: "1 serving",
        foods: [{
          name: recipe.title,
          portion: "1 serving",
          calories: recipe.calories_per_serving,
          protein_g: recipe.protein_g_per_serving,
          carbs_g: recipe.carbs_g_per_serving,
          fat_g: recipe.fat_g_per_serving,
        }],
      });
      queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
      queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition_analytics"] });
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Log failed", e?.response?.data?.detail || "Try again");
    } finally {
      setSaving(false);
    }
  };


  const deleteRecipe = async () => {
    if (!recipe) return;
    Alert.alert("Delete recipe?", recipe.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.delete(`/recipes/${recipe.recipe_id}`);
          router.back();
        } catch {}
      } }
    ]);
  };

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.black} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="recipe-back">
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipe</Text>
        <TouchableOpacity onPress={deleteRecipe} style={styles.back} testID="recipe-delete">
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.desc}>{recipe.description}</Text>

        {recipe.bio_cultural_score ? (
          <View style={styles.culturalCard}>
            <View style={styles.culturalBadgeRow}>
              <View style={styles.qlooBadge}>
                <Text style={styles.qlooBadgeText}>QLOO TASTE AI</Text>
              </View>
              <Text style={styles.scoreText}>{recipe.bio_cultural_score}% Bio-Cultural Match</Text>
            </View>
            {recipe.cultural_inspiration ? (
              <Text style={styles.inspirationText}>✨ {recipe.cultural_inspiration}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Meta icon="time-outline" label={`${recipe.prep_minutes + recipe.cook_minutes} min`} />
          <Meta icon="people-outline" label={`${recipe.servings} serv`} />
          <Meta icon="flame-outline" label={`${Math.round(recipe.calories_per_serving)} cal`} />
        </View>

        {recipe.tags && recipe.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {recipe.tags.map((t) => (
              <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
            ))}
          </View>
        )}

        <View style={styles.macrosCard}>
          <MacroBox l="Protein" v={`${Math.round(recipe.protein_g_per_serving)}g`} />
          <MacroBox l="Carbs" v={`${Math.round(recipe.carbs_g_per_serving)}g`} />
          <MacroBox l="Fat" v={`${Math.round(recipe.fat_g_per_serving)}g`} />
        </View>

        <Text style={styles.section}>Ingredients</Text>
        <View style={{ gap: 8 }}>
          {recipe.ingredients.map((ing, i) => (
            <View key={i} style={styles.ingredientRow}>
              <View style={styles.dot} />
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientQty}>{ing.quantity}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Steps</Text>
        <View style={{ gap: 12 }}>
          {recipe.steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logBtn} onPress={logAsMeal} disabled={saving} testID="recipe-log-btn">
          {saving ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={styles.logBtnText}>Log as meal</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}
function MacroBox({ l, v }: { l: string; v: string }) {
  return (
    <View style={styles.macroBox}>
      <Text style={styles.macroLabel}>{l}</Text>
      <Text style={styles.macroVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "900", color: colors.textPrimary, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  metaText: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.accentSoft },
  tagText: { fontSize: 11, fontWeight: "800", color: colors.accent, textTransform: "capitalize" },
  macrosCard: { flexDirection: "row", gap: 8, marginTop: 16 },
  macroBox: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  macroLabel: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1 },
  macroVal: { fontSize: 18, fontWeight: "900", color: colors.textPrimary, marginTop: 2 },
  section: { fontSize: 15, fontWeight: "900", color: colors.textPrimary, marginTop: 24, marginBottom: 10, letterSpacing: -0.2 },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.accent },
  ingredientName: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
  ingredientQty: { fontSize: 13, color: colors.textSecondary, fontWeight: "700" },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum: { width: 28, height: 28, borderRadius: 999, backgroundColor: colors.black, alignItems: "center", justifyContent: "center", marginTop: 2 },
  stepNumText: { color: colors.white, fontWeight: "900", fontSize: 13 },
  stepText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 22 },
  logBtn: { marginTop: 30, height: 58, borderRadius: 999, backgroundColor: colors.accent, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  logBtnText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  culturalCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  culturalBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  qlooBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#059669",
  },
  qlooBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.8,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065F46",
  },
  inspirationText: {
    fontSize: 12,
    color: "#374151",
    lineHeight: 18,
    fontStyle: "italic",
  },
});
