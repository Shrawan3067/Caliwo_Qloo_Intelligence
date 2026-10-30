import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { useSubscriptionContext } from "../providers/SubscriptionProvider";
import { PackageItem } from "../types/subscription.types";
import { subscriptionAnalytics } from "../services/subscriptionAnalytics";
import { locationService, CountryRegion } from "@/src/services/locationService";
import api from "@/src/lib/api";

export type PlanDetail = {
  product_id: string;
  price: number;
  currency: string;
  currency_symbol: string;
  period: string;
  price_formatted: string;
  monthly_equivalent: string;
  save_percent?: number;
  title: string;
  description: string;
};

export type PricingResponse = {
  country_code: CountryRegion;
  country_name: string;
  trial_days: number;
  has_used_trial: boolean;
  is_trial_eligible: boolean;
  plans: {
    monthly: PlanDetail;
    yearly: PlanDetail;
  };
};

export function usePaywall() {
  const router = useRouter();
  const {
    isPremium,
    offerings,
    purchaseState,
    error,
    purchasePackage,
    restorePurchases,
    syncPurchases,
    clearError,
  } = useSubscriptionContext();

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly" | "lifetime">("yearly");
  const [countryRegion, setCountryRegion] = useState<CountryRegion>("ROW");
  const [pricingData, setPricingData] = useState<PricingResponse | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);

  const fetchPricing = useCallback(async () => {
    setLoadingPricing(true);
    try {
      const detected = await locationService.detectCountryRegion();
      setCountryRegion(detected);
      const res = await api.get<PricingResponse>(`/subscription/pricing?country_code=${detected}`);
      setPricingData(res.data);
    } catch {
      // Fallback pricing
      setPricingData({
        country_code: "ROW",
        country_name: "Global",
        trial_days: 3,
        has_used_trial: false,
        is_trial_eligible: true,
        plans: {
          monthly: {
            product_id: "com.caliwo.ainutritioncoach.pro_monthly",
            price: 9.99,
            currency: "USD",
            currency_symbol: "$",
            period: "monthly",
            price_formatted: "$9.99 / mo",
            monthly_equivalent: "$9.99 / mo",
            title: "Monthly Pro",
            description: "Unlimited AI meal scans, recipes, and coach access",
          },
          yearly: {
            product_id: "com.caliwo.ainutritioncoach.pro_yearly",
            price: 29.99,
            currency: "USD",
            currency_symbol: "$",
            period: "yearly",
            price_formatted: "$29.99 / yr",
            monthly_equivalent: "$2.50 / mo",
            save_percent: 75,
            title: "Yearly Pro",
            description: "Billed annually at $29.99 (Just $2.50/mo)",
          },
        },
      });
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const openPaywall = (reason?: string, source: any = "home_upgrade") => {
    subscriptionAnalytics.trackPaywallViewed(source, isPremium ? "premium" : "free");
    router.push({
      pathname: "/paywall",
      params: reason ? { reason } : undefined,
    });
  };

  const startFreeTrial = async (): Promise<boolean> => {
    setStartingTrial(true);
    try {
      const res = await api.post<{
        ok: boolean;
        trial_days: number;
        message: string;
      }>("/subscription/trial/start");

      if (res.data.ok) {
        if (typeof syncPurchases === "function") {
          await syncPurchases();
        }
        return true;
      }
      return false;
    } catch (e: any) {
      Alert.alert(
        "Free Trial Unavailable",
        e?.response?.data?.detail || "Could not start free trial at this time."
      );
      return false;
    } finally {
      setStartingTrial(false);
    }
  };

  const executePurchase = async (pkgOverride?: PackageItem): Promise<boolean> => {
    let targetPkg: PackageItem | undefined = pkgOverride;

    if (!targetPkg && offerings?.current) {
      if (selectedPlan === "yearly") {
        targetPkg = offerings.current.yearly;
      } else if (selectedPlan === "lifetime") {
        targetPkg = offerings.current.lifetime;
      } else {
        targetPkg = offerings.current.monthly;
      }
    }

    if (!targetPkg && offerings?.current?.availablePackages?.length) {
      targetPkg = offerings.current.availablePackages[0];
    }

    if (!targetPkg) {
      // Fallback mock purchase trigger if no native package available
      const planKey = selectedPlan === "lifetime" ? "yearly" : selectedPlan;
      const currentPlanDetail = pricingData?.plans[planKey];
      const dummyPack: PackageItem = {
        identifier: currentPlanDetail?.product_id || "com.caliwo.ainutritioncoach.pro_yearly",
        packageType: selectedPlan === "yearly" ? "ANNUAL" : selectedPlan === "lifetime" ? "LIFETIME" : "MONTHLY",
        product: {
          identifier: currentPlanDetail?.product_id || "com.caliwo.ainutritioncoach.pro_yearly",
          title: currentPlanDetail?.title || "Caliwo Pro",
          description: currentPlanDetail?.description || "Unlimited AI nutrition",
          price: currentPlanDetail?.price || 29.99,
          priceString: currentPlanDetail?.price_formatted || "$29.99",
          currencyCode: currentPlanDetail?.currency || "USD",
        },
        offeringIdentifier: "default",
      };
      return await purchasePackage(dummyPack);
    }

    return await purchasePackage(targetPkg);
  };

  return {
    isPremium,
    offerings: offerings?.current,
    availablePackages: offerings?.current?.availablePackages || [],
    monthlyPackage: offerings?.current?.monthly,
    yearlyPackage: offerings?.current?.yearly,
    lifetimePackage: offerings?.current?.lifetime,
    selectedPlan,
    setSelectedPlan,
    purchaseState,
    error,
    countryRegion,
    pricingData,
    loadingPricing,
    startingTrial,
    isTrialEligible: pricingData?.is_trial_eligible ?? true,
    openPaywall,
    startFreeTrial,
    executePurchase,
    restorePurchases,
    clearError,
  };
}
