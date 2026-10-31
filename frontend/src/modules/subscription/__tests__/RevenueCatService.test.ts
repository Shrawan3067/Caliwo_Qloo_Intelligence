/**
 * Subscription Service Unit & Integration Tests (Standalone Unlocked)
 */

import { revenueCatService } from "../services/RevenueCatService";

export async function runRevenueCatServiceTests(): Promise<{ passed: boolean; results: string[] }> {
  const results: string[] = [];

  try {
    await revenueCatService.initialize();
    results.push("✅ SubscriptionService initialized successfully");

    const info = await revenueCatService.restorePurchases();
    if (typeof info?.isPremium === "boolean") {
      results.push(`✅ Restore purchases returned entitlement state (isPremium: ${info.isPremium})`);
    }

    return { passed: true, results };
  } catch (error: any) {
    results.push(`❌ Test error: ${error?.message || String(error)}`);
    return { passed: false, results };
  }
}

describe("SubscriptionService Unit Tests", () => {
  it("initializes without throwing errors", async () => {
    await expect(revenueCatService.initialize()).resolves.not.toThrow();
  });

  it("restores purchases and returns customer subscription info", async () => {
    const info = await revenueCatService.restorePurchases();
    expect(info).toBeDefined();
    expect(info.isPremium).toBe(true);
  });
});
