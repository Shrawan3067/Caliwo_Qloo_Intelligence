/**
 * useActivityPermission Hook
 *
 * Manages health data permission flow with platform-aware UI hints.
 *
 * @module activity/hooks/useActivityPermission
 */

import { useCallback } from "react";
import { Linking, Platform } from "react-native";
import { useActivityStore } from "../store/activity.store";
import { PlatformService } from "../services";

/**
 * Hook that manages health data permissions.
 *
 * Returns permission status, request callback, and platform hints
 * for guiding the user through the permission flow.
 */
export function useActivityPermission() {
  const permissionStatus = useActivityStore((s) => s.permissionStatus);
  const platformName = useActivityStore((s) => s.platformName);
  const requestPermissions = useActivityStore((s) => s.requestPermissions);
  const checkPermissions = useActivityStore((s) => s.checkPermissions);

  const isGranted = permissionStatus === "granted";
  const isDenied = permissionStatus === "denied";
  const isUnavailable = permissionStatus === "unavailable" || permissionStatus === "unsupported_device";
  const isHealthAppMissing = permissionStatus === "health_app_missing";
  const isSimulator = permissionStatus === "simulator";
  const needsSetup = !isGranted && !isUnavailable && !isSimulator;

  const openSettings = useCallback(async () => {
    if (Platform.OS === "ios") {
      await Linking.openURL("app-settings:");
    } else if (Platform.OS === "android") {
      const available = await PlatformService.isHealthServiceAvailable();
      if (available) {
        // Use the HealthConnect service to open settings
        const { HealthConnectService } = await import("../services");
        HealthConnectService.openSettings();
      } else {
        Linking.openSettings();
      }
    }
  }, []);

  const getPermissionMessage = useCallback((): string => {
    switch (permissionStatus) {
      case "granted":
        return `Connected to ${platformName}`;
      case "denied":
        return `${platformName} access denied. Open Settings to enable.`;
      case "health_app_missing":
        return Platform.OS === "android"
          ? "Health Connect app is not installed. Install it from the Play Store."
          : `${platformName} is not available on this device.`;
      case "simulator":
        return "Health data is not available in the simulator.";
      case "unavailable":
      case "unsupported_device":
        return `${platformName} is not available on this device.`;
      default:
        return `Grant access to ${platformName} to track your activity.`;
    }
  }, [permissionStatus, platformName]);

  return {
    permissionStatus,
    platformName,
    isGranted,
    isDenied,
    isUnavailable,
    isHealthAppMissing,
    isSimulator,
    needsSetup,
    requestPermissions,
    checkPermissions,
    openSettings,
    getPermissionMessage,
  };
}
