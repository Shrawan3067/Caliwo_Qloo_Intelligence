import React, { useCallback, useEffect, useState } from "react";
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
import { useOnboarding } from "@/src/context/OnboardingContext";
import { NutriLogo } from "@/src/components/NutriLogo";
import { colors, bgGradient } from "@/src/theme";

// Mirror of the backend policy (min 8 chars, at least one letter and one number).
function isValidPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

export default function SignUp() {
  const router = useRouter();
  const { user, signUpEmail, refresh } = useAuth();
  const { data: onbData, save: saveOnboarding } = useOnboarding();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const finishAuth = useCallback(async () => {
    try {
      if (onbData && Object.keys(onbData).length > 0) {
        await saveOnboarding();
      }
    } catch (e) {
      // Non-blocking: account already exists. If the plan didn't persist the
      // profile stays not-onboarded and the app will re-prompt — the user is
      // never silently left with a broken/empty plan.
      if (__DEV__) console.warn("[onboarding] save failed:", e);
    }
    await refresh();
    router.replace({
      pathname: "/taste-onboarding",
      params: { from: "registration" },
    } as any);
  }, [onbData, saveOnboarding, refresh, router]);

  useEffect(() => {
    if (user) finishAuth();
  }, [user, finishAuth]);

  const onSubmit = async () => {
    if (!email.trim() || !isValidPassword(password)) return;
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setBusy(true);
    try {
      await signUpEmail(
        email.trim().toLowerCase(),
        password,
        name.trim() || undefined,
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || "Sign-up failed. Please try again.",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
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
            <Text style={styles.title} testID="signup-title">
              Create your account
            </Text>
            <Text style={styles.subtitle}>
              Save your custom plan and start tracking your nutrition today.
            </Text>

            {/* Error Banner */}
            {error ? (
              <View style={styles.errCard} testID="signup-error">
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errText}>{error}</Text>
              </View>
            ) : null}

            {/* Form Fields */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedInput === "name" && styles.inputWrapperFocused,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={focusedInput === "name" ? "#0F172A" : "#94A3B8"}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedInput("name")}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Alex Morgan"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  testID="signup-name-input"
                />
              </View>
            </View>

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
                  testID="signup-email-input"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
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
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput("password")}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="Min 8 chars, 1 letter & 1 number"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  testID="signup-password-input"
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

            {/* Password requirement checklist */}
            {password.length > 0 ? (
              <View style={{ marginBottom: 16, marginTop: -4, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={password.length >= 8 ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={password.length >= 8 ? "#10B981" : "#94A3B8"}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: password.length >= 8 ? "#065F46" : "#64748B",
                    }}
                  >
                    At least 8 characters
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={/[a-zA-Z]/.test(password) ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={/[a-zA-Z]/.test(password) ? "#10B981" : "#94A3B8"}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: /[a-zA-Z]/.test(password) ? "#065F46" : "#64748B",
                    }}
                  >
                    At least one letter
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={/[0-9]/.test(password) ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={/[0-9]/.test(password) ? "#10B981" : "#94A3B8"}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: /[0-9]/.test(password) ? "#065F46" : "#64748B",
                    }}
                  >
                    At least one number
                  </Text>
                </View>
              </View>
            ) : null}


            {/* Submit CTA */}
            <TouchableOpacity
              style={[
                styles.cta,
                (!email || !isValidPassword(password) || busy) && styles.ctaDisabled,
              ]}
              onPress={onSubmit}
              disabled={busy || !email || !isValidPassword(password)}
              activeOpacity={0.88}
              testID="signup-submit-btn"
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={styles.ctaContent}>
                  <Text style={styles.ctaText}>Create account</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#FFFFFF"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Switch to Sign In */}
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.replace("/signin");
              }}
              style={styles.switchBtn}
              testID="signup-to-signin"
            >
              <Text style={styles.altText}>
                Already have an account?{" "}
                <Text style={styles.altHighlight}>Sign in</Text>
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
    marginTop: 24,
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
