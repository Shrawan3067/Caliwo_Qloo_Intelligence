/**
 * Lightweight hook returning active premium entitlement status & feature access checker
 */

import { useSubscriptionContext } from "../providers/SubscriptionProvider";
import { FeatureKey } from "../constants/subscription.constants";

export function usePremium() {
  const { isPremium, isLoading, currentPlan, expirationDate, hasFeatureAccess } =
    useSubscriptionContext();

  return {
    isPremium,
    isLoading,
    currentPlan,
    expirationDate,
    hasFeatureAccess: (feature: FeatureKey) => hasFeatureAccess(feature),
  };
}
