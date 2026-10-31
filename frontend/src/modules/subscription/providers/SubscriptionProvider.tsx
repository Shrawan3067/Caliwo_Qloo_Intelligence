/**
 * Subscription Context Provider (Fully Unlocked & Standalone)
 * Free Pro Access enabled for all users without third-party store dependencies.
 */

import React, { createContext, useContext, useState } from "react";
import { FeatureKey } from "../constants/subscription.constants";
import {
  CustomerSubscriptionInfo,
  OfferingsModel,
  PackageItem,
  PlanType,
  PurchaseErrorDetails,
  PurchaseState,
  SubscriptionContextValue,
} from "../types/subscription.types";

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

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPremium] = useState<boolean>(true);
  const [currentPlan] = useState<PlanType>("premium_yearly");
  const [expirationDate] = useState<string | null>(null);
  const [isLoading] = useState<boolean>(false);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<PurchaseErrorDetails | null>(null);
  const [offerings] = useState<OfferingsModel | null>(null);
  const [customerInfo] = useState<CustomerSubscriptionInfo | null>(defaultCustomerInfo);
  const [lastRefresh] = useState<string | null>(new Date().toISOString());

  const hasFeatureAccess = (_feature: FeatureKey): boolean => {
    return true; // All features fully unlocked
  };

  const purchasePackage = async (_pkg: PackageItem): Promise<boolean> => {
    return true;
  };

  const purchaseProduct = async (_productId: string): Promise<boolean> => {
    return true;
  };

  const restorePurchases = async (): Promise<CustomerSubscriptionInfo> => {
    return defaultCustomerInfo;
  };

  const syncPurchases = async (): Promise<void> => {
    return;
  };

  const getCustomerInfo = async (): Promise<CustomerSubscriptionInfo | null> => {
    return defaultCustomerInfo;
  };

  const login = async (_userId: string): Promise<void> => {
    return;
  };

  const logout = async (): Promise<void> => {
    return;
  };

  const clearError = () => {
    setError(null);
    setPurchaseState("idle");
  };

  const initialize = async (): Promise<void> => {
    return;
  };

  const getOfferings = async (): Promise<OfferingsModel | null> => {
    return null;
  };

  const value: SubscriptionContextValue = {
    isPremium,
    currentPlan,
    expirationDate,
    isLoading,
    purchaseState,
    error,
    offerings,
    customerInfo,
    lastRefresh,
    initialize,
    login,
    logout,
    restorePurchases,
    syncPurchases,
    purchasePackage,
    purchaseProduct,
    getOfferings,
    getCustomerInfo,
    hasFeatureAccess,
    clearError,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscriptionContext must be used within a SubscriptionProvider");
  }
  return context;
}
