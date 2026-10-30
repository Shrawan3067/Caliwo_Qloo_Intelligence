import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Line, Path, Rect, Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";

import { WeightLogModal } from "@/src/components/WeightLogModal";

type Daily = {
  day: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  hit_calorie_goal: boolean;
  hit_protein_goal: boolean;
};
type Weight = { weight_kg: number; logged_at: string; date?: string; weight_lbs?: number; change_prev_kg?: number; notes?: string };
type WeightStats = {
  current_weight_kg?: number;
  current_weight_lbs?: number;
  starting_weight_kg?: number;
  goal_weight_kg?: number;
  total_change_kg?: number;
  bmi?: number;
  bmi_category?: string;
  logs_count?: number;
};
type Summary = {
  range_days: number;
  daily: Daily[];
  weights: Weight[];
  averages: { calories: number; protein_g: number };
  streaks: { logging_streak_days: number };
  goals_hit: {
    calorie_days: number;
    protein_days: number;
    logged_days: number;
    of_days: number;
  };
  cal_goal: number;
  protein_goal: number;
};

const RANGES = [
  { k: 7, l: "7 Days" },
  { k: 14, l: "14 Days" },
  { k: 30, l: "30 Days" },
];

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 32;

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

import { useQueryClient } from "@tanstack/react-query";

