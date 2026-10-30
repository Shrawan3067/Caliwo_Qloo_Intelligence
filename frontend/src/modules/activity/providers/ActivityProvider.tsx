/**
 * Activity Provider
 *
 * React context wrapper that initializes the Activity Store, handles background sync,
 * and manages foreground activity lifecycle.
 */

import React, { useEffect } from "react";
import { useActivitySync } from "../hooks/useActivitySync";

interface ActivityProviderProps {
  children: React.ReactNode;
}

export function ActivityProvider({ children }: ActivityProviderProps) {
  // Hook handles auto-sync on mount, focus, and foreground resume
  const { onRefresh } = useActivitySync();

  useEffect(() => {
    // Initial silent sync on provider mount
    onRefresh().catch(() => {});
  }, [onRefresh]);

  return <>{children}</>;
}
