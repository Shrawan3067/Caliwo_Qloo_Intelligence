import React, { useCallback, useEffect, useRef, useState } from "react";

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

export default function SignIn() {
  const router = useRouter();
  const { user, signInEmail, refresh } = useAuth();
  const { data: onbData, save: saveOnboarding } = useOnboarding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const finishAuth = useCallback(async () => {
    try {
      if (onbData && Object.keys(onbData).length > 0) {
        await saveOnboarding();
      }
    } catch {}
    const freshUser = await refresh();
    if (isMounted.current) {
      const activeUser = freshUser || user;
      const hasTaste = Boolean(
        activeUser?.taste_onboarded ||
        activeUser?.profile?.taste_onboarded ||
        activeUser?.has_taste_dna ||
        activeUser?.profile?.taste_dna?.entity_ids?.length
      );
      if (hasTaste) {
        router.replace("/(tabs)/home");
      } else {
        router.replace({
          pathname: "/taste-onboarding",
          params: { from: "signin" },
        } as any);
      }
    }
  }, [onbData, saveOnboarding, refresh, router, user]);

  useEffect(() => {
    if (user) {
      finishAuth();
    }
  }, [user, finishAuth]);

  const onSubmit = async () => {
    if (!email.trim() || !password) return;
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setBusy(true);
    try {
      await signInEmail(email.trim().toLowerCase(), password);
    } catch (e: any) {
      if (isMounted.current) {
        setError(
          e?.response?.data?.detail ||
            "Sign-in failed. Please check your credentials.",
        );
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    } finally {
      if (isMounted.current) {
        setBusy(false);
      }
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
            <Text style={styles.title} testID="signin-title">
              Welcome back
            </Text>
            <Text style={styles.subtitle}>
              Sign in to continue your personalized Caliwo journey.
            </Text>

            {/* Error Banner */}
            {error ? (
              <View style={styles.errCard} testID="signin-error">
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errText}>{error}</Text>
              </View>
            ) : null}

            {/* Form Fields */}
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
                  testID="signin-email-input"
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
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  testID="signin-password-input"
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
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  router.push("/forgot-password");
                }}
                style={{ alignSelf: "flex-end", marginTop: 8, paddingVertical: 4 }}
                testID="signin-forgot-password"
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748B" }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>


            {/* Submit CTA */}
            <TouchableOpacity
              style={[
                styles.cta,
                (!email || !password || busy) && styles.ctaDisabled,
              ]}
              onPress={onSubmit}
              disabled={!email || !password || busy}
              testID="signin-submit"
            >
              {busy ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.ctaText}>Sign In</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color="#0F172A"
                    style={{ marginLeft: 8 }}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Quick Demo Fill for Hackathon Judges */}
            <TouchableOpacity
              onPress={() => {
                setEmail("demo@caliwo.app");
                setPassword("Demo1234!");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }}
              style={styles.demoFillBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={15} color="#FF5E00" />
              <Text style={styles.demoFillText}>Fill Hackathon Demo Account</Text>
            </TouchableOpacity>

            {/* Switch to Sign Up */}
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.replace("/signup");
              }}
              style={styles.switchBtn}
              testID="signin-to-signup"
            >
              <Text style={styles.altText}>
                Don&apos;t have an account?{" "}
                <Text style={styles.altHighlight}>Create an account</Text>
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
  demoFillBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: "rgba(255, 94, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 94, 0, 0.25)",
  },
  demoFillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FF5E00",
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
