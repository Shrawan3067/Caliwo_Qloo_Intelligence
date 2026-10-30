import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/src/context/AuthContext";
import { NutriLogo } from "@/src/components/NutriLogo";
import { colors, bgGradient } from "@/src/theme";

function isValidPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

export default function ForgotPassword() {
  const router = useRouter();
  const { requestPasswordReset, resetPassword } = useAuth();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const onRequestReset = async () => {
    if (!email.trim()) return;
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setSuccessMsg(null);
    setBusy(true);

    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      setSuccessMsg(res.message);
      // In dev mode, the backend returns the token directly for convenience
      if (res.reset_token) {
        setResetToken(res.reset_token);
      }
      // Always transition to the reset step — in production, users will
      // paste the token from the email they receive
      setStep("reset");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Unable to send reset request. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const onResetSubmit = async () => {
    if (!resetToken.trim() || !isValidPassword(newPassword)) return;
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setSuccessMsg(null);
    setBusy(true);

    try {
      const res = await resetPassword(resetToken.trim(), newPassword);
      setSuccessMsg(res.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => {
        router.replace("/signin");
      }, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to reset password. Token may be invalid or expired.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={bgGradient.colors as unknown as [string, string, ...string[]]}
      start={bgGradient.start}
      end={bgGradient.end}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Row */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="chevron-back" size={20} color="#0F172A" />
              </TouchableOpacity>
              <NutriLogo size={36} style={{ borderRadius: 8 }} />
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title} testID="forgot-title">
              {step === "request" ? "Reset your password" : "Create new password"}
            </Text>
            <Text style={styles.subtitle}>
              {step === "request"
                ? "Enter your email address and we'll send you instructions to reset your password."
                : "Enter your reset token and your new account password below."}
            </Text>

            {/* Error Banner */}
            {error ? (
              <View style={styles.errCard} testID="forgot-error">
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errText}>{error}</Text>
              </View>
            ) : null}

            {/* Success Banner */}
            {successMsg ? (
              <View style={styles.successCard} testID="forgot-success">
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {step === "request" ? (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedInput === "email" && styles.inputWrapperFocused,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color={focusedInput === "email" ? "#0F172A" : "#94A3B8"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="you@example.com"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                      testID="forgot-email-input"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.cta, (!email.trim() || busy) && styles.ctaDisabled]}
                  onPress={onRequestReset}
                  disabled={busy || !email.trim()}
                  activeOpacity={0.88}
                  testID="forgot-submit-btn"
                >
                  {busy ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <View style={styles.ctaContent}>
                      <Text style={styles.ctaText}>Send Reset Link</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={20}
                        color="#FFFFFF"
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep("reset")}
                  style={styles.switchBtn}
                >
                  <Text style={styles.altText}>
                    Have a reset token already?{" "}
                    <Text style={styles.altHighlight}>Enter token</Text>
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Reset Token</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedInput === "token" && styles.inputWrapperFocused,
                    ]}
                  >
                    <Ionicons
                      name="key-outline"
                      size={20}
                      color={focusedInput === "token" ? "#0F172A" : "#94A3B8"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={resetToken}
                      onChangeText={setResetToken}
                      onFocus={() => setFocusedInput("token")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Paste your reset token"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      style={styles.input}
                      testID="reset-token-input"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focusedInput === "password" && styles.inputWrapperFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={focusedInput === "password" ? "#0F172A" : "#94A3B8"}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Min 8 chars, 1 letter & 1 number"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      style={styles.input}
                      testID="reset-password-input"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {newPassword.length > 0 && !isValidPassword(newPassword) ? (
                  <Text style={styles.hint}>
                    Use at least 8 characters with a letter and a number.
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.cta,
                    (!resetToken || !isValidPassword(newPassword) || busy) &&
                      styles.ctaDisabled,
                  ]}
                  onPress={onResetSubmit}
                  disabled={busy || !resetToken || !isValidPassword(newPassword)}
                  activeOpacity={0.88}
                  testID="reset-submit-btn"
                >
                  {busy ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <View style={styles.ctaContent}>
                      <Text style={styles.ctaText}>Reset Password</Text>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#FFFFFF"
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep("request")}
                  style={styles.switchBtn}
                >
                  <Text style={styles.altText}>
                    Need to request a new token?{" "}
                    <Text style={styles.altHighlight}>Request reset link</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => router.replace("/signin")}
              style={{ marginTop: 20, alignItems: "center" }}
            >
              <Text style={{ fontSize: 14, color: "#64748B", fontWeight: "600" }}>
                Back to Sign in
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#64748B",
    lineHeight: 22,
    marginBottom: 28,
  },
  hint: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 13,
    color: "#94734B",
    fontWeight: "600",
  },
  errCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  errText: {
    flex: 1,
    color: "#991B1B",
    fontSize: 14,
    fontWeight: "600",
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  successText: {
    flex: 1,
    color: "#065F46",
    fontSize: 14,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#475569",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 56,
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  inputWrapperFocused: {
    borderColor: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
  },
  cta: {
    marginTop: 12,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
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
    letterSpacing: 0.2,
  },
  switchBtn: {
    marginTop: 20,
    alignItems: "center",
  },
  altText: {
    fontSize: 15,
    color: "#64748B",
  },
  altHighlight: {
    fontWeight: "800",
    color: "#0F172A",
  },
});
