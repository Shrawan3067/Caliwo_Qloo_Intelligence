import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";
import { LinearGradient } from "expo-linear-gradient";

type ShareCard = {
  week_range: { from: string; to: string };
  user: { name: string; picture: string | null };
  meals: {
    logged: number;
    on_target_days: number;
    total_calories: number;
    total_protein_g: number;
    daily_calorie_goal: number;
  };
  steps: { total: number; average: number; goal: number; logged_days: number };
  sleep: { average_hours: number; goal_hours: number; logged_days: number };
  weight_change_kg: number | null;
  streak_days: number;
  brand: string;
  generated_at: string;
};

export default function ShareCardScreen() {
  const router = useRouter();
  const [card, setCard] = useState<ShareCard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<ShareCard>("/share/weekly-card");
      setCard(r.data);
    } catch (e: any) {
      Alert.alert(
        "Failed",
        e?.response?.data?.detail || "Could not load your week",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onShare = async () => {
    if (!card) return;
    const summary = [
      `📊 My Caliwo week — ${fmtDate(card.week_range.from)} to ${fmtDate(card.week_range.to)}`,
      `🍽 ${card.meals.logged} meals logged (${card.meals.on_target_days}/7 on target)`,
      `👟 ${card.steps.total.toLocaleString()} steps · avg ${card.steps.average.toLocaleString()}/day`,
      card.sleep.average_hours
        ? `😴 ${card.sleep.average_hours}h avg sleep`
        : null,
      card.weight_change_kg !== null
        ? `⚖️ ${card.weight_change_kg > 0 ? "+" : ""}${card.weight_change_kg} kg`
        : null,
      `🔥 ${card.streak_days}-day streak`,
      "",
      "Powered by Caliwo — your AI nutrition coach",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await Share.share({ message: summary });
    } catch {}
  };

  if (loading || !card) {
    return (
      <SafeAreaView style={styles.safe}>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={colors.black} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="share-back-btn"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Your Week</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* The card that gets shared/rendered */}
        <View style={styles.cardWrap} testID="share-card">
          <LinearGradient
            colors={["#0E0E0E", "#232323"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.brandRow}>
              <View style={styles.brandDot}>
                <Ionicons name="flame" size={16} color={colors.white} />
              </View>
              <Text style={styles.brandText}>Caliwo</Text>
              <Text style={styles.brandDivider}>·</Text>
              <Text style={styles.brandDate}>
                {fmtDate(card.week_range.from)} – {fmtDate(card.week_range.to)}
              </Text>
            </View>

            <Text style={styles.hero}>
              <Text style={styles.heroName}>
                {card.user.name.split(" ")[0]}
              </Text>
              {"\n"}crushed the week.
            </Text>

            <View style={styles.streakRow}>
              <View style={styles.streakBadge}>
                <Ionicons name="flame" size={18} color={colors.accent} />
                <Text style={styles.streakText}>
                  {card.streak_days}-day streak
                </Text>
              </View>
              {card.weight_change_kg !== null ? (
                <View
                  style={[
                    styles.streakBadge,
                    { backgroundColor: "rgba(255,255,255,0.08)" },
                  ]}
                >
                  <Ionicons
                    name={
                      card.weight_change_kg <= 0
                        ? "trending-down"
                        : "trending-up"
                    }
                    size={16}
                    color={colors.white}
                  />
                  <Text style={[styles.streakText, { color: colors.white }]}>
                    {card.weight_change_kg > 0 ? "+" : ""}
                    {card.weight_change_kg} kg
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.statsGrid}>
              <Stat
                n={card.meals.logged.toString()}
                l="Meals"
                sub={`${card.meals.on_target_days}/7 on target`}
              />
              <Stat
                n={fmtNum(card.steps.total)}
                l="Total steps"
                sub={`${fmtNum(card.steps.average)}/day avg`}
              />
              <Stat
                n={
                  card.sleep.average_hours
                    ? `${card.sleep.average_hours}h`
                    : "—"
                }
                l="Avg sleep"
                sub={`goal ${card.sleep.goal_hours}h`}
              />
              <Stat
                n={fmtNum(card.meals.total_protein_g)}
                l="Protein (g)"
                sub={`${fmtNum(card.meals.total_calories)} cal total`}
              />
            </View>

            <View style={styles.footerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.footerLabel}>Powered by</Text>
                <Text style={styles.footerBrand}>Caliwo AI</Text>
              </View>
              <View style={styles.qrPlaceholder}>
                <Ionicons name="nutrition" size={26} color={colors.white} />
              </View>
            </View>
          </LinearGradient>
        </View>

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={onShare}
          testID="share-btn"
        >
          <Ionicons name="share-social" size={20} color={colors.white} />
          <Text style={styles.shareBtnText}>Share my week</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/progress")}
          testID="share-progress-btn"
        >
          <Text style={styles.secondaryBtnText}>See full progress</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtNum(n: number): string {
  return (n || 0).toLocaleString();
}

function Stat({ n, l, sub }: { n: string; l: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNumber}>{n}</Text>
      <Text style={styles.statLabel}>{l}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  cardWrap: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginTop: 8,
  },
  card: { padding: 24 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  brandDot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.white,
    letterSpacing: -0.3,
  },
  brandDivider: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    marginHorizontal: 2,
  },
  brandDate: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
  },
  hero: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.white,
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  heroName: { color: colors.accent },
  streakRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  streakText: { fontSize: 13, fontWeight: "900", color: colors.accent },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: {
    width: "47%",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.white,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },
  statSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  footerLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "800",
    letterSpacing: 1,
  },
  footerBrand: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  qrPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  shareBtn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    height: 58,
    borderRadius: 999,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  secondaryBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: "900",
    fontSize: 14,
  },
});
