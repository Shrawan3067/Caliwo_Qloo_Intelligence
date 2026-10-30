import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { useRouter, useLocalSearchParams } from "expo-router";
import { usePaywall } from "@/src/modules/subscription/hooks/usePaywall";
import { PurchaseSuccessModal } from "@/src/modules/subscription/components/PurchaseSuccessModal";
import { PurchaseErrorDialog } from "@/src/modules/subscription/components/PurchaseErrorDialog";

const FEATURES = [
  {
    i: "restaurant" as const,
    t: "Unlimited AI Meal Plans",
    s: "Custom 7-day meal plans generated on demand",
  },
  {
    i: "sparkles" as const,
    t: "Unlimited Recipe Creator",
    s: "Personalized recipes based on your pantry & macros",
  },
  {
    i: "camera" as const,
    t: "Unlimited Photo Scans",
    s: "Snap every meal & snack with GPT-4o vision",
  },
  {
    i: "chatbubble-ellipses" as const,
    t: "Priority AI Coach",
    s: "Instant 24/7 nutrition advice & macro guidance",
  },
  {
    i: "people" as const,
    t: "Family Sharing",
    s: "Share Pro features with up to 5 family members",
  },
];

const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
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

export default function PaywallScreen() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  const {
    isPremium,
    selectedPlan,
    setSelectedPlan,
    purchaseState,
    error,
    countryRegion,
    pricingData,
    loadingPricing,
    startingTrial,
    isTrialEligible,
    startFreeTrial,
    executePurchase,
    restorePurchases,
    clearError,
  } = usePaywall();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const isPurchasing = purchaseState === "purchasing";
  const isRestoring = purchaseState === "restoring";

  const handleAction = async () => {
    if (isPremium) {
      const success = await executePurchase();
      if (success) setShowSuccessModal(true);
      return;
    }

    if (isTrialEligible) {
      const success = await startFreeTrial();
      if (success) setShowSuccessModal(true);
      return;
    }

    const success = await executePurchase();
    if (success) {
      setShowSuccessModal(true);
    }
  };

  const handleRestore = async () => {
    try {
      const info = await restorePurchases();
      if (info.isPremium) {
        setShowSuccessModal(true);
      }
    } catch {}
  };

  const monthlyPlan = pricingData?.plans.monthly;
  const yearlyPlan = pricingData?.plans.yearly;

  return (
    <SafeAreaView style={styles.bg} edges={["top", "bottom"]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeIconBtn}
          testID="paywall-close-btn"
        >
          <Ionicons name="close" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="star" size={26} color={colors.accent} />
          </View>
          <Text style={styles.title}>
            {isPremium ? "Caliwo Pro Active" : "Start 3 Days Free"}
          </Text>
          <Text style={styles.subtitle}>
            Try Caliwo Pro free for 3 days. Unlock unlimited AI meal scans, custom recipes, & family sharing.
          </Text>
          <View style={styles.regionBadgeRow}>
            <Ionicons name="location-sharp" size={12} color={colors.accent} />
            <Text style={styles.regionBadgeText}>
              Region: {countryRegion === "IN" ? "India (INR)" : "Global (USD)"}
            </Text>
          </View>
          {reason ? (
            <Text style={styles.reason} testID="paywall-reason">
              {reason}
            </Text>
          ) : null}
        </View>

        {/* Pricing Plan Selector Cards (Monthly vs Yearly) */}
        {loadingPricing && !pricingData ? (
          <View style={{ paddingVertical: 30, alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <View style={styles.planSelectorRow}>
            {/* Monthly */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedPlan("monthly")}
              style={[
                styles.priceCard,
                selectedPlan === "monthly" && styles.priceCardActive,
              ]}
            >
              <Text
                style={[
                  styles.priceBig,
                  selectedPlan === "monthly" && styles.priceBigActive,
                ]}
              >
                {monthlyPlan?.price_formatted || (countryRegion === "IN" ? "₹949 / mo" : "$9.99 / mo")}
              </Text>
              <Text
                style={[
                  styles.priceLabel,
                  selectedPlan === "monthly" && styles.priceLabelActive,
                ]}
              >
                Monthly Plan
              </Text>
            </TouchableOpacity>

            {/* Yearly (Best Value) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedPlan("yearly")}
              style={[
                styles.priceCard,
                selectedPlan === "yearly" && styles.priceCardActive,
              ]}
            >
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>
                  BEST VALUE · SAVE {yearlyPlan?.save_percent || (countryRegion === "IN" ? 74 : 75)}%
                </Text>
              </View>
              <Text
                style={[
                  styles.priceBig,
                  selectedPlan === "yearly" && styles.priceBigActive,
                ]}
              >
                {yearlyPlan?.price_formatted || (countryRegion === "IN" ? "₹3,000 / yr" : "$29.99 / yr")}
              </Text>
              <Text
                style={[
                  styles.priceLabel,
                  selectedPlan === "yearly" && styles.priceLabelActive,
                ]}
              >
                {yearlyPlan?.monthly_equivalent || (countryRegion === "IN" ? "₹250 / mo" : "$2.50 / mo")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Feature Comparison Rows */}
        <View style={{ gap: 10, marginTop: 22 }}>
          {FEATURES.map((f) => (
            <View key={f.t} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.i} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.t}</Text>
                <Text style={styles.featureSub}>{f.s}</Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.accent}
              />
            </View>
          ))}
        </View>

        {/* Primary CTA Button */}
        <TouchableOpacity
          style={styles.cta}
          onPress={handleAction}
          disabled={isPurchasing || isRestoring || startingTrial}
          activeOpacity={0.85}
          testID="paywall-upgrade-btn"
        >
          {isPurchasing || startingTrial ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.ctaText}>
              {isPremium
                ? "Extend Pro Access"
                : isTrialEligible
                ? "Start 3-Day Free Trial"
                : "Upgrade to Pro"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Restore Purchases & Legal Links */}
        <View style={styles.footerActionRow}>
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isRestoring}
            testID="paywall-restore-btn"
          >
            <Text style={styles.restoreText}>
              {isRestoring ? "Restoring Purchases…" : "Restore Purchases"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legalDot}>·</Text>

          <TouchableOpacity
            onPress={() => Linking.openURL("https://caliwo.app/terms")}
          >
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>

          <Text style={styles.legalDot}>·</Text>

          <TouchableOpacity
            onPress={() => Linking.openURL("https://caliwo.app/privacy")}
          >
            <Text style={styles.legalLink}>Privacy</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cancelNotice}>
          Secured by App Store & Google Play Billing. Cancel anytime.
        </Text>
      </ScrollView>

      {/* Success & Error Feedback Modals */}
      <PurchaseSuccessModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.replace("/(tabs)/profile");
        }}
      />
      <PurchaseErrorDialog error={error} onClose={clearError} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },
  header: { alignItems: "center", marginTop: 4 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
    fontWeight: "500",
  },
  regionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  regionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  reason: {
    marginTop: 12,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },

  /* Plan selector row */
  planSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  priceCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  priceCardActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
    ...shadowMd,
  },
  priceBig: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.6,
  },
  priceBigActive: { color: colors.white },
  priceLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  priceLabelActive: { color: "rgba(255, 255, 255, 0.75)" },
  saveBadge: {
    position: "absolute",
    top: -12,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  saveBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  /* Features */
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  featureSub: { fontSize: 12, color: "#64748B", marginTop: 2, fontWeight: "500" },

  /* Primary CTA */
  cta: {
    marginTop: 22,
    backgroundColor: colors.accent,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  ctaText: { color: colors.white, fontWeight: "900", fontSize: 17 },

  /* Footer Links */
  footerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  restoreText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 13,
  },
  legalDot: { color: "#94A3B8", fontSize: 14 },
  legalLink: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 13,
  },
  cancelNotice: {
    textAlign: "center",
    marginTop: 14,
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
});
