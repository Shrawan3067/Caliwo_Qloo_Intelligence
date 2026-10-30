/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Enterprise RevenueCat Service Manager
 * Native In-App Purchase & Google Play Billing Integration with Fallback & Caching
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ENTITLEMENT_ID,
  REVENUECAT_CONFIG,
  SUBSCRIPTION_PRODUCTS,
  ASYNC_STORAGE_CACHE_KEY,
} from "../constants/subscription.constants";
import {
  CustomerSubscriptionInfo,
  OfferingsModel,
  PackageItem,
  PlanType,
} from "../types/subscription.types";
import { subscriptionLogger } from "./subscriptionLogger";

let Purchases: any = null;
try {
  Purchases = require("react-native-purchases").default;
} catch {
  Purchases = null;
}

class RevenueCatService {
  private isInitialized = false;
  private isNativeStoreAvailable = false;
  private currentUserId: string | null = null;
  private updateListeners: ((info: CustomerSubscriptionInfo) => void)[] = [];

  /**
   * Exponential backoff retry helper
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 1000
  ): Promise<T> {
    let delay = initialDelayMs;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        if (attempt === maxRetries) throw err;
        subscriptionLogger.warn("REVENUECAT_RETRY_ATTEMPT", {
          attempt,
          maxRetries,
          delayMs: delay,
          error: err?.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error("Max retries exceeded");
  }

  /**
   * Timeout wrapper helper
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error("RevenueCat request timed out")),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Initialize RevenueCat SDK with Public API Keys
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      subscriptionLogger.info("REVENUECAT_INITIALIZING", {
        platform: Platform.OS,
      });

      if (Purchases && Platform.OS !== "web") {
        const apiKey =
          Platform.OS === "ios"
            ? REVENUECAT_CONFIG.PUBLIC_IOS_KEY
            : REVENUECAT_CONFIG.PUBLIC_ANDROID_KEY;

        if (apiKey && !apiKey.includes("YOUR_")) {
          try {
            await Purchases.configure({ apiKey });
            this.isNativeStoreAvailable = true;

            // Enable debug logs in development
            if (__DEV__) {
              await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
            }

            // Attach native subscription update listener
            Purchases.addCustomerInfoUpdateListener((customerInfo: any) => {
              subscriptionLogger.info("REVENUECAT_NATIVE_UPDATE_LISTENER");
              const parsed = this.parseCustomerInfo(customerInfo);
              this.cacheCustomerInfo(parsed);
              this.notifyListeners(parsed);
            });
          } catch (initErr: any) {
            subscriptionLogger.warn("REVENUECAT_NATIVE_INIT_DISABLED_EXPO_GO", {
              error: initErr?.message,
            });
            this.isNativeStoreAvailable = false;
          }
        } else {
          this.isNativeStoreAvailable = false;
          subscriptionLogger.warn(
            "REVENUECAT_NATIVE_KEY_PLACEHOLDER_USING_FALLBACK"
          );
        }
      } else {
        this.isNativeStoreAvailable = false;
        subscriptionLogger.warn(
          "REVENUECAT_NATIVE_NOT_AVAILABLE_USING_FALLBACK"
        );
      }

      this.isInitialized = true;
      subscriptionLogger.info("REVENUECAT_INITIALIZED_SUCCESS");
    } catch (error: any) {
      subscriptionLogger.error("REVENUECAT_INIT_FAILED", error);
      this.isNativeStoreAvailable = false;
      this.isInitialized = true; // allow fallback operation
    }
  }

  /**
   * Log in user to RevenueCat
   */
  async login(userId: string): Promise<void> {
    if (!userId) return;
    this.currentUserId = userId;

    try {
      subscriptionLogger.info("REVENUECAT_LOGIN", { userId });

      if (this.isNativeStoreAvailable && Purchases && Platform.OS !== "web") {
        await this.withTimeout(Purchases.logIn(userId));
      }

      await this.getCustomerInfo();
    } catch (error: any) {
      subscriptionLogger.error("REVENUECAT_LOGIN_FAILED", error, { userId });
    }
  }

