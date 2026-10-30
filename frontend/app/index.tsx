import React, { useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { NutriLogo } from "@/src/components/NutriLogo";
import { colors } from "@/src/theme";

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.onboarded) router.replace("/(tabs)/home");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <Image
          source={require("@/assets/images/hero-food.webp")}
          style={styles.heroImg}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.85)", "#FFFFFF"]}
          style={styles.fade}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.logoRow}>
          <NutriLogo size={36} style={{ borderRadius: 8 }} />
          <Text style={styles.brand}>Caliwo</Text>
        </View>

        <Text style={styles.title} testID="landing-title">
          Calorie tracking{"\n"}made easy
        </Text>
        <Text style={styles.subtitle}>
          Your AI nutrition coach — snap a meal, get instant macros, and reach
          your goals with a personalized plan.
        </Text>

        <View style={styles.socialRow}>
          <View style={styles.avatarStack}>
            {(["#FF8A3D", "#4A90D9", "#50C878"] as const).map((bg, i) => (
              <View
                key={bg}
                style={[
                  styles.avatar,
                  { marginLeft: i === 0 ? 0 : -10, backgroundColor: bg },
                ]}
              >
                <Ionicons name="person" size={14} color={colors.white} />
              </View>
            ))}
          </View>
          <Text style={styles.socialText}>
            Join 10M+ people crushing their goals
          </Text>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.push("/onboarding/1")}
          testID="landing-get-started-btn"
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/signin")}
          testID="landing-signin-link"
        >
          <Text style={styles.signInText}>
            Already have an account?{" "}
            <Text style={{ fontWeight: "800", color: colors.black }}>
              Sign in
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { height: "45%", width: "100%", position: "relative" },
  heroImg: { width: "100%", height: "100%", resizeMode: "cover" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 160 },
  body: { flex: 1, paddingHorizontal: 28, paddingBottom: 16, paddingTop: 8 },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  logoDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 44,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    gap: 10,
  },
  avatarStack: { flexDirection: "row" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  socialText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  cta: {
    marginTop: 26,
    backgroundColor: colors.black,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 17 },
  signInText: {
    marginTop: 12,
    marginBottom: 10,
    color: colors.textSecondary,
    textAlign: "center",
    fontSize: 14,
  },
});
