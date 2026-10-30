import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ring, MacroRing } from "@/src/components/Ring";
import { colors } from "@/src/theme";
import { getPermission, syncNow } from "@/src/lib/steps";
import api, {
  getTasteDiscoveries,
  getTasteRecommendations,
  switchTastePersona,
  toggleBlindMode,
} from "@/src/lib/api";
import { syncSleep, requestSleepPermission } from "@/src/lib/sleep";
import { WidgetSync } from "@/src/widgets/widgetSync";
import { NutriLogo } from "@/src/components/NutriLogo";
import { getMealImageSource } from "@/src/lib/mealImages";
import {
  fetchMilestones,
  getCachedMilestones,
} from "@/src/modules/activity/engines/achievement.engine";
import { WeightLogModal } from "@/src/components/WeightLogModal";
import CulturalComparisonModal from "@/src/components/CulturalComparisonModal";
import { formatMealTime } from "@/src/utils/date";
import { getTasteEntityMeta } from "@/src/utils/tasteIcons";

type Totals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  magnesium_mg?: number;
};
type Goals = Totals;
type Summary = {
  day: string;
  totals: Totals;
  goals: Goals;
  water_ml: number;
  water_goal_ml: number;
};
type Meal = {
  meal_id: string;
  title: string;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  magnesium_mg?: number;
  image_base64?: string;
  logged_at: string;
};

type StepToday = {
  steps: number;
  goal: number;
  progress_pct: number;
  distance_m: number;
  calories: number;
  goal_reached: boolean;
};
type SleepToday = {
  hours: number;
  goal_hours: number;
  progress_pct: number;
  quality: string | null;
  logged: boolean;
};
type SuggestionItem = {
  title: string;
  description: string;
  icon: any;
};