  /**
   * Log out user from RevenueCat & clear local subscription cache
   */
  async logout(): Promise<void> {
    this.currentUserId = null;
    try {
      subscriptionLogger.info("REVENUECAT_LOGOUT");
      if (this.isNativeStoreAvailable && Purchases && Platform.OS !== "web") {
        await Purchases.logOut();
      }
      await AsyncStorage.removeItem(ASYNC_STORAGE_CACHE_KEY);
    } catch (error: any) {
      subscriptionLogger.error("REVENUECAT_LOGOUT_FAILED", error);
    }
  }

  /**
   * Fetch current CustomerInfo from RevenueCat or cache
   */
  async getCustomerInfo(): Promise<CustomerSubscriptionInfo | null> {
    try {
      if (this.isNativeStoreAvailable && Purchases && Platform.OS !== "web") {
        const rawInfo = await this.retryWithBackoff(() =>
          this.withTimeout(Purchases.getCustomerInfo())
        );
        const parsed = this.parseCustomerInfo(rawInfo);
        await this.cacheCustomerInfo(parsed);
        return parsed;
      }
    } catch (error: any) {
      subscriptionLogger.warn("REVENUECAT_GET_CUSTOMER_INFO_FAILED_USING_CACHE", {
        error: error?.message,
      });
    }

    // Fallback to AsyncStorage cached info
    return await this.getCachedCustomerInfo();
  }

  /**
   * Fetch active Offerings from RevenueCat or fallback mock offerings
   */
  async getOfferings(): Promise<OfferingsModel | null> {
    try {
      if (this.isNativeStoreAvailable && Purchases && Platform.OS !== "web") {
        const rawOfferings = await this.retryWithBackoff(() =>
          this.withTimeout(Purchases.getOfferings())
        );
        return this.parseOfferings(rawOfferings);
      }
    } catch (error: any) {
      subscriptionLogger.warn(
        "REVENUECAT_GET_OFFERINGS_FAILED_USING_FALLBACK",
        { error: error?.message }
      );
    }

    // Return structured default offerings
    return this.getFallbackOfferings();
  }

  /**
   * Purchase a RevenueCat package
   */
  async purchasePackage(
    pack: PackageItem
  ): Promise<{ success: boolean; customerInfo?: CustomerSubscriptionInfo }> {
    subscriptionLogger.info("REVENUECAT_PURCHASE_STARTED", {
      identifier: pack.identifier,
      product: pack.product.identifier,
    });

    try {
      if (this.isNativeStoreAvailable && Purchases && Platform.OS !== "web" && pack.rawPackage) {
        const { customerInfo } = await Purchases.purchasePackage(
          pack.rawPackage
        );
        const parsed = this.parseCustomerInfo(customerInfo);
        await this.cacheCustomerInfo(parsed);
        this.notifyListeners(parsed);
        subscriptionLogger.info("REVENUECAT_PURCHASE_COMPLETED", {
          isPremium: parsed.isPremium,
        });
        return { success: true, customerInfo: parsed };
      }

      // Native SDK not available — cannot complete purchase
      subscriptionLogger.error("REVENUECAT_PURCHASE_NO_NATIVE_SDK", {
        platform: Platform.OS,
        identifier: pack.identifier,
      });
      throw {
        type: "STORE_UNAVAILABLE",
        message: "In-app purchases are not available in Expo Go or without a store build. Please build a native development build or production build.",
      };
    } catch (error: any) {
      if (error?.userCancelled) {
        subscriptionLogger.info("REVENUECAT_PURCHASE_CANCELLED_BY_USER");
        throw { type: "PURCHASE_CANCELLED", message: "Purchase was cancelled." };
      }
      subscriptionLogger.error("REVENUECAT_PURCHASE_FAILED", error);
      throw error;
    }
  }

