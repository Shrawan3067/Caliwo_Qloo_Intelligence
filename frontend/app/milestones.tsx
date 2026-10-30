import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { PremiumBadge } from "@/src/components/Badges";
import {
  BadgeItem,
  BadgeCategory,
  MilestonesSummary,
  fetchMilestones,
  getCachedMilestones,
  syncOfflineEvents,
  markCelebrationSeen,
  getPersistentlySeenBadges,
} from "@/src/modules/activity/engines/achievement.engine";
import { BadgeCelebrationModal } from "@/src/components/BadgeCelebrationModal";
import { ShareBadgeModal } from "@/src/components/ShareBadgeModal";

/* ---------- Category Tabs Configuration ---------- */
const CATEGORIES: { id: BadgeCategory; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "grid-outline" },
  { id: "streak", label: "Streak", icon: "flame-outline" },
  { id: "meals", label: "Meals", icon: "restaurant-outline" },
  { id: "calorie", label: "Calorie", icon: "disc-outline" },
  { id: "protein", label: "Protein", icon: "barbell-outline" },
  { id: "hydration", label: "Hydration", icon: "water-outline" },
  { id: "activity", label: "Activity", icon: "walk-outline" },
  { id: "community", label: "Community", icon: "people-outline" },
  { id: "special", label: "Special", icon: "star-outline" },
  { id: "lifetime", label: "Lifetime", icon: "ribbon-outline" },
];

/* ---------- Shared Shadow Elevation Tokens ---------- */
const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
  },
  android: { elevation: 3 },
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

