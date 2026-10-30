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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { colors, radius, bgGradient } from "@/src/theme";
import { groupsApi, GroupDetailsResponse } from "@/src/lib/groupsApi";

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 16);

  const [group, setGroup] = useState<GroupDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"members" | "edit" | "rules">("members");

  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      Promise.all([
        groupsApi.getGroupDetails(id),
        groupsApi.getMembers(id),
      ]).then(([groupData, memberData]) => {
        setGroup(groupData);
        setMembers(memberData.members);
        setRules(groupData.rules || []);
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupData, memberData] = await Promise.all([
        groupsApi.getGroupDetails(id),
        groupsApi.getMembers(id),
      ]);
      setGroup(groupData);
      setMembers(memberData.members);
      setRules(groupData.rules || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: string, memberName: string) => {
    Alert.alert(
      "Update Role",
      `Are you sure you want to change ${memberName}'s role to ${newRole.toUpperCase()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await groupsApi.changeRole(id, targetUserId, newRole);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert("Role Updated", `${memberName} is now a ${newRole}.`);
              fetchData();
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.detail || "Failed to update role");
            }
          },
        },
      ]
    );
  };

  const handleKick = async (targetUserId: string, name: string) => {
    Alert.alert("Kick Member", `Remove ${name} from this group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Kick Member",
        style: "destructive",
        onPress: async () => {
          try {
            await groupsApi.kickMember(id, targetUserId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            fetchData();
          } catch (e: any) {
            Alert.alert("Error", e?.response?.data?.detail || "Failed to kick member");
          }
        },
      },
    ]);
  };

  const copyInviteCode = async () => {
    if (group?.invite_code) {
      await Clipboard.setStringAsync(group.invite_code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleAddRule = () => {
    if (newRule.trim()) {
      setRules([...rules, newRule.trim()]);
      setNewRule("");
    }
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, idx) => idx !== index));
  };

  if (loading || !group) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const filteredMembers = members.filter((m) =>
    searchQuery ? m.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <LinearGradient colors={bgGradient.colors} start={bgGradient.start} end={bgGradient.end} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle}>Group Governance</Text>
            <Text style={styles.headerSub}>Settings, Roles & Moderation</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Group Hero Info Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroImageWrapper}>
            {group.image_url ? (
              <Image source={{ uri: group.image_url }} style={styles.heroImage} />
            ) : (
              <View style={[styles.heroImage, styles.heroFallback]}>
                <Text style={styles.heroFallbackText}>{group.name[0]?.toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle} numberOfLines={1}>{group.name}</Text>
            <View style={styles.heroCategoryRow}>
              <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{group.category}</Text></View>
              <Text style={styles.heroMembersText}>{group.member_count} members</Text>
            </View>
          </View>

          <TouchableOpacity onPress={copyInviteCode} style={styles.heroCodeBtn} activeOpacity={0.8}>
            <Ionicons name={copiedCode ? "checkmark-circle" : "copy-outline"} size={16} color={colors.accent} />
            <Text style={styles.heroCodeText}>{copiedCode ? "Copied!" : group.invite_code}</Text>
          </TouchableOpacity>
        </View>

        {/* Section Switcher Bar */}
        <View style={styles.sectionBar}>
          {[
            { id: "members", label: "Members", icon: "people-outline" },
            { id: "rules", label: "Rules", icon: "list-outline" },
          ].map((sec) => (
            <TouchableOpacity
              key={sec.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveSection(sec.id as any);
              }}
              style={[styles.sectionBtn, activeSection === sec.id && styles.sectionBtnActive]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={sec.icon as any}
                size={16}
                color={activeSection === sec.id ? colors.accent : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.sectionBtnText, activeSection === sec.id && styles.sectionBtnTextActive]}>
                {sec.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SECTION 1: MEMBERS & ROLES */}
        {activeSection === "members" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 20 }]}>
            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search member by name..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {filteredMembers.map((m) => (
              <View key={m.user_id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name[0]}</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    {m.role === "owner" && <View style={styles.ownerPill}><Text style={styles.ownerText}>👑 Owner</Text></View>}
                    {m.role === "moderator" && <View style={styles.modPill}><Text style={styles.modText}>🛡️ Mod</Text></View>}
                  </View>
                  <Text style={styles.memberStreak}>{m.current_streak}d streak 🔥</Text>
                </View>

                {m.role !== "owner" && (
                  <View style={styles.actionsRow}>
                    {m.role === "member" ? (
                      <TouchableOpacity
                        onPress={() => handleRoleChange(m.user_id, "moderator", m.name)}
                        style={styles.modBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.modBtnText}>Make Mod</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleRoleChange(m.user_id, "member", m.name)}
                        style={styles.demoteBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.demoteBtnText}>Demote</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => handleKick(m.user_id, m.name)}
                      style={styles.kickBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="person-remove-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* SECTION 2: GROUP RULES */}
        {activeSection === "rules" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 20 }]}>
            <View style={styles.rulesCard}>
              <Text style={styles.cardHeaderTitle}>Community Guidelines</Text>
              <Text style={styles.cardHeaderSub}>Enforce clear expectations for all community members.</Text>

              <View style={styles.rulesList}>
                {rules.map((rule, idx) => (
                  <View key={idx} style={styles.ruleItem}>
                    <View style={styles.ruleBadge}><Text style={styles.ruleBadgeText}>{idx + 1}</Text></View>
                    <Text style={styles.ruleText}>{rule}</Text>
                    <TouchableOpacity onPress={() => handleRemoveRule(idx)} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.addRuleRow}>
                <TextInput
                  style={styles.addRuleInput}
                  placeholder="Add custom rule..."
                  placeholderTextColor={colors.textTertiary}
                  value={newRule}
                  onChangeText={setNewRule}
                />
                <TouchableOpacity onPress={handleAddRule} style={styles.addRuleBtn} activeOpacity={0.8}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addRuleBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
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
  centerLoader: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  headerTitle: { fontSize: 17, fontWeight: "900", color: colors.textPrimary },
  headerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1, fontWeight: "600" },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroImageWrapper: { marginRight: 12 },
  heroImage: { width: 48, height: 48, borderRadius: radius.md },
  heroFallback: { backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  heroFallbackText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  heroTitle: { fontSize: 16, fontWeight: "900", color: colors.textPrimary },
  heroCategoryRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  heroBadge: { backgroundColor: "#FFF0E5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  heroBadgeText: { fontSize: 9, fontWeight: "900", color: colors.accent },
  heroMembersText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
  heroCodeBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF0E5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  heroCodeText: { fontSize: 11, fontWeight: "900", color: colors.accent },
  sectionBar: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  sectionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.7)", paddingVertical: 10, borderRadius: radius.pill },
  sectionBtnActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  sectionBtnText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  sectionBtnTextActive: { color: colors.accent, fontWeight: "900" },
  content: { paddingHorizontal: 16 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: colors.textPrimary },
  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", padding: 14, borderRadius: radius.lg, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  memberAvatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  memberName: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  memberStreak: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  ownerPill: { backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ownerText: { fontSize: 9, fontWeight: "800", color: "#D97706" },
  modPill: { backgroundColor: "#E0E7FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modText: { fontSize: 9, fontWeight: "800", color: "#4338CA" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modBtn: { backgroundColor: "#EEF2FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  modBtnText: { color: "#4F46E5", fontSize: 11, fontWeight: "800" },
  demoteBtn: { backgroundColor: "#FEF2F2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  demoteBtnText: { color: colors.danger, fontSize: 11, fontWeight: "800" },
  kickBtn: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: radius.pill },
  rulesCard: { backgroundColor: "#FFFFFF", padding: 18, borderRadius: radius.xl },
  cardHeaderTitle: { fontSize: 18, fontWeight: "900", color: colors.textPrimary },
  cardHeaderSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  rulesList: { gap: 8, marginBottom: 16 },
  ruleItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", padding: 12, borderRadius: radius.md, gap: 10 },
  ruleBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  ruleBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  ruleText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, flex: 1 },
  addRuleRow: { flexDirection: "row", gap: 8 },
  addRuleInput: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#E2E8F0", fontSize: 13, color: colors.textPrimary },
  addRuleBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.textPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md },
  addRuleBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
});
