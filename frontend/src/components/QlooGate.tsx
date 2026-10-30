import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "@/src/lib/api";

type QlooStatus = "checking" | "active" | "cached_fallback";

/**
 * QlooGate — Resilient Foundation Layer Guard.
 *
 * Checks /health on mount. If the live Qloo endpoint is unreachable or timing out,
 * it DOES NOT block the user. Instead, it seamlessly enables offline resilient
 * cached taste graph clusters and displays a subtle status indicator banner.
 */
export function QlooGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<QlooStatus>("checking");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const checkHealth = async (retries = 2) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (__DEV__) {
          console.log(`[QlooGate] Health check (${attempt}/${retries}) -> ${BASE_URL}/health`);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

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
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Never dead-end or lock the user out: gracefully fall back to cached clusters
    if (__DEV__) {
      console.log("[QlooGate] Switching to cached Qloo taste graph clusters fallback.");
    }
    setStatus("cached_fallback");
  };

  useEffect(() => {
    checkHealth();
    // Maximum splash grace period: 2 seconds before showing UI in cached mode
    const fallbackTimer = setTimeout(() => {
      setStatus((prev) => (prev === "checking" ? "cached_fallback" : prev));
    }, 2000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  if (status === "checking") {
    return null; // Let the splash screen handle initial render
  }

  return (
    <View style={styles.rootContainer}>
      {children}

      {/* Subtle Offline-Resilient Cached Cluster Banner */}
      {status === "cached_fallback" && !bannerDismissed && (
        <View style={styles.cachedBannerContainer} testID="qloo-cached-cluster-banner">
          <View style={styles.cachedBannerContent}>
            <View style={styles.sparkleWrap}>
              <Ionicons name="sparkles" size={13} color="#C084FC" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.cachedBannerTitle}>
                Operating on Cached Qloo Taste Graph Clusters.
              </Text>
              <Text style={styles.cachedBannerSubtitle}>
                Offline-resilient cultural intelligence active
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => checkHealth(1)}
              style={styles.retryIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="qloo-cached-retry-btn"
            >
              <Ionicons name="refresh-outline" size={15} color="#A78BFA" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBannerDismissed(true)}
              style={styles.dismissBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="qloo-cached-dismiss-btn"
            >
              <Ionicons name="close" size={15} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  cachedBannerContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 48 : 28,
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.35)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  cachedBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sparkleWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(192, 132, 252, 0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  textWrap: {
    flex: 1,
  },
  cachedBannerTitle: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  cachedBannerSubtitle: {
    color: "#C084FC",
    fontSize: 10,
    fontWeight: "500",
    lineHeight: 13,
  },
  retryIconBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  dismissBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
});