/* ---------- Memoized Badge Card Component ---------- */
const BadgeCard = React.memo(({
  badge,
  onPress,
}: {
  badge: BadgeItem;
  onPress: (badge: BadgeItem) => void;
}) => {
  const unlocked = badge.unlocked || badge.earned;
  const pct = Math.min(100, Math.max(0, (badge.progress / badge.threshold) * 100));

  return (
    <TouchableOpacity
      style={[styles.badgeWrap, !unlocked && styles.badgeLockedWrap]}
      onPress={() => onPress(badge)}
      activeOpacity={0.85}
      testID={`milestone-${badge.id}`}
    >
      <View style={styles.badgeIconContainer}>
        <PremiumBadge
          id={badge.id}
          kind={badge.icon_kind}
          unlocked={unlocked}
          value={badge.value}
        />
        {unlocked && (
          <View style={styles.earnedCheckPill}>
            <Ionicons name="checkmark-sharp" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>

      <View style={styles.badgeTextContainer}>
        <Text
          style={[styles.badgeName, !unlocked && { color: "#64748B" }]}
          numberOfLines={1}
        >
          {badge.name}
        </Text>
        <Text style={styles.badgeDesc} numberOfLines={2}>
          {badge.desc}
        </Text>

        {/* Progress Bar for Locked State */}
        {!unlocked && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(badge.progress)} / {badge.threshold}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

/* ---------- Main Milestones Screen ---------- */
export default function MilestonesScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<MilestonesSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Celebration Modal State
  const [celebrationBadge, setCelebrationBadge] = useState<BadgeItem | null>(null);

  // Share Modal State
  const [shareBadge, setShareBadge] = useState<BadgeItem | null>(null);

  // Session deduplication to prevent showing the same badge repeatedly in a single screen session
  const seenBadgeIdsRef = useRef<Set<string>>(new Set());

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Check cached state first for fast render
      const cached = await getCachedMilestones();
      if (cached) setSummary(cached);

      // Attempt offline sync if any queued
      await syncOfflineEvents();

      // Fetch server data
      const data = await fetchMilestones();
      setSummary(data);

      // Check persistently seen badge IDs from local storage
      const persistentSeen = await getPersistentlySeenBadges();

      // Trigger celebration if unseen badges exist and haven't been shown before
      if (data.unseen_celebrations && data.unseen_celebrations.length > 0) {
        const nextUnseenId = data.unseen_celebrations.find(
          (id) => !seenBadgeIdsRef.current.has(id) && !persistentSeen.has(id)
        );
        if (nextUnseenId) {
          const target = data.badges.find((b) => b.id === nextUnseenId);
          if (target) {
            seenBadgeIdsRef.current.add(nextUnseenId);
            setCelebrationBadge(target);
          }
        }
      }
    } catch (err) {
      console.warn("Milestones loading error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCloseCelebration = useCallback(() => {
    if (celebrationBadge) {
      const badgeId = celebrationBadge.id;
      seenBadgeIdsRef.current.add(badgeId);
      markCelebrationSeen([badgeId]).catch(() => {});

      setSummary((prev) => {
        if (!prev) return prev;
        const updatedUnseen = (prev.unseen_celebrations || []).filter((id) => id !== badgeId);
        const updatedBadges = prev.badges.map((b) => (b.id === badgeId ? { ...b, seen: true } : b));

        const nextUnseenId = updatedUnseen.find((id) => !seenBadgeIdsRef.current.has(id));
        if (nextUnseenId) {
          const nextTarget = updatedBadges.find((b) => b.id === nextUnseenId);
          if (nextTarget) {
            seenBadgeIdsRef.current.add(nextUnseenId);
            setTimeout(() => {
              setCelebrationBadge(nextTarget);
            }, 100);
          }
        }
        return {
          ...prev,
          unseen_celebrations: updatedUnseen,
          badges: updatedBadges,
        };
      });
    }
    setCelebrationBadge(null);
  }, [celebrationBadge]);

  const handleShareCelebration = useCallback((badge: BadgeItem) => {
    seenBadgeIdsRef.current.add(badge.id);
    markCelebrationSeen([badge.id]).catch(() => {});

    setSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unseen_celebrations: (prev.unseen_celebrations || []).filter((id) => id !== badge.id),
        badges: prev.badges.map((b) => (b.id === badge.id ? { ...b, seen: true } : b)),
      };
    });

    setCelebrationBadge(null);
    setShareBadge(badge);
  }, []);

  // Filtered Badges Memoization
  const filteredBadges = useMemo(() => {
    if (!summary?.badges) return [];
    if (selectedCategory === "all") return summary.badges;
    return summary.badges.filter((b) => b.category === selectedCategory);
  }, [summary?.badges, selectedCategory]);

  const handleBadgePress = useCallback((badge: BadgeItem) => {
    setShareBadge(badge);
  }, []);

  const renderHeader = () => {
    const unlockedCount = summary?.unlocked ?? 0;
    const totalCount = summary?.total ?? 35;
    const overallPct = Math.round((unlockedCount / totalCount) * 100);

    return (
      <View style={styles.headerContainer}>
        {/* Top Summary Cards */}
        <View style={styles.statRow}>
          <View style={styles.statCard} testID="milestones-day-streak">
            <View style={[styles.statIconWrap, { backgroundColor: "#FFF1F2" }]}>
              <Ionicons name="flame" size={30} color="#E11D48" />
            </View>
            <Text style={styles.statLabel}>Day Streak</Text>
            <Text style={styles.statValue}>{summary?.current_streak ?? 0}</Text>
            <View style={styles.statSubPill}>
              <Text style={styles.statSubText}>
                {summary?.longest_streak ?? 0} days record
              </Text>
            </View>
          </View>

          <View style={styles.statCard} testID="milestones-badges-earned">
            <View style={[styles.statIconWrap, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="trophy" size={28} color="#10B981" />
            </View>
            <Text style={styles.statLabel}>Badges Earned</Text>
            <Text style={styles.statValue}>{unlockedCount}</Text>
            <View style={styles.statSubPill}>
              <Text style={styles.statSubText}>
                {unlockedCount}/{totalCount} Unlocked ({overallPct}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Overall Progress Bar */}
        <View style={styles.overallProgressCard}>
          <View style={styles.overallProgressHeader}>
            <Text style={styles.overallProgressTitle}>Overall Milestone Progress</Text>
            <Text style={styles.overallProgressValue}>{overallPct}%</Text>
          </View>
          <View style={styles.overallTrack}>
            <View style={[styles.overallFill, { width: `${overallPct}%` }]} />
          </View>
        </View>

        {/* Category Tabs */}
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const isActive = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                onPress={() => setSelectedCategory(item.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={isActive ? "#FFFFFF" : "#64748B"}
                />
                <Text
                  style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Navbar Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          activeOpacity={0.8}
          testID="milestones-back"
        >
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Milestones</Text>

        <TouchableOpacity
          onPress={() => {
            if (summary?.badges) {
              const unlockedBadges = summary.badges.filter((b) => b.unlocked || b.earned);
              const target = unlockedBadges.length > 0 ? unlockedBadges[unlockedBadges.length - 1] : summary.badges[0];
              if (target) setShareBadge(target);
            }
          }}
          style={styles.headerBtn}
          activeOpacity={0.8}
          testID="milestones-share"
        >
          <Ionicons name="share-outline" size={20} color="#0F172A" />
        </TouchableOpacity>

      </View>

      {loading && !summary ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredBadges}
          keyExtractor={(item) => item.id}
          numColumns={3}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <BadgeCard badge={item} onPress={handleBadgePress} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="ribbon-outline" size={40} color="#94A3B8" />
              <Text style={styles.emptyText}>No badges found in this category.</Text>
            </View>
          }
        />
      )}

      {/* Unlocked Badge Celebration Overlay */}
      <BadgeCelebrationModal
        badge={celebrationBadge}
        visible={!!celebrationBadge}
        onClose={handleCloseCelebration}
        onShare={handleShareCelebration}
      />

      {/* Share Badge Modal */}
      <ShareBadgeModal
        badge={shareBadge}
        userStreak={summary?.current_streak ?? 0}
        visible={!!shareBadge}
        onClose={() => setShareBadge(null)}
      />
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    ...shadowSm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 16,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowMd,
  },
  statIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  statSubPill: {
    marginTop: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statSubText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },

  overallProgressCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    ...shadowSm,
  },
  overallProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  overallProgressTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
  },
  overallProgressValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#10B981",
  },
  overallTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  overallFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 4,
  },

  categoriesList: {
    gap: 8,
    paddingBottom: 8,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryTabActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  categoryTabTextActive: {
    color: "#FFFFFF",
  },

  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 14,
  },
  badgeWrap: {
    width: "31.5%",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  badgeLockedWrap: {
    backgroundColor: "#F8FAFC",
    shadowOpacity: 0,
    elevation: 0,
  },
  badgeIconContainer: {
    marginBottom: 8,
    position: "relative",
  },
  earnedCheckPill: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#10B981",
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeTextContainer: {
    alignItems: "center",
    width: "100%",
  },
  badgeName: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 2,
  },
  badgeDesc: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 13,
    fontWeight: "500",
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    gap: 3,
  },
  progressBarTrack: {
    width: "80%",
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#94A3B8",
  },
  progressText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
  },

  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
});