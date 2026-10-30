/**
 * useActivitySync Hook
 *
 * Manages sync lifecycle: auto-sync on mount, pull-to-refresh,
 * and foreground resume detection.
 *
 * @module activity/hooks/useActivitySync
 */

import { useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useActivityStore } from "../store/activity.store";

/**
 * Hook that manages activity data synchronization.
 *
 * - Initializes the store on first mount
 * - Syncs today's data on foreground resume
 * - Provides manual refresh callback
 * - Tracks sync state for UI feedback
 */
export function useActivitySync() {
  const initialize = useActivityStore((s) => s.initialize);
  const syncToday = useActivityStore((s) => s.syncToday);
  const syncManual = useActivityStore((s) => s.syncManual);
  const cancelSync = useActivityStore((s) => s.cancelSync);
  const isSyncing = useActivityStore((s) => s.isSyncing);
  const isInitialized = useActivityStore((s) => s.isInitialized);
  const lastSyncTime = useActivityStore((s) => s.lastSyncTime);
  const error = useActivityStore((s) => s.error);
  const appStateRef = useRef(AppState.currentState);

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Sync on foreground resume
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        syncToday();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [syncToday]);

  // Manual refresh handler (for pull-to-refresh)
  const onRefresh = useCallback(async () => {
    await syncManual();
  }, [syncManual]);

  return {
    isSyncing,
    isInitialized,
    lastSyncTime,
    error,
    onRefresh,
    cancelSync,
  };
}
