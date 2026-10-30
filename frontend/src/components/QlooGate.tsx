import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "@/src/lib/api";

type QlooStatus = "checking" | "active" | "unavailable";

/**
 * QlooGate — Foundation layer guard.
 *
 * Checks /health on mount. If Qloo is not configured (503),
 * renders a blocking error screen. The app cannot function without Qloo.
 */
export function QlooGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<QlooStatus>("checking");

  const checkHealth = async (retries = 3) => {
    setStatus("checking");
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (__DEV__) {
          console.log(`[QlooGate] Health check (attempt ${attempt}/${retries}) -> ${BASE_URL}/health`);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let res = await fetch(`${BASE_URL}/health`, { signal: controller.signal }).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch(`${BASE_URL}/api/health`, { signal: controller.signal }).catch(() => null);
        }
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const data = await res.json();
          if (
            data.qloo_integration === "active" ||
            data.qloo_integration === "mock" ||
            data.mock_mode === true ||
            data.status === "healthy"
          ) {
            if (__DEV__) console.log("[QlooGate] Qloo foundation verified active!");
            setStatus("active");
            return;
          }
        }
      } catch (err) {
        if (__DEV__) {
          console.warn(`[QlooGate] Attempt ${attempt} failed:`, err);
        }
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setStatus("unavailable");
  };

  useEffect(() => {
    checkHealth();
  }, []);

  if (status === "checking") {
    return null; // Let the splash screen handle loading state
  }

  if (status === "unavailable") {
    return (
      <LinearGradient colors={["#0F0C29", "#302B63", "#24243E"]} style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={56} color="#F87171" />
          </View>
          <Text style={styles.title}>Service Unavailable</Text>
          <Text style={styles.subtitle}>
            Caliwo requires Qloo Cultural Intelligence to operate.
            The Qloo API is currently unreachable or not configured.
          </Text>
          <Text style={styles.detail}>
            Target backend: {BASE_URL}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => checkHealth(3)} activeOpacity={0.8}>
            <LinearGradient
              colors={["#7C3AED", "#A78BFA"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.retryGradient}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryText}>Retry Connection</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: 32, alignItems: "center", maxWidth: 400 },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(248,113,113,0.15)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#F87171", fontSize: 26, fontWeight: "800",
    textAlign: "center", marginBottom: 12,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)", fontSize: 16,
    textAlign: "center", lineHeight: 24, marginBottom: 16,
  },
  detail: {
    color: "rgba(255,255,255,0.5)", fontSize: 14,
    textAlign: "center", lineHeight: 20, marginBottom: 32,
  },
  retryButton: { borderRadius: 16, overflow: "hidden", width: "100%" },
  retryGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, gap: 8,
  },
  retryText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
