import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, radius, bgGradient } from "@/src/theme";
import { feedbackApi, FeedbackPostItem } from "@/src/lib/feedbackApi";

const CATEGORIES = [
  "All",
  "AI",
  "Meal Scanning",
  "Nutrition",
  "Water Tracking",
  "Workouts",
  "Groups",
  "Widgets",
  "UI / UX",
  "Performance",
  "Notifications",
  "Integrations",
  "Other",
];

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  feature_request: {
    label: "Feature",
    icon: "bulb-outline",
    color: "#8B5CF6",
    bg: "#F3E8FF",
  },
  bug_report: {
    label: "Bug",
    icon: "bug-outline",
    color: "#EF4444",
    bg: "#FEE2E2",
  },
  error_report: {
    label: "Error",
    icon: "warning-outline",
    color: "#F59E0B",
    bg: "#FEF3C7",
  },
  general_feedback: {
    label: "Feedback",
    icon: "chatbox-ellipses-outline",
    color: "#10B981",
    bg: "#D1FAE5",
  },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  under_review: { label: "Under Review", color: "#4B5563", bg: "#F3F4F6" },
  planned: { label: "Planned 💡", color: "#2563EB", bg: "#DBEAFE" },
  in_progress: { label: "In Progress ⚙️", color: "#7C3AED", bg: "#F3E8FF" },
  testing: { label: "Testing 🧪", color: "#D97706", bg: "#FEF3C7" },
  released: { label: "Released 🎉", color: "#059669", bg: "#D1FAE5" },
  fixed: { label: "Fixed ✅", color: "#047857", bg: "#D1FAE5" },
  duplicate: { label: "Duplicate", color: "#6B7280", bg: "#E5E7EB" },
  declined: { label: "Declined", color: "#DC2626", bg: "#FEE2E2" },
  closed: { label: "Closed", color: "#4B5563", bg: "#E5E7EB" },
};

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return "Yesterday";
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function FeedbackHubScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "feed" | "roadmap" | "my_activity"
  >("feed");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedSort, setSelectedSort] = useState<
    "most_voted" | "trending" | "newest"
  >("most_voted");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [posts, setPosts] = useState<FeedbackPostItem[]>([]);
  const [roadmapPosts, setRoadmapPosts] = useState<{
    planned: FeedbackPostItem[];
    in_progress: FeedbackPostItem[];
    released: FeedbackPostItem[];
  }>({ planned: [], in_progress: [], released: [] });
  const [roadmapStatusTab, setRoadmapStatusTab] = useState<
    "planned" | "in_progress" | "released"
  >("in_progress");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, shipped: 0, votes: 0 });

  useEffect(() => {
    setLoading(true);
    feedbackApi
      .getPosts({
        post_type: selectedType === "all" ? undefined : selectedType,
        category: selectedCategory === "All" ? undefined : selectedCategory,
        sort: selectedSort,
        search: searchQuery.trim() || undefined,
        my_posts: activeTab === "my_activity" ? true : undefined,
      })
      .then((data) => {
        const fetched = data.posts || [];
        setPosts(fetched);
        setStats({
          total: fetched.length,
          shipped: fetched.filter((p) => p.status === "released" || p.status === "fixed").length,
          votes: fetched.reduce((acc, p) => acc + (p.votes_count || 0), 0),
        });
        setRoadmapPosts({
          planned: fetched.filter((p) => p.status === "planned"),
          in_progress: fetched.filter((p) => p.status === "in_progress" || p.status === "testing"),
          released: fetched.filter((p) => p.status === "released" || p.status === "fixed"),
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedType, selectedCategory, selectedSort, activeTab, searchQuery]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await feedbackApi.getPosts({
        post_type: selectedType === "all" ? undefined : selectedType,
        category: selectedCategory === "All" ? undefined : selectedCategory,
        sort: selectedSort,
        search: searchQuery.trim() || undefined,
        my_posts: activeTab === "my_activity" ? true : undefined,
      });

      const fetchedPosts = data.posts || [];
      setPosts(fetchedPosts);

      const totalCount = fetchedPosts.length;
      const shippedCount = fetchedPosts.filter(
        (p) => p.status === "released" || p.status === "fixed",
      ).length;
      const totalVotes = fetchedPosts.reduce(
        (acc, p) => acc + (p.votes_count || 0),
        0,
      );
      setStats({ total: totalCount, shipped: shippedCount, votes: totalVotes });

      setRoadmapPosts({
        planned: fetchedPosts.filter((p) => p.status === "planned"),
        in_progress: fetchedPosts.filter(
          (p) => p.status === "in_progress" || p.status === "testing",
        ),
        released: fetchedPosts.filter(
          (p) => p.status === "released" || p.status === "fixed",
        ),
      });
    } catch (e) {
      console.error("Failed to fetch feedback posts", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const handleVote = async (postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextVoted = !p.has_voted;
          return {
            ...p,
            has_voted: nextVoted,
            votes_count: nextVoted
              ? p.votes_count + 1
              : Math.max(0, p.votes_count - 1),
          };
        }
        return p;
      }),
    );

    try {
      await feedbackApi.toggleVote(postId);
    } catch (e) {
      console.error("Vote toggle error", e);
      fetchPosts();
    }
  };

  const hasActiveFilters = selectedCategory !== "All" || selectedSort !== "most_voted";

  const renderPostCard = (item: FeedbackPostItem) => {
    const typeConf =
      TYPE_CONFIG[item.post_type] || TYPE_CONFIG.general_feedback;
    const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.under_review;
    const initial = (item.author_name || "U").charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => router.push(`/feedback/${item.id}` as any)}
        style={styles.postCard}
        activeOpacity={0.88}
      >
        <View style={styles.postCardHeader}>
          {/* Vertical Upvote Pill */}
          <TouchableOpacity
            onPress={() => handleVote(item.id)}
            style={[styles.voteBox, item.has_voted && styles.voteBoxActive]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="caret-up"
              size={18}
              color={item.has_voted ? "#FFFFFF" : colors.textSecondary}
            />
            <Text
              style={[
                styles.voteCount,
                item.has_voted && styles.voteCountActive,
              ]}
            >
              {item.votes_count}
            </Text>
          </TouchableOpacity>

          {/* Main Card Content */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.badgeRow}>
              <View
                style={[styles.typeBadge, { backgroundColor: typeConf.bg }]}
              >
                <Ionicons
                  name={typeConf.icon as any}
                  size={11}
                  color={typeConf.color}
                />
                <Text style={[styles.typeBadgeText, { color: typeConf.color }]}>
                  {typeConf.label}
                </Text>
              </View>

              <View
                style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}
              >
                <Text
                  style={[styles.statusBadgeText, { color: statusConf.color }]}
                >
                  {statusConf.label}
                </Text>
              </View>
            </View>

            <Text style={styles.postTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.postDesc} numberOfLines={2}>
              {item.description}
            </Text>

            {/* Media thumbnails if present */}
            {item.media_urls && item.media_urls.length > 0 && (
              <View style={styles.mediaRow}>
                {item.media_urls.slice(0, 3).map((url, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: url }}
                    style={styles.mediaThumb}
                  />
                ))}
                {item.media_urls.length > 3 && (
                  <View style={styles.mediaMoreBox}>
                    <Text style={styles.mediaMoreText}>
                      +{item.media_urls.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Post Meta Info Footer */}
            <View style={styles.postMetaRow}>
              <View style={styles.authorGroup}>
                {item.author_avatar ? (
                  <Image
                    source={{ uri: item.author_avatar }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}
                <Text style={styles.postAuthor} numberOfLines={1}>
                  {item.author_name || "Community Member"}
                </Text>
              </View>

              <Text style={styles.postMetaDot}>•</Text>
              <Text style={styles.postCategoryPill}>{item.category}</Text>

              <Text style={styles.postMetaDot}>•</Text>
              <Text style={styles.timeText}>
                {formatRelativeTime(item.created_at)}
              </Text>

              <View style={{ flex: 1 }} />

              <View style={styles.commentCountRow}>
                <Ionicons
                  name="chatbox-outline"
                  size={13}
                  color={colors.textTertiary}
                />
                <Text style={styles.commentCountText}>
                  {item.comments_count}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
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
        {/* Compact Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle}>Community Feedback</Text>
            <View style={styles.inlineStatsRow}>
              <Text style={styles.inlineStatPill}>{stats.total} Ideas</Text>
              <Text style={styles.inlineStatDot}>•</Text>
              <Text style={[styles.inlineStatPill, { color: "#059669" }]}>
                {stats.shipped} Shipped
              </Text>
              <Text style={styles.inlineStatDot}>•</Text>
              <Text style={[styles.inlineStatPill, { color: colors.accent }]}>
                {stats.votes} Votes
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push("/feedback/changelog" as any);
            }}
            style={styles.changelogBadgeBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={13} color={colors.accent} />
            <Text style={styles.changelogBadgeText}>Updates</Text>
          </TouchableOpacity>
        </View>

        {/* Main Section Navigation Bar (Feed | Roadmap | My Activity) */}
        <View style={styles.mainTabRow}>
          {[
            { id: "feed", label: "Ideas", icon: "chatbubbles-outline" },
            { id: "roadmap", label: "Roadmap 🗺️", icon: "map-outline" },
            { id: "my_activity", label: "Mine", icon: "person-outline" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveTab(tab.id as any);
              }}
              style={[
                styles.mainTabBtn,
                activeTab === tab.id && styles.mainTabBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={
                  activeTab === tab.id ? colors.accent : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.mainTabText,
                  activeTab === tab.id && styles.mainTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "feed" || activeTab === "my_activity" ? (
          <>
            {/* Search & Filter Trigger Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={colors.textTertiary}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search features, bugs..."
                  placeholderTextColor={colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={() => fetchPosts()}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      fetchPosts();
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Modal Trigger Button */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setShowFilterModal(true);
                }}
                style={[
                  styles.filterToggleBtn,
                  hasActiveFilters && styles.filterToggleBtnActive,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={hasActiveFilters ? "#FFFFFF" : colors.textPrimary}
                />
                {hasActiveFilters && <View style={styles.activeFilterBadgeDot} />}
              </TouchableOpacity>
            </View>

            {/* Compact Type Chips Bar */}
            <View style={styles.typeSelectorRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollChipsContainer}
              >
                {[
                  {
                    id: "all",
                    label: "All",
                    icon: "apps-outline",
                    color: colors.textPrimary,
                  },
                  {
                    id: "feature_request",
                    label: "Features 💡",
                    icon: "bulb-outline",
                    color: "#8B5CF6",
                  },
                  {
                    id: "bug_report",
                    label: "Bugs 🐛",
                    icon: "bug-outline",
                    color: "#EF4444",
                  },
                  {
                    id: "general_feedback",
                    label: "Feedback 💬",
                    icon: "chatbox-ellipses-outline",
                    color: "#10B981",
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setSelectedType(item.id);
                    }}
                    style={[
                      styles.typePill,
                      selectedType === item.id && styles.typePillActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={12}
                      color={selectedType === item.id ? "#FFFFFF" : item.color}
                    />
                    <Text
                      style={[
                        styles.typePillText,
                        selectedType === item.id && styles.typePillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                {selectedCategory !== "All" && (
                  <TouchableOpacity
                    onPress={() => setSelectedCategory("All")}
                    style={styles.activeCatChip}
                  >
                    <Text style={styles.activeCatChipText}>
                      Cat: {selectedCategory} ✕
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* Main Feed Content */}
            {loading && !refreshing ? (
              <View style={styles.centerLoader}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={44}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyTitle}>
                  {activeTab === "my_activity"
                    ? "No Posts Submitted Yet"
                    : "No Feedback Posts Found"}
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === "my_activity"
                    ? "Share your suggestions or bug reports to track them here!"
                    : "Be the first to submit a feature request or bug report!"}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/feedback/create" as any)}
                  style={styles.emptyCreateBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyCreateBtnText}>Create Post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.accent}
                  />
                }
                renderItem={({ item }) => renderPostCard(item)}
              />
            )}
          </>
        ) : (
          /* Roadmap View */
          <View style={{ flex: 1 }}>
            {/* Roadmap Status Sub-Tabs */}
            <View style={styles.roadmapTabRow}>
              {[
                {
                  id: "in_progress",
                  label: "In Progress ⚙️",
                  count: roadmapPosts.in_progress.length,
                },
                {
                  id: "planned",
                  label: "Planned 💡",
                  count: roadmapPosts.planned.length,
                },
                {
                  id: "released",
                  label: "Released 🎉",
                  count: roadmapPosts.released.length,
                },
              ].map((rt) => (
                <TouchableOpacity
                  key={rt.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setRoadmapStatusTab(rt.id as any);
                  }}
                  style={[
                    styles.roadmapTabBtn,
                    roadmapStatusTab === rt.id && styles.roadmapTabBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roadmapTabText,
                      roadmapStatusTab === rt.id && styles.roadmapTabTextActive,
                    ]}
                  >
                    {rt.label} ({rt.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                />
              }
            >
              {roadmapPosts[roadmapStatusTab].length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons
                    name="map-outline"
                    size={44}
                    color={colors.textTertiary}
                  />
                  <Text style={styles.emptyTitle}>
                    No Posts in{" "}
                    {roadmapStatusTab.replace("_", " ").toUpperCase()}
                  </Text>
                  <Text style={styles.emptySub}>
                    Vote on ideas in the feed to help prioritize our product
                    roadmap!
                  </Text>
                </View>
              ) : (
                roadmapPosts[roadmapStatusTab].map((item) =>
                  renderPostCard(item),
                )
              )}
            </ScrollView>
          </View>
        )}

        {/* Floating Add Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push("/feedback/create" as any);
          }}
          style={styles.fab}
          activeOpacity={0.88}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Filter & Sort Bottom Sheet Modal */}
        <Modal
          visible={showFilterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilterModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFilterModal(false)}
          >
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filter & Sort</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* Sort By Section */}
              <Text style={styles.modalSectionTitle}>Sort Order</Text>
              <View style={styles.modalSortRow}>
                {[
                  { id: "most_voted", label: "Top Voted 🔥" },
                  { id: "trending", label: "Trending 📈" },
                  { id: "newest", label: "Newest ✨" },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelectedSort(s.id as any)}
                    style={[
                      styles.modalSortBtn,
                      selectedSort === s.id && styles.modalSortBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalSortText,
                        selectedSort === s.id && styles.modalSortTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category Grid Section */}
              <Text style={styles.modalSectionTitle}>Categories</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.modalCatChip,
                        selectedCategory === cat && styles.modalCatChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalCatChipText,
                          selectedCategory === cat && styles.modalCatChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Apply / Reset Actions */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategory("All");
                    setSelectedSort("most_voted");
                  }}
                  style={styles.resetBtn}
                >
                  <Text style={styles.resetBtnText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowFilterModal(false)}
                  style={styles.applyBtn}
                >
                  <Text style={styles.applyBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centerLoader: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* Compact Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerMeta: { flex: 1, marginHorizontal: 10 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: colors.textPrimary },
  inlineStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  inlineStatPill: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },
  inlineStatDot: { fontSize: 8, color: colors.textTertiary },
  changelogBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 94, 0, 0.2)",
  },
  changelogBadgeText: { fontSize: 11, fontWeight: "900", color: colors.accent },

  /* Main Tab Switcher */
  mainTabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginVertical: 6,
    gap: 6,
  },
  mainTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  mainTabBtnActive: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  mainTabText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  mainTabTextActive: { color: colors.accent, fontWeight: "900" },

  /* Search & Filter Toggle Container */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 6,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  filterToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  filterToggleBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  activeFilterBadgeDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
  },

  /* Type Selector Chips Row */
  typeSelectorRow: { marginBottom: 8 },
  scrollChipsContainer: { paddingHorizontal: 16, gap: 6, alignItems: "center" },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  typePillActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  typePillTextActive: { color: "#FFFFFF", fontWeight: "900" },
  activeCatChip: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  activeCatChipText: { fontSize: 10, fontWeight: "800", color: colors.accent },

  /* Feed List */
  listContent: { paddingHorizontal: 16, paddingBottom: 90, gap: 10 },
  postCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  postCardHeader: { flexDirection: "row" },
  voteBox: {
    width: 40,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  voteBoxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  voteCount: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textPrimary,
    marginTop: 1,
  },
  voteCountActive: { color: "#FFFFFF" },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: { fontSize: 10, fontWeight: "800" },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },

  postTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 4,
    lineHeight: 19,
  },
  postDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },

  mediaRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  mediaThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  mediaMoreBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaMoreText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 5,
  },
  authorGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  avatarImg: { width: 16, height: 16, borderRadius: 8 },
  avatarPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 8, fontWeight: "900", color: colors.accent },
  postAuthor: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    maxWidth: 90,
  },
  postCategoryPill: { fontSize: 10, fontWeight: "800", color: colors.accent },
  postMetaDot: { fontSize: 9, color: colors.textTertiary },
  timeText: { fontSize: 10, color: colors.textTertiary, fontWeight: "500" },
  commentCountRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  commentCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
  },

  /* Empty State */
  emptyBox: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 17,
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    marginTop: 14,
  },
  emptyCreateBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },

  /* Roadmap Tab */
  roadmapTabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 6,
  },
  roadmapTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: radius.md,
  },
  roadmapTabBtnActive: { backgroundColor: colors.textPrimary },
  roadmapTabText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
  },
  roadmapTabTextActive: { color: "#FFFFFF" },

  /* FAB */
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  /* Filter Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "900", color: colors.textPrimary },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 8,
  },
  modalSortRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modalSortBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  modalSortBtnActive: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  modalSortText: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
  modalSortTextActive: { color: colors.accent, fontWeight: "900" },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  modalCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#F3F4F6",
  },
  modalCatChipActive: { backgroundColor: colors.accent },
  modalCatChipText: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
  modalCatChipTextActive: { color: "#FFFFFF", fontWeight: "900" },

  modalFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  resetBtnText: { fontSize: 13, fontWeight: "800", color: colors.textSecondary },
  applyBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  applyBtnText: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
});

