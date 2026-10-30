/**
 * Subscription Data Models & Type Definitions
 */

import { FeatureKey } from "../constants/subscription.constants";

export type PlanType = "free" | "premium_monthly" | "premium_yearly" | "premium_lifetime";

export type PurchaseState =
  | "idle"
  | "loading"
  | "purchasing"
  | "verifying"
  | "success"
  | "error"
  | "cancelled"
  | "restoring";

export type PurchaseErrorType =
  | "NETWORK_FAILURE"
  | "STORE_UNAVAILABLE"
  | "PURCHASE_CANCELLED"
  | "ALREADY_PURCHASED"
  | "BILLING_UNAVAILABLE"
  | "PENDING_PURCHASE"
  | "USER_NOT_AUTHENTICATED"
  | "REVENUECAT_UNAVAILABLE"
  | "UNKNOWN_ERROR";

export type PurchaseErrorDetails = {
  type: PurchaseErrorType;
  message: string;
  userFriendlyMessage: string;
  originalError?: any;
};

export type CustomerSubscriptionInfo = {
  isPremium: boolean;
  activeEntitlements: string[];
  currentPlan: PlanType;
  productId: string | null;
  expirationDate: string | null;
  willRenew: boolean;
  purchasePlatform: "ios" | "android" | "web" | "mock" | null;
  originalAppUserId: string | null;
  lastSynced: string;
  rawCustomerInfo?: any;
};

export type PackageItem = {
  identifier: string;
  packageType: "MONTHLY" | "ANNUAL" | "LIFETIME" | "CUSTOM" | string;
  product: {
    identifier: string;
    title: string;
    description: string;
    price: number;
    priceString: string;
    currencyCode: string;
    subscriptionPeriod?: string;
  };
  offeringIdentifier: string;
  rawPackage?: any;
};

export type OfferingsModel = {
  current: {
    identifier: string;
    availablePackages: PackageItem[];
    monthly?: PackageItem;
    yearly?: PackageItem;
    lifetime?: PackageItem;
  } | null;
  all: Record<string, any>;
};

export type SubscriptionContextValue = {
  isPremium: boolean;
  currentPlan: PlanType;
  expirationDate: string | null;
  isLoading: boolean;
  purchaseState: PurchaseState;
  error: PurchaseErrorDetails | null;
  offerings: OfferingsModel | null;
  customerInfo: CustomerSubscriptionInfo | null;
  lastRefresh: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  restorePurchases: () => Promise<CustomerSubscriptionInfo>;
  syncPurchases: () => Promise<void>;
  purchasePackage: (pack: PackageItem) => Promise<boolean>;
  purchaseProduct: (productId: string) => Promise<boolean>;
  getOfferings: () => Promise<OfferingsModel | null>;
  getCustomerInfo: () => Promise<CustomerSubscriptionInfo | null>;
  hasFeatureAccess: (feature: FeatureKey) => boolean;
  clearError: () => void;
};

export type RevenueCatWebhookEventPayload = {
  event: {
    type:
      | "INITIAL_PURCHASE"
      | "RENEWAL"
      | "EXPIRATION"
      | "CANCELLATION"
      | "UNCANCELLATION"
      | "PRODUCT_CHANGE"
      | "TRANSFER"
      | "REFUND"
      | "BILLING_ISSUE";
    id: string;
    app_user_id: string;
    original_app_user_id: string;
    product_id: string;
    entitlement_ids: string[];
    purchased_at_ms: number;
    expiration_at_ms?: number;
    environment: "SANDBOX" | "PRODUCTION";
    store: "PLAY_STORE" | "APP_STORE" | "STRIPE" | "MAC_APP_STORE";
    will_renew?: boolean;
    cancellation_reason?: string;
  };
  api_version: string;
};
