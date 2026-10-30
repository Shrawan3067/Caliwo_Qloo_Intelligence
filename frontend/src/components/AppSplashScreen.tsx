import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type AppSplashScreenProps = {
  onFinish?: () => void;
};

export function AppSplashScreen({ onFinish }: AppSplashScreenProps) {
  const [visible, setVisible] = useState(true);

  // Animation values (all transforms & opacities use native driver)
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(14)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Entrance sequence
    Animated.parallel([
      // Logo Spring & Fade
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Brand Title & Tagline Slide Up
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        delay: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Footer Fade
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 350,
        delay: 220,
        useNativeDriver: true,
      }),
      // Sleek progress bar filling smoothly over 1300ms
      Animated.timing(progressWidth, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // 2. Seamless exit cross-fade
    const exitTimer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        if (onFinish) {
          onFinish();
        }
      });
    }, 1500);

    return () => clearTimeout(exitTimer);
  }, [
    logoScale,
    logoOpacity,
    contentOpacity,
    contentTranslateY,
    footerOpacity,
    progressWidth,
    screenOpacity,
    onFinish,
  ]);

  if (!visible) return null;

  const barWidthInterpolate = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        { opacity: screenOpacity },
      ]}
      pointerEvents="none"
    >
      {/* Center Brand Identity */}
      <View style={styles.centerContent}>
        {/* Prominent Logo Card */}
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoCard}>
            <Image
              source={require("@/assets/images/app-icon.png")}
              style={styles.logoImg}
              resizeMode="cover"
            />
          </View>
        </Animated.View>

        {/* Brand Name & Tagline */}
        <Animated.View
          style={[
            styles.textWrap,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>Caliwo</Text>
            <View style={styles.qlooBadge}>
              <Ionicons name="sparkles" size={11} color="#7C3AED" />
              <Text style={styles.qlooBadgeText}>TASTE AI</Text>
            </View>
          </View>
          <Text style={styles.brandTagline}>
            Cultural Intelligence • Macro Precision
          </Text>
        </Animated.View>
      </View>

      {/* Bottom Minimalist Status Section */}
      <Animated.View style={[styles.bottomSection, { opacity: footerOpacity }]}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressBar, { width: barWidthInterpolate }]}
          >
            <LinearGradient
              colors={["#7C3AED", "#FF5E00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <Text style={styles.footerText}>
          Powered by Qloo Cultural Graph & Vision AI
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 99999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 48,
  },
  logoWrap: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  logoCard: {
    width: 140,
    height: 140,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    padding: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  logoImg: {
    width: 126,
    height: 126,
    borderRadius: 28,
  },
  textWrap: {
    alignItems: "center",
    marginTop: 26,
    gap: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandTitle: {
    fontSize: 46,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -1.2,
  },
  qlooBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.2)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  qlooBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7C3AED",
    letterSpacing: 0.8,
  },
  brandTagline: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.2,
  },
  bottomSection: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 52 : 36,
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 36,
    gap: 12,
  },
  progressTrack: {
    width: 130,
    height: 3,
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
  },
  footerText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 0.4,
    textAlign: "center",
  },
});
