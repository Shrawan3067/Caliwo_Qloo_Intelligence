import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

type FamilyMember = {
  user_id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  is_owner: boolean;
};

type Family = {
  family_id: string;
  code: string;
  owner_id: string;
  members: FamilyMember[];
};

const shadowSm = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

export default function FamilyScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/family/me");
      setFamily(res.data.family || null);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const createFamily = async () => {
    setBusy(true);
    try {
      await api.post("/family/create");
      await refresh();
      await load();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.detail || "Could not create family.",
      );
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
      setJoinCode("");
    } catch (e: any) {
      Alert.alert(
        "Join Failed",
        e?.response?.data?.detail || "Invalid code or family limit reached.",
      );
    } finally {
      setBusy(false);
    }
  };

  const leaveFamily = async () => {
    Alert.alert(
      "Leave Family?",
      "You can rejoin later using the invite code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await api.post("/family/leave");
              await refresh();
              await load();
            } catch (e: any) {
              Alert.alert(
                "Error",
                e?.response?.data?.detail || "Could not leave family.",
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const removeMember = (member: FamilyMember) => {
    Alert.alert(`Remove ${member.name || member.email}?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete(`/family/members/${member.user_id}`);
            await load();
          } catch (e: any) {
            Alert.alert(
              "Error",
              e?.response?.data?.detail || "Could not remove member.",
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const copyCode = async (c: string) => {
    await Clipboard.setStringAsync(c);
    Alert.alert("Copied!", `Family invite code ${c} copied to clipboard.`);
  };

  const isOwner =
    family &&
    user &&
    (family.owner_id === user.id || family.owner_id === user.user_id);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          testID="family-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Family Sharing</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {family ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Your Family Group</Text>
                  <Text style={styles.cardSub}>
                    {family.members.length} / 6 members
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={leaveFamily}
                  disabled={busy}
                  style={styles.leaveBtn}
                  testID="family-leave"
                >
                  <Text style={styles.leaveBtnText}>Leave</Text>
                </TouchableOpacity>
              </View>

              {/* Code Box */}
              <TouchableOpacity
                onPress={() => copyCode(family.code)}
                style={styles.codeBox}
                activeOpacity={0.8}
                testID="family-code-box"
              >
                <View>
                  <Text style={styles.codeLabel}>FAMILY INVITE CODE</Text>
                  <Text style={styles.codeVal}>{family.code}</Text>
                </View>
                <View style={styles.copyBadge}>
                  <Ionicons
                    name="copy-outline"
                    size={14}
                    color={colors.white}
                  />
                  <Text style={styles.copyBadgeText}>Copy</Text>
                </View>
              </TouchableOpacity>

              {/* Member List */}
              <Text style={styles.sectionLabel}>MEMBERS</Text>
              <View style={{ gap: 10 }}>
                {family.members.map((m) => (
                  <View key={m.user_id} style={styles.memberRow}>
                    <View style={styles.avatar}>
                      {m.picture ? (
                        <Image
                          source={{ uri: m.picture }}
                          style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(m.name || m.email).slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {m.name || m.email}
                        {m.is_owner ? " (Owner)" : ""}
                      </Text>
                      <Text style={styles.memberEmail}>{m.email}</Text>
                    </View>
                    {isOwner && !m.is_owner ? (
                      <TouchableOpacity
                        onPress={() => removeMember(m)}
                        style={styles.removeBtn}
                        testID={`family-remove-${m.user_id}`}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {/* Create Family Card */}
              <View style={styles.card}>
                <View style={styles.iconWrap}>
                  <Ionicons name="people" size={28} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Create Family Group</Text>
                <Text style={styles.emptySub}>
                  Create a family group to share Caliwo Pro benefits with up to
                  5 family members.
                </Text>
                <TouchableOpacity
                  onPress={createFamily}
                  disabled={busy}
                  style={styles.ctaBtn}
                  testID="family-create-btn"
                >
                  {busy ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="add" size={18} color={colors.white} />
                      <Text style={styles.ctaBtnText}>Create Family</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Join Family Card */}
              <View style={styles.card}>
                <Text style={styles.emptyTitle}>Join Existing Family</Text>
                <Text style={styles.emptySub}>
                  Enter the 6-character invite code shared by your family owner.
                </Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder="Enter code (e.g. ABCXYZ)..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={8}
                    style={styles.input}
                    testID="family-join-input"
                  />
                  <TouchableOpacity
                    onPress={joinFamily}
                    disabled={!joinCode.trim() || busy}
                    style={[
                      styles.joinBtn,
                      (!joinCode.trim() || busy) && { opacity: 0.5 },
                    ]}
                    testID="family-join-btn"
                  >
                    <Text style={styles.joinBtnText}>Join</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.white,
    ...shadowSm,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 6 },
  card: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  cardSub: { fontSize: 13, color: "#64748B", marginTop: 2, fontWeight: "600" },
  leaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  leaveBtnText: { fontSize: 12, fontWeight: "800", color: "#EF4444" },
  codeBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  codeVal: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: 2,
    marginTop: 2,
  },
  copyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  copyBadgeText: { fontSize: 12, fontWeight: "800", color: colors.white },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "900", color: colors.accent },
  memberName: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  memberEmail: { fontSize: 12, color: "#64748B", marginTop: 1 },
  removeBtn: { padding: 6 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
    marginBottom: 16,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    height: 48,
    borderRadius: 999,
  },
  ctaBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  inputWrap: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  joinBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnText: { color: colors.white, fontWeight: "800", fontSize: 14 },
});
