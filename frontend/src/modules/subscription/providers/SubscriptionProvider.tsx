/**
 * Subscription Context Provider
 * Manages active entitlement state, RevenueCat CustomerInfo, and purchase operations across Caliwo.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { ENTITLEMENT_ID, FeatureKey } from "../constants/subscription.constants";

import {
  CustomerSubscriptionInfo,
  OfferingsModel,
  PackageItem,
  PlanType,
  PurchaseErrorDetails,
  PurchaseState,
  SubscriptionContextValue,
} from "../types/subscription.types";
import { revenueCatService } from "../services/RevenueCatService";
import { subscriptionLogger } from "../services/subscriptionLogger";
import { subscriptionAnalytics } from "../services/subscriptionAnalytics";

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<PlanType>("free");
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [error, setError] = useState<PurchaseErrorDetails | null>(null);
  const [offerings, setOfferings] = useState<OfferingsModel | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerSubscriptionInfo | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  /**
   * Sync customerInfo to React Context State
   */
  const updateSubscriptionState = useCallback((info: CustomerSubscriptionInfo | null) => {
    if (!info) {
      setIsPremium(false);
      setCurrentPlan("free");
      setExpirationDate(null);
      setCustomerInfo(null);
      return;
    }

    setIsPremium(info.isPremium);
    setCurrentPlan(info.currentPlan);
    setExpirationDate(info.expirationDate);
    setCustomerInfo(info);
    setLastRefresh(new Date().toISOString());

    subscriptionLogger.info("SUBSCRIPTION_STATE_UPDATED", {
      isPremium: info.isPremium,
      plan: info.currentPlan,
      expirationDate: info.expirationDate,
    });
  }, []);

  /**
   * Initialize RevenueCat and load initial CustomerInfo & Offerings
   */
  const initialize = useCallback(async () => {
    setIsLoading(true);
    try {
      await revenueCatService.initialize();
      const [info, fetchedOfferings] = await Promise.all([
        revenueCatService.getCustomerInfo(),
        revenueCatService.getOfferings(),
      ]);

      updateSubscriptionState(info);
      setOfferings(fetchedOfferings);
    } catch (err: any) {
      subscriptionLogger.error("SUBSCRIPTION_PROVIDER_INIT_ERROR", err);
    } finally {
      setIsLoading(false);
    }
  }, [updateSubscriptionState]);

  /**
   * React effect to track User Authentication changes
   */
  useEffect(() => {
    (async () => {
      await initialize();
      if (user?.user_id) {
        const uid = user.user_id;
        await revenueCatService.login(uid);
        const info = await revenueCatService.getCustomerInfo();
        updateSubscriptionState(info);
      } else {
        await revenueCatService.logout();
        updateSubscriptionState(null);
      }
    })();
  }, [user, initialize, updateSubscriptionState]);

  /**
   * Listen to RevenueCat subscription update broadcasts
   */
  useEffect(() => {
    const unsubscribe = revenueCatService.listenForSubscriptionChanges((info) => {
      updateSubscriptionState(info);
    });
    return () => unsubscribe();
  }, [updateSubscriptionState]);

  /**
   * Login user to RevenueCat
   */
  const login = async (userId: string) => {
    setIsLoading(true);
    try {
      await revenueCatService.login(userId);
      const info = await revenueCatService.getCustomerInfo();
      updateSubscriptionState(info);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user from RevenueCat
   */
  const logout = async () => {
    setIsLoading(true);
    try {
      await revenueCatService.logout();
      updateSubscriptionState(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Restore previous purchases
   */
  const restorePurchases = async (): Promise<CustomerSubscriptionInfo> => {
    setPurchaseState("restoring");
    setError(null);
    subscriptionAnalytics.trackRestoreClicked();
    try {
      const info = await revenueCatService.restorePurchases();
      updateSubscriptionState(info);
      setPurchaseState("idle");
      subscriptionAnalytics.trackRestoreSuccess(info.isPremium, info.activeEntitlements);
      return info;
    } catch (err: any) {
      setPurchaseState("error");
      const errDetails: PurchaseErrorDetails = {
        type: "UNKNOWN_ERROR",
        message: err?.message || "Could not restore purchases.",
        userFriendlyMessage: "Unable to restore previous purchases. Please try again.",
        originalError: err,
      };
      setError(errDetails);
      throw errDetails;
    }
  };

  /**
   * Sync purchases with RevenueCat & Backend
   */
  const syncPurchases = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await revenueCatService.syncPurchases();
      const info = await revenueCatService.getCustomerInfo();
      updateSubscriptionState(info);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Purchase a package
   */
  const purchasePackage = async (pack: PackageItem): Promise<boolean> => {
    setPurchaseState("purchasing");
    setError(null);

    subscriptionAnalytics.trackPurchaseClicked(
      pack.product.identifier,
      pack.packageType,
      pack.product.price
    );

    try {
      const res = await revenueCatService.purchasePackage(pack);
      if (res.success && res.customerInfo) {
        updateSubscriptionState(res.customerInfo);
        setPurchaseState("success");
        subscriptionAnalytics.trackPurchaseSuccess(
          pack.product.identifier,
          res.customerInfo.currentPlan,
          pack.product.price
        );
        return true;
      }
      setPurchaseState("idle");
      return false;
    } catch (err: any) {
      if (err?.type === "PURCHASE_CANCELLED") {
        setPurchaseState("cancelled");
        subscriptionAnalytics.trackPurchaseFailed(pack.product.identifier, "cancelled_by_user");
        return false;
      }

      setPurchaseState("error");
      const errDetails: PurchaseErrorDetails = {
        type: "STORE_UNAVAILABLE",
        message: err?.message || "Purchase failed",
        userFriendlyMessage: "The purchase could not be completed. Please check your payment details or try again later.",
        originalError: err,
      };
      setError(errDetails);
      subscriptionAnalytics.trackPurchaseFailed(
        pack.product.identifier,
        errDetails.userFriendlyMessage
      );
      return false;
    }
  };

  /**
   * Purchase product by ID
   */
  const purchaseProduct = async (productId: string): Promise<boolean> => {
    const fetchedOfferings = await revenueCatService.getOfferings();
    const pkg = fetchedOfferings?.current?.availablePackages.find(
      (p) => p.product.identifier === productId
    );

    if (pkg) {
      return await purchasePackage(pkg);
    }

    return await revenueCatService.purchaseProduct(productId).then((res) => {
      if (res.customerInfo) updateSubscriptionState(res.customerInfo);
      return res.success;
    });
  };

  /**
   * Get Offerings
   */
  const getOfferings = async (): Promise<OfferingsModel | null> => {
    const fetched = await revenueCatService.getOfferings();
    setOfferings(fetched);
    return fetched;
  };

  /**
   * Get CustomerInfo
   */
  const getCustomerInfo = async (): Promise<CustomerSubscriptionInfo | null> => {
    const info = await revenueCatService.getCustomerInfo();
    updateSubscriptionState(info);
    return info;
  };

  /**
   * Check feature access (Entitlement check - NEVER hardcodes plan names)
   */
  const hasFeatureAccess = (feature: FeatureKey): boolean => {
    if (!isPremium) return false;
    if (customerInfo?.activeEntitlements.includes(ENTITLEMENT_ID)) return true;
    return isPremium;
  };

  const clearError = () => setError(null);

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
