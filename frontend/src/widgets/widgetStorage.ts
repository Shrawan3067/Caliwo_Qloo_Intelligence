import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import { TodaySummary, DEFAULT_TODAY_SUMMARY, LOGGED_OUT_SUMMARY } from "./widgetTypes";

const WIDGET_CACHE_KEY = "@caliwo_widget_today_summary";

// NOTE: NutrivaWidgetModule is the React Native native bridge name.
// The native Swift WidgetKit extension exists (ios/Widgets/NutrivaWidgets.swift)
// but the RN bridge module is not yet implemented. All access is guarded with ?.
const { NutrivaWidgetModule } = NativeModules;

export class WidgetStorage {
  /**
   * Save TodaySummary to local AsyncStorage and shared platform storage (AppGroups / SharedPrefs).
   */
  static async saveSummary(summary: TodaySummary): Promise<void> {
    try {
      const jsonStr = JSON.stringify(summary);
      await AsyncStorage.setItem(WIDGET_CACHE_KEY, jsonStr);

      // Write to shared platform storage if native module is linked
      if (NutrivaWidgetModule?.setSharedData) {
        NutrivaWidgetModule.setSharedData(jsonStr);
      }
    } catch (error) {
      console.warn("[WidgetStorage] Error saving summary:", error);
    }
  }

  /**
   * Read TodaySummary from local storage with cache recovery and midnight date rollover check.
   */
  static async getSummary(): Promise<TodaySummary> {
    try {
      const raw = await AsyncStorage.getItem(WIDGET_CACHE_KEY);
      if (!raw) {
        return DEFAULT_TODAY_SUMMARY;
      }

      let parsed: TodaySummary;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Corrupted cache recovery
        console.warn("[WidgetStorage] Corrupted cache detected, resetting to default");
        await this.saveSummary(DEFAULT_TODAY_SUMMARY);
        return DEFAULT_TODAY_SUMMARY;
      }

      // Check for midnight rollover (compare local YYYY-MM-DD)
      const nowStr = new Date().toISOString().split("T")[0];
      const lastUpdatedDate = parsed.lastUpdated
        ? new Date(parsed.lastUpdated).toISOString().split("T")[0]
        : "";

      if (lastUpdatedDate && lastUpdatedDate !== nowStr) {
        // New day started -> reset intake values while retaining user goals
        const rolloverSummary: TodaySummary = {
          ...parsed,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          water: 0,
          waterMl: 0,
          lastUpdated: new Date().toISOString(),
        };
        await this.saveSummary(rolloverSummary);
        return rolloverSummary;
      }

      return parsed;
    } catch (error) {
      console.warn("[WidgetStorage] Error reading summary:", error);
      return DEFAULT_TODAY_SUMMARY;
    }
  }

  /**
   * Clears summary data or sets logged out state.
   */
  static async clearSummary(): Promise<void> {
    try {
      await this.saveSummary(LOGGED_OUT_SUMMARY);
    } catch (error) {
      console.warn("[WidgetStorage] Error clearing summary:", error);
    }
  }
}
