/**
 * Reusable Premium Guard Component
 * Conditionally renders protected content based on RevenueCat Premium entitlement.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePremium } from "../hooks/usePremium";
import { usePaywall } from "../hooks/usePaywall";
import { colors } from "@/src/theme";

type PremiumGuardProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  reason?: string;
  showPaywallButton?: boolean;
};

export function PremiumGuard({
  children,
  fallback,
  reason = "Unlock Caliwo Pro to access this feature.",
  showPaywallButton = true,
}: PremiumGuardProps) {
  const { isPremium, isLoading } = usePremium();
  const { openPaywall } = usePaywall();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles" size={24} color={colors.accent} />
      </View>
      <Text style={styles.title}>Pro Feature</Text>
      <Text style={styles.sub}>{reason}</Text>

      {showPaywallButton ? (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => openPaywall(reason, "feature_gate")}
          activeOpacity={0.85}
        >
          <Ionicons name="star" size={16} color={colors.white} />
          <Text style={styles.btnText}>Upgrade to Pro</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },
  sub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 14,
  },
});
