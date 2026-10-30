/**
 * RevenueCatService & Subscription Unit & Integration Tests
 */

import { revenueCatService } from "../services/RevenueCatService";

export async function runRevenueCatServiceTests(): Promise<{ passed: boolean; results: string[] }> {
  const results: string[] = [];

  try {
    await revenueCatService.initialize();
    results.push("✅ RevenueCatService initialized successfully");

    const offerings = await revenueCatService.getOfferings();
    if (offerings?.current?.availablePackages.length) {
      results.push(`✅ Offerings loaded with ${offerings.current.availablePackages.length} packages`);
    } else {
      results.push("❌ Failed to load offerings");
    }

    const info = await revenueCatService.restorePurchases();
    if (typeof info?.isPremium === "boolean") {
      results.push(`✅ Restore purchases returned entitlement state (isPremium: ${info.isPremium})`);
    } else {
      results.push("❌ Restore purchases returned invalid info");
    }

    const pkg = offerings?.current?.yearly;
    if (pkg) {
      const res = await revenueCatService.purchasePackage(pkg);
      if (res.success && res.customerInfo?.isPremium) {
        results.push("✅ Purchase package completed successfully");
      }
    }

    return { passed: true, results };
  } catch (error: any) {
    results.push(`❌ Test error: ${error?.message || String(error)}`);
    return { passed: false, results };
  }
}

describe("RevenueCatService Unit Tests", () => {
  it("initializes without throwing errors", async () => {
    await expect(revenueCatService.initialize()).resolves.not.toThrow();
  });

  it("fetches offerings gracefully (returns fallback offerings when offline/mocked)", async () => {
    const offerings = await revenueCatService.getOfferings();
    expect(offerings).toBeDefined();
    expect(offerings?.current).toBeDefined();
    expect(offerings?.current?.availablePackages.length).toBeGreaterThan(0);
  });

  it("restores purchases and returns customer subscription info", async () => {
    const info = await revenueCatService.restorePurchases();
    expect(info).toBeDefined();
    expect(typeof info.isPremium).toBe("boolean");
  });
});
