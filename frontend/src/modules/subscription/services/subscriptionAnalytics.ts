/**
 * Subscription Analytics Event Tracking
 */

import { subscriptionLogger } from "./subscriptionLogger";

type PaywallViewSource = "home_upgrade" | "profile_upgrade" | "feature_gate" | "scan_limit" | "coach_limit";

class SubscriptionAnalytics {
  trackPaywallViewed(source: PaywallViewSource, currentPlan: string): void {
    subscriptionLogger.info("ANALYTICS_PAYWALL_VIEWED", { source, currentPlan });
  }

  trackPurchaseClicked(productId: string, packageType: string, price: number): void {
    subscriptionLogger.info("ANALYTICS_PURCHASE_CLICKED", { productId, packageType, price });
  }

  trackPurchaseSuccess(productId: string, plan: string, price?: number): void {
    subscriptionLogger.info("ANALYTICS_PURCHASE_SUCCESS", { productId, plan, price });
  }

  trackPurchaseFailed(productId: string, errorReason: string): void {
    subscriptionLogger.warn("ANALYTICS_PURCHASE_FAILED", { productId, errorReason });
  }

  trackRestoreClicked(): void {
    subscriptionLogger.info("ANALYTICS_RESTORE_CLICKED");
  }

  trackRestoreSuccess(unlocked: boolean, activeEntitlements: string[]): void {
    subscriptionLogger.info("ANALYTICS_RESTORE_SUCCESS", { unlocked, activeEntitlements });
  }

  trackSubscriptionRenewed(productId: string, expirationDate: string): void {
    subscriptionLogger.info("ANALYTICS_SUBSCRIPTION_RENEWED", { productId, expirationDate });
  }

  trackSubscriptionExpired(productId: string): void {
    subscriptionLogger.info("ANALYTICS_SUBSCRIPTION_EXPIRED", { productId });
  }
}

export const subscriptionAnalytics = new SubscriptionAnalytics();
