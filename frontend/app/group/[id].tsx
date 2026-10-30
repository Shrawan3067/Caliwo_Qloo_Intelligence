import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, bgGradient } from "@/src/theme";
import {
  groupsApi,
  GroupDetailsResponse,
  GroupMessageItem,
  LeaderboardMember,
} from "@/src/lib/groupsApi";
import { UserProfileModal } from "@/src/components/groups/UserProfileModal";
import { GroupShareModal } from "@/src/components/groups/GroupShareModal";
import { ReportModal } from "@/src/components/groups/ReportModal";

const EMOJI_REACTIONS = ["❤️", "🔥", "💪", "👏", "😂", "🎉", "💯"];
const STICKERS = ["🥗", "🏋️", "🥑", "🏆", "🔥", "💧", "🧘", "🍌"];

function formatMessageTime(dateStr: string) {
  if (!dateStr) return "";
  let isoStr = dateStr;
  if (
    !isoStr.endsWith("Z") &&
    !isoStr.includes("+") &&
    isoStr.indexOf("-", 10) === -1
  ) {
    isoStr += "Z";
  }
  const date = new Date(isoStr);
  return isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<GroupDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    "chat" | "leaderboard" | "members" | "about"
  >("chat");

  // Chat State
  const [messages, setMessages] = useState<GroupMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputContent, setInputContent] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GroupMessageItem | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<GroupMessageItem | null>(
    null,
  );
  const [stickerPickerVisible, setStickerPickerVisible] = useState(false);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([]);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<
    "daily" | "weekly" | "monthly" | "all_time"
  >("weekly");
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Members State
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modals
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [activeActionMessage, setActiveActionMessage] =
    useState<GroupMessageItem | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const fetchGroupDetails = useCallback(async () => {
    try {
      const data = await groupsApi.getGroupDetails(id);
      setGroup(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchMessages = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoadingMessages(true);
      try {
        const data = await groupsApi.getMessages(id);
        setMessages(data.messages);
        const pinned = data.messages.find((m) => m.is_pinned);
        if (pinned) setPinnedMessage(pinned);
      } catch (e) {
        console.error(e);
      } finally {
        if (showLoader) setLoadingMessages(false);
      }
    },
    [id],
  );

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await groupsApi.getLeaderboard(id, leaderboardTimeframe);
      setLeaderboard(data.leaderboard);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [id, leaderboardTimeframe]);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const data = await groupsApi.getMembers(id, memberSearchQuery);
      setMembers(data.members);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMembers(false);
    }
  }, [id, memberSearchQuery]);

  useEffect(() => {
    if (id) {
      fetchGroupDetails();
      fetchMessages();
    }
  }, [id, fetchGroupDetails, fetchMessages]);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      },
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (activeTab === "leaderboard" && id) {
      fetchLeaderboard();
    } else if (activeTab === "members" && id) {
      fetchMembers();
    }
  }, [activeTab, leaderboardTimeframe, id, fetchLeaderboard, fetchMembers]);

  const handleSendMessage = async (
    mediaType?: string,
    mediaUrl?: string,
    customText?: string,
  ) => {
    if (!inputContent.trim() && !mediaUrl && !customText) return;

    const contentToSend =
      customText?.trim() ||
      inputContent.trim() ||
      (mediaType === "sticker" ? mediaUrl : "");
    setInputContent("");
    setSending(true);

    try {
      const res = await groupsApi.sendMessage(
        id,
        contentToSend || "Attachment",
        mediaType,
        mediaUrl,
        replyingTo?.id,
      );

      setMessages((prev) => [...prev, res.message]);
      setReplyingTo(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    } catch (e: any) {
      Alert.alert(
        "Message Failed",
        e?.response?.data?.detail || "Could not send message",
      );
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      handleSendMessage("image", res.assets[0].uri);
    }
  };

  const handleReaction = async (msg: GroupMessageItem, emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await groupsApi.reactToMessage(id, msg.id, emoji);
      fetchMessages(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePin = async (msg: GroupMessageItem) => {
    try {
      const res = await groupsApi.togglePinMessage(id, msg.id);
      if (res.is_pinned) {
        setPinnedMessage(msg);
      } else {
        setPinnedMessage(null);
      }
      fetchMessages(false);
    } catch (e: any) {
      Alert.alert(
        "Permission Error",
        e?.response?.data?.detail || "Only mods can pin messages",
      );
    }
  };

  const handleDeleteMessage = async (msg: GroupMessageItem) => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await groupsApi.deleteMessage(id, msg.id);
              setMessages((prev) => prev.filter((m) => m.id !== msg.id));
              if (pinnedMessage?.id === msg.id) {
                setPinnedMessage(null);
              }
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ).catch(() => {});
            } catch (e: any) {
              Alert.alert(
                "Error",
                e?.response?.data?.detail || "Failed to delete message",
              );
            }
          },
        },
      ],
    );
  };

  const openUserProfile = (userId: string) => {
    setSelectedUserId(userId);
    setProfileModalVisible(true);
  };

  if (loading || !group) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const filteredMembers = members.filter((m) =>
    memberSearchQuery
      ? m.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
      : true,
  );

  return (
    <LinearGradient
      colors={bgGradient.colors}
      start={bgGradient.start}
      end={bgGradient.end}
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Modern Glass Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerMeta}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.groupHeaderTitle} numberOfLines={1}>
              {group.name}
            </Text>
          </View>
          <Text style={styles.groupHeaderSub}>
            {group.member_count} members • Active Now 🔥
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShareModalVisible(true)}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Ionicons
              name="share-social-outline"
              size={18}
              color={colors.textPrimary}
            />
          </TouchableOpacity>

          {(group.user_role === "owner" || group.user_role === "moderator") && (
            <TouchableOpacity
              onPress={() => router.push(`/group/settings/${group.id}` as any)}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Premium Segmented Tab Selector */}
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          {[
            {
              id: "chat",
              label: "Chat",
              icon: "chatbubble-ellipses-outline",
            },
            { id: "leaderboard", label: "Ranks", icon: "trophy-outline" },
            { id: "members", label: "Members", icon: "people-outline" },
            {
              id: "about",
              label: "About",
              icon: "information-circle-outline",
            },
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {},
                );
                setActiveTab(t.id as any);
              }}
              style={[
                styles.tabItem,
                activeTab === t.id && styles.tabItemActive,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon as any}
                size={15}
                color={
                  activeTab === t.id ? colors.accent : colors.textSecondary
                }
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.tabItemText,
                  activeTab === t.id && styles.tabItemTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* TAB 1: GROUP CHAT */}
      {activeTab === "chat" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 90 : 0}
        >
          {/* Pinned Message Banner */}
          {pinnedMessage && (
            <View style={styles.pinnedBanner}>
              <View style={styles.pinnedIconWrap}>
                <Ionicons name="pin" size={14} color={colors.accent} />
              </View>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={styles.pinnedTitle}>PINNED MESSAGE</Text>
                <Text style={styles.pinnedContent} numberOfLines={1}>
                  {pinnedMessage.sender_name}: {pinnedMessage.content}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => pinnedMessage && handleTogglePin(pinnedMessage)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Message Stream */}
          {loadingMessages ? (
            <View style={styles.centerLoader}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages.filter((m) => !m.is_deleted)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.chatListContent,
                messages.filter((m) => !m.is_deleted).length === 0 && {
                  flex: 1,
                  justifyContent: "center",
                },
              ]}
              onScrollToIndexFailed={(info) => {
                flatListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
              }}
              ListEmptyComponent={
                <View style={styles.emptyChatContainer}>
                  <View style={styles.emptyChatIconBox}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={40}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={styles.emptyChatTitle}>
                    Welcome to {group?.name || "the Group Chat"}! 👋
                  </Text>
                  <Text style={styles.emptyChatSub}>
                    No messages yet. Break the ice by saying hello or sharing
                    your daily nutrition goals!
                  </Text>
                  <View style={styles.emptyChatChipsRow}>
                    {[
                      {
                        label: "👋 Hey everyone!",
                        text: "👋 Hey everyone! Excited to join this group.",
                      },
                      {
                        label: "🥗 Logged a healthy meal!",
                        text: "🥗 Just logged a healthy meal today!",
                      },
                      {
                        label: "🔥 Ready for the streak!",
                        text: "🔥 Ready to keep our fitness streak strong!",
                      },
                    ].map((chip, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          ).catch(() => {});
                          handleSendMessage(undefined, undefined, chip.text);
                        }}
                        style={styles.emptyChatChip}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.emptyChatChipText}>
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              }
              renderItem={({ item }) => {
                if (item.is_deleted) return null;
                return (
                  <View style={styles.messageRow}>
                    <TouchableOpacity
                      onPress={() => openUserProfile(item.user_id)}
                      activeOpacity={0.8}
                    >
                      {item.sender_avatar ? (
                        <Image
                          source={{ uri: item.sender_avatar }}
                          style={styles.msgAvatar}
                        />
                      ) : (
                        <View
                          style={[styles.msgAvatar, styles.msgAvatarFallback]}
                        >
                          <Text style={styles.msgAvatarText}>
                            {item.sender_name[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.msgBubbleWrapper}>
                      <View style={styles.msgHeader}>
                        <TouchableOpacity
                          onPress={() => openUserProfile(item.user_id)}
                        >
                          <Text style={styles.msgSenderName}>
                            {item.sender_name}
                          </Text>
                        </TouchableOpacity>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Text style={styles.msgTime}>
                            {formatMessageTime(item.created_at)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => setActiveActionMessage(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={16}
                              color={colors.textTertiary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Parent message preview if reply */}
                      {item.parent_message && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            const index = messages.findIndex(
                              (m) => m.id === item.parent_message?.id,
                            );
                            if (index >= 0 && flatListRef.current) {
                              flatListRef.current.scrollToIndex({
                                index,
                                animated: true,
                                viewPosition: 0.5,
                              });
                            }
                          }}
                          style={styles.parentReplyBox}
                        >
                          <Text style={styles.parentSender}>
                            {item.parent_message.sender_name}
                          </Text>
                          <Text style={styles.parentText} numberOfLines={2}>
                            {item.parent_message.content}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Image Attachment */}
                      {item.media_type === "image" && item.media_url && (
                        <Image
                          source={{ uri: item.media_url }}
                          style={styles.msgAttachmentImage}
                        />
                      )}

                      {/* Sticker / GIF */}
                      {item.media_type === "sticker" ? (
                        <Text style={{ fontSize: 38, marginVertical: 4 }}>
                          {item.content}
                        </Text>
                      ) : (
                        <Text style={styles.msgText}>{item.content}</Text>
                      )}

                      {/* Message Reactions */}
                      {item.reactions && item.reactions.length > 0 && (
                        <View style={styles.reactionsRow}>
                          {item.reactions.map((rx: any, idx: number) => (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => handleReaction(item, rx.emoji)}
                              style={styles.reactionPill}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.reactionText}>
                                {rx.emoji} {rx.users.length}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* Sticker Picker Drawer */}
          {stickerPickerVisible && (
            <View style={styles.stickerDrawer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}
              >
                {STICKERS.map((stk) => (
                  <TouchableOpacity
                    key={stk}
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light,
                      ).catch(() => {});
                      handleSendMessage("sticker", stk);
                      setStickerPickerVisible(false);
                    }}
                    style={styles.stickerItem}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 28 }}>{stk}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Reply Bar */}
          {replyingTo && (
            <View style={styles.replyBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.replyTitle}>
                  Replying to {replyingTo.sender_name}
                </Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {replyingTo.content}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {},
                  );
                  setReplyingTo(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input Bar */}
          <View
            style={[
              styles.chatInputContainer,
              {
                marginBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 10),
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {},
                );
                setStickerPickerVisible(!stickerPickerVisible);
              }}
              style={[
                styles.inputActionBtn,
                stickerPickerVisible && styles.inputActionBtnActive,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={stickerPickerVisible ? "happy" : "happy-outline"}
                size={20}
                color={stickerPickerVisible ? colors.accent : "#64748B"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {},
                );
                handlePickImage();
              }}
              style={styles.inputActionBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={20} color="#64748B" />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.chatInput}
              placeholder="Share meal, progress or..."
              placeholderTextColor="#94A3B8"
              value={inputContent}
              onChangeText={setInputContent}
              multiline
              numberOfLines={1}
            />

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                  () => {},
                );
                handleSendMessage();
              }}
              disabled={sending || !inputContent.trim()}
              activeOpacity={0.85}
              style={styles.sendBtnWrapper}
            >
              <LinearGradient
                colors={
                  inputContent.trim() && !sending
                    ? [colors.accent, "#FF8A00"]
                    : ["#94A3B8", "#64748B"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.sendBtn,
                  (!inputContent.trim() || sending) && { opacity: 0.5 },
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="send"
                    size={15}
                    color="#FFFFFF"
                    style={{ marginLeft: 2 }}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* TAB 2: LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tabContent}
        >
          {/* Timeframe Selector */}
          <View style={styles.timeframeBar}>
            {[
              { id: "daily", label: "Daily" },
              { id: "weekly", label: "Weekly" },
              { id: "monthly", label: "Monthly" },
              { id: "all_time", label: "All Time" },
            ].map((tf) => (
              <TouchableOpacity
                key={tf.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {},
                  );
                  setLeaderboardTimeframe(tf.id as any);
                }}
                style={[
                  styles.tfBtn,
                  leaderboardTimeframe === tf.id && styles.tfBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.tfText,
                    leaderboardTimeframe === tf.id && styles.tfTextActive,
                  ]}
                >
                  {tf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingLeaderboard ? (
            <View style={styles.centerLoader}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="trophy-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>No Leaderboard Activity Yet</Text>
              <Text style={styles.emptySub}>
                Log meals and track daily streaks to earn points!
              </Text>
            </View>
          ) : (
            <>
              {/* Podium View for Top 3 */}
              {leaderboard.length >= 3 && (
                <View style={styles.podiumContainer}>
                  {/* Rank 2 - Silver */}
                  <TouchableOpacity
                    onPress={() => openUserProfile(leaderboard[1].user_id)}
                    style={styles.podiumCol}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[styles.podiumAvatar, { borderColor: "#94A3B8" }]}
                    >
                      <Text style={styles.podiumAvatarText}>
                        {leaderboard[1].username[0]}
                      </Text>
                      <View
                        style={[
                          styles.podiumBadge,
                          { backgroundColor: "#94A3B8" },
                        ]}
                      >
                        <Text style={styles.podiumBadgeText}>2</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {leaderboard[1].username}
                    </Text>
                    <Text style={styles.podiumScore}>
                      🔥 {leaderboard[1].current_streak}d streak
                    </Text>
                  </TouchableOpacity>

                  {/* Rank 1 - Gold */}
                  <TouchableOpacity
                    onPress={() => openUserProfile(leaderboard[0].user_id)}
                    style={[styles.podiumCol, { marginTop: -16 }]}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.podiumAvatar,
                        {
                          width: 74,
                          height: 74,
                          borderRadius: 37,
                          borderColor: "#F59E0B",
                        },
                      ]}
                    >
                      <Text style={[styles.podiumAvatarText, { fontSize: 26 }]}>
                        {leaderboard[0].username[0]}
                      </Text>
                      <View
                        style={[
                          styles.podiumBadge,
                          { backgroundColor: "#F59E0B" },
                        ]}
                      >
                        <Text style={styles.podiumBadgeText}>👑 1</Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.podiumName, { fontWeight: "900" }]}
                      numberOfLines={1}
                    >
                      {leaderboard[0].username}
                    </Text>
                    <Text
                      style={[styles.podiumScore, { color: colors.accent }]}
                    >
                      🔥 {leaderboard[0].current_streak}d streak
                    </Text>
                  </TouchableOpacity>

                  {/* Rank 3 - Bronze */}
                  <TouchableOpacity
                    onPress={() => openUserProfile(leaderboard[2].user_id)}
                    style={styles.podiumCol}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[styles.podiumAvatar, { borderColor: "#D97706" }]}
                    >
                      <Text style={styles.podiumAvatarText}>
                        {leaderboard[2].username[0]}
                      </Text>
                      <View
                        style={[
                          styles.podiumBadge,
                          { backgroundColor: "#D97706" },
                        ]}
                      >
                        <Text style={styles.podiumBadgeText}>3</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {leaderboard[2].username}
                    </Text>
                    <Text style={styles.podiumScore}>
                      🔥 {leaderboard[2].current_streak}d streak
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Rank List */}
              {leaderboard.map((item) => (
                <TouchableOpacity
                  key={item.user_id}
                  onPress={() => openUserProfile(item.user_id)}
                  style={[
                    styles.rankRow,
                    item.is_current_user && styles.rankRowCurrentUser,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rankNumber}>#{item.rank}</Text>
                  <View style={styles.rankAvatar}>
                    <Text style={styles.rankAvatarText}>
                      {item.username[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.rankName}>
                      {item.username} {item.is_current_user && "(You)"}
                    </Text>
                    <Text style={styles.rankSub}>
                      Max {item.longest_streak}d streak • {item.total_meals}{" "}
                      meals logged
                    </Text>
                  </View>
                  <Text style={styles.rankScore}>
                    🔥 {item.current_streak}d streak
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* TAB 3: MEMBERS */}
      {activeTab === "members" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tabContent}
        >
          {/* Member Search Bar */}
          <View style={styles.memberSearchBox}>
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textTertiary}
            />
            <TextInput
              style={styles.memberSearchInput}
              placeholder="Search group members..."
              placeholderTextColor={colors.textTertiary}
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
            />
          </View>

          {loadingMembers ? (
            <View style={styles.centerLoader}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : filteredMembers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="people-outline"
                size={44}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>No Members Found</Text>
            </View>
          ) : (
            filteredMembers.map((m) => (
              <TouchableOpacity
                key={m.user_id}
                onPress={() => openUserProfile(m.user_id)}
                style={styles.memberRow}
                activeOpacity={0.8}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name[0]}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={styles.memberName}>{m.name}</Text>
                    {m.role === "owner" && (
                      <View style={styles.ownerPill}>
                        <Text style={styles.ownerText}>👑 Owner</Text>
                      </View>
                    )}
                    {m.role === "moderator" && (
                      <View style={styles.modPill}>
                        <Text style={styles.modText}>🛡️ Mod</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberStreak}>
                    {m.current_streak} day streak 🔥
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* TAB 4: ABOUT */}
      {activeTab === "about" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tabContent}
        >
          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>About {group.name}</Text>
            <Text style={styles.aboutDesc}>{group.description}</Text>

            {/* Share & Invite Code Card */}
            <View style={styles.inviteShortcutCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shortcutCodeLabel}>INVITE CODE</Text>
                <Text style={styles.shortcutCodeValue}>
                  {group.invite_code}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShareModalVisible(true)}
                style={styles.shortcutShareBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code-outline" size={16} color="#FFFFFF" />
                <Text style={styles.shortcutShareText}>QR & Share</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>Group Rules</Text>
            {group.rules && group.rules.length > 0 ? (
              group.rules.map((rule, idx) => (
                <View key={idx} style={styles.aboutRuleItem}>
                  <View style={styles.ruleBadge}>
                    <Text style={styles.ruleBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.aboutRuleText}>{rule}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No custom rules defined.</Text>
            )}

            <TouchableOpacity
              onPress={() => setReportModalVisible(true)}
              style={styles.reportGroupBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="flag-outline" size={16} color={colors.danger} />
              <Text style={styles.reportGroupText}>Report Community</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Profile Modal */}
      <UserProfileModal
        visible={profileModalVisible}
        userId={selectedUserId}
        onClose={() => setProfileModalVisible(false)}
      />

      {/* Share Modal */}
      <GroupShareModal
        visible={shareModalVisible}
        groupName={group.name}
        inviteCode={group.invite_code}
        onClose={() => setShareModalVisible(false)}
      />

      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        groupId={group.id}
        onClose={() => setReportModalVisible(false)}
      />

      {/* Message Options Action Sheet Modal */}
      <Modal
        visible={!!activeActionMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveActionMessage(null)}
      >
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setActiveActionMessage(null)}
        >
          <View style={styles.actionSheetCard}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetHeaderTitle}>Message Actions</Text>

            {/* Quick Emoji Reactions */}
            <View style={styles.actionSheetEmojiRow}>
              {EMOJI_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => {
                    if (activeActionMessage) {
                      handleReaction(activeActionMessage, emoji);
                      setActiveActionMessage(null);
                    }
                  }}
                  style={styles.actionSheetEmojiItem}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionSheetDivider} />

            {/* Actions List */}
            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => {
                if (activeActionMessage) {
                  const targetMsg = activeActionMessage;
                  setReplyingTo(targetMsg);
                  setActiveActionMessage(null);
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 100);
                }
              }}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={18}
                color={colors.textPrimary}
              />
              <Text style={styles.actionSheetOptionText}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => {
                if (activeActionMessage) {
                  handleTogglePin(activeActionMessage);
                  setActiveActionMessage(null);
                }
              }}
            >
              <Ionicons
                name={activeActionMessage?.is_pinned ? "pin" : "pin-outline"}
                size={18}
                color={colors.accent}
              />
              <Text style={styles.actionSheetOptionText}>
                {activeActionMessage?.is_pinned
                  ? "Unpin Message"
                  : "Pin Message"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionSheetOption, { borderBottomWidth: 0 }]}
              onPress={() => {
                if (activeActionMessage) {
                  const targetMsg = activeActionMessage;
                  setActiveActionMessage(null);
                  handleDeleteMessage(targetMsg);
                }
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text
                style={[styles.actionSheetOptionText, { color: colors.danger }]}
              >
                Delete Message
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centerLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerMeta: { flex: 1, marginHorizontal: 12 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  groupHeaderTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  headerCategoryPill: {
    backgroundColor: "#FFF0E5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  headerCategoryText: { fontSize: 9, fontWeight: "900", color: colors.accent },
  groupHeaderSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: "600",
  },
  headerActions: { flexDirection: "row", gap: 8 },
  tabBarContainer: { paddingHorizontal: 16, marginBottom: 8 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: radius.pill,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  tabItemActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItemText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  tabItemTextActive: { color: colors.accent, fontWeight: "900" },
  chatListContent: { padding: 16, gap: 14 },
  pinnedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF0E5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FFD6BD",
  },
  pinnedIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  pinnedContent: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  messageRow: { flexDirection: "row", gap: 10 },
  msgAvatar: { width: 38, height: 38, borderRadius: 19 },
  msgAvatarFallback: {
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  msgBubbleWrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  msgHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  msgSenderName: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
  msgTime: { fontSize: 10, color: colors.textTertiary },
  parentReplyBox: {
    backgroundColor: "#F1F5F9",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  parentSender: { fontSize: 10, fontWeight: "800", color: colors.accent },
  parentText: { fontSize: 11, color: colors.textSecondary },
  msgAttachmentImage: {
    width: "100%",
    height: 160,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  msgText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  reactionPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reactionText: { fontSize: 11, fontWeight: "700" },
  msgActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  stickerDrawer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  stickerItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  replyTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accent,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  replyText: { fontSize: 12, color: "#0F172A", fontWeight: "500" },
  chatInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginHorizontal: 12,
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 5,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  inputActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  inputActionBtnActive: {
    backgroundColor: "#FFF7ED",
  },
  chatInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: "transparent",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#0F172A",
    fontWeight: "500",
  },
  sendBtnWrapper: {
    marginBottom: 1,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  tabContent: { padding: 16 },
  timeframeBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 16,
  },
  tfBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.pill,
  },
  tfBtnActive: { backgroundColor: colors.accent },
  tfText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  tfTextActive: { color: "#FFFFFF", fontWeight: "900" },
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 24,
    marginTop: 8,
  },
  podiumCol: { alignItems: "center", width: "30%" },
  podiumAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    position: "relative",
  },
  podiumAvatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  podiumBadge: {
    position: "absolute",
    bottom: -6,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 8,
  },
  podiumBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  podiumName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 10,
  },
  podiumScore: { fontSize: 11, color: colors.textSecondary, fontWeight: "700" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: radius.lg,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  rankRowCurrentUser: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: "#FFF0E5",
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textSecondary,
    width: 32,
  },
  rankAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rankAvatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  rankName: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  rankSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  rankScore: { fontSize: 15, fontWeight: "900", color: colors.accent },
  memberSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  memberSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: colors.textPrimary,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: radius.lg,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  memberName: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  memberStreak: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  ownerPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerText: { fontSize: 9, fontWeight: "800", color: "#D97706" },
  modPill: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modText: { fontSize: 9, fontWeight: "800", color: "#4338CA" },
  aboutCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: radius.xl,
  },
  aboutTitle: { fontSize: 20, fontWeight: "900", color: colors.textPrimary },
  aboutDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  inviteShortcutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: radius.md,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  shortcutCodeLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textTertiary,
  },
  shortcutCodeValue: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: 1,
    marginTop: 2,
  },
  shortcutShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  shortcutShareText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  aboutRuleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 8,
    gap: 10,
  },
  ruleBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  aboutRuleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
  },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  emptyText: { fontSize: 12, color: colors.textTertiary },
  reportGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
    paddingVertical: 10,
  },
  reportGroupText: { color: colors.danger, fontSize: 13, fontWeight: "800" },

  /* Empty Chat Interface Styles */
  emptyChatContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyChatIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 94, 0, 0.2)",
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyChatSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyChatChipsRow: {
    flexDirection: "column",
    gap: 10,
    width: "100%",
    maxWidth: 320,
  },
  emptyChatChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyChatChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.accent,
  },

  /* Message Action Sheet Styles */
  actionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  actionSheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 14,
  },
  actionSheetHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionSheetEmojiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  actionSheetEmojiItem: {
    padding: 6,
    borderRadius: 8,
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 4,
  },
  actionSheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  actionSheetOptionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
});