  /**
   * Purchase a RevenueCat product by ID
   */
  async purchaseProduct(
    productId: string
  ): Promise<{ success: boolean; customerInfo?: CustomerSubscriptionInfo }> {
    const offerings = await this.getOfferings();
    const pkg = offerings?.current?.availablePackages.find(
      (p) => p.product.identifier === productId
    );

    if (pkg) {
      return await this.purchasePackage(pkg);
    }

    const dummyPack: PackageItem = {
      identifier: productId,
      packageType: productId.includes("yearly")
        ? "ANNUAL"
        : productId.includes("lifetime")
        ? "LIFETIME"
        : "MONTHLY",
      product: {
        identifier: productId,
        title: "Caliwo Pro",
        description: "Unlimited AI nutrition features",
        price: 9.99,
        priceString: "$9.99",
        currencyCode: "USD",
      },
      offeringIdentifier: "default",
    };

    return await this.purchasePackage(dummyPack);
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<CustomerSubscriptionInfo> {
    subscriptionLogger.info("REVENUECAT_RESTORE_PURCHASES_STARTED");
    try {
      if (this.isNativeStoreAvailable && Purchases && Platform.OS !== "web") {
        const rawInfo = await Purchases.restorePurchases();
        const parsed = this.parseCustomerInfo(rawInfo);
        await this.cacheCustomerInfo(parsed);
        this.notifyListeners(parsed);
        return parsed;
      }
    } catch (error: any) {
      subscriptionLogger.error("REVENUECAT_RESTORE_PURCHASES_FAILED", error);
    }

    const existing = await this.getCachedCustomerInfo();
    if (existing) return existing;

    const emptyState: CustomerSubscriptionInfo = {
      isPremium: false,
      activeEntitlements: [],
      currentPlan: "free",
      productId: null,
      expirationDate: null,
      willRenew: false,
      purchasePlatform: null,
      originalAppUserId: this.currentUserId,
      lastSynced: new Date().toISOString(),
    };
    return emptyState;
  }

  /**
   * Sync active purchases with backend / RevenueCat
   */
  async syncPurchases(): Promise<void> {
    subscriptionLogger.info("REVENUECAT_SYNC_PURCHASES");
    if (this.isNativeStoreAvailable && Purchases && Platform.OS !== "web") {
      try {
        await Purchases.syncPurchases();
      } catch (e: any) {
        subscriptionLogger.warn("REVENUECAT_SYNC_PURCHASES_FAILED", {
          error: e?.message,
        });
      }
    }
  }

  /**
   * Subscription change listener registration
   */
  listenForSubscriptionChanges(
    callback: (info: CustomerSubscriptionInfo) => void
  ): () => void {
    this.updateListeners.push(callback);
    return () => {
      this.updateListeners = this.updateListeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(info: CustomerSubscriptionInfo) {
    this.updateListeners.forEach((listener) => {
      try {
        listener(info);
      } catch {}
    });
  }

  /**
   * Cache CustomerInfo locally for offline support
   */
  private async cacheCustomerInfo(
    info: CustomerSubscriptionInfo
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ASYNC_STORAGE_CACHE_KEY,
        JSON.stringify(info)
      );
    } catch (e: any) {
      subscriptionLogger.warn("FAILED_TO_CACHE_SUBSCRIPTION_INFO", {
        error: e?.message,
      });
    }
  }

  private async getCachedCustomerInfo(): Promise<CustomerSubscriptionInfo | null> {
    try {
      const raw = await AsyncStorage.getItem(ASYNC_STORAGE_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  /**
   * Parse RevenueCat CustomerInfo into clean app subscription model
   */
  private parseCustomerInfo(rawInfo: any): CustomerSubscriptionInfo {
    const entitlements = rawInfo?.entitlements?.active || {};
    const premiumEntitlement = entitlements[ENTITLEMENT_ID];

    const isPremium = Boolean(premiumEntitlement);
    const activeEntitlements = Object.keys(entitlements);
    const productId = premiumEntitlement?.productIdentifier || null;

    let currentPlan: PlanType = "free";
    if (isPremium) {
      if (productId === SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY) {
        currentPlan = "premium_monthly";
      } else if (productId === SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY) {
        currentPlan = "premium_yearly";
      } else if (productId === SUBSCRIPTION_PRODUCTS.PREMIUM_LIFETIME) {
        currentPlan = "premium_lifetime";
      } else {
        currentPlan = "premium_monthly";
      }
    }

    const expirationDate = premiumEntitlement?.expirationDate || null;
    const willRenew = premiumEntitlement?.willRenew ?? true;

    return {
      isPremium,
      activeEntitlements,
      currentPlan,
      productId,
      expirationDate,
      willRenew,
      purchasePlatform: Platform.OS === "ios" ? "ios" : "android",
      originalAppUserId: rawInfo?.originalAppUserId || this.currentUserId,
      lastSynced: new Date().toISOString(),
      rawCustomerInfo: rawInfo,
    };
  }

  /**
   * Parse RevenueCat Offerings into clean app model
   */
  private parseOfferings(rawOfferings: any): OfferingsModel {
    const current = rawOfferings?.current;
    if (!current) return this.getFallbackOfferings();

    const packages: PackageItem[] = (current.availablePackages || []).map(
      (p: any) => ({
        identifier: p.identifier,
        packageType: p.packageType,
        product: {
          identifier: p.product.identifier,
          title: p.product.title,
          description: p.product.description,
          price: p.product.price,
          priceString: p.product.priceString,
          currencyCode: p.product.currencyCode,
          subscriptionPeriod: p.product.subscriptionPeriod,
        },
        offeringIdentifier: current.identifier,
        rawPackage: p,
      })
    );

    const monthly = packages.find(
      (p) =>
        p.product.identifier === SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY ||
        p.packageType === "MONTHLY"
    );
    const yearly = packages.find(
      (p) =>
        p.product.identifier === SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY ||
        p.packageType === "ANNUAL"
    );
    const lifetime = packages.find(
      (p) =>
        p.product.identifier === SUBSCRIPTION_PRODUCTS.PREMIUM_LIFETIME ||
        p.packageType === "LIFETIME"
    );

    return {
      current: {
        identifier: current.identifier,
        availablePackages: packages,
        monthly,
        yearly,
        lifetime,
      },
      all: rawOfferings.all || {},
    };
  }

  /**
   * Default fallback offerings when offline or native store unavailable
   */
  private getFallbackOfferings(): OfferingsModel {
    const monthlyPkg: PackageItem = {
      identifier: "$rc_monthly",
      packageType: "MONTHLY",
      product: {
        identifier: SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY,
        title: "Caliwo Pro Monthly",
        description: "Unlimited AI nutrition & meal plans",
        price: 9.99,
        priceString: "$9.99",
        currencyCode: "USD",
        subscriptionPeriod: "P1M",
      },
      offeringIdentifier: "default",
    };

    const yearlyPkg: PackageItem = {
      identifier: "$rc_annual",
      packageType: "ANNUAL",
      product: {
        identifier: SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY,
        title: "Caliwo Pro Yearly",
        description: "Unlimited AI nutrition — Save 70%",
        price: 35.0,
        priceString: "$35.00",
        currencyCode: "USD",
        subscriptionPeriod: "P1Y",
      },
      offeringIdentifier: "default",
    };

    const lifetimePkg: PackageItem = {
      identifier: "$rc_lifetime",
      packageType: "LIFETIME",
      product: {
        identifier: SUBSCRIPTION_PRODUCTS.PREMIUM_LIFETIME,
        title: "Caliwo Pro Lifetime",
        description: "Unlimited AI nutrition forever",
        price: 99.99,
        priceString: "$99.99",
        currencyCode: "USD",
      },
      offeringIdentifier: "default",
    };

    return {
      current: {
        identifier: "default",
        availablePackages: [monthlyPkg, yearlyPkg, lifetimePkg],
        monthly: monthlyPkg,
        yearly: yearlyPkg,
        lifetime: lifetimePkg,
      },
      all: {},
    };
  }
}

export const revenueCatService = new RevenueCatService();
