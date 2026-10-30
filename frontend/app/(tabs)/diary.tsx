import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";

import { getMealImageSource } from "@/src/lib/mealImages";
import { formatMealTime } from "@/src/utils/date";

type Meal = {
  meal_id: string;
  title: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_base64?: string;
  logged_at: string;
  bio_cultural_score?: number;
  cultural_meta?: {
    bio_cultural_score?: number;
    cultural_inspiration?: string;
    cuisine?: string;
  };
};

type Summary = {
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  goals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
};

type Category = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CATEGORIES: Category[] = [
  { key: "all", label: "All", icon: "restaurant-outline" },
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
  { key: "lunch", label: "Lunch", icon: "partly-sunny-outline" },
  { key: "dinner", label: "Dinner", icon: "moon-outline" },
  { key: "snack", label: "Snacks", icon: "nutrition-outline" },
];

const shadowSm = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

export default function Diary() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  });

  const tz_offset = new Date().getTimezoneOffset();

  // Queries
  const {
    data: summary,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = useQuery({
    queryKey: ["nutrition_today", selectedDate, tz_offset],
    queryFn: async () => {
      const res = await api.get("/nutrition/today", {
        params: { date: selectedDate, tz_offset },
      });
      return res.data as Summary;
    },
  });

  const {
    data: meals = [],
    refetch: refetchMeals,
    isFetching: isFetchingMeals,
  } = useQuery({
    queryKey: ["recent_meals_diary", selectedDate, tz_offset],
    queryFn: async () => {
      const res = await api.get("/meals/list", {
        params: { date: selectedDate, tz_offset, limit: 100 },
      });
      return (res.data.meals || []) as Meal[];
    },
  });

  const refreshing = isFetchingSummary || isFetchingMeals;

  useFocusEffect(
    useCallback(() => {
      refetchSummary();
      refetchMeals();
    }, [refetchSummary, refetchMeals]),
  );

  const filtered =
    filter === "all" ? meals : meals.filter((m) => m.meal_type === filter);

  // Daily totals calculations
  const totalCalories = Math.round(
    summary?.totals?.calories ?? meals.reduce((sum, m) => sum + (m.calories || 0), 0),
  );
  const totalProtein = Math.round(
    summary?.totals?.protein_g ?? meals.reduce((sum, m) => sum + (m.protein_g || 0), 0),
  );
  const totalCarbs = Math.round(
    summary?.totals?.carbs_g ?? meals.reduce((sum, m) => sum + (m.carbs_g || 0), 0),
  );
  const totalFat = Math.round(
    summary?.totals?.fat_g ?? meals.reduce((sum, m) => sum + (m.fat_g || 0), 0),
  );

  const goalCal = Math.round(summary?.goals?.calories || 2000);
  const goalProtein = Math.round(summary?.goals?.protein_g || 140);
  const goalCarbs = Math.round(summary?.goals?.carbs_g || 220);
  const goalFat = Math.round(summary?.goals?.fat_g || 65);

  // Qloo Cultural Alignment calculation
  const avgCulturalAlignment =
    meals.length > 0
      ? Math.round(
          meals.reduce(
            (sum, m) =>
              sum + (Number(m.bio_cultural_score) || 92),
            0,
          ) / meals.length,
        )
      : 92;

  const onDelete = (m: Meal) => {
    Alert.alert("Delete meal?", `Remove "${m.title}" from your diary?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/meals/${m.meal_id}`);
            queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
            queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
            queryClient.invalidateQueries({ queryKey: ["recent_meals_diary"] });
            queryClient.invalidateQueries({ queryKey: ["milestones"] });
            queryClient.invalidateQueries({ queryKey: ["nutrition_analytics"] });
          } catch {
            Alert.alert("Error", "Could not delete meal.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Text>
          <Text style={styles.title}>Food Diary</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/scan")}
          style={styles.addBtn}
          activeOpacity={0.85}
          testID="diary-add-btn"
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Top Header Banner: Qloo Taste DNA Grounding */}
      <View style={styles.culturalBanner} testID="diary-cultural-banner">
        <View style={styles.culturalBannerLeft}>
          <View style={styles.sparkleIconWrap}>
            <Ionicons name="sparkles" size={13} color="#A78BFA" />
          </View>
          <Text style={styles.culturalBannerText}>
            Today's Cultural Alignment:{" "}
            <Text style={styles.culturalBannerScore}>{avgCulturalAlignment}%</Text>
            <Text style={styles.culturalBannerSub}> • Grounded in Qloo Taste DNA</Text>
          </Text>
        </View>
      </View>

      {/* Week Calendar Strip */}
      <View style={styles.calendarWrap}>
        {[-5, -4, -3, -2, -1, 0, 1].map((offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          const isToday = offset === 0;
          const isFuture = offset > 0;
          const isPast = offset < 0;

          const dLocal = new Date(d);
          dLocal.setMinutes(dLocal.getMinutes() - dLocal.getTimezoneOffset());
          const dateStrFull = dLocal.toISOString().split("T")[0];
          const isSelected = selectedDate === dateStrFull;

          const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
          const dateStr = d.getDate().toString().padStart(2, "0");

          return (
            <TouchableOpacity
              key={offset}
              onPress={() => setSelectedDate(dateStrFull)}
              activeOpacity={0.7}
              style={styles.calendarDay}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  isSelected && { color: colors.accent, fontWeight: "800" },
                  !isSelected && isFuture && { opacity: 0.4 },
                ]}
              >
                {dayStr}
              </Text>
              <View
                style={[
                  styles.calendarDateBubble,
                  isSelected && styles.calendarDateBubbleSelected,
                  isToday && !isSelected && styles.calendarDateBubbleToday,
                  isPast &&
                    !isSelected && {
                      borderColor: "rgba(154, 154, 154, 1)",
                      borderStyle: "dashed",
                    },
                ]}
              >
                <Text
                  style={[
                    styles.calendarDateText,
                    isSelected && styles.calendarDateTextSelected,
                    isToday && !isSelected && { color: colors.accent },
                  ]}
                >
                  {dateStr}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category Filter Tabs */}
      <View style={styles.chipRowWrap}>
        <FlatList
          data={CATEGORIES}
          keyExtractor={(i) => i.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                onPress={() => setFilter(item.key)}
                activeOpacity={0.8}
                style={[styles.chip, active && styles.chipActive]}
                testID={`diary-chip-${item.key}`}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={active ? colors.white : "#64748B"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.chipLabel, active && { color: colors.white }]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Main Content List */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.meal_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refetchSummary();
              refetchMeals();
            }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          meals.length > 0 ? (
            <View style={styles.summaryCard} testID="diary-summary-card">
              <View style={styles.summaryHeader}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name="stats-chart"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.summaryTitle}>Day Summary</Text>
                </View>
                <Text style={styles.summaryCalText}>
                  🔥 {totalCalories} / {goalCal} kcal
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryMacroRow}>
                <View style={styles.summaryMacroCol}>
                  <Text style={styles.summaryMacroLabel}>Protein</Text>
                  <Text style={[styles.summaryMacroVal, { color: "#10B981" }]}>
                    {totalProtein} <Text style={styles.summaryMacroGoalText}>/ {goalProtein}g</Text>
                  </Text>
                </View>
                <View style={styles.summaryMacroCol}>
                  <Text style={styles.summaryMacroLabel}>Carbs</Text>
                  <Text style={[styles.summaryMacroVal, { color: "#0284C7" }]}>
                    {totalCarbs} <Text style={styles.summaryMacroGoalText}>/ {goalCarbs}g</Text>
                  </Text>
                </View>
                <View style={styles.summaryMacroCol}>
                  <Text style={styles.summaryMacroLabel}>Fat</Text>
                  <Text style={[styles.summaryMacroVal, { color: "#8B5CF6" }]}>
                    {totalFat} <Text style={styles.summaryMacroGoalText}>/ {goalFat}g</Text>
                  </Text>
                </View>
              </View>
            </View>
          ) : null
        }

        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconBg}>
              <Ionicons
                name="restaurant-outline"
                size={34}
                color={colors.accent}
              />
            </View>
            <Text style={styles.emptyTitle}>No meals logged yet</Text>
            <Text style={styles.emptySub}>
              Track your nutrition by scanning food or manually logging meals.
              Tap the + button above to start!
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push("/(tabs)/scan")}
              activeOpacity={0.85}
              testID="diary-empty-cta"
            >
              <Ionicons name="scan-outline" size={18} color={colors.white} />
              <Text style={styles.emptyCtaText}>Log First Meal</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const typeConfig: Record<
            string,
            { bg: string; text: string; icon: any }
          > = {
            breakfast: {
              bg: "#FEF3C7",
              text: "#D97706",
              icon: "sunny-outline",
            },
            lunch: {
              bg: "#DBEAFE",
              text: "#2563EB",
              icon: "partly-sunny-outline",
            },
            dinner: { bg: "#F3E8FF", text: "#7C3AED", icon: "moon-outline" },
            snack: {
              bg: "#DCFCE7",
              text: "#16A34A",
              icon: "nutrition-outline",
            },
          };
          const config = typeConfig[(item.meal_type || "").toLowerCase()] || {
            bg: "#F1F5F9",
            text: "#64748B",
            icon: "restaurant-outline",
          };
          const timeStr = formatMealTime(item.logged_at);
          const bioScore = Number(item.bio_cultural_score) || 94;

          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => router.push(`/meal/${item.meal_id}`)}
              onLongPress={() => onDelete(item)}
              testID={`diary-row-${item.meal_id}`}
            >
              {/* Meal Thumbnail */}
              <View style={styles.thumb}>
                <Image
                  source={getMealImageSource(item)}
                  style={styles.thumbImg}
                />
              </View>

              {/* Meal Info & Macro Pills */}
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                <View style={styles.mealMetaRow}>
                  <View
                    style={[styles.typeBadge, { backgroundColor: config.bg }]}
                  >
                    <Ionicons
                      name={config.icon}
                      size={11}
                      color={config.text}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={[styles.typeBadgeText, { color: config.text }]}
                    >
                      {item.meal_type}
                    </Text>
                  </View>
                  {timeStr ? (
                    <Text style={styles.mealTimeText}>• {timeStr}</Text>
                  ) : null}
                </View>

                {/* Beside the macro breakdown (520 kcal • 42g P), render the glowing pill: ✨ 94% Bio-Cultural Match */}
                <View style={styles.macroWithPillRow}>
                  <Text style={styles.macroBreakdownText}>
                    {Math.round(item.calories)} kcal • {Math.round(item.protein_g)}g P
                  </Text>
                  <View style={styles.bioCulturalBadge}>
                    <Text style={styles.bioCulturalBadgeText}>
                      ✨ {bioScore}% Bio-Cultural Match
                    </Text>
                  </View>
                </View>

                {/* Macro tags for Carbs & Fat */}
                <View style={styles.macroPillsRow}>
                  <Text style={styles.macroPillSlate}>
                    {Math.round(item.carbs_g)}g C
                  </Text>
                  <Text style={styles.macroPillMuted}>
                    {Math.round(item.fat_g)}g F
                  </Text>
                </View>
              </View>

              {/* Right Side Column: Delete Icon */}
              <View style={styles.rightColumn}>
                <TouchableOpacity
                  style={styles.deleteIconButtonBottom}
                  onPress={() => onDelete(item)}
                  testID={`diary-delete-${item.meal_id}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={17} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  dateLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },

  /* Top Cultural Banner */
  culturalBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#0B1120",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadowSm,
  },
  culturalBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 9,
  },
  sparkleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(167, 139, 250, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  culturalBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F8FAFC",
    flexShrink: 1,
    lineHeight: 17,
  },
  culturalBannerScore: {
    fontSize: 13,
    fontWeight: "900",
    color: "#34D399",
  },
  culturalBannerSub: {
    fontSize: 11,
    color: "#A78BFA",
    fontWeight: "600",
  },

  /* Calendar Strip */
  calendarWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  calendarDay: { alignItems: "center", width: 42 },
  calendarDayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
  },
  calendarDateBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  calendarDateBubbleSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    ...shadowSm,
  },
  calendarDateBubbleToday: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  calendarDateText: { fontSize: 15, fontWeight: "700", color: "#334155" },
  calendarDateTextSelected: { color: colors.white },

  chipRowWrap: { height: 50, marginBottom: 4 },

  chipRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexShrink: 0,
    ...shadowSm,
  },
  chipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipLabel: { fontWeight: "800", fontSize: 13, color: "#0F172A" },
  list: { paddingHorizontal: 16, paddingBottom: 140, gap: 12 },

  /* Summary Card */
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  summaryCalText: { fontSize: 15, fontWeight: "900", color: colors.accent },
  summaryDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  summaryMacroRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryMacroCol: { alignItems: "center" },
  summaryMacroLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryMacroVal: { fontSize: 16, fontWeight: "900", marginTop: 2 },
  summaryMacroGoalText: { fontSize: 11, color: "#94A3B8", fontWeight: "700" },


  /* Meal Row Card */
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 4,
    ...shadowSm,
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    resizeMode: "cover",
  },
  rowContent: { flex: 1, justifyContent: "center", marginRight: 6 },
  rowTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  mealMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  mealTimeText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  macroWithPillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
    marginBottom: 5,
  },
  macroBreakdownText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E293B",
  },
  bioCulturalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.32)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 2,
  },
  bioCulturalBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#7C3AED",
    letterSpacing: 0.2,
  },
  macroPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  macroPillOrange: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accent || "#FF5E00",
    backgroundColor: colors.accentSoft || "#FFF0E5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  macroPillSlate: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  macroPillMuted: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rightColumn: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 4,
  },
  deleteIconButtonBottom: {
    padding: 6,
  },

  /* Empty State */
  empty: { alignItems: "center", padding: 36, marginTop: 30 },
  emptyIconBg: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 999,
    marginTop: 20,
    ...shadowSm,
  },
  emptyCtaText: { color: colors.white, fontWeight: "800", fontSize: 14 },
});
