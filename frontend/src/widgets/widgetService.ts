import api from "@/src/lib/api";
import { TodaySummary } from "./widgetTypes";
import { WidgetStorage } from "./widgetStorage";
import { WidgetSync } from "./widgetSync";
import { WidgetRefresh } from "./widgetRefresh";

const CACHE_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export class WidgetService {
  /**
   * Reads cached summary. If cache is older than 5 minutes, fetches latest from backend.
   */
  static async getSummary(forceFetch = false): Promise<TodaySummary> {
    try {
      const cached = await WidgetStorage.getSummary();

      if (!forceFetch && cached.lastUpdated) {
        const age = Date.now() - new Date(cached.lastUpdated).getTime();
        if (age < CACHE_STALE_THRESHOLD_MS) {
          return cached;
        }
      }

      // Cache is stale (> 5 min) or force fetch requested -> fetch latest summary
      return await this.fetchAndSyncLatest();
    } catch (error) {
      console.warn("[WidgetService] getSummary error:", error);
      return await WidgetStorage.getSummary();
    }
  }

  /**
   * Fetches latest nutrition summary from backend and updates widget cache & UI.
   */
  static async fetchAndSyncLatest(): Promise<TodaySummary> {
    try {
      const tz_offset = new Date().getTimezoneOffset();
      const todayDate = new Date().toISOString().split("T")[0];

      const res = await api.get("/nutrition/today", {
        params: { date: todayDate, tz_offset },
      });

      if (res.data) {
        return await WidgetSync.syncSummaryData(res.data);
      }
    } catch (error) {
      console.warn("[WidgetService] Failed to fetch latest summary from backend, using cache.", error);
    }
    return await WidgetStorage.getSummary();
  }

  /**
   * Log water quick-action: updates local widget instantly, calls backend asynchronously.
   */
  static async logWater(ml: number): Promise<TodaySummary> {
    // 1. Instant local update & native widget reload
    const updated = await WidgetSync.syncWaterDelta(ml);

    // 2. Sync to backend asynchronously (never blocks widget update)
    (async () => {
      try {
        const tz_offset = new Date().getTimezoneOffset();
        const todayDate = new Date().toISOString().split("T")[0];
        await api.post("/water/log", { ml, date: todayDate, tz_offset });
      } catch (error) {
        console.warn("[WidgetService] Async water log to backend failed:", error);
      }
    })();

    return updated;
  }

  /**
   * Reset water quick-action: resets local widget instantly, calls backend asynchronously.
   */
  static async resetWater(): Promise<TodaySummary> {
    // 1. Instant local update & native widget reload
    const updated = await WidgetSync.syncWaterDelta("reset");

    // 2. Sync to backend asynchronously
    (async () => {
      try {
        const tz_offset = new Date().getTimezoneOffset();
        const todayDate = new Date().toISOString().split("T")[0];
        // Reset water by sending negative current water or backend reset
        await api.post("/water/log", { ml: -updated.waterMl, date: todayDate, tz_offset });
      } catch (error) {
        console.warn("[WidgetService] Async water reset to backend failed:", error);
      }
    })();

    return updated;
  }

  /**
   * Manually force refresh widgets.
   */
  static async forceRefresh(): Promise<TodaySummary> {
    const summary = await this.fetchAndSyncLatest();
    WidgetRefresh.forceRefreshNativeWidgets();
    return summary;
  }
}
