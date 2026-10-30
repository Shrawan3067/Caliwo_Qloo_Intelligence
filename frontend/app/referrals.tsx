import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";

type CommissionEntry = {
  tx_key?: string;
  referee_id?: string;
  plan?: string;
  purchase_amount_usd?: number;
  commission_usd?: number;
  commission_rate?: number;
  timestamp?: string;
};

type ReferralInfo = {
  code: string;
  commission_rate: number;
  total_commission_earned: number;
  commission_balance: number;
  redemptions: number;
  paid_conversions?: number;
  commission_history?: CommissionEntry[];
  share_url: string;
  share_message: string;
  already_redeemed_a_code: boolean;
  redeemed_code?: string | null;
  pro_active: boolean;
  pro_expires_at?: string | null;
  pro_days_remaining?: number;
  bonus_days_earned?: number;
  bonus_days_per_referral?: number;
};

export default function ReferralsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [ref, setRef] = useState<ReferralInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.get<ReferralInfo>("/referrals/me");
      setRef(r.data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not load referral data");
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const copyCode = async () => {
    if (!ref) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await Clipboard.setStringAsync(ref.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareLink = async () => {
    if (!ref) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await Share.share({
        message:
          ref.share_message ||
          `Join me on Caliwo — the AI nutrition coach. Use my code ${ref.code} when you sign up!\n\n${ref.share_url}`,
      });
    } catch {}
  };

  const redeem = async () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRedeeming(true);
    try {
      const r = await api.post<{
        ok: boolean;
        commission_rate: number;
        message: string;
      }>("/referrals/redeem", { code });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        "🎉 Success!",
        r.data.message || "Referral code applied! Your friend will receive a 20% commission reward when you subscribe.",
        [{ text: "Awesome!" }]
      );
      setInputCode("");
      queryClient.invalidateQueries({ queryKey: ["user_profile"] });
      queryClient.invalidateQueries({ queryKey: ["subscription_status"] });
      await load();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Could Not Redeem", e?.response?.data?.detail || "Invalid code. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          style={styles.backBtn}
          testID="ref-back-btn"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={["#FFF0E5", "#FEEBD3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.giftIconWrap}>
              <Ionicons name="wallet" size={28} color={colors.accent} />
            </View>
            <Text style={styles.heroTitle}>Earn 20% Cash Commission</Text>
            <Text style={styles.heroSub}>
              Share your invite code with friends. When they buy a Caliwo Pro subscription, you earn{" "}
              <Text style={{ fontWeight: "800", color: colors.accent }}>
                20% commission
              </Text>
              {" "}on every purchase!
            </Text>
          </LinearGradient>
        </View>

        {busy && !ref ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : ref ? (
          <>
            {/* Pro Status Banner (if active) */}
            {ref.pro_active && (
              <View style={styles.proActiveCard}>
                <View style={styles.proBadgeIcon}>
                  <Ionicons name="sparkles" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.proActiveTitle}>Caliwo Pro Active</Text>
                  <Text style={styles.proActiveSub}>
                    {ref.pro_days_remaining
                      ? `${ref.pro_days_remaining} days remaining`
                      : "Active Pro membership unlocked"}
                  </Text>
                </View>
              </View>
            )}

            {/* Your Referral Code Card */}
            <Text style={styles.sectionLabel}>Your Invite Code</Text>
            <View style={styles.codeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.codeSubtitle}>Tap to copy or share</Text>
                <Text style={styles.codeValue} testID="ref-code-value">
                  {ref.code}
                </Text>
              </View>
              <TouchableOpacity
                onPress={copyCode}
                style={[styles.copyBtn, copied && styles.copyBtnActive]}
                activeOpacity={0.8}
                testID="ref-copy-btn"
              >
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy-outline"}
                  size={16}
                  color={copied ? colors.white : colors.textPrimary}
                />
                <Text
                  style={[
                    styles.copyBtnText,
                    copied && { color: colors.white },
                  ]}
                >
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Share CTA Button */}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={shareLink}
              activeOpacity={0.85}
              testID="ref-share-btn"
            >
              <Ionicons name="share-social" size={20} color={colors.white} />
              <Text style={styles.shareBtnText}>Share Invite Link</Text>
            </TouchableOpacity>

            {/* Referral Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <View style={[styles.statIconBadge, { backgroundColor: "#ECFDF5" }]}>
                  <Ionicons name="cash" size={18} color="#10B981" />
                </View>
                <Text style={styles.statNum} testID="ref-earnings">
                  ${(ref.total_commission_earned || 0).toFixed(2)}
                </Text>
                <Text style={styles.statLbl}>Total Earned</Text>
              </View>

              <View style={styles.statBox}>
                <View style={styles.statIconBadge}>
                  <Ionicons name="people" size={18} color={colors.accent} />
                </View>
                <Text style={styles.statNum} testID="ref-count">
                  {ref.redemptions}
                </Text>
                <Text style={styles.statLbl}>Friends Joined</Text>
              </View>

              <View style={styles.statBox}>
                <View style={[styles.statIconBadge, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="pricetag" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.statNum}>20%</Text>
                <Text style={styles.statLbl}>Commission</Text>
              </View>
            </View>

            {/* Commission History Section */}
            {ref.commission_history && ref.commission_history.length > 0 && (
              <View style={{ marginTop: 22 }}>
                <Text style={styles.sectionLabel}>Commission History</Text>
                <View style={styles.howCard}>
                  {ref.commission_history.map((item, idx) => (
                    <View key={item.tx_key || idx.toString()} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: idx < ref.commission_history!.length - 1 ? 1 : 0, borderBottomColor: "#F1F5F9" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#0F172A" }}>
                          Friend Subscription ({item.plan || "Monthly"})
                        </Text>
                        <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          Purchase: ${item.purchase_amount_usd?.toFixed(2) || "9.99"}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: "#10B981" }}>
                        +${(item.commission_usd || 0).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* How It Works Card */}
            <View style={styles.howCard}>
              <Text style={styles.howTitle}>How it works</Text>
              <View style={styles.howSteps}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepHeading}>Share your code</Text>
                    <Text style={styles.stepSub}>
                      Send your link to friends, family, or workout partners.
                    </Text>
                  </View>
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepHeading}>They join with your code</Text>
                    <Text style={styles.stepSub}>
                      They redeem your code when registering or inside the app.
                    </Text>
                  </View>
                </View>

                <View style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>3</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepHeading}>Earn 20% Commission</Text>
                    <Text style={styles.stepSub}>
                      Whenever they buy or renew a subscription, you instantly earn 20% cash commission.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Redeem Friend's Code Section */}
            {!ref.already_redeemed_a_code ? (
              <View style={styles.redeemSection}>
                <Text style={styles.sectionLabel}>Have a Friend's Code?</Text>
                <View style={styles.redeemCard}>
                  <TextInput
                    value={inputCode}
                    onChangeText={setInputCode}
                    placeholder="Enter code (e.g. CALIWO-ABCD)"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    style={styles.input}
                    testID="ref-input"
                  />
                  <TouchableOpacity
                    style={[
                      styles.redeemBtn,
                      (!inputCode.trim() || redeeming) && { opacity: 0.5 },
                    ]}
                    onPress={redeem}
                    disabled={!inputCode.trim() || redeeming}
                    activeOpacity={0.8}
                    testID="ref-redeem-btn"
                  >
                    {redeeming ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.redeemBtnText}>Redeem</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.redeemedBanner}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#10B981"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.redeemedText}>
                    You redeemed code{" "}
                    <Text style={{ fontWeight: "900" }}>{ref.redeemed_code}</Text>
                  </Text>
                  <Text style={styles.redeemedSub}>
                    Your account is linked to your friend's referral code.
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 4 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
  },

  /* Hero */
  heroCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  heroGradient: {
    padding: 22,
    alignItems: "center",
  },
  giftIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
    paddingHorizontal: 10,
  },
  loadingWrap: {
    marginTop: 60,
    alignItems: "center",
  },

  /* Pro Status Card */
  proActiveCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF3C7",
    padding: 14,
    borderRadius: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  proBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  proActiveTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
  },
  proActiveSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B45309",
    marginTop: 2,
  },

  /* Section Label */
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* Code Card */
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: "#0F172A",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  codeSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 2,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#0F172A",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  copyBtnActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  copyBtnText: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 13,
  },

  /* Share CTA */
  shareBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  shareBtnText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 15,
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "flex-start",
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNum: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  statLbl: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
  },

  /* How it works */
  howCard: {
    marginTop: 22,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  howTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 14,
  },
  howSteps: {
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.accent,
  },
  stepHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  stepSub: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
    marginTop: 1,
  },

  /* Redeem Card */
  redeemSection: {
    marginTop: 4,
  },
  redeemCard: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    backgroundColor: colors.white,
  },
  redeemBtn: {
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  redeemBtnText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 13,
  },

  /* Redeemed Banner */
  redeemedBanner: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  redeemedText: {
    color: "#065F46",
    fontWeight: "800",
    fontSize: 13,
  },
  redeemedSub: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
