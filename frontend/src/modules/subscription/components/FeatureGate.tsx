/**
 * Granular Feature Gate Component
 * Protects specific feature access keys using RevenueCat Entitlement verification.
 */

import React from "react";
import { FeatureKey } from "../constants/subscription.constants";
import { usePremium } from "../hooks/usePremium";
import { PremiumGuard } from "./PremiumGuard";

type FeatureGateProps = {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  reason?: string;
};

export function FeatureGate({
  feature,
  children,
  fallback,
  reason = "This feature requires Caliwo Pro.",
}: FeatureGateProps) {
  const { hasFeatureAccess } = usePremium();

  if (hasFeatureAccess(feature)) {
    return <>{children}</>;
  }

  return (
    <PremiumGuard fallback={fallback} reason={reason}>
      {children}
    </PremiumGuard>
  );
}
