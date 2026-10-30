import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, spacing } from "@/src/theme";

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onContinue?: () => void | Promise<void>;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  hideBack?: boolean;
  hideContinue?: boolean;
  testID?: string;
};

export function OnboardingLayout({
  step,
  total,
  title,
  subtitle,
  onContinue,
  continueLabel = "Continue",
  continueDisabled,
  loading,
  children,
  hideBack,
  hideContinue,
  testID,
}: Props) {
  const router = useRouter();
  const pct = Math.min(1, Math.max(0.02, step / total));

  const handlePressContinue = () => {
    Haptics.selectionAsync().catch(() => {});
    if (onContinue) {
      onContinue();
    }
  };

  const handlePressBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID={testID}>
      {/* Top Navigation & Progress Bar */}
      <View style={styles.headerRow}>
        {!hideBack ? (
          <TouchableOpacity
            onPress={handlePressBack}
            style={styles.backBtn}
            testID="onboarding-back-btn"
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        <View style={styles.progressWrap} testID="onboarding-progress">
          <LinearGradient
            colors={[colors.accent || "#FF6B00", "#FF8A3D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${pct * 100}%` }]}
          />
        </View>

        <View style={styles.stepBadge}>
          <Text style={styles.stepLabel}>
            {step} / {total}
          </Text>
        </View>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title} testID="onboarding-title">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} testID="onboarding-subtitle">
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.childrenWrap}>{children}</View>
      </ScrollView>

      {/* Fixed Sticky Footer Button with Soft Gradient Fade */}
      {!hideContinue ? (
        <View style={styles.footerContainer}>
          <LinearGradient
            colors={["rgba(250, 250, 249, 0)", "#FAFAF9"]}
            style={styles.footerFade}
            pointerEvents="none"
          />
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cta, continueDisabled && styles.ctaDisabled]}
              onPress={handlePressContinue}
              disabled={continueDisabled || loading}
              activeOpacity={0.88}
              testID="onboarding-continue-button"
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={styles.ctaContent}>
                  <Text style={styles.ctaText}>{continueLabel}</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={colors.white}
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAFAF9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? spacing.xs : spacing.sm,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  backBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  progressWrap: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  stepBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#475569",
    letterSpacing: 0.8,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.7,
    lineHeight: 35,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#64748B",
    lineHeight: 23,
    fontWeight: "500",
  },
  childrenWrap: {
    marginTop: spacing.xl,
  },
  footerContainer: {
    position: "relative",
    backgroundColor: "transparent",
  },
  footerFade: {
    position: "absolute",
    top: -24,
    left: 0,
    right: 0,
    height: 24,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 14 : 22,
    paddingTop: spacing.xs,
    backgroundColor: "#FAFAF9",
  },
  cta: {
    backgroundColor: "#0F172A",
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ctaDisabled: {
    backgroundColor: "#CBD5E1",
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
