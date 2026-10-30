import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";
import { Ring } from "@/src/components/Ring";

type Today = { date: string; hours: number; goal_hours: number; progress_pct: number; quality: string | null; logged: boolean };
type HistoryEntry = { date: string; hours: number; quality: string | null };
type History = { entries: HistoryEntry[]; avg_hours: number; goal_hours: number; logged_days: number };

const QUALITY_OPTIONS: { k: "poor" | "fair" | "good" | "excellent"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { k: "poor", label: "Poor", icon: "sad-outline" },
  { k: "fair", label: "Fair", icon: "remove-circle-outline" },
  { k: "good", label: "Good", icon: "happy-outline" },
  { k: "excellent", label: "Excellent", icon: "star" },
];

export default function SleepScreen() {
  const router = useRouter();
  const [today, setToday] = useState<Today | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [hours, setHours] = useState("7.5");
  const [quality, setQuality] = useState<"poor" | "fair" | "good" | "excellent">("good");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([
        api.get<Today>("/sleep/today"),
        api.get<History>("/sleep/history", { params: { days: 14 } }),
      ]);
      setToday(t.data);
      setHistory(h.data);
      if (t.data.logged && t.data.hours > 0) {
        setHours(t.data.hours.toString());
        if (t.data.quality) setQuality(t.data.quality as any);
      }
    } catch (e) {
      console.log("sleep load err", e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    const h = parseFloat(hours);
    if (!h || h < 0 || h > 24) { Alert.alert("Enter hours between 0 and 24"); return; }
    setSaving(true);
    try {
      await api.post("/sleep/log", { hours: h, quality });
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.detail || "Try again");
    } finally { setSaving(false); }
  };

  const setGoal = async (g: number) => {
    try {
      await api.post("/sleep/goal", { daily_goal_hours: g });
      await load();
    } catch {}
  };

  const maxHours = Math.max(10, (today?.goal_hours || 8) + 2);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="sleep-back-btn">
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Sleep</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Today */}
        <View style={styles.hero}>
          <Ring size={180} stroke={16} progress={(today?.progress_pct || 0) / 100} color="#7C5CE6" trackColor={colors.surface}>
            <Text style={styles.heroValue}>{today?.hours || 0}</Text>
            <Text style={styles.heroUnit}>hours</Text>
          </Ring>
          <View style={{ marginTop: 14, alignItems: "center" }}>
            <Text style={styles.heroSub}>Goal · {today?.goal_hours || 8}h</Text>
            {today?.quality ? (
              <View style={styles.qBadge}>
                <Ionicons name="moon" size={12} color={colors.white} />
                <Text style={styles.qBadgeText}>{today.quality}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Log form */}
        <Text style={styles.label}>Log tonight{"\u2019"}s sleep</Text>
        <View style={styles.formCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput
              value={hours}
              onChangeText={setHours}
              keyboardType="decimal-pad"
              placeholder="7.5"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              testID="sleep-hours-input"
            />
            <Text style={{ fontWeight: "800", color: colors.textSecondary }}>hours</Text>
          </View>
          <View style={styles.qRow}>
            {QUALITY_OPTIONS.map((q) => (
              <TouchableOpacity
                key={q.k}
                onPress={() => setQuality(q.k)}
                style={[styles.qChip, quality === q.k && styles.qChipActive]}
                testID={`sleep-quality-${q.k}`}
              >
                <Ionicons name={q.icon} size={16} color={quality === q.k ? colors.white : colors.textPrimary} />
                <Text style={[styles.qChipText, quality === q.k && { color: colors.white }]}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} testID="sleep-save-btn">
            {saving ? <ActivityIndicator color={colors.white} /> : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.white} />
                <Text style={styles.saveBtnText}>Save sleep</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Goal */}
        <Text style={styles.label}>Daily goal</Text>
        <View style={styles.goalRow}>
          {[6, 7, 8, 9].map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => setGoal(g)}
              style={[styles.goalChip, (today?.goal_hours === g) && styles.goalChipActive]}
              testID={`sleep-goal-${g}`}
            >
              <Text style={[styles.goalChipText, today?.goal_hours === g && { color: colors.white }]}>{g}h</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* History */}
        <Text style={styles.label}>Last 14 nights · avg {history?.avg_hours || 0}h</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {(history?.entries || []).map((e) => {
              const pct = Math.min(1, e.hours / maxHours);
              const goalPct = Math.min(1, (today?.goal_hours || 8) / maxHours);
              const reached = e.hours >= (today?.goal_hours || 8);
              return (
                <View key={e.date} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.goalDash, { bottom: `${goalPct * 100}%` }]} />
                    <View style={[styles.barFill, { height: `${pct * 100}%`, backgroundColor: reached ? "#7C5CE6" : "#C4B7F0" }]} />
                  </View>
                  <Text style={styles.barLabel}>{e.date.slice(-2)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "900", color: colors.textPrimary, letterSpacing: -0.5 },
  hero: { alignItems: "center", padding: 24, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  heroValue: { fontSize: 44, fontWeight: "900", color: colors.textPrimary, letterSpacing: -1 },
  heroUnit: { fontSize: 11, color: colors.textSecondary, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  heroSub: { fontSize: 13, color: colors.textSecondary, fontWeight: "700" },
  qBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#7C5CE6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 6 },
  qBadgeText: { fontSize: 11, fontWeight: "900", color: colors.white, textTransform: "capitalize", letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: "900", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 22, marginBottom: 8 },
  formCard: { padding: 14, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, height: 52, fontSize: 22, fontWeight: "900", color: colors.textPrimary },
  qRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  qChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  qChipActive: { backgroundColor: "#7C5CE6", borderColor: "#7C5CE6" },
  qChipText: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
  saveBtn: { marginTop: 14, backgroundColor: colors.black, height: 52, borderRadius: 999, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: colors.white, fontWeight: "900", fontSize: 15 },
  goalRow: { flexDirection: "row", gap: 8 },
  goalChip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  goalChipActive: { backgroundColor: "#7C5CE6", borderColor: "#7C5CE6" },
  goalChipText: { fontWeight: "900", color: colors.textPrimary },
  chartCard: { padding: 14, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chartRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 150, gap: 2 },
  barCol: { flex: 1, alignItems: "center" },
  barTrack: { width: "80%", height: 120, backgroundColor: colors.surface, borderRadius: 8, justifyContent: "flex-end", overflow: "hidden", position: "relative" },
  barFill: { width: "100%", borderRadius: 8 },
  goalDash: { position: "absolute", left: -2, right: -2, height: 2, backgroundColor: colors.textTertiary, opacity: 0.6 },
  barLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: "800", marginTop: 6 },
});
