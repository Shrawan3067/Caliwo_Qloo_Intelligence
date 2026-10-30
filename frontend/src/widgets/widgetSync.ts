import { TodaySummary, DEFAULT_TODAY_SUMMARY } from "./widgetTypes";
import { WidgetStorage } from "./widgetStorage";
import { WidgetRefresh } from "./widgetRefresh";

export class WidgetSync {
  /**
   * Syncs raw nutrition summary object (from /nutrition/today API or React Query cache) to widgets.
   */
  static async syncSummaryData(apiSummaryData: any): Promise<TodaySummary> {
    try {
      if (!apiSummaryData) {
        const cached = await WidgetStorage.getSummary();
        return cached;
      }

      const totals = apiSummaryData.totals || {};
      const goals = apiSummaryData.goals || {};

      const calories = Math.round(totals.calories || 0);
      const calorieGoal = Math.round(goals.calories || 2200);

      const protein = Math.round(totals.protein_g || 0);
      const proteinGoal = Math.round(goals.protein_g || 140);

      const carbs = Math.round(totals.carbs_g || 0);
      const carbsGoal = Math.round(goals.carbs_g || 220);

      const fat = Math.round(totals.fat_g || 0);
      const fatGoal = Math.round(goals.fat_g || 65);

      const fiber = Math.round(totals.fiber_g || 0);
      const fiberGoal = Math.round(goals.fiber_g || 28);

      const sugar = Math.round(totals.sugar_g || 0);
      const sugarGoal = Math.round(goals.sugar_g || 30);

      const sodium = Math.round(totals.sodium_mg || 0);
      const sodiumGoal = Math.round(goals.sodium_mg || 2000);

      const waterMl = Math.round(apiSummaryData.water_ml || 0);
      const waterGoalMl = Math.round(apiSummaryData.water_goal_ml || 2500);

      const water = Number((waterMl / 1000).toFixed(1));
      const waterGoal = Number((waterGoalMl / 1000).toFixed(1));

      const summary: TodaySummary = {
        calories,
        calorieGoal,
        protein,
        proteinGoal,
        carbs,
        carbsGoal,
        fat,
        fatGoal,
        fiber,
        fiberGoal,
        sugar,
        sugarGoal,
        sodium,
        sodiumGoal,
        water,
        waterGoal,
        waterMl,
        waterGoalMl,
        lastUpdated: new Date().toISOString(),
        isLoggedOut: false,
      };

      await WidgetStorage.saveSummary(summary);
      WidgetRefresh.forceRefreshNativeWidgets();
      return summary;
    } catch (error) {
      console.warn("[WidgetSync] Error syncing summary data:", error);
      return DEFAULT_TODAY_SUMMARY;
    }
  }

  /**
   * Instantly updates water intake locally for quick actions (+250ml, +500ml, Reset)
   * and triggers immediate widget refresh.
   */
  static async syncWaterDelta(deltaMl: number | "reset"): Promise<TodaySummary> {
    try {
      const current = await WidgetStorage.getSummary();
      let newWaterMl = 0;

      if (deltaMl === "reset") {
        newWaterMl = 0;
      } else {
        newWaterMl = Math.max(0, current.waterMl + deltaMl);
      }

      const newWater = Number((newWaterMl / 1000).toFixed(1));

      const updated: TodaySummary = {
        ...current,
        waterMl: newWaterMl,
        water: newWater,
        lastUpdated: new Date().toISOString(),
      };

      await WidgetStorage.saveSummary(updated);
      WidgetRefresh.forceRefreshNativeWidgets();
      return updated;
    } catch (error) {
      console.warn("[WidgetSync] Error syncing water delta:", error);
      return DEFAULT_TODAY_SUMMARY;
    }
  }

  /**
   * Clears widget state on user logout.
   */
  static async handleUserLogout(): Promise<void> {
    await WidgetStorage.clearSummary();
    WidgetRefresh.forceRefreshNativeWidgets();
  }
}