export default function ProgressScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Summary | null>(null);
  const [weightHistory, setWeightHistory] = useState<Weight[]>([]);
  const [weightStats, setWeightStats] = useState<WeightStats | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (n: number) => {
    setLoading(true);
    try {
      const [sumRes, weightRes, profRes] = await Promise.all([
        api.get<Summary>("/progress/summary", { params: { days: n } }),
        api.get("/weight/history", { params: { days: 90 } }),
        api.get("/profile/me"),
      ]);
      setData(sumRes.data);
      if (weightRes.data) {
        setWeightHistory(weightRes.data.history || []);
        setWeightStats(weightRes.data.stats || null);
      }
      setUserProfile(profRes.data?.profile || {});
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(days);
    }, [days, load])
  );

  const handleDeleteWeight = (dateStr: string) => {
    Alert.alert(
      "Delete Weight Log",
      `Are you sure you want to delete the weight entry for ${dateStr}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/weight/log", { params: { date: dateStr } });
              queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
              queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
              queryClient.invalidateQueries({ queryKey: ["milestones"] });
              queryClient.invalidateQueries({ queryKey: ["nutrition_analytics"] });
              load(days);
            } catch {
              Alert.alert("Error", "Could not delete weight log.");
            }
          },
        },
      ]
    );
  };

  const displayWeights = weightHistory.length > 0 ? weightHistory : (data?.weights || []);

  // Compute Macro Distribution
  const avgP = data?.averages.protein_g || 0;
  const avgC = data?.daily ? Math.round(data.daily.reduce((acc, curr) => acc + curr.carbs_g, 0) / (data.daily.length || 1)) : 0;
  const avgF = data?.daily ? Math.round(data.daily.reduce((acc, curr) => acc + curr.fat_g, 0) / (data.daily.length || 1)) : 0;
  const totalMacroGrams = (avgP * 4) + (avgC * 4) + (avgF * 9) || 1;
  const pctP = Math.round(((avgP * 4) / totalMacroGrams) * 100);
  const pctC = Math.round(((avgC * 4) / totalMacroGrams) * 100);
  const pctF = Math.round(((avgF * 9) / totalMacroGrams) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
          testID="progress-back"
        >
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress & Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Date Range Chips */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = days === r.k;
          return (
            <TouchableOpacity
              key={r.k}
              onPress={() => setDays(r.k)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.85}
              testID={`range-chip-${r.k}`}
            >
              <Text
                style={[
                  styles.chipLabel,
                  active && { color: colors.white },
                ]}
              >
                {r.l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading || !data ? (
          <View style={{ paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* Top Stat Boxes */}
            <View style={styles.statsRow}>
              <StatBox
                icon="flame"
                iconColor="#EA580C"
                bgColor="#FFF7ED"
                label="Avg Calories"
                value={`${data.averages.calories}`}
                testID="stat-avg-cal"
              />
              <StatBox
                icon="barbell"
                iconColor="#10B981"
                bgColor="#ECFDF5"
                label="Avg Protein"
                value={`${data.averages.protein_g}g`}
                testID="stat-avg-prot"
              />
              <StatBox
                icon="trophy"
                iconColor="#8B5CF6"
                bgColor="#F5F3FF"
                label="Day Streak"
                value={`${data.streaks.logging_streak_days}d`}
                testID="stat-streak"
              />
            </View>

            {/* Calorie Trend Card */}
            <View style={styles.card} testID="progress-calorie-chart">
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Calorie Intake</Text>
                  <Text style={styles.cardSubtitle}>
                    Avg {data.averages.calories} kcal · Target {data.cal_goal} kcal
                  </Text>
                </View>
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>
                    {data.goals_hit.calorie_days}/{data.range_days} hit goal
                  </Text>
                </View>
              </View>

              <CalorieChart daily={data.daily} goal={data.cal_goal} />
            </View>

            {/* Macro Breakdown Card */}
            <View style={styles.card} testID="progress-macro-breakdown">
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Macro Distribution</Text>
                  <Text style={styles.cardSubtitle}>Average daily energy split</Text>
                </View>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={styles.macroSplitBar}>
                  <View style={[styles.macroSegment, { flex: Math.max(1, pctP), backgroundColor: "#10B981" }]} />
                  <View style={[styles.macroSegment, { flex: Math.max(1, pctC), backgroundColor: "#3B82F6" }]} />
                  <View style={[styles.macroSegment, { flex: Math.max(1, pctF), backgroundColor: "#F59E0B" }]} />
                </View>
                <View style={styles.macroLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                    <Text style={styles.legendText}>Protein {avgP}g ({pctP}%)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
                    <Text style={styles.legendText}>Carbs {avgC}g ({pctC}%)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                    <Text style={styles.legendText}>Fat {avgF}g ({pctF}%)</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Protein Intake Card */}
            <View style={styles.card} testID="progress-protein-chart">
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Protein Intake</Text>
                  <Text style={styles.cardSubtitle}>
                    Avg {data.averages.protein_g}g · Target {data.protein_goal}g
                  </Text>
                </View>
                <View style={[styles.headerBadge, { backgroundColor: "#ECFDF5" }]}>
                  <Text style={[styles.headerBadgeText, { color: "#10B981" }]}>
                    Target {data.protein_goal}g
                  </Text>
                </View>
              </View>

              <ProteinBars daily={data.daily} goal={data.protein_goal} />
            </View>


            {/* Weight Trend Line Chart */}
            <View style={styles.card} testID="progress-weight-chart">
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Body Weight Trend</Text>
                  {displayWeights.length >= 2 ? (
                    <Text style={styles.cardSubtitle}>
                      {displayWeights[0].weight_kg} kg →{" "}
                      {displayWeights[displayWeights.length - 1].weight_kg} kg (
                      {(
                        displayWeights[displayWeights.length - 1].weight_kg -
                        displayWeights[0].weight_kg
                      ) > 0 ? "+" : ""}
                      {(
                        displayWeights[displayWeights.length - 1].weight_kg -
                        displayWeights[0].weight_kg
                      ).toFixed(1)}{" "}
                      kg)
                    </Text>
                  ) : displayWeights.length === 1 ? (
                    <Text style={styles.cardSubtitle}>
                      Current: {displayWeights[0].weight_kg} kg ({((displayWeights[0].weight_kg) * 2.20462).toFixed(1)} lbs)
                    </Text>
                  ) : (
                    <Text style={styles.cardSubtitle}>
                      Log your body weight to view progress over time
                    </Text>
                  )}
                </View>

                {/* Quick Log Weight Action Button */}
                <TouchableOpacity
                  style={styles.quickLogWeightBtn}
                  onPress={() => setWeightModalOpen(true)}
                  activeOpacity={0.85}
                  testID="progress-log-weight-btn"
                >
                  <Ionicons name="add" size={16} color={colors.white} />
                  <Text style={styles.quickLogWeightText}>Log Weight</Text>
                </TouchableOpacity>
              </View>

              {/* Weight Key Metrics Grid */}
              {weightStats && (
                <View style={styles.weightMetricsGrid}>
                  <View style={styles.weightMetricItem}>
                    <Text style={styles.weightMetricLabel}>CURRENT</Text>
                    <Text style={styles.weightMetricVal}>
                      {weightStats.current_weight_kg ? `${weightStats.current_weight_kg} kg` : "—"}
                    </Text>
                  </View>
                  <View style={styles.weightMetricItem}>
                    <Text style={styles.weightMetricLabel}>GOAL</Text>
                    <Text style={styles.weightMetricVal}>
                      {weightStats.goal_weight_kg ? `${weightStats.goal_weight_kg} kg` : "—"}
                    </Text>
                  </View>
                  <View style={styles.weightMetricItem}>
                    <Text style={styles.weightMetricLabel}>CHANGE</Text>
                    <Text
                      style={[
                        styles.weightMetricVal,
                        {
                          color:
                            (weightStats.total_change_kg || 0) < 0
                              ? "#10B981"
                              : (weightStats.total_change_kg || 0) > 0
                              ? colors.accent
                              : "#0F172A",
                        },
                      ]}
                    >
                      {(weightStats.total_change_kg || 0) > 0 ? "+" : ""}
                      {weightStats.total_change_kg !== undefined
                        ? `${weightStats.total_change_kg} kg`
                        : "0.0 kg"}
                    </Text>
                  </View>
                  {weightStats.bmi ? (
                    <View style={styles.weightMetricItem}>
                      <Text style={styles.weightMetricLabel}>BMI</Text>
                      <Text style={styles.weightMetricVal}>{weightStats.bmi}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Line Chart */}
              {displayWeights.length >= 2 ? (
                <WeightLine weights={displayWeights} />
              ) : (
                <TouchableOpacity
                  style={styles.emptyWeightBox}
                  onPress={() => setWeightModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="scale-outline" size={32} color={colors.accent} />
                  <Text style={styles.emptyWeightTitle}>
                    {displayWeights.length === 1 ? "1 weight logged" : "No weight logs yet"}
                  </Text>
                  <Text style={styles.emptyText}>
                    Tap here to log your weight and build your trend line.
                  </Text>
                </TouchableOpacity>
              )}

              {/* Recent Weight Logs Table */}
              {displayWeights.length > 0 && (
                <View style={styles.weightLogsList}>
                  <Text style={styles.weightLogsListTitle}>Recent Logs</Text>
                  {[...displayWeights].reverse().slice(0, 5).map((w, idx) => {
                    const dateStr = w.date || w.logged_at?.split("T")[0] || "Today";
                    const lbs = w.weight_lbs || Number((w.weight_kg * 2.20462).toFixed(1));
                    return (
                      <View key={w.logged_at || `${dateStr}-${idx}`} style={styles.weightLogRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.weightLogDate}>{dateStr}</Text>
                          {w.notes ? <Text style={styles.weightLogNotes}>{w.notes}</Text> : null}
                        </View>
                        <View style={styles.weightLogValues}>
                          <Text style={styles.weightLogKg}>{w.weight_kg} kg</Text>
                          <Text style={styles.weightLogLbs}>{lbs} lbs</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteWeight(dateStr)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginLeft: 12 }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* Production-Ready Weight Log Modal */}
      <WeightLogModal
        visible={weightModalOpen}
        initialWeightKg={
          weightStats?.current_weight_kg || userProfile?.weight_kg || 70.0
        }
        heightCm={userProfile?.height_cm}
        goalWeightKg={weightStats?.goal_weight_kg || userProfile?.desired_weight_kg}
        onClose={() => setWeightModalOpen(false)}
        onSuccess={() => {
          load(days);
        }}
      />
    </SafeAreaView>
  );
}

function StatBox({
  icon,
  iconColor,
  bgColor,
  label,
  value,
  testID,
}: {
  icon: any;
  iconColor: string;
  bgColor: string;
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View style={styles.statBox} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CalorieChart({ daily, goal }: { daily: Daily[]; goal: number }) {
  const w = CHART_W - 32;
  const h = 140;
  const maxVal =
    Math.max(goal, ...daily.map((d) => d.calories)) * 1.15 || 2500;
  const stepX = w / Math.max(1, daily.length - 1);
  const points = daily.map((d, i) => ({
    x: i * stepX,
    y: h - (d.calories / maxVal) * h,
    hit: d.hit_calorie_goal,
    cal: d.calories,
  }));
  const path = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    )
    .join(" ");
  const goalY = h - (goal / maxVal) * h;

  return (
    <View style={{ marginTop: 12 }}>
      <Svg width={w} height={h + 24}>
        <Defs>
          <SvgGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0.0" />
          </SvgGradient>
        </Defs>

        {/* Goal line */}
        <Line
          x1={0}
          y1={goalY}
          x2={w}
          y2={goalY}
          stroke={colors.accent}
          strokeDasharray="4,4"
          strokeWidth={1.5}
        />
        {/* Area fill */}
        <Path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#calGrad)" />
        {/* Main Line */}
        <Path
          d={path}
          stroke={colors.accent}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={p.hit ? colors.accent : "#94A3B8"}
            stroke={colors.white}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View style={styles.chartXAxis}>
        {daily.map((d, i) => (
          <Text key={d.day} style={styles.chartXLabel}>
            {i === 0 ||
            i === daily.length - 1 ||
            i === Math.floor(daily.length / 2)
              ? d.day.slice(5)
              : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ProteinBars({ daily, goal }: { daily: Daily[]; goal: number }) {
  const w = CHART_W - 32;
  const h = 120;
  const maxVal = Math.max(goal, ...daily.map((d) => d.protein_g)) * 1.15 || 200;
  const barW = Math.max(6, w / daily.length - 6);

  return (
    <View style={{ marginTop: 12 }}>
      <Svg width={w} height={h + 20}>
        <Line
          x1={0}
          y1={h - (goal / maxVal) * h}
          x2={w}
          y2={h - (goal / maxVal) * h}
          stroke="#0F172A"
          strokeDasharray="3,4"
          strokeWidth={1}
        />
        {daily.map((d, i) => {
          const bh = (d.protein_g / maxVal) * h;
          const x = i * (w / daily.length) + 2;
          return (
            <Rect
              key={d.day}
              x={x}
              y={h - bh}
              width={barW}
              height={Math.max(3, bh)}
              rx={4}
              fill={d.hit_protein_goal ? "#10B981" : "#E2E8F0"}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function WeightLine({ weights }: { weights: Weight[] }) {
  const w = CHART_W - 32;
  const h = 140;
  const vals = weights.map((x) => x.weight_kg);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = Math.max(0.5, max - min);
  const stepX = w / Math.max(1, weights.length - 1);
  const points = weights.map((v, i) => ({
    x: i * stepX,
    y: h - ((v.weight_kg - min) / range) * (h - 30) - 15,
    val: v.weight_kg,
    date: v.date || v.logged_at?.split("T")[0] || "",
  }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <View style={{ marginTop: 14 }}>
      <Svg width={w} height={h + 20}>
        <Defs>
          <SvgGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0.0" />
          </SvgGradient>
        </Defs>

        {/* Gradient area fill */}
        <Path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#weightGrad)" />

        {/* Trend Line */}
        <Path
          d={path}
          stroke={colors.accent}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 6 : 4}
            fill={i === points.length - 1 ? colors.accent : "#0F172A"}
            stroke={colors.white}
            strokeWidth={2}
          />
        ))}
      </Svg>

      <View style={styles.chartXAxis}>
        <Text style={styles.chartXLabel}>{points[0]?.date || "Start"}</Text>
        {points.length > 2 && (
          <Text style={styles.chartXLabel}>{points[Math.floor(points.length / 2)]?.date}</Text>
        )}
        <Text style={styles.chartXLabel}>{points[points.length - 1]?.date || "Latest"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  rangeRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  chipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipLabel: { fontWeight: "800", fontSize: 13, color: "#0F172A" },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  statBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 10,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  /* Card Container */
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
  },
  headerBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  headerBadgeText: { fontSize: 11, fontWeight: "800", color: "#64748B" },

  /* Quick Log Weight Button */
  quickLogWeightBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  quickLogWeightText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.white,
  },

  /* Weight Key Metrics Grid */
  weightMetricsGrid: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "space-between",
  },
  weightMetricItem: {
    alignItems: "center",
    flex: 1,
  },
  weightMetricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  weightMetricVal: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
  },

  /* Recent Weight Logs */
  weightLogsList: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  weightLogsListTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
  },
  weightLogRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  weightLogDate: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  weightLogNotes: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  weightLogValues: {
    alignItems: "flex-end",
  },
  weightLogKg: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  weightLogLbs: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
  },

  /* Macro Split Bar */
  macroSplitBar: {
    height: 12,
    borderRadius: 999,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    gap: 3,
  },
  macroSegment: { height: "100%", borderRadius: 4 },
  macroLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: "700", color: "#475569" },

  /* Chart X Axis */
  chartXAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  chartXLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "700" },

  /* Empty Weight State */
  emptyWeightBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
  },
  emptyWeightTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
  },
});
