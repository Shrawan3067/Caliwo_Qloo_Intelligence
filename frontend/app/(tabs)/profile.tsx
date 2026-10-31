import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import api from "@/src/lib/api";
import { WidgetService } from "@/src/widgets/widgetService";
import { WeightLogModal } from "@/src/components/WeightLogModal";
import { MacroIcon, MacroType } from "@/src/components/MacroIcon";
import { getTasteEntityMeta } from "@/src/utils/tasteIcons";
import CulturalTasteGraphExplorer from "@/src/components/CulturalTasteGraphExplorer";

type Profile = {
  daily_calories?: number;
  daily_protein_g?: number;
  daily_carbs_g?: number;
  daily_fat_g?: number;
  desired_weight_kg?: number;
  workouts_per_week?: string;
  diet?: string;
  goal?: string;
  [key: string]: any;
};

type SubStatus = {
  is_pro: boolean;
  pro_source: string | null;
  pro_until: string | null;
  price_usd: number;
  days_per_purchase: number;
};

type FamilyMember = {
  user_id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  is_owner: boolean;
  pro_until: string | null;
};

type Family = {
  family_id: string;
  code: string;
  owner_id: string;
  members: FamilyMember[];
};

const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  android: { elevation: 4 },
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

export default function ProfileScreen() {
  const { user, signOut, refresh } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>({});
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [family, setFamily] = useState<Family | null>(null);

  const [weightModal, setWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [famModal, setFamModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<
    "bug" | "feature" | "praise" | "other"
  >("other");
  const [feedbackSending, setFeedbackSending] = useState(false);

  const [widgetInstructionModal, setWidgetInstructionModal] = useState(false);
  const [showGraphExplorer, setShowGraphExplorer] = useState(false);
  const [refreshingWidgets, setRefreshingWidgets] = useState(false);
  const [ringColorsModal, setRingColorsModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prof, subR, famR] = await Promise.all([
        api.get("/profile/me"),
        api.get("/subscription/status"),
        api.get("/family/me"),
      ]);
      setProfile(prof.data.profile || {});
      setSub(subR.data);
      setFamily(famR.data.family || null);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSignOut = () => {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const logWeight = async () => {
    const w = parseFloat(newWeight);
    if (!w || w < 20 || w > 400) {
      Alert.alert("Invalid weight", "Please enter a realistic weight in kg.");
      return;
    }
    try {
      await api.post("/weight/log", { weight_kg: w });
      setWeightModal(false);
      setNewWeight("");
      Alert.alert("Logged", `New weight ${w} kg saved.`);
      load();
    } catch {
      Alert.alert("Failed", "Could not save weight.");
    }
  };

  const createFamily = async () => {
    setBusy(true);
    try {
      await api.post("/family/create");
      await refresh();
      await load();
      setFamModal(false);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.detail || "Try again");
    } finally {
      setBusy(false);
    }
  };

  const joinFamily = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    try {
      await api.post("/family/join", { code });
      await refresh();
      await load();
      setFamModal(false);
      setJoinCode("");
    } catch (e: any) {
      Alert.alert(
        "Join failed",
        e?.response?.data?.detail || "Check the code and try again",
      );
    } finally {
      setBusy(false);
    }
  };

  const leaveFamily = async () => {
    Alert.alert("Leave family?", "You can rejoin later using the code.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post("/family/leave");
            await refresh();
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e?.response?.data?.detail || "Try again");
          }
        },
      },
    ]);
  };

  const removeMember = (m: FamilyMember) => {
    Alert.alert(`Remove ${m.name || m.email}?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/family/members/${m.user_id}`);
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e?.response?.data?.detail || "Try again");
          }
        },
      },
    ]);
  };

  const copyCode = async (c: string) => {
    await Clipboard.setStringAsync(c);
    Alert.alert("Copied", `Family code ${c} copied to clipboard.`);
  };

  const exportData = async () => {
    try {
      const res = await api.get("/account/export");
      const mealsCount = Array.isArray(res.data?.meals) ? res.data.meals.length : (res.data?.meals_count || 0);
      const sleepCount = Array.isArray(res.data?.sleep_logs) ? res.data.sleep_logs.length : 0;
      Alert.alert(
        "Export Ready",
        `Exported ${mealsCount} logged meals & ${sleepCount} sleep entries to JSON format.`,
      );
    } catch (e: any) {
      Alert.alert("Export Failed", e?.response?.data?.detail || "Try again");
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete Account?",
      "This action is permanent and will remove all your logged data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/profile/me");
              await signOut();
              router.replace("/");
            } catch (e: any) {
              Alert.alert(
                "Failed to delete",
                e?.response?.data?.detail || "Try again",
              );
            }
          },
        },
      ],
    );
  };

  const isOwner = family && user && family.owner_id === user.user_id;
  const proUntilLabel = sub?.pro_until
    ? new Date(sub.pro_until).toLocaleDateString()
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setFeedbackModal(true)}
            activeOpacity={0.8}
            testID="profile-top-feedback"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color="#0F172A"
            />
          </TouchableOpacity>
        </View>

        {/* User Profile Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarBig}>
            {user?.picture ? (
              <Image
                source={{ uri: user.picture }}
                style={{ width: 72, height: 72 }}
              />
            ) : (
              <Text style={styles.avatarBigText}>
                {(user?.name || user?.email || "N").slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Text style={styles.userName}>{user?.name || "User"}</Text>
              {sub?.is_pro ? (
                <View style={styles.proBadge}>
                  <Ionicons name="star" size={10} color={colors.white} />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.userMeta}>{user?.email}</Text>
          </View>
        </View>

        {/* Daily Plan Target Summary Card */}
        <View style={styles.planCard}>
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            style={styles.planGradient}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={styles.planLabel}>DAILY NUTRITION GOAL</Text>
              <Ionicons name="flame" size={18} color={colors.accent} />
            </View>
            <Text style={styles.planVal}>
              {(profile.goals?.calories ?? profile.daily_calories ?? 2200).toLocaleString()}{" "}
              <Text style={{ fontSize: 16, color: "#94A3B8" }}>kcal</Text>
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12, marginTop: 12 }}>
              <PlanBox
                label="Protein"
                v={`${profile.goals?.protein_g ?? profile.daily_protein_g ?? 140}g`}
                accent="#FF5E00"
                macroType="protein"
              />
              <PlanBox
                label="Carbs"
                v={`${profile.goals?.carbs_g ?? profile.daily_carbs_g ?? 220}g`}
                accent="#F59E0B"
                macroType="carbs"
              />
              <PlanBox
                label="Fats"
                v={`${profile.goals?.fat_g ?? profile.daily_fat_g ?? 65}g`}
                accent="#0284C7"
                macroType="fats"
              />
              <PlanBox
                label="Fiber"
                v={`${profile.goals?.fiber_g ?? 28}g`}
                accent="#10B981"
                macroType="fiber"
              />
              <PlanBox
                label="Sugar"
                v={`${profile.goals?.sugar_g ?? 30}g`}
                accent="#EC4899"
                macroType="sugar"
              />
              <PlanBox
                label="Sodium"
                v={`${profile.goals?.sodium_mg ?? 2000}mg`}
                accent="#8B5CF6"
                macroType="sodium"
              />
            </View>
          </LinearGradient>
        </View>

        {/* Subscription Section */}
        <Section title="Subscription" noCard>
          <View style={styles.proStatus}>
            <View style={styles.proStatusIcon}>
              <Ionicons name="star" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proStatusTitle}>
                Caliwo Pro Active
              </Text>
              <Text style={styles.proStatusSub}>
                Full Access Unlocked (Qloo Hackathon Edition)
              </Text>
            </View>
          </View>
        </Section>

        {/* Social Groups Section */}
        <Section title="Community & Groups" noCard>
          <TouchableOpacity
            style={styles.groupsCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
              router.push("/groups" as any);
            }}
            activeOpacity={0.88}
            testID="profile-social-groups-btn"
          >
            <View style={styles.groupsIconWrap}>
              <Ionicons name="people" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.groupsCardTitle}>Social Groups</Text>
                <View style={styles.groupsHotBadge}>
                  <Text style={styles.groupsHotText}>🔥 Active</Text>
                </View>
              </View>
              <Text style={styles.groupsCardSub}>
                Join fitness communities, build streaks & track leaderboards
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.groupsCard, { marginTop: 12 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
              router.push("/feedback" as any);
            }}
            activeOpacity={0.88}
            testID="profile-feedback-hub-btn"
          >
            <View
              style={[styles.groupsIconWrap, { backgroundColor: "#8B5CF6" }]}
            >
              <Ionicons name="chatbubbles" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.groupsCardTitle}>Feedback & Ideas</Text>
                <View
                  style={[
                    styles.groupsHotBadge,
                    { backgroundColor: "#DDD6FE" },
                  ]}
                >
                  <Text style={[styles.groupsHotText, { color: "#6D28D9" }]}>
                    ✨ Ideas
                  </Text>
                </View>
              </View>
              <Text style={styles.groupsCardSub}>
                Suggest features, vote on ideas & view product updates
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </Section>

        {/* Home Screen Widgets Section */}
        <Section title="Home Screen Widgets" noCard>
          <Text
            style={{
              fontSize: 12,
              color: "#64748B",
              marginBottom: 4,
              paddingHorizontal: 4,
              fontWeight: "600",
              lineHeight: 18,
            }}
          >
            Access your nutrition stats directly from your iPhone & Android Home
            Screen.
          </Text>

          {/* Widget 1: Today's Intake */}
          <View style={styles.widgetCard} testID="profile-widget-intake-card">
            <View style={styles.widgetHeaderRow}>
              <View style={styles.widgetBadgeRow}>
                <View
                  style={[
                    styles.widgetIconWrap,
                    { backgroundColor: "#FFF1F2" },
                  ]}
                >
                  <Ionicons name="flame" size={16} color="#E11D48" />
                </View>
                <View>
                  <Text style={styles.widgetCardTitle}>
                    Today&apos;s Intake
                  </Text>
                  <Text style={styles.widgetCardSubTitle}>
                    Calories & Macros Meter
                  </Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color="#10B981"
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.statusBadgeText}>iOS & Android</Text>
              </View>
            </View>

            {/* Simulated Live System Widget Card */}
            <View style={styles.widgetPreviewContainer}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <Ionicons name="leaf" size={12} color={colors.accent} />
                  <Text
                    style={{
                      fontWeight: "800",
                      color: "#0F172A",
                      fontSize: 13,
                    }}
                  >
                    Today&apos;s Intake
                  </Text>
                </View>
                <Text
                  style={{
                    fontWeight: "900",
                    color: colors.accent,
                    fontSize: 12,
                  }}
                >
                  1,542 / 2,200 kcal
                </Text>
              </View>

              {/* Progress Bar preview */}
              <View style={styles.widgetPreviewBar}>
                <View style={[styles.widgetPreviewFill, { width: "70%" }]} />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <View style={styles.macroPillPreview}>
                  <MacroIcon type="protein" size={14} showBadge={false} />
                  <Text style={[styles.macroPillText, { color: "#FF5E00" }]}>
                    P 96g
                  </Text>
                </View>
                <View style={styles.macroPillPreview}>
                  <MacroIcon type="carbs" size={14} showBadge={false} />
                  <Text style={[styles.macroPillText, { color: "#F59E0B" }]}>
                    C 170g
                  </Text>
                </View>
                <View style={styles.macroPillPreview}>
                  <MacroIcon type="fats" size={14} showBadge={false} />
                  <Text style={[styles.macroPillText, { color: "#0284C7" }]}>
                    F 52g
                  </Text>
                </View>
                <View style={styles.macroPillPreview}>
                  <MacroIcon type="fiber" size={14} showBadge={false} />
                  <Text style={[styles.macroPillText, { color: "#10B981" }]}>
                    Fib 24g
                  </Text>
                </View>
                <View style={styles.macroPillPreview}>
                  <MacroIcon type="sugar" size={14} showBadge={false} />
                  <Text style={[styles.macroPillText, { color: "#EC4899" }]}>
                    Sug 18g
                  </Text>
                </View>
                <View style={styles.macroPillPreview}>
                  <MacroIcon type="sodium" size={14} showBadge={false} />
                  <Text style={[styles.macroPillText, { color: "#8B5CF6" }]}>
                    Sod 1.4g
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.widgetDesc}>
              View your live calorie progress and daily macro split directly on
              your Lock/Home Screen.
            </Text>

            <TouchableOpacity
              style={styles.widgetBtn}
              onPress={() => setWidgetInstructionModal(true)}
              activeOpacity={0.8}
              testID="profile-add-widget-intake"
            >
              <Ionicons
                name="add"
                size={16}
                color={colors.white}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.widgetBtnText}>Add to Home Screen</Text>
            </TouchableOpacity>
          </View>

          {/* Widget 2: Log Water */}
          <View
            style={[styles.widgetCard, { marginTop: 12 }]}
            testID="profile-widget-water-card"
          >
            <View style={styles.widgetHeaderRow}>
              <View style={styles.widgetBadgeRow}>
                <View
                  style={[
                    styles.widgetIconWrap,
                    { backgroundColor: "#E0F2FE" },
                  ]}
                >
                  <Ionicons name="water" size={16} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.widgetCardTitle}>Log Water</Text>
                  <Text style={styles.widgetCardSubTitle}>
                    Instant Water Tracker
                  </Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color="#10B981"
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.statusBadgeText}>iOS & Android</Text>
              </View>
            </View>

            {/* Simulated Live System Widget Card */}
            <View style={styles.widgetPreviewContainer}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <Ionicons name="water" size={13} color="#0284C7" />
                  <Text
                    style={{
                      fontWeight: "800",
                      color: "#0284C7",
                      fontSize: 13,
                    }}
                  >
                    Hydration Goal
                  </Text>
                </View>
                <Text
                  style={{ fontWeight: "900", color: "#0F172A", fontSize: 12 }}
                >
                  1.8 L / 3.0 L
                </Text>
              </View>

              <View style={styles.widgetPreviewBar}>
                <View
                  style={[
                    styles.widgetPreviewFill,
                    { width: "60%", backgroundColor: "#0284C7" },
                  ]}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                <View style={styles.quickBtnPreview}>
                  <Ionicons name="add" size={10} color={colors.white} />
                  <Text style={styles.quickBtnPreviewText}>250 ml</Text>
                </View>
                <View style={styles.quickBtnPreview}>
                  <Ionicons name="add" size={10} color={colors.white} />
                  <Text style={styles.quickBtnPreviewText}>500 ml</Text>
                </View>
                <View
                  style={[
                    styles.quickBtnPreview,
                    { backgroundColor: "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[styles.quickBtnPreviewText, { color: "#0F172A" }]}
                  >
                    Reset
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.widgetDesc}>
              Log water intakes with 1-tap quick buttons without opening the
              app.
            </Text>

            <TouchableOpacity
              style={styles.widgetBtn}
              onPress={() => setWidgetInstructionModal(true)}
              activeOpacity={0.8}
              testID="profile-add-widget-water"
            >
              <Ionicons
                name="add"
                size={16}
                color={colors.white}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.widgetBtnText}>Add to Home Screen</Text>
            </TouchableOpacity>
          </View>

          {/* Force Refresh Button */}
          <TouchableOpacity
            style={styles.refreshWidgetsBtn}
            disabled={refreshingWidgets}
            activeOpacity={0.8}
            onPress={async () => {
              setRefreshingWidgets(true);
              try {
                await WidgetService.forceRefresh();
                Alert.alert(
                  "Widgets Updated",
                  "Home Screen widgets refreshed with latest data.",
                );
              } catch {
                Alert.alert("Error", "Could not refresh widgets.");
              } finally {
                setRefreshingWidgets(false);
              }
            }}
            testID="profile-refresh-widgets-btn"
          >
            {refreshingWidgets ? (
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color="#0F172A" />
                <Text style={styles.refreshWidgetsBtnText}>
                  Refresh Widgets Data
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Section>

        {/* Family Sharing Section */}
        <Section title="Family Sharing" noCard>
          {family ? (
            <View style={styles.familyActiveCard}>
              <View style={styles.familyHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.familyTitle}>
                    Family · {family.members.length} members
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyCode(family.code)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                    testID="family-code-copy"
                  >
                    <Text style={styles.familyCode}>{family.code}</Text>
                    <Ionicons name="copy-outline" size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={leaveFamily}
                  style={styles.leaveBtn}
                  testID="family-leave-btn"
                >
                  <Text style={styles.leaveText}>Leave</Text>
                </TouchableOpacity>
              </View>
              <View style={{ gap: 8, marginTop: 12 }}>
                {family.members.map((m) => (
                  <View key={m.user_id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      {m.picture ? (
                        <Image
                          source={{ uri: m.picture }}
                          style={{ width: 36, height: 36, borderRadius: 999 }}
                        />
                      ) : (
                        <Text style={styles.memberInitial}>
                          {(m.name || m.email).slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {m.name || m.email}
                        {m.is_owner ? " · Owner" : ""}
                      </Text>
                      <Text style={styles.memberEmail}>{m.email}</Text>
                    </View>
                    {isOwner && !m.is_owner ? (
                      <TouchableOpacity
                        onPress={() => removeMember(m)}
                        testID={`family-remove-${m.user_id}`}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.familyEmpty}
              onPress={() => setFamModal(true)}
              activeOpacity={0.8}
              testID="family-create-open"
            >
              <View style={styles.familyEmptyIcon}>
                <Ionicons name="people" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.familyEmptyTitle}>
                  Create or join a family
                </Text>
                <Text style={styles.familyEmptySub}>
                  Share Pro benefits with up to 5 family members
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </Section>

        {/* Health */}
        <Section title="Health & Body">
          <Row
            icon="scale-outline"
            label="Current weight"
            value={profile.weight_kg ? `${profile.weight_kg} kg` : "Log now"}
            testID="profile-log-weight"
            onPress={() => setWeightModal(true)}
          />
          <Row
            icon="flag-outline"
            label="Goal weight"
            value={
              profile.desired_weight_kg
                ? `${profile.desired_weight_kg} kg`
                : "—"
            }
          />
          {profile.height_cm && profile.weight_kg ? (
            <Row
              icon="pulse-outline"
              label="Body Mass Index (BMI)"
              value={`${(profile.weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1)}`}
            />
          ) : null}
          <Row
            icon="fitness-outline"
            label="Weekly workouts"
            value={profile.workouts_per_week || "—"}
          />
        </Section>

        {/* Preferences */}
        <Section title="Preferences & Guides">
          <Row
            icon="leaf-outline"
            label="Diet"
            value={profile.diet || "None"}
          />
          <Row icon="flame-outline" label="Goal" value={profile.goal || "—"} />
          <Row
            icon="color-palette-outline"
            label="Calendar Ring Colors"
            value="View guide"
            testID="profile-ring-colors"
            onPress={() => setRingColorsModal(true)}
          />
        </Section>

        {/* Taste DNA (Qloo) */}
        <Section title="Taste DNA" noCard>
          <View style={{
            backgroundColor: "rgba(167,139,250,0.08)",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(167,139,250,0.2)",
            padding: 16,
            gap: 12,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: "rgba(167,139,250,0.15)",
                justifyContent: "center", alignItems: "center",
              }}>
                <Ionicons name="sparkles" size={20} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>
                  Cultural Taste Profile
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                  Powered by Qloo
                </Text>
              </View>
            </View>

            {((profile as any)?.taste_onboarded || (profile as any)?.taste_dna?.entity_ids?.length > 0) ? (
              <View style={{ gap: 8 }}>
                <View style={{
                  flexDirection: "row", flexWrap: "wrap", gap: 6,
                }}>
                  {(((profile as any)?.cuisine_affinities || (profile as any)?.taste_dna?.cuisine_affinities || [])).slice(0, 8).map((c: string) => {
                    const meta = getTasteEntityMeta(c, "cuisines");
                    return (
                      <View
                        key={c}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 11,
                          paddingVertical: 6,
                          borderRadius: 12,
                          backgroundColor: meta.bg,
                          borderWidth: 1,
                          borderColor: `${meta.color}35`,
                        }}
                      >
                        <Ionicons name={meta.icon} size={13} color={meta.color} />
                        <Text style={{ color: meta.color, fontSize: 12, fontWeight: "600" }}>{c}</Text>
                      </View>
                    );
                  })}
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/taste-onboarding" as any)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    paddingVertical: 8,
                  }}
                >
                  <Ionicons name="refresh" size={16} color="#A78BFA" />
                  <Text style={{ color: "#A78BFA", fontSize: 14, fontWeight: "600" }}>
                    Update Taste Preferences
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowGraphExplorer((prev) => !prev)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(192, 132, 252, 0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(192, 132, 252, 0.3)",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    marginTop: 4,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="git-network-outline" size={16} color="#C084FC" />
                    <Text style={{ color: "#E9D5FF", fontSize: 13, fontWeight: "700" }}>
                      {showGraphExplorer ? "Hide Taste Constellation" : "🌌 Explore Cultural Taste Graph"}
                    </Text>
                  </View>
                  <Ionicons
                    name={showGraphExplorer ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#C084FC"
                  />
                </TouchableOpacity>

                {showGraphExplorer && (
                  <CulturalTasteGraphExplorer
                    data={(profile as any)?.taste_dna}
                  />
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/taste-onboarding" as any)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: "#7C3AED",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                  🎯 Set Up Taste Profile
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Section>

        {/* Account */}
        <Section title="Account & Data">
          <Row
            icon="gift-outline"
            label="Invite friends"
            value="Get 7 days free 🎁"
            testID="profile-referrals"
            onPress={() => router.push("/referrals")}
          />
          <Row
            icon="share-social-outline"
            label="Share my week"
            testID="profile-share-week"
            onPress={() => router.push("/share-card")}
          />
          <Row
            icon="chatbox-outline"
            label="Send feedback"
            testID="profile-feedback"
            onPress={() => setFeedbackModal(true)}
          />
          <Row
            icon="download-outline"
            label="Export my data"
            testID="profile-export-data"
            onPress={exportData}
          />
          <Row
            icon="trash-outline"
            label="Delete account"
            testID="profile-delete-account"
            onPress={confirmDeleteAccount}
            danger
          />
          <Row
            icon="log-out-outline"
            label="Sign out"
            onPress={onSignOut}
            testID="profile-signout"
            danger
          />
        </Section>

        {/* Legal */}
        <Section title="Legal & Privacy">
          <Row
            icon="document-text-outline"
            label="Privacy Policy"
            testID="profile-privacy-policy"
            onPress={() => Linking.openURL("https://caliwo.app/privacy")}
          />
          <Row
            icon="shield-checkmark-outline"
            label="Terms of Service"
            testID="profile-terms"
            onPress={() => Linking.openURL("https://caliwo.app/terms")}
          />
        </Section>

        <Text style={styles.brandFooter}>
          Caliwo v1.0.0{"\n"}Personalized AI Nutrition & Fitness
        </Text>
      </ScrollView>

      {/* Widget Instructions Modal */}
      <Modal
        transparent
        visible={widgetInstructionModal}
        animationType="fade"
        onRequestClose={() => setWidgetInstructionModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Text style={styles.modalTitle}>Add Caliwo Widgets</Text>
              <TouchableOpacity
                onPress={() => setWidgetInstructionModal(false)}
              >
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {Platform.OS === "ios" ? (
              <View style={{ gap: 10, marginBottom: 18 }}>
                <Text style={styles.stepText}>
                  1. Go to your iPhone Home Screen.
                </Text>
                <Text style={styles.stepText}>
                  2. Touch and hold an empty area until apps jiggle.
                </Text>
                <Text style={styles.stepText}>
                  3. Tap the <Text style={{ fontWeight: "800" }}>+</Text> button
                  in the top left.
                </Text>
                <Text style={styles.stepText}>
                  4. Search for{" "}
                  <Text style={{ fontWeight: "800" }}>Caliwo</Text> and choose
                  your widget.
                </Text>
                <Text style={styles.stepText}>
                  5. Tap <Text style={{ fontWeight: "800" }}>Add Widget</Text>.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10, marginBottom: 18 }}>
                <Text style={styles.stepText}>
                  1. Go to your Android Home Screen.
                </Text>
                <Text style={styles.stepText}>
                  2. Touch and hold an empty space on the screen.
                </Text>
                <Text style={styles.stepText}>
                  3. Tap <Text style={{ fontWeight: "800" }}>Widgets</Text>.
                </Text>
                <Text style={styles.stepText}>
                  4. Select <Text style={{ fontWeight: "800" }}>Caliwo</Text>{" "}
                  from your app list.
                </Text>
                <Text style={styles.stepText}>
                  5. Drag{" "}
                  <Text style={{ fontWeight: "800" }}>Today&apos;s Intake</Text>{" "}
                  or <Text style={{ fontWeight: "800" }}>Log Water</Text> onto
                  your screen.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalSave}
              onPress={() => setWidgetInstructionModal(false)}
              testID="profile-widget-instruction-close"
            >
              <Text style={{ fontWeight: "800", color: colors.white }}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Enhanced Weight Modal */}
      <WeightLogModal
        visible={weightModal}
        initialWeightKg={profile.weight_kg || 70.0}
        heightCm={profile.height_cm}
        goalWeightKg={profile.desired_weight_kg}
        onClose={() => setWeightModal(false)}
        onSuccess={() => {
          load();
        }}
      />

      {/* Family Modal */}
      <Modal
        transparent
        visible={famModal}
        animationType="fade"
        onRequestClose={() => setFamModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={styles.modalTitle}>Family Sharing</Text>
              <TouchableOpacity onPress={() => setFamModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text
              style={{
                color: "#64748B",
                marginBottom: 14,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              Create a new family to share Pro features with up to 5 members, or
              join an existing family using a code.
            </Text>
            <TouchableOpacity
              style={styles.modalSave}
              onPress={createFamily}
              disabled={busy}
              testID="family-create-btn"
            >
              {busy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={{ fontWeight: "800", color: colors.white }}>
                  Create New Family
                </Text>
              )}
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>or join</Text>
              <View style={styles.divLine} />
            </View>
            <TextInput
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="ABC123"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              maxLength={6}
              style={[
                styles.modalInput,
                {
                  letterSpacing: 6,
                  textAlign: "center",
                  fontWeight: "900",
                },
              ]}
              testID="family-join-code-input"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setFamModal(false)}
              >
                <Text style={{ fontWeight: "800", color: "#0F172A" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={joinFamily}
                disabled={busy || !joinCode.trim()}
                testID="family-join-btn"
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={{ fontWeight: "800", color: colors.white }}>
                    Join
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        transparent
        visible={feedbackModal}
        animationType="fade"
        onRequestClose={() => setFeedbackModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={styles.modalTitle}>Send Feedback</Text>
              <TouchableOpacity onPress={() => setFeedbackModal(false)}>
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text
              style={{
                color: "#64748B",
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              Tell us what&apos;s working, what&apos;s missing, or how we can
              improve.
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 6,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {(["bug", "feature", "praise", "other"] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setFeedbackCategory(c)}
                  style={[
                    {
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: "#F1F5F9",
                    },
                    feedbackCategory === c && { backgroundColor: "#0F172A" },
                  ]}
                  testID={`feedback-cat-${c}`}
                >
                  <Text
                    style={{
                      fontWeight: "800",
                      fontSize: 12,
                      textTransform: "capitalize",
                      color: feedbackCategory === c ? colors.white : "#0F172A",
                    }}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Type your feedback here…"
              placeholderTextColor="#94A3B8"
              multiline
              style={[
                styles.modalInput,
                {
                  height: 110,
                  textAlignVertical: "top",
                  fontSize: 14,
                  fontWeight: "500",
                  paddingTop: 12,
                },
              ]}
              testID="feedback-input"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setFeedbackModal(false)}
              >
                <Text style={{ fontWeight: "800", color: "#0F172A" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                disabled={feedbackSending || feedbackText.trim().length < 3}
                onPress={async () => {
                  setFeedbackSending(true);
                  try {
                    await api.post("/feedback/submit", {
                      category: feedbackCategory,
                      message: feedbackText,
                    });
                    setFeedbackModal(false);
                    setFeedbackText("");
                    Alert.alert(
                      "Thanks!",
                      "Your feedback helps us improve Caliwo.",
                    );
                  } catch (e: any) {
                    Alert.alert(
                      "Could not send",
                      e?.response?.data?.detail || "Try again",
                    );
                  } finally {
                    setFeedbackSending(false);
                  }
                }}
                testID="feedback-submit-btn"
              >
                {feedbackSending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={{ fontWeight: "800", color: colors.white }}>
                    Send
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Calendar Ring Colors Explained Modal */}
      <Modal
        transparent
        visible={ringColorsModal}
        animationType="fade"
        onRequestClose={() => setRingColorsModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={styles.ringModalHeaderIcon}>
                  <Ionicons
                    name="ellipse-outline"
                    size={20}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.modalTitle}>Calendar Rings</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRingColorsModal(false)}
                testID="profile-ring-colors-close"
              >
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                color: "#64748B",
                fontSize: 13,
                lineHeight: 18,
                marginBottom: 16,
                fontWeight: "500",
              }}
            >
              On the homepage calendar and diary calendar, the colored rings
              around each date show how close you were to your daily calorie
              goal:
            </Text>

            {/* Ring Items */}
            <View style={{ gap: 10, marginBottom: 20 }}>
              {/* Green */}
              <View style={styles.ringGuideRow}>
                <View
                  style={[
                    styles.ringPreviewCircle,
                    { borderColor: "#10B981", backgroundColor: "#ECFDF5" },
                  ]}
                >
                  <Text style={[styles.ringPreviewText, { color: "#10B981" }]}>
                    18
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={styles.ringGuideName}>Green</Text>
                    <View
                      style={[
                        styles.ringTag,
                        { backgroundColor: "#ECFDF5" },
                      ]}
                    >
                      <Text
                        style={[styles.ringTagText, { color: "#10B981" }]}
                      >
                        On target
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ringGuideDesc}>
                    Within 100 calories of your goal
                  </Text>
                </View>
              </View>

              {/* Yellow */}
              <View style={styles.ringGuideRow}>
                <View
                  style={[
                    styles.ringPreviewCircle,
                    { borderColor: "#F59E0B", backgroundColor: "#FEF3C7" },
                  ]}
                >
                  <Text style={[styles.ringPreviewText, { color: "#F59E0B" }]}>
                    19
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={styles.ringGuideName}>Yellow</Text>
                    <View
                      style={[
                        styles.ringTag,
                        { backgroundColor: "#FEF3C7" },
                      ]}
                    >
                      <Text
                        style={[styles.ringTagText, { color: "#D97706" }]}
                      >
                        100–199 over
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ringGuideDesc}>
                    100–199 calories over your goal
                  </Text>
                </View>
              </View>

              {/* Red */}
              <View style={styles.ringGuideRow}>
                <View
                  style={[
                    styles.ringPreviewCircle,
                    { borderColor: "#EF4444", backgroundColor: "#FEE2E2" },
                  ]}
                >
                  <Text style={[styles.ringPreviewText, { color: "#EF4444" }]}>
                    20
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={styles.ringGuideName}>Red</Text>
                    <View
                      style={[
                        styles.ringTag,
                        { backgroundColor: "#FEE2E2" },
                      ]}
                    >
                      <Text
                        style={[styles.ringTagText, { color: "#EF4444" }]}
                      >
                        200+ over
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ringGuideDesc}>
                    200+ calories over your goal
                  </Text>
                </View>
              </View>

              {/* Dotted */}
              <View style={styles.ringGuideRow}>
                <View
                  style={[
                    styles.ringPreviewCircle,
                    {
                      borderColor: "rgba(154, 154, 154, 1)",
                      borderStyle: "dashed",
                      backgroundColor: "#F8FAFC",
                    },
                  ]}
                >
                  <Text style={[styles.ringPreviewText, { color: "#94A3B8" }]}>
                    21
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={styles.ringGuideName}>Dotted</Text>
                    <View
                      style={[
                        styles.ringTag,
                        { backgroundColor: "#F1F5F9" },
                      ]}
                    >
                      <Text
                        style={[styles.ringTagText, { color: "#64748B" }]}
                      >
                        No logs
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ringGuideDesc}>
                    No meals logged that day
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalSave}
              onPress={() => setRingColorsModal(false)}
              testID="profile-ring-colors-dismiss"
            >
              <Text style={{ fontWeight: "800", color: colors.white }}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  noCard = false,
}: {
  title: string;
  children: React.ReactNode;
  noCard?: boolean;
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {noCard ? (
        <View style={{ gap: 10 }}>{children}</View>
      ) : (
        <View style={styles.sectionBody}>{children}</View>
      )}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  testID,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  testID?: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: "#FFF1F2" }]}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? "#E11D48" : "#0F172A"}
        />
      </View>
      <Text style={[styles.rowLabel, danger && { color: "#E11D48" }]}>
        {label}
      </Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
      ) : null}
    </TouchableOpacity>
  );
}

function PlanBox({
  label,
  v,
  accent = colors.white,
  macroType,
}: {
  label: string;
  v: string;
  accent?: string;
  macroType?: MacroType;
}) {
  return (
    <View style={{ width: "33.33%", alignItems: "center", paddingVertical: 8, paddingHorizontal: 2 }}>
      {macroType ? (
        <MacroIcon type={macroType} size={22} showBadge={false} />
      ) : null}
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 10,
          textTransform: "uppercase",
          fontWeight: "800",
          letterSpacing: 0.5,
          marginTop: 4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: accent,
          fontSize: 14,
          fontWeight: "900",
          marginTop: 2,
        }}
      >
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 8 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },

  /* User Card */
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 14,
    ...shadowMd,
  },
  avatarBig: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  avatarBigText: { fontSize: 26, fontWeight: "900", color: "#0F172A" },
  userName: { fontSize: 19, fontWeight: "900", color: "#0F172A" },
  userMeta: { fontSize: 13, color: "#64748B", marginTop: 2, fontWeight: "500" },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  proBadgeText: {
    fontSize: 9,
    color: colors.white,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  /* Daily Nutrition Plan Card */
  planCard: {
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
    ...shadowMd,
  },
  planGradient: {
    padding: 20,
  },
  planLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "800",
    letterSpacing: 1,
  },
  planVal: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  planMacroRow: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },

  /* Section Wrapper */
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionBody: {
    backgroundColor: colors.white,
    borderRadius: 14,
    overflow: "hidden",
    padding: 8,
    ...shadowMd,
  },

  /* Pro Status */
  proStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 14,
    ...shadowMd,
  },
  proStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  proStatusTitle: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  proStatusSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#0F172A",
  },
  smallBtnText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  upgradeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#0F172A",
  },
  upgradeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeTitle: { color: colors.white, fontWeight: "900", fontSize: 14 },
  upgradeSub: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },

  /* Widget Styles */
  widgetCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowMd,
  },
  widgetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  widgetBadgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  widgetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  widgetCardTitle: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  widgetCardSubTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "800", color: "#334155" },
  widgetPreviewContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    ...shadowSm,
  },
  widgetPreviewBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    marginTop: 10,
    overflow: "hidden",
  },
  widgetPreviewFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  macroPillPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  macroPillText: { fontSize: 11, fontWeight: "800" },
  quickBtnPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#0284C7",
  },
  quickBtnPreviewText: { fontSize: 11, fontWeight: "800", color: colors.white },
  widgetDesc: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 14,
    fontWeight: "500",
    lineHeight: 16,
  },
  widgetBtn: {
    backgroundColor: "#0F172A",
    height: 44,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  widgetBtnText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  refreshWidgetsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  refreshWidgetsBtnText: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  stepText: { fontSize: 13, color: "#0F172A", lineHeight: 20 },

  /* Family Sharing */
  familyActiveCard: {
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 14,
    ...shadowMd,
  },
  familyEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 14,
    ...shadowMd,
  },
  familyEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  familyEmptyTitle: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  familyEmptySub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  familyHeader: { flexDirection: "row", alignItems: "center", padding: 4 },
  familyTitle: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  familyCode: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "800",
    letterSpacing: 3,
  },
  leaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  leaveText: { fontSize: 12, fontWeight: "800", color: "#0F172A" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  memberInitial: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  memberName: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  memberEmail: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },

  /* List Row Item */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: "#0F172A" },
  rowValue: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "700",
    marginRight: 4,
  },

  /* Social Groups Entry Card */
  groupsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowMd,
  },
  groupsIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  groupsCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  groupsHotBadge: {
    backgroundColor: "#FFF0E5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  groupsHotText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.accent,
  },
  groupsCardSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
    lineHeight: 16,
  },

  /* Footer */
  brandFooter: {
    textAlign: "center",
    marginTop: 32,
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    lineHeight: 18,
  },

  /* Modals */
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 26,
    padding: 22,
    ...shadowMd,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 14,
  },
  modalCancel: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 999,
  },
  modalSave: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 999,
    ...shadowSm,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
  },
  divLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  divText: {
    color: "#94A3B8",
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  /* Ring Colors Guide Styles */
  ringModalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  ringGuideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  ringPreviewCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringPreviewText: {
    fontSize: 13,
    fontWeight: "800",
  },
  ringGuideName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  ringTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ringTagText: {
    fontSize: 10,
    fontWeight: "800",
  },
  ringGuideDesc: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
});
