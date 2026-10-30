import * as Location from "expo-location";

export type CountryRegion = "IN" | "ROW";

export class LocationService {
  private cachedRegion: CountryRegion | null = null;

  /**
   * Automatically detect user's country code ('IN' for India, 'ROW' for Rest of World)
   */
  async detectCountryRegion(): Promise<CountryRegion> {
    if (this.cachedRegion) {
      return this.cachedRegion;
    }

    try {
      // 1. Try Expo Location reverse geocoding if permission is already granted
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getLastKnownPositionAsync({}) || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        if (pos?.coords) {
          const [place] = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (place) {
            const cc = (place.isoCountryCode || place.country || "").toUpperCase();
            if (cc === "IN" || cc === "INDIA") {
              this.cachedRegion = "IN";
              return "IN";
            }
          }
        }
      }
    } catch {}

    try {
      // 2. Timezone & Locale inspection fallback
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (
        timeZone.includes("Kolkata") ||
        timeZone.includes("Calcutta") ||
        timeZone.includes("Asia/Kolkata") ||
        timeZone.includes("Asia/Calcutta")
      ) {
        this.cachedRegion = "IN";
        return "IN";
      }

      // Check locale string (e.g. en-IN, hi-IN)
      if (typeof navigator !== "undefined" && navigator.language) {
        if (navigator.language.toUpperCase().endsWith("-IN")) {
          this.cachedRegion = "IN";
          return "IN";
        }
      }
    } catch {}

    // Default to Rest of World (ROW)
    this.cachedRegion = "ROW";
    return "ROW";
  }

  /**
   * Request location permission and perform location detection
   */
  async requestAndDetectRegion(): Promise<CountryRegion> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        this.cachedRegion = null;
        return await this.detectCountryRegion();
      }
    } catch {}
    return await this.detectCountryRegion();
  }
}

export const locationService = new LocationService();
