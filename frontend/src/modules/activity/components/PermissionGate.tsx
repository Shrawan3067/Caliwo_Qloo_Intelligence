/**
 * PermissionGate — Guides users through health permission setup
 *
 * Shows a branded permission card when access hasn't been granted,
 * with platform-specific instructions and CTA buttons.
 *
 * @module activity/components/PermissionGate
 */

import React from "react";
import { View, Text, StyleSheet, Pressable, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "@/src/theme";
import { useActivityColors } from "./theme";
import { useActivityPermission } from "../hooks/useActivityPermission";
import { HEALTH_CONNECT_PLAY_STORE_URI } from "../constants";

interface PermissionGateProps {
  children: React.ReactNode;
  testID?: string;
}

/**
 * Wrap activity screens with this component.
 * Children render only when health permission is granted.
 */
export function PermissionGate({ children, testID }: PermissionGateProps) {
  const {
    isGranted,
    isSimulator,
    isHealthAppMissing,
    needsSetup,
    requestPermissions,
    openSettings,
    getPermissionMessage,
    platformName,
    permissionStatus,
  } = useActivityPermission();

  // Render children when permissions are granted or in simulator
  if (isGranted || isSimulator) {
    return <>{children}</>;
  }

  // No setup needed — device unsupported
  if (!needsSetup) {
    return (
      <View style={styles.container} testID={testID}>
        <UnavailableCard
          message={getPermissionMessage()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {isHealthAppMissing ? (
        <HealthAppMissingCard platformName={platformName} />
      ) : permissionStatus === "denied" ? (
        <DeniedCard
          platformName={platformName}
          onOpenSettings={openSettings}
        />
      ) : (
        <RequestCard
          platformName={platformName}
          onRequestPermissions={requestPermissions}
        />
      )}
    </View>
  );
}

// ─── Sub-Cards ───────────────────────────────────────────────────────────────

function RequestCard({
  platformName,
  onRequestPermissions,
}: {
  platformName: string;
  onRequestPermissions: () => void;
}) {
  const theme = useActivityColors();

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.stepsLight }]}>
        <Ionicons
          name={Platform.OS === "ios" ? "heart-circle" : "fitness"}
          size={40}
          color={theme.steps}
        />
      </View>

      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Connect {platformName}
      </Text>

      <Text style={[styles.description, { color: theme.textSecondary }]}>
        Allow Nutri AI to read your activity data to automatically track your steps,
        distance, and calories burned. We never write to or modify your health data.
      </Text>

      <View style={styles.featureList}>
        <Feature icon="footsteps-outline" text="Automatic step tracking" theme={theme} />
        <Feature icon="sync-outline" text="Real-time sync" theme={theme} />
        <Feature icon="shield-checkmark-outline" text="Read-only, private & secure" theme={theme} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.steps, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={onRequestPermissions}
        accessibilityRole="button"
        accessibilityLabel={`Connect to ${platformName}`}
      >
        <Ionicons name="link-outline" size={18} color="#FFFFFF" />
        <Text style={styles.buttonText}>Connect {platformName}</Text>
      </Pressable>
    </View>
  );
}

function DeniedCard({
  platformName,
  onOpenSettings,
}: {
  platformName: string;
  onOpenSettings: () => void;
}) {
  const theme = useActivityColors();

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.warning }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.caloriesLight }]}>
        <Ionicons name="warning-outline" size={40} color={theme.warning} />
      </View>

      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Permission Required
      </Text>

      <Text style={[styles.description, { color: theme.textSecondary }]}>
        {platformName} access was denied. Open Settings to enable activity tracking.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.warning, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Open Settings"
      >
        <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
        <Text style={styles.buttonText}>Open Settings</Text>
      </Pressable>
    </View>
  );
}

function HealthAppMissingCard({ platformName }: { platformName: string }) {
  const theme = useActivityColors();

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.error }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.caloriesLight }]}>
        <Ionicons name="download-outline" size={40} color={theme.error} />
      </View>

      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Install {Platform.OS === "android" ? "Health Connect" : platformName}
      </Text>

      <Text style={[styles.description, { color: theme.textSecondary }]}>
        {Platform.OS === "android"
          ? "Health Connect is required for activity tracking. Install it from the Google Play Store."
          : `${platformName} is not available on this device.`}
      </Text>

      {Platform.OS === "android" && (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.steps, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URI)}
          accessibilityRole="button"
          accessibilityLabel="Install Health Connect"
        >
          <Ionicons name="logo-google-playstore" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Install Health Connect</Text>
        </Pressable>
      )}
    </View>
  );
}

function UnavailableCard({ message }: { message: string }) {
  const theme = useActivityColors();

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.surfaceBg }]}>
        <Ionicons name="information-circle-outline" size={40} color={theme.textTertiary} />
      </View>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Not Available</Text>
      <Text style={[styles.description, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );
}

function Feature({
  icon,
  text,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  theme: ReturnType<typeof useActivityColors>;
}) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon} size={18} color={theme.steps} />
      <Text style={[styles.featureText, { color: theme.textPrimary }]}>{text}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  featureList: {
    alignSelf: "stretch",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  featureText: {
    fontSize: 14,
    fontWeight: "500",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    alignSelf: "stretch",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
