import { NativeModules } from "react-native";

const { NutrivaWidgetModule } = NativeModules;

export class WidgetRefresh {
  /**
   * Triggers native widget refresh on iOS and Android.
   */
  static forceRefreshNativeWidgets(): void {
    try {
      if (NutrivaWidgetModule?.reloadWidgets) {
        NutrivaWidgetModule.reloadWidgets();
      } else {
        console.log("[WidgetRefresh] Native NutrivaWidgetModule not loaded, fallback logged.");
      }
    } catch (error) {
      console.warn("[WidgetRefresh] Failed to force refresh native widgets:", error);
    }
  }
}
