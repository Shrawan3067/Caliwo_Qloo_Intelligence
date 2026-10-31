import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { useRouter } from "expo-router";

const FEATURES = [
  {
    i: "restaurant" as const,
    t: "Unlimited AI Meal Plans",
    s: "Custom 7-day culturally aligned meal plans on demand",
  },
  {
    i: "sparkles" as const,
    t: "Unlimited Recipe Creator",
    s: "Hyper-personalized recipes based on your pantry & Qloo taste DNA",
  },
  {
    i: "camera" as const,
    t: "Unlimited Photo Scans",
    s: "Snap every meal & snack with GPT-4o vision",
  },
  {
    i: "chatbubble-ellipses" as const,
    t: "Autonomous AI Coach",
    s: "Real-time nutrition gap bridging with Qloo cultural intelligence",
  },
  {
    i: "globe" as const,
    t: "Qloo 6-Domain Taste Graph",
    s: "Cinema, music, dining, and travel affinities synthesized into your nutrition",
  },
];

const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
  },
  android: { elevation: 4 },
  default: {},
});

export default function PaywallScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.bg} edges={["top", "bottom"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeIconBtn}
          testID="paywall-close-btn"
        >
          <Ionicons name="close" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="star" size={26} color={colors.accent} />
          </View>
          <Text style={styles.title}>Caliwo Pro Unlocked</Text>
          <Text style={styles.subtitle}>
            All features, autonomous meal planning, and Qloo Cultural Taste Graph recommendations are 100% active.
          </Text>
          <View style={styles.unlockedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={styles.unlockedBadgeText}>Full Access Enabled (Hackathon Edition)</Text>
          </View>
        </View>

        {/* Feature List */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.i} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.t}</Text>
                <Text style={styles.featureSub}>{f.s}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.ctaBtn, shadowMd]}
          onPress={() => router.back()}
          activeOpacity={0.9}
          testID="paywall-upgrade-btn"
        >
          <Text style={styles.ctaText}>Continue to Caliwo</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#FAF7F2" },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  closeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1EBE1",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 28,
  },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(184, 91, 53, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  unlockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(184, 91, 53, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 14,
  },
  unlockedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  },
  features: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(184, 91, 53, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  featureSub: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
