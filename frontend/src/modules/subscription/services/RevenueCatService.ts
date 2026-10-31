/**
 * Standalone Subscription Service
 * Native store dependencies removed for Expo Go & hackathon evaluation.
 */

import { CustomerSubscriptionInfo, OfferingsModel, PackageItem } from "../types/subscription.types";

const defaultCustomerInfo: CustomerSubscriptionInfo = {
  isPremium: true,
  activeEntitlements: ["pro", "premium"],
  currentPlan: "premium_yearly",
  productId: "caliwo_pro_unlocked",
  expirationDate: null,
  willRenew: true,
  purchasePlatform: "mock",
  originalAppUserId: "caliwo_user",
  lastSynced: new Date().toISOString(),
  rawCustomerInfo: {},
};

class RevenueCatService {
  async initialize(): Promise<void> {
    return;
  }

  async login(_userId: string): Promise<void> {
    return;
  }

  async logout(): Promise<void> {
    return;
  }

  async getCustomerInfo(): Promise<CustomerSubscriptionInfo> {
    return defaultCustomerInfo;
  }

  async getOfferings(): Promise<OfferingsModel | null> {
    return null;
  }

  async purchasePackage(_pkg: PackageItem): Promise<{ success: boolean; customerInfo?: CustomerSubscriptionInfo }> {
    return { success: true, customerInfo: defaultCustomerInfo };
  }

  async purchaseProduct(_productId: string): Promise<{ success: boolean; customerInfo?: CustomerSubscriptionInfo }> {
    return { success: true, customerInfo: defaultCustomerInfo };
  }

  async restorePurchases(): Promise<CustomerSubscriptionInfo> {
    return defaultCustomerInfo;
  }

  async syncPurchases(): Promise<void> {
    return;
  }

  listenForSubscriptionChanges(_callback: (info: CustomerSubscriptionInfo) => void): () => void {
    return () => {};
  }
}

export const revenueCatService = new RevenueCatService();
