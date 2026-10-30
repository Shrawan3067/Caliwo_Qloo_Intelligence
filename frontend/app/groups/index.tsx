import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, bgGradient } from "@/src/theme";
import { groupsApi, SocialGroupItem } from "@/src/lib/groupsApi";

const CATEGORIES = [
  "All",
  "Weight Loss",
  "Muscle Gain",
  "Healthy Eating",
  "Keto",
  "Vegan",
  "Running",
  "Gym",
  "Fasting",
  "Diabetes",
  "Custom",
];

export default function GroupsMainScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "discover" | "my_groups" | "create"
  >("discover");

  // Discover state
  const [discoverGroups, setDiscoverGroups] = useState<SocialGroupItem[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [discoverSort, setDiscoverSort] = useState<
    "trending" | "new" | "recommended" | "most_active"
  >("trending");

  // My Groups state
  const [myGroups, setMyGroups] = useState<SocialGroupItem[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);

  // Create Group Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Healthy Eating");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [maxMembers, setMaxMembers] = useState("");
  const [rules, setRules] = useState<string[]>([
    "Be respectful",
    "Share daily progress",
  ]);
  const [newRule, setNewRule] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (activeTab === "discover") {
      groupsApi
        .getDiscoverGroups(
          searchQuery,
          selectedCategory === "All" ? undefined : selectedCategory,
          discoverSort,
        )
        .then((res) => setDiscoverGroups(res.groups))
        .catch(console.error)
        .finally(() => setLoadingDiscover(false));
    } else if (activeTab === "my_groups") {
      groupsApi
        .getMyGroups()
        .then((res) => setMyGroups(res.groups))
        .catch(console.error)
        .finally(() => setLoadingMy(false));
    }
  }, [activeTab, searchQuery, selectedCategory, discoverSort]);

  const fetchDiscover = async () => {
    setLoadingDiscover(true);
    try {
      const data = await groupsApi.getDiscoverGroups(
        searchQuery,
        selectedCategory === "All" ? undefined : selectedCategory,
        discoverSort,
      );
      setDiscoverGroups(data.groups);
    } catch (e) {
      console.error("Fetch discover error:", e);
    } finally {
      setLoadingDiscover(false);
      setRefreshing(false);
    }
  };

  const fetchMyGroups = async () => {
    setLoadingMy(true);
    try {
      const data = await groupsApi.getMyGroups();
      setMyGroups(data.groups);
    } catch (e) {
      console.error("Fetch my groups error:", e);
    } finally {
      setLoadingMy(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === "discover") fetchDiscover();
    else if (activeTab === "my_groups") fetchMyGroups();
  };

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setImageUri(res.assets[0].uri);
    }
  };

  const handleAddRule = () => {
    if (newRule.trim()) {
      setRules([...rules, newRule.trim()]);
      setNewRule("");
    }
  };

  const handleCreateGroup = async () => {
    if (!name.trim() || name.length < 3) {
      Alert.alert("Error", "Please enter a group name (at least 3 characters)");
      return;
    }
    if (!description.trim() || description.length < 5) {
      Alert.alert(
        "Error",
        "Please enter a description (at least 5 characters)",
      );
      return;
    }

    setCreating(true);
    try {
      const res = await groupsApi.createGroup({
        name: name.trim(),
        description: description.trim(),
        category,
        privacy,
        max_members: maxMembers ? parseInt(maxMembers) : undefined,
        image_url: imageUri || undefined,
        rules,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      Alert.alert("Success!", "Group created successfully!", [
        {
          text: "Open Group",
          onPress: () => router.push(`/group/${res.group_id}` as any),
        },
      ]);
      // Reset form
      setName("");
      setDescription("");
      setImageUri(null);
      setActiveTab("my_groups");
    } catch (e: any) {
      Alert.alert(
        "Creation Error",
        e?.response?.data?.detail || "Failed to create group",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (group: SocialGroupItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const res = await groupsApi.joinGroup(group.id);
      if (res.status === "pending") {
        Alert.alert(
          "Request Sent",
          "Your request to join this private group has been sent to the owner.",
        );
      } else {
        Alert.alert("Joined!", `Welcome to ${group.name}!`, [
          {
            text: "Go to Group",
            onPress: () => router.push(`/group/${group.id}` as any),
          },
        ]);
      }
      fetchDiscover();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to join group");
    }
  };

  return (
    <LinearGradient
      colors={bgGradient.colors}
      start={bgGradient.start}
      end={bgGradient.end}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Top Header */}

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Social Groups</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Sub-tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              setActiveTab("discover");
            }}
            style={[
              styles.tabBtn,
              activeTab === "discover" && styles.tabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "discover" && styles.tabTextActive,
              ]}
            >
              Discover
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              setActiveTab("my_groups");
            }}
            style={[
              styles.tabBtn,
              activeTab === "my_groups" && styles.tabBtnActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "my_groups" && styles.tabTextActive,
              ]}
            >
              My Groups
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              setActiveTab("create");
            }}
            style={[
              styles.tabBtn,
              activeTab === "create" && styles.tabBtnActive,
            ]}
          >
            <Ionicons
              name="add-circle-outline"
              size={16}
              color={
                activeTab === "create" ? colors.accent : colors.textSecondary
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "create" && styles.tabTextActive,
              ]}
            >
              Create
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: DISCOVER */}
        {activeTab === "discover" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons
                name="search-outline"
                size={20}
                color={colors.textTertiary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search groups, topics or goals..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryBar}
            >
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.catPill,
                    selectedCategory === cat && styles.catPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      selectedCategory === cat && styles.catPillTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Discover Sub-Sort Tabs */}
            <View style={styles.sortBar}>
              {[
                { id: "trending", label: "🔥 Trending" },
                { id: "new", label: "✨ New" },
                { id: "recommended", label: "🎯 For You" },
                { id: "most_active", label: "⚡ Active" },
              ].map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setDiscoverSort(s.id as any)}
                  style={[
                    styles.sortBtn,
                    discoverSort === s.id && styles.sortBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.sortText,
                      discoverSort === s.id && styles.sortTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Groups Grid */}
            {loadingDiscover ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : discoverGroups.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="people-outline"
                  size={48}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyTitle}>No Groups Found</Text>
                <Text style={styles.emptySub}>
                  Try searching for another category or create your own
                  community!
                </Text>
              </View>
            ) : (
              discoverGroups.map((item) => (
                <View key={item.id} style={styles.groupCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardImageWrapper}>
                      {item.image_url ? (
                        <Image
                          source={{ uri: item.image_url }}
                          style={styles.cardImage}
                        />
                      ) : (
                        <View
                          style={[styles.cardImage, styles.cardImageFallback]}
                        >
                          <Text style={styles.fallbackText}>
                            {item.name[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardMeta}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                      </View>
                      <Text style={styles.groupTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.groupDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.statsRow}>
                      <View style={styles.statBadge}>
                        <Ionicons
                          name="people-outline"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statBadgeText}>
                          {item.member_count} members
                        </Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Ionicons name="flame" size={14} color="#FF5E00" />
                        <Text style={styles.statBadgeText}>
                          {item.average_streak}d avg streak
                        </Text>
                      </View>
                    </View>

                    {item.user_status === "active" ? (
                      <TouchableOpacity
                        onPress={() => router.push(`/group/${item.id}` as any)}
                        style={styles.openBtn}
                      >
                        <Text style={styles.openBtnText}>Open</Text>
                      </TouchableOpacity>
                    ) : item.user_status === "pending" ? (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingText}>Requested</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleJoinGroup(item)}
                        style={styles.joinBtn}
                      >
                        <Text style={styles.joinBtnText}>
                          {item.privacy === "private" ? "Request Join" : "Join"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* TAB 2: MY GROUPS */}
        {activeTab === "my_groups" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {loadingMy ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : myGroups.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="sparkles-outline"
                  size={48}
                  color={colors.textTertiary}
                />
                <Text style={styles.emptyTitle}>
                  You Haven&apos;t Joined Any Groups
                </Text>
                <Text style={styles.emptySub}>
                  Explore the Discover tab to find communities matching your
                  fitness goals!
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveTab("discover")}
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryBtnText}>Discover Groups</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  onPress={() => router.push(`/group/${group.id}` as any)}
                  activeOpacity={0.85}
                  style={styles.myGroupCard}
                >
                  <View style={styles.myGroupImageWrapper}>
                    {group.image_url ? (
                      <Image
                        source={{ uri: group.image_url }}
                        style={styles.myGroupImage}
                      />
                    ) : (
                      <View
                        style={[styles.myGroupImage, styles.cardImageFallback]}
                      >
                        <Text style={styles.fallbackText}>
                          {group.name[0]?.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.myGroupMeta}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text style={styles.groupTitle} numberOfLines={1}>
                        {group.name}
                      </Text>
                      {group.role === "owner" && (
                        <View style={styles.ownerPill}>
                          <Text style={styles.ownerText}>👑 Owner</Text>
                        </View>
                      )}
                      {group.role === "moderator" && (
                        <View style={styles.modPill}>
                          <Text style={styles.modText}>🛡️ Mod</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.groupDesc} numberOfLines={1}>
                      {group.description}
                    </Text>
                    <Text style={styles.myGroupSub}>
                      {group.member_count} members • {group.category}
                    </Text>
                  </View>

                  {group.unread_count ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {group.unread_count}
                      </Text>
                    </View>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textTertiary}
                    />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {/* TAB 3: CREATE GROUP */}
        {activeTab === "create" && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Create Community Group</Text>

              {/* Group Avatar Picker */}
              <TouchableOpacity
                onPress={handlePickImage}
                style={styles.imagePickerBox}
              >
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.pickedImage}
                  />
                ) : (
                  <View style={styles.pickerPlaceholder}>
                    <Ionicons
                      name="camera-outline"
                      size={32}
                      color={colors.accent}
                    />
                    <Text style={styles.pickerText}>Upload Group Image</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Group Name */}
              <Text style={styles.fieldLabel}>Group Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 30-Day Keto Warriors"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[
                  styles.formInput,
                  { height: 80, textAlignVertical: "top" },
                ]}
                placeholder="Describe your community's goal, meal plans, and streak challenges..."
                placeholderTextColor={colors.textTertiary}
                multiline
                value={description}
                onChangeText={setDescription}
              />

              {/* Category */}
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.catPill,
                      category === cat && styles.catPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catPillText,
                        category === cat && styles.catPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Privacy */}
              <Text style={styles.fieldLabel}>Privacy Setting</Text>
              <View style={styles.privacyRow}>
                <TouchableOpacity
                  onPress={() => setPrivacy("public")}
                  style={[
                    styles.privacyBox,
                    privacy === "public" && styles.privacyBoxActive,
                  ]}
                >
                  <Ionicons
                    name="globe-outline"
                    size={20}
                    color={
                      privacy === "public"
                        ? colors.accent
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.privacyTitle,
                      privacy === "public" && styles.privacyTitleActive,
                    ]}
                  >
                    Public
                  </Text>
                  <Text style={styles.privacyDesc}>
                    Anyone can search & join instantly
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPrivacy("private")}
                  style={[
                    styles.privacyBox,
                    privacy === "private" && styles.privacyBoxActive,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={
                      privacy === "private"
                        ? colors.accent
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.privacyTitle,
                      privacy === "private" && styles.privacyTitleActive,
                    ]}
                  >
                    Private
                  </Text>
                  <Text style={styles.privacyDesc}>
                    Requires request or invite code
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Max Members Limit (Optional) */}
              <Text style={styles.fieldLabel}>Maximum Members (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Unlimited (e.g. 50)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={maxMembers}
                onChangeText={setMaxMembers}
              />

              {/* Custom Rules */}
              <Text style={styles.fieldLabel}>Group Rules</Text>
              <View style={styles.rulesList}>
                {rules.map((rule, idx) => (
                  <View key={idx} style={styles.ruleItem}>
                    <Text style={styles.ruleText}>
                      {idx + 1}. {rule}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setRules(rules.filter((_, i) => i !== idx))
                      }
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={colors.danger}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.addRuleRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="Add custom rule..."
                  placeholderTextColor={colors.textTertiary}
                  value={newRule}
                  onChangeText={setNewRule}
                />
                <TouchableOpacity
                  onPress={handleAddRule}
                  style={styles.addRuleBtn}
                >
                  <Text style={styles.addRuleBtnText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleCreateGroup}
                disabled={creating}
                style={[styles.submitGroupBtn, creating && { opacity: 0.6 }]}
                activeOpacity={0.85}
              >
                <Text style={styles.submitGroupBtnText}>
                  {creating ? "Creating Group..." : "Launch Group 🚀"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: radius.pill,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  categoryBar: {
    flexDirection: "row",
    marginBottom: 14,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  catPillTextActive: {
    color: "#FFFFFF",
  },
  sortBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  sortBtnActive: {
    backgroundColor: "rgba(255, 94, 0, 0.12)",
  },
  sortText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  sortTextActive: {
    color: colors.accent,
    fontWeight: "900",
  },
  loaderBox: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 20,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  groupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  cardImageWrapper: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    marginRight: 14,
    overflow: "hidden",
  },
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
  },
  cardImageFallback: {
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  cardMeta: {
    flex: 1,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF0E5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.accent,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  groupDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  joinBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  openBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  openBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pendingText: {
    color: "#D97706",
    fontSize: 11,
    fontWeight: "800",
  },
  myGroupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: radius.lg,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  myGroupImageWrapper: {
    marginRight: 14,
  },
  myGroupImage: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
  },
  myGroupMeta: {
    flex: 1,
  },
  myGroupSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
    fontWeight: "600",
  },
  ownerPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#D97706",
  },
  modPill: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#4338CA",
  },
  unreadBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.lg,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.textPrimary,
    marginBottom: 16,
  },
  imagePickerBox: {
    height: 100,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  pickedImage: {
    width: "100%",
    height: "100%",
  },
  pickerPlaceholder: {
    alignItems: "center",
  },
  pickerText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 4,
  },
  formInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  privacyRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  privacyBox: {
    flex: 1,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  privacyBoxActive: {
    borderColor: colors.accent,
    backgroundColor: "#FFF0E5",
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 6,
  },
  privacyTitleActive: {
    color: colors.accent,
  },
  privacyDesc: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rulesList: {
    gap: 6,
    marginBottom: 10,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: radius.sm,
  },
  ruleText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  addRuleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  addRuleBtn: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: radius.md,
  },
  addRuleBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  submitGroupBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  submitGroupBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});
