/**
 * Activity Services — Barrel Export
 *
 * Import platform-specific services by namespace:
 *   import { PlatformService, HealthKitService, HealthConnectService } from "@/src/modules/activity/services";
 *
 * For most use cases, only PlatformService is needed — it auto-delegates.
 *
 * @module activity/services
 */

export * as HealthKitService from "./healthkit.service";
export * as HealthConnectService from "./healthconnect.service";
export * as PlatformService from "./platform.service";
