/**
 * Custom hook exposing full subscription management capabilities
 */

import { useSubscriptionContext } from "../providers/SubscriptionProvider";
import { SubscriptionContextValue } from "../types/subscription.types";

export function useSubscription(): SubscriptionContextValue {
  return useSubscriptionContext();
}
