import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Share,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, radius, bgGradient } from "@/src/theme";
import {
  feedbackApi,
  FeedbackPostItem,
  FeedbackCommentItem,
} from "@/src/lib/feedbackApi";

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bg: string }
> = {
  feature_request: {
    label: "Feature Request",
    icon: "bulb-outline",
    color: "#8B5CF6",
    bg: "#F3E8FF",
  },
  bug_report: {
    label: "Bug Report",
    icon: "bug-outline",
    color: "#EF4444",
    bg: "#FEE2E2",
  },
  error_report: {
    label: "Error Report",
    icon: "warning-outline",
    color: "#F59E0B",
    bg: "#FEF3C7",
  },
  general_feedback: {
    label: "General Feedback",
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
    if (diffSec < 86400) return `${Math.floor(diffSec / 86400)}h ago`;
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

export default function FeedbackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<FeedbackPostItem | null>(null);
  const [comments, setComments] = useState<FeedbackCommentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [commentInput, setCommentInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<FeedbackCommentItem | null>(
    null,
  );
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (id) {
      feedbackApi
        .getPostDetails(id)
        .then((pData) => {
          setPost(pData.post);
          return feedbackApi.getComments(id);
        })
        .then((cData) => {
          if (cData) setComments(cData.comments || []);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const loadPostDetails = async () => {
    setLoading(true);
    try {
      const pData = await feedbackApi.getPostDetails(id);
      setPost(pData.post);
      const cData = await feedbackApi.getComments(id);
      setComments(cData.comments || []);
    } catch (e) {
      console.error("Failed to load post details", e);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextVoted = !post.has_voted;
    setPost({
      ...post,
      has_voted: nextVoted,
      votes_count: nextVoted
        ? post.votes_count + 1
        : Math.max(0, post.votes_count - 1),
    });

    try {
      await feedbackApi.toggleVote(post.id);
    } catch (e) {
      console.error(e);
      loadPostDetails();
    }
  };

  const handleFollow = async () => {
    if (!post) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextFollowing = !post.is_following;
    setPost({ ...post, is_following: nextFollowing });

    try {
      await feedbackApi.toggleFollow(post.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        title: post.title,
        message: `Check out this feedback idea on Nutri AI: "${post.title}"`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendComment = async () => {
    if (!commentInput.trim() || !post) return;
    setSubmittingComment(true);
    try {
      const res = await feedbackApi.addComment(
        post.id,
        commentInput.trim(),
        replyingTo?.id,
      );
      setComments((prev) => [...prev, res.comment]);
      setCommentInput("");
      setReplyingTo(null);
      Keyboard.dismiss();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } catch (e: any) {
      Alert.alert(
        "Comment Error",
        e?.response?.data?.detail || "Could not post comment.",
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading || !post) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const typeConf = TYPE_CONFIG[post.post_type] || TYPE_CONFIG.general_feedback;
  const statusConf = STATUS_CONFIG[post.status] || STATUS_CONFIG.under_review;
  const officialDevReply = comments.find((c) => c.is_official_dev_response);
  const initial = (post.author_name || "U").charAt(0).toUpperCase();

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            Discussion
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFollow}
              style={[
                styles.followBtn,
                post.is_following && styles.followBtnActive,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={
                  post.is_following ? "notifications" : "notifications-outline"
                }
                size={14}
                color={post.is_following ? "#FFFFFF" : colors.accent}
              />
              <Text
                style={[
                  styles.followBtnText,
                  post.is_following && styles.followBtnTextActive,
                ]}
              >
                {post.is_following ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 80 },
            ]}
          >
            {/* Main Post Card */}
            <View style={styles.mainPostCard}>
              {/* Badges Row */}
              <View style={styles.badgeRow}>
                <View
                  style={[styles.typeBadge, { backgroundColor: typeConf.bg }]}
                >
                  <Ionicons
                    name={typeConf.icon as any}
                    size={12}
                    color={typeConf.color}
                  />
                  <Text
                    style={[styles.typeBadgeText, { color: typeConf.color }]}
                  >
                    {typeConf.label}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusConf.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: statusConf.color },
                    ]}
                  >
                    {statusConf.label}
                  </Text>
                </View>
              </View>

              {/* Title & Description */}
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postDesc}>{post.description}</Text>

              {/* Technical / Bug Metadata */}
              {(post.steps_to_reproduce ||
                post.expected_behaviour ||
                post.actual_behaviour) && (
                <View style={styles.techDetailsBox}>
                  <Text style={styles.techHeading}>Diagnostic Context</Text>
                  {post.steps_to_reproduce && (
                    <Text style={styles.techLine}>
                      <Text style={{ fontWeight: "800" }}>Steps: </Text>
                      {post.steps_to_reproduce}
                    </Text>
                  )}
                  {post.expected_behaviour && (
                    <Text style={styles.techLine}>
                      <Text style={{ fontWeight: "800" }}>Expected: </Text>
                      {post.expected_behaviour}
                    </Text>
                  )}
                  {post.actual_behaviour && (
                    <Text style={styles.techLine}>
                      <Text style={{ fontWeight: "800" }}>Actual: </Text>
                      {post.actual_behaviour}
                    </Text>
                  )}
                </View>
              )}

              {/* Media Gallery */}
              {post.media_urls && post.media_urls.length > 0 && (
                <View style={styles.mediaGallery}>
                  {post.media_urls.map((url, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: url }}
                      style={styles.mediaImg}
                    />
                  ))}
                </View>
              )}

              {/* Post Author Footer & Actions */}
              <View style={styles.postFooterRow}>
                <View style={styles.authorRow}>
                  {post.author_avatar ? (
                    <Image
                      source={{ uri: post.author_avatar }}
                      style={styles.authorAvatar}
                    />
                  ) : (
                    <View style={styles.authorPlaceholder}>
                      <Text style={styles.authorInitial}>{initial}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.authorName}>
                      {post.author_name || "Community Member"}
                    </Text>
                    <Text style={styles.authorMeta}>
                      {post.category} • {formatRelativeTime(post.created_at)}
                    </Text>
                  </View>
                </View>

                {/* Vote Button */}
                <TouchableOpacity
                  onPress={handleVote}
                  style={[
                    styles.votePillBtn,
                    post.has_voted && styles.votePillBtnActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="caret-up"
                    size={18}
                    color={post.has_voted ? "#FFFFFF" : colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.votePillText,
                      post.has_voted && styles.votePillTextActive,
                    ]}
                  >
                    {post.votes_count} Upvotes
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Official Developer Response Banner */}
            {officialDevReply && (
              <View style={styles.devReplyCard}>
                <View style={styles.devHeaderRow}>
                  <View style={styles.devBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#8B5CF6"
                    />
                    <Text style={styles.devBadgeText}>
                      Official Caliwo Team Response
                    </Text>
                  </View>
                  <Text style={styles.devTime}>
                    {formatRelativeTime(officialDevReply.created_at)}
                  </Text>
                </View>
                <Text style={styles.devContent}>
                  {officialDevReply.content}
                </Text>
              </View>
            )}

            {/* Comments Header */}
            <View style={styles.commentsHeaderRow}>
              <Text style={styles.commentsSectionTitle}>
                Community Discussion ({comments.length})
              </Text>
            </View>

            {/* Comments List */}
            {comments.length === 0 ? (
              <View style={styles.emptyCommentsBox}>
                <Ionicons
                  name="chatbox-outline"
                  size={32}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                <Text style={styles.emptyCommentsSub}>
                  Start the conversation below!
                </Text>
              </View>
            ) : (
              comments.map((c) => {
                const cInitial = (c.author_name || "U").charAt(0).toUpperCase();
                return (
                  <View
                    key={c.id}
                    style={[
                      styles.commentCard,
                      c.is_official_dev_response && styles.commentDevCard,
                    ]}
                  >
                    <View style={styles.commentHeader}>
                      {c.author_avatar ? (
                        <Image
                          source={{ uri: c.author_avatar }}
                          style={styles.commentAvatar}
                        />
                      ) : (
                        <View style={styles.commentAvatarPlaceholder}>
                          <Text style={styles.commentInitial}>{cInitial}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text style={styles.commentAuthor}>
                            {c.author_name || "User"}
                          </Text>
                          {c.is_official_dev_response && (
                            <View style={styles.teamTag}>
                              <Text style={styles.teamTagText}>Nutri Team</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.commentTime}>
                          {formatRelativeTime(c.created_at)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setReplyingTo(c);
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          ).catch(() => {});
                        }}
                        style={styles.replyBtn}
                      >
                        <Ionicons
                          name="return-up-back"
                          size={14}
                          color={colors.accent}
                        />
                        <Text style={styles.replyBtnText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.commentBody}>{c.content}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Sticky Bottom Comment Bar */}
          <View
            style={[
              styles.bottomInputBar,
              { paddingBottom: Math.max(insets.bottom, 10) },
            ]}
          >
            {replyingTo && (
              <View style={styles.replyingBar}>
                <Text style={styles.replyingText}>
                  Replying to{" "}
                  <Text style={{ fontWeight: "900" }}>
                    @{replyingTo.author_name}
                  </Text>
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.commentTextInput}
                placeholder={
                  replyingTo
                    ? `Reply to ${replyingTo.author_name}...`
                    : "Add to discussion..."
                }
                placeholderTextColor={colors.textTertiary}
                value={commentInput}
                onChangeText={setCommentInput}
                multiline
              />
              <TouchableOpacity
                onPress={handleSendComment}
                disabled={submittingComment || !commentInput.trim()}
                style={[
                  styles.sendBtn,
                  (!commentInput.trim() || submittingComment) && {
                    opacity: 0.4,
                  },
                ]}
                activeOpacity={0.8}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    justifyContent: "space-between",
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
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.textPrimary,
    flex: 1,
    marginHorizontal: 10,
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 94, 0, 0.2)",
  },
  followBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  followBtnText: { fontSize: 12, fontWeight: "800", color: colors.accent },
  followBtnTextActive: { color: "#FFFFFF" },

  scrollContent: { paddingHorizontal: 16, paddingTop: 10 },

  /* Main Post Card */
  mainPostCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "800" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "800" },

  postTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },
  postDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },

  techDetailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  techHeading: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  techLine: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },

  mediaGallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  mediaImg: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },

  postFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  authorAvatar: { width: 32, height: 32, borderRadius: 16 },
  authorPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  authorInitial: { fontSize: 14, fontWeight: "900", color: colors.accent },
  authorName: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
  authorMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },

  votePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  votePillBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  votePillText: { fontSize: 13, fontWeight: "900", color: colors.textPrimary },
  votePillTextActive: { color: "#FFFFFF" },

  /* Dev Response Card */
  devReplyCard: {
    backgroundColor: "#F3E8FF",
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#C084FC",
  },
  devHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  devBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  devBadgeText: { fontSize: 12, fontWeight: "900", color: "#6B21A8" },
  devTime: { fontSize: 11, color: "#7E22CE" },
  devContent: { fontSize: 13, color: "#3B0764", lineHeight: 18 },

  /* Comments Header & List */
  commentsHeaderRow: { marginVertical: 10 },
  commentsSectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textPrimary,
  },

  emptyCommentsBox: { alignItems: "center", paddingVertical: 30 },
  emptyCommentsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textSecondary,
    marginTop: 8,
  },
  emptyCommentsSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

  commentCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: radius.lg,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  commentDevCard: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  commentAvatar: { width: 26, height: 26, borderRadius: 13 },
  commentAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  commentInitial: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
  },
  commentAuthor: { fontSize: 12, fontWeight: "800", color: colors.textPrimary },
  commentTime: { fontSize: 10, color: colors.textTertiary },
  teamTag: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  teamTagText: { fontSize: 9, fontWeight: "900", color: "#FFFFFF" },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  replyBtnText: { fontSize: 11, fontWeight: "800", color: colors.accent },
  commentBody: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },

  /* Bottom Comment Input Bar */
  bottomInputBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  replyingText: { fontSize: 12, color: colors.textSecondary },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentTextInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