/* ---------- Shared elevation tokens ---------- */
const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  android: { elevation: 4 },
  default: {},
});

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

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { width: windowWidth } = useWindowDimensions();
  const macroPageWidth = Math.max(280, windowWidth - 32);
  const [macroPageIndex, setMacroPageIndex] = useState<number>(0);
  const macroScrollRef = useRef<ScrollView>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  });

  const tz_offset = new Date().getTimezoneOffset();

  // --- Queries ---
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

  // Auto-sync widget data whenever summary updates
  useEffect(() => {
    if (summary) {
      WidgetSync.syncSummaryData(summary);
    }
  }, [summary]);

  const {
    data: meals = [],
    refetch: refetchMeals,
    isFetching: isFetchingMeals,
  } = useQuery({
    queryKey: ["recent_meals"],
    queryFn: async () => {
      const res = await api.get("/meals/list", {
        params: { limit: 8 },
      });
      return (res.data.meals || []) as Meal[];
    },
  });

  const {
    data: steps,
    refetch: refetchSteps,
    isFetching: isFetchingSteps,
  } = useQuery({
    queryKey: ["steps_today", selectedDate, tz_offset],
    queryFn: async () => {
      const res = await api.get("/steps/today", {
        params: { date: selectedDate, tz_offset },
      });
      return res.data as StepToday;
    },
    retry: false,
  });

  const {
    data: sleep,
    refetch: refetchSleep,
    isFetching: isFetchingSleep,
  } = useQuery({
    queryKey: ["sleep_today", selectedDate, tz_offset],
    queryFn: async () => {
      const res = await api.get("/sleep/today", {
        params: { date: selectedDate, tz_offset },
      });
      return res.data as SleepToday;
    },
    retry: false,
  });

  const { data: suggestions, refetch: refetchSuggestions } = useQuery({
    queryKey: ["coach_suggestions"],
    queryFn: async () => {
      const res = await api.get("/coach/suggestions");
      return (res.data.suggestions || []) as SuggestionItem[];
    },
  });

  const { data: milestonesData, refetch: refetchMilestones } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      try {
        return await fetchMilestones();
      } catch {
        return await getCachedMilestones();
      }
    },
  });

  const { data: weightData, refetch: refetchWeight } = useQuery({
    queryKey: ["weight_history"],
    queryFn: async () => {
      const res = await api.get("/weight/history", { params: { days: 30 } });
      return res.data;
    },
  });

  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ["user_profile"],
    queryFn: async () => {
      const res = await api.get("/profile/me");
      return res.data?.profile || {};
    },
  });

  const { data: tasteData, refetch: refetchTaste } = useQuery({
    queryKey: ["home_taste_recommendations"],
    queryFn: async () => {
      try {
        const res = await getTasteRecommendations("dinner");
        return res;
      } catch {
        return null;
      }
    },
    staleTime: 60 * 1000,
  });

  const { data: discoveriesData, refetch: refetchDiscoveries } = useQuery({
    queryKey: ["home_taste_discoveries"],
    queryFn: async () => {
      try {
        const res = await getTasteDiscoveries();
        return res?.discoveries || [];
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
  });

  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [showBlindAiContrast, setShowBlindAiContrast] = useState(false);
  const [switchingPersona, setSwitchingPersona] = useState<string | null>(null);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);

  const currentPersonaId =
    (profileData as any)?.active_persona_id ||
    ((profileData as any)?.name === "Elena" ? "elena" : (profileData as any)?.name === "Marcus" ? "marcus" : "alex");

  const handleSwitchPersona = async (personaId: string) => {
    if (switchingPersona) return;
    setSwitchingPersona(personaId);
    try {
      await switchTastePersona(personaId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["home_taste_recommendations"] }),
        queryClient.invalidateQueries({ queryKey: ["home_taste_discoveries"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["nutrition_today"] }),
        queryClient.invalidateQueries({ queryKey: ["recent_meals"] }),
        refetchTaste(),
        refetchDiscoveries(),
        refetchSummary(),
        refetchMeals(),
      ]);
    } catch (e: any) {
      if (__DEV__) console.warn("Failed to switch persona:", e);
    } finally {
      setSwitchingPersona(null);
    }
  };

  const [togglingBlind, setTogglingBlind] = useState(false);
  const isBlindMode = Boolean(
    (profileData as any)?.simulate_blind || tasteData?.blind_mode
  );

  const handleToggleBlindMode = async () => {
    if (togglingBlind) return;
    setTogglingBlind(true);
    const nextVal = !isBlindMode;
    try {
      await toggleBlindMode(nextVal);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["home_taste_recommendations"] }),
        queryClient.invalidateQueries({ queryKey: ["home_taste_discoveries"] }),
        queryClient.invalidateQueries({ queryKey: ["user_profile"] }),
        refetchProfile(),
        refetchTaste(),
        refetchDiscoveries(),
      ]);
    } catch (e: any) {
      if (__DEV__) console.warn("Failed to toggle blind mode:", e);
    } finally {
      setTogglingBlind(false);
    }
  };

  const refreshing =
    isFetchingSummary || isFetchingMeals || isFetchingSteps || isFetchingSleep;

  // Auto-refetch all daily dashboard data whenever Home tab gains focus
  useFocusEffect(
    useCallback(() => {
      refetchSummary();
      refetchMeals();
      refetchSteps();
      refetchSleep();
      refetchMilestones();
      refetchWeight();
      refetchProfile();
      refetchTaste();
      refetchDiscoveries();
    }, [
      refetchSummary,
      refetchMeals,
      refetchSteps,
      refetchSleep,
      refetchMilestones,
      refetchWeight,
      refetchProfile,
      refetchTaste,
      refetchDiscoveries,
    ]),
  );

  // Background sync on mount
  useEffect(() => {
    (async () => {
      // Sync Steps
      const perm = await getPermission();
      if (perm === "granted") {
        const res = await syncNow();
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["steps_today"] });
        }
      }

      // Sync Sleep
      const sleepPerm = await requestSleepPermission();
      if (sleepPerm) {
        const sleepSynced = await syncSleep();
        if (sleepSynced) {
          queryClient.invalidateQueries({ queryKey: ["sleep_today"] });
        }
      }
    })();
  }, [queryClient]);

  const onRefresh = useCallback(() => {
    refetchSummary();
    refetchMeals();
    refetchSteps();
    refetchSleep();
    refetchSuggestions();
    refetchMilestones();
    refetchTaste();
    refetchDiscoveries();
  }, [
    refetchSummary,
    refetchMeals,
    refetchSteps,
    refetchSleep,
    refetchSuggestions,
    refetchMilestones,
    refetchTaste,
    refetchDiscoveries,
  ]);

  const s = summary;
  const calLeft = s
    ? Math.max(0, Math.round(s.goals.calories - s.totals.calories))
    : 0;
  const calProgress =
    s && s.goals.calories > 0 ? s.totals.calories / s.goals.calories : 0;
  const waterProgress =
    s && s.water_goal_ml > 0 ? s.water_ml / s.water_goal_ml : 0;

  const proteinRemaining = s
    ? Math.max(0, (s.goals?.protein_g || 140) - (s.totals?.protein_g || 0))
    : 0;
  const hasTasteProfile = Boolean(
    tasteData?.taste_profile_active ||
    (profileData as any)?.taste_onboarded ||
    (profileData as any)?.taste_dna?.entity_ids?.length,
  );
  const topCulturalRec = tasteData?.recommendations?.[0] || null;
  const recDishName =
    topCulturalRec?.dish_name ||
    topCulturalRec?.name ||
    "Truffle Ponzu Salmon & Quinoa";
  const recMatchScore =
    topCulturalRec?.bio_cultural_score ||
    topCulturalRec?.cultural_alignment_score ||
    96;
  const recCuisines = topCulturalRec?.cuisine_tags?.length
    ? topCulturalRec.cuisine_tags
    : ["Japanese", "Mediterranean", "Clean Gourmet"];
  const recVenue = topCulturalRec?.restaurant_anchor
    ? `from ${topCulturalRec.restaurant_anchor}`
    : "";
  const askCoachPrompt = `Generate a culturally-tailored gourmet recipe for ${recDishName} ${recVenue ? `(${recVenue}) ` : ""}aligned with my Qloo Taste DNA that meets my remaining daily target of ${Math.round(proteinRemaining)}g protein. Include ingredients, step-by-step instructions, and macro breakdown.`;

  const waterMutation = useMutation({
    mutationFn: async (ml: number) => {
      return api.post("/water/log", { ml, date: selectedDate, tz_offset });
    },
    onMutate: async (ml: number) => {
      await queryClient.cancelQueries({
        queryKey: ["nutrition_today", selectedDate, tz_offset],
      });
      const previousSummary = queryClient.getQueryData<Summary>([
        "nutrition_today",
        selectedDate,
        tz_offset,
      ]);
      if (previousSummary) {
        queryClient.setQueryData<Summary>(
          ["nutrition_today", selectedDate, tz_offset],
          {
            ...previousSummary,
            water_ml: (previousSummary.water_ml || 0) + ml,
          },
        );
      }
      return { previousSummary };
    },
    onError: (_err, _ml, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(
          ["nutrition_today", selectedDate, tz_offset],
          context.previousSummary,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
    },
  });

  const addWater = (ml: number) => waterMutation.mutate(ml);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <NutriLogo size={34} style={{ borderRadius: 8 }} />
            <Text style={styles.appName}>Caliwo</Text>
          </View>

          {/* 1-Tap Culturally Blind AI Demonstration Toggle */}
          <TouchableOpacity
            style={[
              styles.headerBlindToggle,
              isBlindMode ? styles.headerBlindToggleActive : styles.headerBlindToggleQloo,
            ]}
            onPress={handleToggleBlindMode}
            disabled={togglingBlind}
            activeOpacity={0.8}
            testID="home-header-blind-toggle"
          >
            <LinearGradient
              colors={
                isBlindMode
                  ? ["#EF4444", "#DC2626"]
                  : ["#7C3AED", "#6366F1"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.headerBlindToggleGradient}
            >
              {togglingBlind ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ transform: [{ scale: 0.7 }] }} />
              ) : (
                <>
                  <Ionicons
                    name={isBlindMode ? "alert-circle" : "sparkles"}
                    size={12}
                    color="#FFFFFF"
                  />
                  <Text style={styles.headerBlindToggleText}>
                    {isBlindMode ? "BLIND AI" : "QLOO AI"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/milestones")}
            style={styles.streakButton}
            activeOpacity={0.8}
            testID="home-streak-btn"
          >
            <LinearGradient
              colors={["#FFF1F2", "#FFE4E6"]}
              style={styles.streakGradient}
            >
              <Ionicons name="flame" size={20} color="#E11D48" />
              <Text style={styles.streakText}>
                {milestonesData?.current_streak ?? 0}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Culturally Blind AI Warning Banner */}
        {isBlindMode && (
          <View style={styles.blindWarningBanner} testID="home-blind-warning-banner">
            <View style={styles.blindWarningIconWrap}>
              <Ionicons name="warning" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.blindWarningTitle}>
                ⚠️ High Abandonment Risk: Culturally Alienating Meal Plan
              </Text>
              <Text style={styles.blindWarningSub}>
                Qloo Cultural Graph bypassed. Defaults to generic boiled chicken & rice with 0% cultural fit. Tap the top toggle to re-activate Qloo.
              </Text>
            </View>
          </View>
        )}

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

        {/* Calorie Hero Card */}
        <View style={styles.hero} testID="home-calorie-card">
          <View style={styles.heroHeader}>
            <Text style={styles.heroEyebrow}>DAILY CALORIES</Text>
            <Text style={styles.heroTarget}>
              Goal: {Math.round(s?.goals.calories || 2000)} kcal
            </Text>
          </View>
          <View style={styles.heroBody}>
            <Ring
              size={136}
              stroke={13}
              progress={calProgress}
              color={colors.accent}
              trackColor="#F1F5F9"
            >
              <Text style={styles.calLeft}>{calLeft}</Text>
              <Text style={styles.calLabel}>CALORIES LEFT</Text>
            </Ring>

            <View style={styles.heroStatsCol}>
              <View style={styles.statBox}>
                <View
                  style={[styles.statIconWrap, { backgroundColor: "#FFF7ED" }]}
                >
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                </View>
                <View>
                  <Text style={styles.statValue}>
                    {Math.round(s?.totals.calories || 0)}
                  </Text>
                  <Text style={styles.statLabel}>Eaten</Text>
                </View>
              </View>

              <View style={styles.statBox}>
                <View
                  style={[styles.statIconWrap, { backgroundColor: "#EFF6FF" }]}
                >
                  <Ionicons name="flag" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.statValue}>
                    {Math.round(s?.goals.calories || 0)}
                  </Text>
                  <Text style={styles.statLabel}>Target</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Macros Breakdown (6 Macros - 3 and 3 Horizontal Swipe with 2 Dots) */}
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text style={styles.sectionHeaderTitle}>Macro Breakdown</Text>
            <View style={styles.macroBottomDotsContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  macroScrollRef.current?.scrollTo({ x: 0, animated: true });
                  setMacroPageIndex(0);
                }}
                style={[
                  styles.macroDot,
                  macroPageIndex === 0 && styles.macroDotActive,
                ]}
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  macroScrollRef.current?.scrollTo({
                    x: macroPageWidth,
                    animated: true,
                  });
                  setMacroPageIndex(1);
                }}
                style={[
                  styles.macroDot,
                  macroPageIndex === 1 && styles.macroDotActive,
                ]}
              />
            </View>
          </View>

          <ScrollView
            ref={macroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const page = Math.round(offsetX / (macroPageWidth || 1));
              if (page !== macroPageIndex && (page === 0 || page === 1)) {
                setMacroPageIndex(page);
              }
            }}
            scrollEventThrottle={16}
          >
            {/* Page 1: Protein, Carbs, Fats */}
            <View style={[styles.macrosRow, { width: macroPageWidth }]}>
              <MacroRing
                label="Protein"
                macroType="protein"
                value={s?.totals.protein_g || 0}
                goal={s?.goals.protein_g || 140}
                color="#FF5E00"
              />
              <MacroRing
                label="Carbs"
                macroType="carbs"
                value={s?.totals.carbs_g || 0}
                goal={s?.goals.carbs_g || 220}
                color="#F59E0B"
              />
              <MacroRing
                label="Fats"
                macroType="fats"
                value={s?.totals.fat_g || 0}
                goal={s?.goals.fat_g || 65}
                color="#0284C7"
              />
            </View>

            {/* Page 2: Fiber, Sugar, Magnesium */}
            <View style={[styles.macrosRow, { width: macroPageWidth }]}>
              <MacroRing
                label="Fiber"
                macroType="fiber"
                value={s?.totals.fiber_g || 0}
                goal={s?.goals.fiber_g || 28}
                color="#10B981"
              />
              <MacroRing
                label="Sugar"
                macroType="sugar"
                value={s?.totals.sugar_g || 0}
                goal={s?.goals.sugar_g || 30}
                color="#EC4899"
              />
              <MacroRing
                label="Magnesium"
                macroType="magnesium"
                value={s?.totals.magnesium_mg || 0}
                goal={s?.goals.magnesium_mg || 400}
                color="#A78BFA"
                unit="mg"
              />
            </View>
          </ScrollView>

          {/* Dots Indicator Below Pager */}
          <View
            style={[
              styles.macroBottomDotsContainer,
              { marginTop: 10, justifyContent: "center" },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                macroScrollRef.current?.scrollTo({ x: 0, animated: true });
                setMacroPageIndex(0);
              }}
              style={[
                styles.macroDot,
                macroPageIndex === 0 && styles.macroDotActive,
              ]}
            />
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                macroScrollRef.current?.scrollTo({
                  x: macroPageWidth,
                  animated: true,
                });
                setMacroPageIndex(1);
              }}
              style={[
                styles.macroDot,
                macroPageIndex === 1 && styles.macroDotActive,
              ]}
            />
          </View>
        </View>

        {/* Hackathon Judge Persona Quick Switcher */}
        <View style={styles.judgeSwitcherCard} testID="home-judge-persona-switcher">
          <View style={styles.judgeSwitcherHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="sparkles" size={13} color="#C084FC" />
              <Text style={styles.judgeSwitcherTitle}>JUDGE DEMO: 1-TAP TASTE PERSONAS</Text>
            </View>
            <TouchableOpacity
              style={styles.judgeCompareHeaderBtn}
              onPress={() => setComparisonModalOpen(true)}
              activeOpacity={0.8}
              testID="home-open-comparison-modal-btn"
            >
              <Ionicons name="git-compare" size={11} color="#FFFFFF" />
              <Text style={styles.judgeCompareHeaderBtnText}>SPLIT VIEW</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.judgeSwitcherSubtitle}>
            Test how Qloo instantly rewires the cultural graph and macro recommendations:
          </Text>
          <View style={styles.judgePersonaRow}>
            {[
              { id: "alex", label: "Alex", icon: "🍣", desc: "Tokyo & Cinema" },
              { id: "elena", label: "Elena", icon: "🍋", desc: "Amalfi & Jazz" },
              { id: "marcus", label: "Marcus", icon: "🌮", desc: "Oaxaca & Hip-Hop" },
            ].map((p) => {
              const active = currentPersonaId === p.id;
              const loading = switchingPersona === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.judgePersonaPill, active && styles.judgePersonaPillActive]}
                  onPress={() => handleSwitchPersona(p.id)}
                  disabled={Boolean(switchingPersona)}
                  activeOpacity={0.75}
                  testID={`judge-persona-${p.id}`}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#C084FC" />
                  ) : (
                    <>
                      <Text style={styles.judgePersonaIcon}>{p.icon}</Text>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={[styles.judgePersonaName, active && styles.judgePersonaNameActive]}>
                          {p.label}
                        </Text>
                        <Text style={styles.judgePersonaDesc} numberOfLines={1}>
                          {p.desc}
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Side-by-Side Comparison Quick Banner */}
          <TouchableOpacity
            style={styles.judgeSideBySideBanner}
            onPress={() => setComparisonModalOpen(true)}
            activeOpacity={0.85}
            testID="home-open-split-view-banner"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Ionicons name="git-compare" size={13} color="#C084FC" />
              <Text style={styles.judgeSideBySideBannerText}>
                ⚡ Compare Side-by-Side: Blind AI (0%) vs. Qloo Attuned (96%)
              </Text>
            </View>
            <View style={styles.judgeSideBySideBadge}>
              <Text style={styles.judgeSideBySideBadgeText}>View Split</Text>
              <Ionicons name="arrow-forward" size={10} color="#E9D5FF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Cultural Recommendation Card - Qloo Taste AI Integration */}
        <View style={styles.culturalCardContainer} testID="home-cultural-card">
          <LinearGradient
            colors={["#1E1B4B", "#2E1065"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.culturalGradient}
          >
            {/* Header Badge & Match Score */}
            <View style={styles.culturalHeader}>
              <View
                style={[
                  styles.culturalBadge,
                  isBlindMode && {
                    borderColor: "rgba(239, 68, 68, 0.45)",
                    backgroundColor: "rgba(239, 68, 68, 0.18)",
                  },
                ]}
              >
                <Ionicons
                  name={isBlindMode ? "alert-circle" : "sparkles"}
                  size={13}
                  color={isBlindMode ? "#EF4444" : "#C084FC"}
                />
                <Text
                  style={[
                    styles.culturalBadgeText,
                    isBlindMode && { color: "#FCA5A5" },
                  ]}
                >
                  {isBlindMode ? "CULTURALLY BLIND AI (NO QLOO)" : "QLOO TASTE AI™"}
                </Text>
              </View>
              {(hasTasteProfile || isBlindMode) && (
                <View
                  style={[
                    styles.culturalScorePill,
                    isBlindMode && {
                      borderColor: "rgba(239, 68, 68, 0.5)",
                      backgroundColor: "rgba(239, 68, 68, 0.22)",
                    },
                  ]}
                >
                  <Ionicons
                    name={isBlindMode ? "close-circle" : "flame"}
                    size={12}
                    color={isBlindMode ? "#EF4444" : "#F59E0B"}
                  />
                  <Text
                    style={[
                      styles.culturalScoreText,
                      isBlindMode && { color: "#FCA5A5" },
                    ]}
                  >
                    {isBlindMode ? "0% CULTURAL FIT" : `${recMatchScore}% MATCH`}
                  </Text>
                </View>
              )}
            </View>

            {hasTasteProfile ? (
              <>
                {/* Title and Macro Gap Context */}
                <Text style={styles.culturalTitle}>{recDishName}</Text>
                {topCulturalRec?.cultural_inspiration ? (
                  <Text
                    style={[
                      styles.culturalSub,
                      { color: "#E2E8F0", fontStyle: "italic", marginTop: 3 },
                    ]}
                  >
                    &ldquo;{topCulturalRec.cultural_inspiration}&rdquo;
                  </Text>
                ) : (
                  <Text style={styles.culturalSub}>
                    {topCulturalRec?.restaurant_anchor
                      ? `From ${topCulturalRec.restaurant_anchor} • `
                      : ""}
                    Tailored for your remaining{" "}
                    <Text style={styles.culturalHighlight}>
                      {Math.round(proteinRemaining)}g protein
                    </Text>{" "}
                    & cross-domain Taste DNA
                  </Text>
                )}

                {/* Cultural Tags / Chips */}
                <View style={styles.culturalChipsRow}>
                  {topCulturalRec?.calories ? (
                    <View
                      style={[
                        styles.culturalChip,
                        {
                          borderColor: "#A78BFA",
                          backgroundColor: "rgba(167, 139, 250, 0.18)",
                        },
                      ]}
                    >
                      <Ionicons name="flash" size={11} color="#C084FC" />
                      <Text
                        style={[
                          styles.culturalChipText,
                          { color: "#F3E8FF", fontWeight: "700" },
                        ]}
                      >
                        {topCulturalRec.calories} kcal •{" "}
                        {Math.round(topCulturalRec.protein_g || 0)}g P
                      </Text>
                    </View>
                  ) : null}
                  {(topCulturalRec as any)?.magnesium_mg ? (
                    <View
                      style={[
                        styles.culturalChip,
                        {
                          borderColor: "#34D399",
                          backgroundColor: "rgba(52, 211, 153, 0.18)",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        },
                      ]}
                    >
                      <Ionicons name="leaf" size={11} color="#34D399" />
                      <Text
                        style={[
                          styles.culturalChipText,
                          { color: "#D1FAE5", fontWeight: "700" },
                        ]}
                      >
                        {(topCulturalRec as any).magnesium_mg}mg Mg
                      </Text>
                    </View>
                  ) : null}
                  {recCuisines.slice(0, 3).map((tag: string, idx: number) => {
                    const tagMeta = getTasteEntityMeta(tag, "cuisines");
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.culturalChip,
                          {
                            borderColor: tagMeta.color,
                            backgroundColor: tagMeta.bg,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          },
                        ]}
                      >
                        <Ionicons name={tagMeta.icon} size={11} color={tagMeta.color} />
                        <Text style={[styles.culturalChipText, { color: "#FFFFFF", fontWeight: "600" }]}>
                          {tag}
                        </Text>
                      </View>
                    );
                  })}
                  <View
                    style={[styles.culturalChip, styles.culturalChipAccent]}
                  >
                    <Ionicons
                      name="musical-notes-outline"
                      size={11}
                      color="#E9D5FF"
                    />
                    <Text style={styles.culturalChipTextAccent}>
                      Film & Audio Aligned
                    </Text>
                  </View>
                </View>

                {/* Cultural Blindness Contrast Toggle & Comparison Card */}
                <TouchableOpacity
                  style={styles.contrastToggleBtn}
                  activeOpacity={0.8}
                  testID="home-cultural-contrast-toggle"
                  onPress={() => setShowBlindAiContrast((prev) => !prev)}
                >
                  <Ionicons name="git-compare-outline" size={13} color="#C084FC" />
                  <Text style={styles.contrastToggleText}>
                    {showBlindAiContrast
                      ? "Hide Blind AI Comparison"
                      : "⚡ Compare with Culturally Blind AI"}
                  </Text>
                  <Ionicons
                    name={showBlindAiContrast ? "chevron-up" : "chevron-down"}
                    size={13}
                    color="#C084FC"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.splitViewModalBtn}
                  activeOpacity={0.8}
                  testID="home-open-comparison-split-modal"
                  onPress={() => setComparisonModalOpen(true)}
                >
                  <Ionicons name="git-compare" size={13} color="#34D399" />
                  <Text style={styles.splitViewModalBtnText}>
                    ⚡ Open Side-by-Side Split View Modal
                  </Text>
                  <Ionicons name="expand-outline" size={12} color="#34D399" />
                </TouchableOpacity>

                {showBlindAiContrast && (
                  <View style={styles.comparisonContainer} testID="home-cultural-contrast-card">
                    <View style={styles.genericAiCard}>
                      <View style={styles.comparisonHeaderRow}>
                        <Ionicons name="alert-circle" size={13} color="#F87171" />
                        <Text style={styles.genericLabel}>⚠️ Culturally Blind AI (Without Qloo)</Text>
                      </View>
                      <Text style={styles.genericDish}>Plain Boiled Chicken Breast & White Rice</Text>
                      <Text style={styles.genericScore}>Cultural Alignment: 0% • Abandonment Risk: High</Text>
                      <Text style={styles.genericDescription}>
                        Generic LLMs have zero cultural intelligence. They reduce human nutrition to sterile numbers, causing 80%+ diet dropout.
                      </Text>
                    </View>

                    <View style={styles.qlooAiCard}>
                      <View style={styles.comparisonHeaderRow}>
                        <Ionicons name="sparkles" size={13} color="#34D399" />
                        <Text style={styles.qlooLabel}>✨ Caliwo + Qloo Taste Graph</Text>
                      </View>
                      <Text style={styles.qlooDish}>{recDishName}</Text>
                      <Text style={styles.qlooScore}>
                        {recMatchScore}% Match • Grounded in {topCulturalRec?.restaurant_anchor || "Taste DNA"}
                      </Text>
                      <Text style={styles.qlooDescription}>
                        Authentic dish bridging your film & music taste while hitting your remaining {Math.round(proteinRemaining)}g protein target.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.culturalActionsRow}>
                  {isBlindMode ? (
                    <TouchableOpacity
                      style={[styles.culturalPrimaryBtn, { backgroundColor: "#7C3AED" }]}
                      activeOpacity={0.85}
                      testID="home-cultural-restore-qloo"
                      onPress={handleToggleBlindMode}
                    >
                      <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                      <Text style={[styles.culturalPrimaryBtnText, { color: "#FFFFFF" }]}>
                        ⚡ Restore Qloo AI (96% Match)
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.culturalPrimaryBtn}
                      activeOpacity={0.85}
                      testID="home-cultural-ask-coach"
                      onPress={() => {
                        router.push({
                          pathname: "/(tabs)/coach",
                          params: { prompt: askCoachPrompt },
                        } as any);
                      }}
                    >
                      <Ionicons name="restaurant" size={14} color="#0F172A" />
                      <Text style={styles.culturalPrimaryBtnText}>
                        Ask Coach for Recipe
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.culturalSecondaryBtn}
                    activeOpacity={0.8}
                    testID="home-cultural-taste-dna"
                    onPress={() => router.push("/taste-onboarding" as any)}
                  >
                    <Ionicons
                      name="finger-print-outline"
                      size={15}
                      color="#E9D5FF"
                    />
                    <Text style={styles.culturalSecondaryBtnText}>
                      Taste DNA
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.culturalTitle}>
                  Bridge Taste DNA & Macros
                </Text>
                <Text style={styles.culturalSub}>
                  Connect your favorite cinema, music artists, and travel vibes
                  to unlock culturally-attuned recipes tailored to your
                  nutrition gaps.
                </Text>

                <TouchableOpacity
                  style={[styles.culturalPrimaryBtn, { marginTop: 14 }]}
                  activeOpacity={0.85}
                  testID="home-cultural-activate-dna"
                  onPress={() => router.push("/taste-onboarding" as any)}
                >
                  <Ionicons name="sparkles" size={14} color="#0F172A" />
                  <Text style={styles.culturalPrimaryBtnText}>
                    Activate Qloo Taste DNA
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Cross-Domain Cultural Discoveries Carousel */}
        {discoveriesData && discoveriesData.length > 0 && (
          <View
            style={styles.discoveriesSection}
            testID="home-taste-discoveries"
          >
            <View style={styles.discoveriesHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons name="sparkles" size={15} color="#A78BFA" />
                <Text style={styles.discoveriesTitle}>
                  Cross-Domain Cultural Discoveries
                </Text>
              </View>
              <Text style={styles.discoveriesSub}>
                Connecting your film & music taste to dining
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.discoveriesScroll}
            >
              {discoveriesData.map((item, idx) => {
                const matchPct = Math.round((item.score || 0.85) * 100);
                const itemMeta = getTasteEntityMeta(item.name);
                return (
                  <TouchableOpacity
                    key={`${item.qloo_entity_id || item.name}-${idx}`}
                    style={styles.discoveryCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      router.push({
                        pathname: "/(tabs)/coach",
                        params: {
                          prompt: `How does ${item.name} align with my cultural taste and macro goals?`,
                        },
                      } as any);
                    }}
                  >
                    <LinearGradient
                      colors={["#1E1B4B", "#0F172A"]}
                      style={styles.discoveryCardGradient}
                    >
                      <View style={styles.discoveryTopRow}>
                        <View style={styles.discoveryScorePill}>
                          <Text style={styles.discoveryScoreText}>
                            {matchPct}% MATCH
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: itemMeta.bg,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name={itemMeta.icon}
                            size={13}
                            color={itemMeta.color}
                          />
                        </View>
                      </View>

                      <Text style={styles.discoveryName} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <View style={styles.discoveryFooter}>
                        <Text style={styles.discoveryHint}>Ask AI Coach</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={12}
                          color="#A78BFA"
                        />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Water Tracking Card */}
        <View style={styles.card} testID="home-water-card">
          <View style={styles.cardHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View style={styles.waterIconWrap}>
                <Ionicons name="water" size={18} color="#0284C7" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Water Hydration</Text>
                <Text style={styles.cardSubTitle}>Daily target 2.5L</Text>
              </View>
            </View>
            <Text style={styles.cardValue}>
              {s?.water_ml || 0} / {s?.water_goal_ml || 2500} ml
            </Text>
          </View>
          <View style={styles.waterBar}>
            <View
              style={[
                styles.waterFill,
                { width: `${Math.min(100, waterProgress * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.waterBtnRow}>
            {[
              { l: "+250", v: 250 },
              { l: "+500", v: 500 },
              { l: "+750", v: 750 },
            ].map((b) => (
              <TouchableOpacity
                key={b.v}
                style={styles.waterBtn}
                onPress={() => addWater(b.v)}
                activeOpacity={0.8}
                testID={`water-${b.v}`}
              >
                <Ionicons name="add-circle" size={16} color={colors.accent} />
                <Text style={styles.waterBtnText}>{b.l} ml</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Health & Activity Cards (Steps & Sleep - Horizontal Row Layout with Enlarged Circle) */}
        <View style={{ gap: 12, marginBottom: 16 }}>
          {/* Steps Card */}
          <TouchableOpacity
            style={styles.activityCardHorizontal}
            onPress={() => router.push("/steps")}
            activeOpacity={0.85}
            testID="home-steps-card"
          >
            <Ring
              size={60}
              stroke={6}
              progress={
                steps ? Math.min(1, (steps.progress_pct || 0) / 100) : 0
              }
              color={colors.accent}
              trackColor="#F1F5F9"
            >
              <Ionicons name="footsteps" size={26} color={colors.accent} />
            </Ring>

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={styles.activityCardLabel}>Daily Steps</Text>
                <Text style={styles.activityCardPct}>
                  {Math.round(steps?.progress_pct || 0)}%
                </Text>
              </View>
              <Text style={styles.activityCardValue} testID="home-steps-count">
                {(steps?.steps || 0).toLocaleString()}
                <Text style={styles.activityCardGoal}>
                  {" "}
                  / {(steps?.goal || 10000).toLocaleString()}
                </Text>
              </Text>
              <Text style={styles.activityCardSub} numberOfLines={1}>
                {(steps as any)?.disconnected
                  ? "Disconnected · Tap to setup"
                  : steps?.goal_reached
                    ? "Goal achieved! 🎉"
                    : `${((steps?.distance_m || 0) / 1000).toFixed(1)} km · ${Math.round(steps?.calories || 0)} kcal`}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Sleep Card */}
          <TouchableOpacity
            style={styles.activityCardHorizontal}
            onPress={() => router.push("/sleep")}
            activeOpacity={0.85}
            testID="home-sleep-card"
          >
            <Ring
              size={60}
              stroke={6}
              progress={
                sleep ? Math.min(1, (sleep.progress_pct || 0) / 100) : 0
              }
              color="#7C3AED"
              trackColor="#F1F5F9"
            >
              <Ionicons name="moon" size={26} color="#7C3AED" />
            </Ring>

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={styles.activityCardLabel}>Night Sleep</Text>
                <Text style={[styles.activityCardPct, { color: "#7C3AED" }]}>
                  {Math.round(sleep?.progress_pct || 0)}%
                </Text>
              </View>
              <Text style={styles.activityCardValue} testID="home-sleep-hours">
                {sleep?.logged ? `${sleep.hours}h` : "0h"}
                <Text style={styles.activityCardGoal}>
                  {" "}
                  / {sleep?.goal_hours || 8}h
                </Text>
              </Text>
              <Text style={styles.activityCardSub} numberOfLines={1}>
                {sleep?.logged
                  ? sleep.quality
                    ? `${sleep.quality} quality`
                    : "Sleep tracked"
                  : "Tap to log sleep"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Body Weight Progress Quick Card */}
        <TouchableOpacity
          style={styles.weightHomeCard}
          onPress={() => router.push("/progress")}
          activeOpacity={0.85}
          testID="home-weight-card"
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
            }}
          >
            <View style={styles.weightHomeIconWrap}>
              <Ionicons name="scale" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.weightHomeTitle}>Body Weight</Text>
                {weightData?.stats?.bmi ? (
                  <View style={styles.bmiHomeBadge}>
                    <Text style={styles.bmiHomeBadgeText}>
                      BMI {weightData.stats.bmi}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.weightHomeSub}>
                {weightData?.stats?.current_weight_kg
                  ? `Current: ${weightData.stats.current_weight_kg} kg${
                      weightData.stats.goal_weight_kg
                        ? ` · Target: ${weightData.stats.goal_weight_kg} kg`
                        : ""
                    }`
                  : "Tap to log your weight and view progress"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.weightQuickLogBtn}
            onPress={(e) => {
              e.stopPropagation();
              setWeightModalOpen(true);
            }}
            activeOpacity={0.8}
            testID="home-quick-log-weight"
          >
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.weightQuickLogText}>Log</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* AI Coach Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Text style={styles.sectionHeaderTitle}>Coach Insights</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {suggestions.map((sug, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionCard}
                  activeOpacity={0.8}
                  onPress={() => router.push("/(tabs)/coach")}
                >
                  <View style={styles.suggestionIconWrap}>
                    <Ionicons
                      name={sug.icon as any}
                      size={20}
                      color={colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle}>{sug.title}</Text>
                    <Text style={styles.suggestionSub} numberOfLines={2}>
                      {sug.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Meal Plan CTA */}
        <TouchableOpacity
          style={styles.planCTA}
          onPress={() => router.push("/plan")}
          activeOpacity={0.9}
          testID="home-plan-cta"
        >
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            style={styles.planGradient}
          >
            <View style={styles.planCTAIcon}>
              <Ionicons name="sparkles" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planCTATitle}>AI Meal Plan & Recipes</Text>
              <Text style={styles.planCTASub}>
                Personalized weekly meals tailored to your goals
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Action Shortcuts */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/progress")}
            activeOpacity={0.8}
            testID="home-progress-cta"
          >
            <View style={[styles.quickIcon, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="stats-chart" size={18} color="#10B981" />
            </View>
            <Text style={styles.quickTitle}>Progress</Text>
            <Text style={styles.quickSub}>Analytics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/share-card")}
            activeOpacity={0.8}
            testID="home-share-cta"
          >
            <View style={[styles.quickIcon, { backgroundColor: "#F3E8FF" }]}>
              <Ionicons name="share-social" size={18} color="#7C3AED" />
            </View>
            <Text style={styles.quickTitle}>Share Week</Text>
            <Text style={styles.quickSub}>Card summary</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/milestones")}
            activeOpacity={0.8}
            testID="home-milestones-cta"
          >
            <View style={[styles.quickIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="trophy" size={18} color="#D97706" />
            </View>
            <Text style={styles.quickTitle}>Milestones</Text>
            <Text style={styles.quickSub}>Badges</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Meals Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Meals</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/diary")}
            activeOpacity={0.7}
            testID="home-see-all-meals"
          >
            <Text style={styles.linkText}>See all</Text>
          </TouchableOpacity>
        </View>

        {meals.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="restaurant" size={26} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No meals logged yet</Text>
            <Text style={styles.emptySub}>
              Snap a photo or record your meal to get instant AI nutritional
              insights.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/scan")}
              style={styles.emptyBtn}
              activeOpacity={0.85}
              testID="home-scan-cta"
            >
              <Ionicons name="camera" size={18} color={colors.white} />
              <Text style={styles.emptyBtnText}>Scan a meal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {meals.slice(0, 6).map((m) => (
              <TouchableOpacity
                key={m.meal_id}
                onPress={() => router.push(`/meal/${m.meal_id}`)}
                activeOpacity={0.85}
              >
                <MealCard meal={m} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Body Weight Logging Modal */}
      <WeightLogModal
        visible={weightModalOpen}
        initialWeightKg={
          weightData?.stats?.current_weight_kg || profileData?.weight_kg || 70.0
        }
        heightCm={profileData?.height_cm}
        goalWeightKg={
          weightData?.stats?.goal_weight_kg || profileData?.desired_weight_kg
        }
        onClose={() => setWeightModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["weight_history"] });
          queryClient.invalidateQueries({ queryKey: ["user_profile"] });
          queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
        }}
      />

      {/* Side-by-Side Culturally Blind vs. Qloo Attuned Comparison Modal */}
      <CulturalComparisonModal
        visible={comparisonModalOpen}
        initialPersonaId={currentPersonaId}
        onClose={() => setComparisonModalOpen(false)}
        onSelectPersona={(pId) => handleSwitchPersona(pId)}
      />
    </SafeAreaView>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const imageSource = getMealImageSource(meal);
  const timeStr = formatMealTime(meal.logged_at);

  const typeConfig: Record<string, { bg: string; text: string; icon: any }> = {
    breakfast: { bg: "#FEF3C7", text: "#D97706", icon: "sunny-outline" },
    lunch: { bg: "#DBEAFE", text: "#2563EB", icon: "partly-sunny-outline" },
    dinner: { bg: "#F3E8FF", text: "#7C3AED", icon: "moon-outline" },
    snack: { bg: "#DCFCE7", text: "#16A34A", icon: "nutrition-outline" },
  };

  const config = typeConfig[(meal.meal_type || "").toLowerCase()] || {
    bg: "#F1F5F9",
    text: "#64748B",
    icon: "restaurant-outline",
  };

  return (
    <View style={styles.mealRow} testID={`meal-row-${meal.meal_id}`}>
      {/* Meal Image */}
      <View style={styles.mealThumbWrap}>
        <Image source={imageSource} style={styles.mealThumbImage} />
      </View>

      {/* Meal Info */}
      <View style={{ flex: 1, justifyContent: "center", marginRight: 8 }}>
        <Text style={styles.mealTitle} numberOfLines={1}>
          {meal.title}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
          <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
            <Ionicons
              name={config.icon}
              size={11}
              color={config.text}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.typeBadgeText, { color: config.text }]}>
              {meal.meal_type}
            </Text>
          </View>
          {timeStr ? (
            <Text style={styles.mealTimeText}>• {timeStr}</Text>
          ) : null}
        </View>

        <Text style={styles.mealSub} numberOfLines={1}>
          P {Math.round(meal.protein_g)}g · C {Math.round(meal.carbs_g)}g · F{" "}
          {Math.round(meal.fat_g)}g
          {meal.magnesium_mg ? ` · Mg ${Math.round(meal.magnesium_mg)}mg` : ""}
        </Text>
      </View>

      {/* Calorie Pill at Top Right */}
      <View style={styles.topRightCalPill}>
        <Text style={styles.topRightCalText}>
          🔥 {Math.round(meal.calories)} kcal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerBlindToggle: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    ...shadowSm,
  },
  headerBlindToggleQloo: {
    borderColor: "rgba(167, 139, 250, 0.5)",
  },
  headerBlindToggleActive: {
    borderColor: "rgba(239, 68, 68, 0.6)",
  },
  headerBlindToggleGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 5,
  },
  headerBlindToggleText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  /* Culturally Blind AI Warning Banner */
  blindWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  blindWarningIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  blindWarningTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
    marginBottom: 3,
  },
  blindWarningSub: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 16,
    fontWeight: "500",
  },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  streakButton: { borderRadius: 999, ...shadowSm },
  streakGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  streakText: { fontSize: 16, fontWeight: "800", color: "#BE123C" },

  /* Calendar Strip */
  calendarWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
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

  /* Hero Card */
  hero: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    ...shadowMd,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1.2,
  },
  heroTarget: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
  },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calLeft: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -1,
  },
  calLabel: {
    fontSize: 9,
    color: "#64748B",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  heroStatsCol: {
    flex: 1,
    marginLeft: 24,
    gap: 14,
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },

  /* Section Header */
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
    marginLeft: 4,
  },

  /* Macros Row */
  macrosRow: {
    flexDirection: "row",
    gap: 10,
  },
  macroBottomDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
  },
  macroDotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF5E00",
  },

  /* Standard Card */
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    ...shadowSm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  cardSubTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  cardValue: { fontSize: 13, fontWeight: "800", color: "#0284C7" },
  waterIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  waterBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    marginTop: 14,
    overflow: "hidden",
  },
  waterFill: { height: "100%", backgroundColor: "#0284C7", borderRadius: 999 },
  waterBtnRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  waterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingVertical: 10,
  },
  waterBtnText: { fontWeight: "800", color: "#0F172A", fontSize: 12 },

  /* Activity Cards */
  activityCardHorizontal: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    ...shadowSm,
  },
  activityCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 14,
    ...shadowSm,
  },
  activityCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stepsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  ringPctText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0F172A",
  },
  activityCardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
    fontWeight: "800",
  },
  activityCardValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  activityCardGoal: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "700",
  },
  activityCardPct: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "800",
  },
  activityCardSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "600",
  },

  /* Coach Suggestions */
  suggestionCard: {
    width: 260,
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  suggestionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  suggestionSub: { fontSize: 11, color: "#64748B", lineHeight: 15 },

  /* Meal Plan CTA Banner */
  planCTA: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    ...shadowSm,
  },
  planGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  planCTAIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  planCTATitle: { fontSize: 14, fontWeight: "900", color: colors.white },
  planCTASub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  /* Quick Actions */
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  quickCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
    ...shadowSm,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },
  quickSub: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
    fontWeight: "600",
    textAlign: "center",
  },

  /* Recent Meals Section */
  sectionHeaderRow: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  linkText: { color: colors.accent, fontWeight: "800", fontSize: 13 },

  /* Meal Cards */
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    ...shadowSm,
  },
  mealThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    marginRight: 12,
  },
  mealThumbImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    resizeMode: "cover",
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  mealTimeText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },
  mealSub: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 3,
  },
  topRightCalPill: {
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFEDD5",
    alignSelf: "flex-start",
  },
  topRightCalText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent || "#FF5E00",
  },

  /* Empty State */
  empty: {
    alignItems: "center",
    padding: 28,
    borderRadius: 24,
    backgroundColor: colors.white,
    ...shadowSm,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyBtnText: { color: colors.white, fontWeight: "800", fontSize: 13 },

  /* Body Weight Home Card */
  weightHomeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  weightHomeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF0E5",
    alignItems: "center",
    justifyContent: "center",
  },
  weightHomeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  bmiHomeBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bmiHomeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
  },
  weightHomeSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  weightQuickLogBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 3,
  },
  weightQuickLogText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.white,
  },

  /* Judge Persona Quick Switcher */
  judgeSwitcherCard: {
    borderRadius: 16,
    backgroundColor: "rgba(30, 27, 75, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    padding: 13,
    marginBottom: 14,
  },
  judgeSwitcherHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  judgeSwitcherTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#C084FC",
    letterSpacing: 0.8,
  },
  judgeSwitcherBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  judgeSwitcherBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.5,
  },
  judgeCompareHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A78BFA",
  },
  judgeCompareHeaderBtnText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  judgeSideBySideBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(124, 58, 237, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  judgeSideBySideBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F3E8FF",
    flexShrink: 1,
  },
  judgeSideBySideBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(192, 132, 252, 0.25)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  judgeSideBySideBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  splitViewModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.35)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  splitViewModalBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#6EE7B7",
  },
  judgeSwitcherSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.65)",
    lineHeight: 16,
    marginBottom: 10,
  },
  judgePersonaRow: {
    flexDirection: "row",
    gap: 8,
  },
  judgePersonaPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  judgePersonaPillActive: {
    backgroundColor: "rgba(167, 139, 250, 0.22)",
    borderColor: "#A78BFA",
  },
  judgePersonaIcon: {
    fontSize: 18,
  },
  judgePersonaName: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.75)",
  },
  judgePersonaNameActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  judgePersonaDesc: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.5)",
  },

  /* Cultural Recommendation Card - Qloo Taste AI */
  culturalCardContainer: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
    ...shadowMd,
  },
  culturalGradient: {
    padding: 18,
    borderRadius: 20,
  },
  culturalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  culturalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(192, 132, 252, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.3)",
  },
  culturalBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#C084FC",
  },
  culturalScorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  culturalScoreText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F59E0B",
  },
  culturalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  culturalSub: {
    fontSize: 13,
    color: "#CBD5E1",
    lineHeight: 18,
    marginBottom: 12,
  },
  culturalHighlight: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  culturalChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  culturalChip: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  culturalChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  culturalChipAccent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  culturalChipTextAccent: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E9D5FF",
  },
  culturalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  culturalPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#38BDF8",
    paddingVertical: 11,
    borderRadius: 12,
    ...shadowSm,
  },
  culturalPrimaryBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  culturalSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  culturalSecondaryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E9D5FF",
  },
  discoveriesSection: {
    marginBottom: 20,
  },
  discoveriesHeader: {
    marginBottom: 12,
  },
  discoveriesTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  discoveriesSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  discoveriesScroll: {
    gap: 12,
    paddingRight: 16,
  },
  discoveryCard: {
    width: 200,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    ...shadowSm,
  },
  discoveryCardGradient: {
    padding: 14,
    minHeight: 120,
    justifyContent: "space-between",
  },
  discoveryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  discoveryScorePill: {
    backgroundColor: "rgba(167, 139, 250, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
  },
  discoveryScoreText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#C084FC",
    letterSpacing: 0.5,
  },
  discoveryName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F8FAFC",
    lineHeight: 18,
    marginVertical: 4,
  },
  discoveryFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  discoveryHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#A78BFA",
  },

  /* Cultural Blindness Contrast Card Styles */
  contrastToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(192, 132, 252, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.28)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  contrastToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E9D5FF",
    letterSpacing: 0.2,
  },
  comparisonContainer: {
    gap: 10,
    marginBottom: 14,
  },
  genericAiCard: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    borderRadius: 12,
    padding: 12,
  },
  qlooAiCard: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.32)",
    borderRadius: 12,
    padding: 12,
  },
  comparisonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  genericLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F87171",
    letterSpacing: 0.3,
  },
  genericDish: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E2E8F0",
    marginTop: 3,
    marginBottom: 2,
  },
  genericScore: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FCA5A5",
  },
  genericDescription: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.65)",
    marginTop: 4,
    lineHeight: 14,
  },
  qlooLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.3,
  },
  qlooDish: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 3,
    marginBottom: 2,
  },
  qlooScore: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6EE7B7",
  },
  qlooDescription: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 4,
    lineHeight: 14,
  },
});
