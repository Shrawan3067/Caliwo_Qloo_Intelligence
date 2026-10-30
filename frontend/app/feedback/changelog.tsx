import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, radius, bgGradient } from "@/src/theme";
import { feedbackApi, ChangelogReleaseItem } from "@/src/lib/feedbackApi";

const DEFAULT_CHANGELOG: ChangelogReleaseItem[] = [
  {
    id: "rel_v240",
    version: "v2.4.0",
    release_date: "July 28, 2026",
    title: "Community Feedback Hub & Social Leaderboards",
    description:
      "Empowering the Nutri AI community to suggest features, track bug resolutions, build streak leaderboards, and join fitness challenges.",
    new_features: [
      "In-App Community Feedback Hub with feature voting & status tracking",
      "Social Group Leaderboards with Streak & Logged Meal scoring",
      "Sticker & GIF drawers in group chat discussions",
    ],
    improvements: [
      "WhatsApp & Messenger style keyboard avoidance in chat stream",
      "Instant message deletion without placeholder boxes",
      "Enhanced glassmorphic hero header animations",
    ],
    bug_fixes: [
      "Fixed bottom safe area padding offsets on iOS edge-to-edge screens",
      "Fixed group message duplication on reconnection",
    ],
    breaking_changes: [],
    reactions: { "🚀": 142, "🎉": 98, "🔥": 84 },
    created_at: new Date().toISOString(),
  },
  {
    id: "rel_v230",
    version: "v2.3.0",
    release_date: "July 15, 2026",
    title: "AI Meal Scanner 2.0 & Custom Widgets",
    description:
      "Faster macro extraction, lock-screen widget support, and personalized water intake goals.",
    new_features: [
      "Sub-second AI meal vision scanner with micronutrient estimation",
      "Lock Screen & Home Screen intake progress widgets",
    ],
    improvements: [
      "Improved offline caching for meal history",
      "Dynamic dark mode palette refinements",
    ],
    bug_fixes: ["Resolved timezone mismatch on daily streak calculation"],
    breaking_changes: [],
    reactions: { "🚀": 110, "❤️": 76 },
    created_at: new Date().toISOString(),
  },
];

export default function ChangelogScreen() {
  const router = useRouter();
  const [releases, setReleases] = useState<ChangelogReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChangelog();
  }, []);

  const fetchChangelog = async () => {
    setLoading(true);
    try {
      const res = await feedbackApi.getChangelog();
      if (res.releases && res.releases.length > 0) {
        setReleases(res.releases);
      } else {
        setReleases(DEFAULT_CHANGELOG);
      }
    } catch (e) {
      console.error(e);
      setReleases(DEFAULT_CHANGELOG);
    } finally {
      setLoading(false);
    }
  };

  const handleReact = (relId: string, emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReleases((prev) =>
      prev.map((r) => {
        if (r.id === relId) {
          const currentCount = r.reactions[emoji] || 0;
          return {
            ...r,
            reactions: { ...r.reactions, [emoji]: currentCount + 1 },
          };
        }
        return r;
      }),
    );
  };

  return (
    <LinearGradient
      colors={bgGradient.colors}
      start={bgGradient.start}
      end={bgGradient.end}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={styles.headerTitle}>Product Changelog</Text>
            <Text style={styles.headerSub}>What&apos;s new in Nutri AI</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {releases.map((rel) => (
              <View key={rel.id} style={styles.releaseCard}>
                {/* Version & Date Row */}
                <View style={styles.verHeaderRow}>
                  <View style={styles.verBadge}>
                    <Ionicons
                      name="pricetag-outline"
                      size={12}
                      color="#FFFFFF"
                    />
                    <Text style={styles.verBadgeText}>{rel.version}</Text>
                  </View>
                  <Text style={styles.verDate}>{rel.release_date}</Text>
                </View>

                <Text style={styles.relTitle}>{rel.title}</Text>
                <Text style={styles.relDesc}>{rel.description}</Text>

                {/* New Features */}
                {rel.new_features && rel.new_features.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.sectionHeading, { color: "#8B5CF6" }]}>
                      ✨ New Features
                    </Text>
                    {rel.new_features.map((item, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Ionicons
                          name="sparkles-outline"
                          size={14}
                          color="#8B5CF6"
                        />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Improvements */}
                {rel.improvements && rel.improvements.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text
                      style={[styles.sectionHeading, { color: colors.accent }]}
                    >
                      ⚡ Improvements
                    </Text>
                    {rel.improvements.map((item, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Ionicons
                          name="flash-outline"
                          size={14}
                          color={colors.accent}
                        />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Bug Fixes */}
                {rel.bug_fixes && rel.bug_fixes.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.sectionHeading, { color: "#059669" }]}>
                      🐛 Bug Fixes
                    </Text>
                    {rel.bug_fixes.map((item, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={14}
                          color="#059669"
                        />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Reactions Row */}
                <View style={styles.reactionsRow}>
                  {Object.entries(rel.reactions || {}).map(([emoji, count]) => (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => handleReact(rel.id, emoji)}
                      style={styles.reactionBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 14 }}>{emoji}</Text>
                      <Text style={styles.reactionCount}>{count}</Text>
                    </TouchableOpacity>
                  ))}
                  {/* Add reaction quick button */}
                  {["🚀", "🎉", "🔥", "❤️"].map(
                    (emoji) =>
                      !(rel.reactions || {})[emoji] && (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => handleReact(rel.id, emoji)}
                          style={styles.addReactionBtn}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 13 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ),
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centerLoader: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: colors.textPrimary },
  headerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    fontWeight: "600",
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 14,
  },
  releaseCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  verHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  verBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  verBadgeText: { fontSize: 11, fontWeight: "900", color: "#FFFFFF" },
  verDate: { fontSize: 11, fontWeight: "700", color: colors.textTertiary },

  relTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  relDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },

  sectionBlock: { marginBottom: 12 },
  sectionHeading: { fontSize: 12, fontWeight: "900", marginBottom: 6 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 17,
  },

  reactionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  reactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reactionCount: { fontSize: 11, fontWeight: "800", color: colors.textPrimary },
  addReactionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#F1F5F9",
  },
});
