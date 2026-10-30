import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";

export default function NotFound() {
  const router = useRouter();
  useEffect(() => {
    // Auto-redirect after 5s to give users a smoother fallback
    const t = setTimeout(() => router.replace("/"), 5000);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={styles.icon}>
          <Ionicons name="alert-circle" size={48} color={colors.accent} />
        </View>
        <Text style={styles.title}>Screen not found</Text>
        <Text style={styles.sub}>We couldn{"\u2019"}t find that page. Taking you home in a moment.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace("/")} testID="not-found-home-btn">
          <Text style={styles.btnText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  icon: { width: 84, height: 84, borderRadius: 999, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900", color: colors.textPrimary, marginTop: 18 },
  sub: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 20 },
  btn: { marginTop: 22, backgroundColor: colors.black, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999 },
  btnText: { color: colors.white, fontWeight: "800", fontSize: 15 },
});
