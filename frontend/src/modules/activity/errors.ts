/**
 * Activity Tracking Module — Error Classes
 *
 * Typed error hierarchy for the activity tracking system. Every error
 * carries structured metadata so callers can decide whether to retry,
 * show a user-facing message, or escalate silently.
 *
 * Usage:
 *   try { ... }
 *   catch (e) {
 *     if (e instanceof PermissionDeniedError) { ... }
 *     if (e instanceof ActivityError && e.retryable) { scheduleRetry(); }
 *   }
 *
 * @module activity/errors
 */

// ─── Error Codes ─────────────────────────────────────────────────────────────

/**
 * Exhaustive error code union. Used for programmatic handling
 * (switch statements, analytics tags) without relying on message strings.
 */
export type ActivityErrorCode =
  | "PERMISSION_DENIED"
  | "PERMISSION_REVOKED"
  | "HEALTH_UNAVAILABLE"
  | "HEALTH_CONNECT_MISSING"
  | "HEALTH_CONNECT_OUTDATED"
  | "DEVICE_UNSUPPORTED"
  | "SIMULATOR_DETECTED"
  | "SYNC_FAILED"
  | "SYNC_TIMEOUT"
  | "SYNC_CANCELLED"
  | "SYNC_CONFLICT"
  | "NO_DATA"
  | "CORRUPTED_DATA"
  | "PARTIAL_DATA"
  | "VALIDATION_FAILED"
  | "NETWORK_UNAVAILABLE"
  | "API_ERROR"
  | "STORAGE_ERROR"
  | "BACKGROUND_FAILURE"
  | "RATE_LIMITED"
  | "UNKNOWN";

// ─── Base Error ──────────────────────────────────────────────────────────────

/**
 * Base class for all activity module errors.
 *
 * Every subclass must supply:
 * - `code`         — machine-readable identifier
 * - `userMessage`  — safe to display in UI (no PII, no stack traces)
 * - `retryable`    — whether the operation may succeed on retry
 * - `recoverable`  — whether the app can continue without this operation
 */
export class ActivityError extends Error {
  /** Machine-readable error code for switch/analytics. */
  readonly code: ActivityErrorCode;
  /** Safe, human-readable message for display in the UI. */
  readonly userMessage: string;
  /** Whether the failed operation may succeed if retried. */
  readonly retryable: boolean;
  /** Whether the app can degrade gracefully without this operation. */
  readonly recoverable: boolean;
  /** Optional wrapped cause for debugging (never logged to analytics). */
  readonly cause: unknown;

  constructor(params: {
    code: ActivityErrorCode;
    message: string;
    userMessage: string;
    retryable: boolean;
    recoverable: boolean;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "ActivityError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.retryable = params.retryable;
    this.recoverable = params.recoverable;
    this.cause = params.cause;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Permission Errors ───────────────────────────────────────────────────────

export class PermissionDeniedError extends ActivityError {
  constructor(cause?: unknown) {
    super({
      code: "PERMISSION_DENIED",
      message: "Health data permission was denied by the user.",
      userMessage: "Permission is required to read your activity data. You can grant access in Settings.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "PermissionDeniedError";
  }
}

export class PermissionRevokedError extends ActivityError {
  constructor(cause?: unknown) {
    super({
      code: "PERMISSION_REVOKED",
      message: "Health data permission was previously granted but has been revoked.",
      userMessage: "Activity access was revoked. Re-enable it in your device Settings to resume syncing.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "PermissionRevokedError";
  }
}

// ─── Platform Availability Errors ────────────────────────────────────────────

export class HealthUnavailableError extends ActivityError {
  constructor(platform: string, cause?: unknown) {
    super({
      code: "HEALTH_UNAVAILABLE",
      message: `${platform} is not available on this device.`,
      userMessage: `${platform} is not available on your device. Activity tracking requires a compatible device.`,
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "HealthUnavailableError";
  }
}

export class HealthConnectMissingError extends ActivityError {
  constructor(cause?: unknown) {
    super({
      code: "HEALTH_CONNECT_MISSING",
      message: "Google Health Connect app is not installed.",
      userMessage: "Health Connect is required for activity tracking on Android. Install it from the Play Store to continue.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "HealthConnectMissingError";
  }
}

export class HealthConnectOutdatedError extends ActivityError {
  constructor(currentVersion: string, requiredVersion: string, cause?: unknown) {
    super({
      code: "HEALTH_CONNECT_OUTDATED",
      message: `Health Connect version ${currentVersion} is outdated. Requires ${requiredVersion}.`,
      userMessage: "Please update Health Connect from the Play Store to use activity tracking.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "HealthConnectOutdatedError";
  }
}

export class DeviceUnsupportedError extends ActivityError {
  constructor(reason: string, cause?: unknown) {
    super({
      code: "DEVICE_UNSUPPORTED",
      message: `Device is not supported for activity tracking: ${reason}`,
      userMessage: "Activity tracking is not supported on this device.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "DeviceUnsupportedError";
  }
}

export class SimulatorDetectedError extends ActivityError {
  constructor(cause?: unknown) {
    super({
      code: "SIMULATOR_DETECTED",
      message: "Running in a simulator/emulator — health data is not available.",
      userMessage: "Activity tracking is not available in the simulator. Use a physical device to test this feature.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "SimulatorDetectedError";
  }
}

// ─── Sync Errors ─────────────────────────────────────────────────────────────

export class SyncFailedError extends ActivityError {
  constructor(reason: string, cause?: unknown) {
    super({
      code: "SYNC_FAILED",
      message: `Activity sync failed: ${reason}`,
      userMessage: "Unable to sync your activity data. We'll try again shortly.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "SyncFailedError";
  }
}

export class SyncTimeoutError extends ActivityError {
  constructor(timeoutMs: number, cause?: unknown) {
    super({
      code: "SYNC_TIMEOUT",
      message: `Activity sync timed out after ${timeoutMs}ms.`,
      userMessage: "Sync is taking longer than expected. We'll retry in the background.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "SyncTimeoutError";
  }
}

export class SyncCancelledError extends ActivityError {
  constructor(cause?: unknown) {
    super({
      code: "SYNC_CANCELLED",
      message: "Activity sync was cancelled.",
      userMessage: "Sync was cancelled.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "SyncCancelledError";
  }
}

export class SyncConflictError extends ActivityError {
  constructor(date: string, cause?: unknown) {
    super({
      code: "SYNC_CONFLICT",
      message: `Sync conflict detected for date ${date}.`,
      userMessage: "A data conflict was detected and resolved automatically.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "SyncConflictError";
  }
}

// ─── Data Errors ─────────────────────────────────────────────────────────────

export class NoDataError extends ActivityError {
  constructor(metric: string, cause?: unknown) {
    super({
      code: "NO_DATA",
      message: `No ${metric} data available.`,
      userMessage: "No activity data is available yet. Start moving to see your stats!",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "NoDataError";
  }
}

export class CorruptedDataError extends ActivityError {
  constructor(detail: string, cause?: unknown) {
    super({
      code: "CORRUPTED_DATA",
      message: `Corrupted activity data detected: ${detail}`,
      userMessage: "Some activity data appears to be invalid and was skipped.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "CorruptedDataError";
  }
}

export class PartialDataError extends ActivityError {
  constructor(available: number, expected: number, cause?: unknown) {
    super({
      code: "PARTIAL_DATA",
      message: `Partial data: ${available} of ${expected} records retrieved.`,
      userMessage: "Some activity data could not be loaded. Showing what's available.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "PartialDataError";
  }
}

export class ValidationFailedError extends ActivityError {
  constructor(detail: string, cause?: unknown) {
    super({
      code: "VALIDATION_FAILED",
      message: `Data validation failed: ${detail}`,
      userMessage: "Some activity records failed validation and were corrected or skipped.",
      retryable: false,
      recoverable: true,
      cause,
    });
    this.name = "ValidationFailedError";
  }
}

// ─── Network & API Errors ────────────────────────────────────────────────────

export class NetworkUnavailableError extends ActivityError {
  constructor(cause?: unknown) {
    super({
      code: "NETWORK_UNAVAILABLE",
      message: "Network is unavailable for activity sync.",
      userMessage: "You're offline. Your activity data is saved and will sync when you're back online.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "NetworkUnavailableError";
  }
}

export class ApiError extends ActivityError {
  /** HTTP status code, if available. */
  readonly statusCode: number | null;

  constructor(statusCode: number | null, detail: string, cause?: unknown) {
    super({
      code: "API_ERROR",
      message: `API error (${statusCode}): ${detail}`,
      userMessage: "Unable to reach the server. Your data is saved locally and will sync later.",
      retryable: statusCode !== 400 && statusCode !== 403,
      recoverable: true,
      cause,
    });
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export class RateLimitedError extends ActivityError {
  /** Seconds until the rate limit resets. */
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, cause?: unknown) {
    super({
      code: "RATE_LIMITED",
      message: `Rate limited. Retry after ${retryAfterSeconds}s.`,
      userMessage: "Too many requests. Please wait a moment before trying again.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ─── Storage Errors ──────────────────────────────────────────────────────────

export class StorageError extends ActivityError {
  constructor(operation: string, key: string, cause?: unknown) {
    super({
      code: "STORAGE_ERROR",
      message: `Storage ${operation} failed for key "${key}".`,
      userMessage: "Unable to save activity data locally. Please try again.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "StorageError";
  }
}

// ─── Background Errors ──────────────────────────────────────────────────────

export class BackgroundFailureError extends ActivityError {
  constructor(detail: string, cause?: unknown) {
    super({
      code: "BACKGROUND_FAILURE",
      message: `Background activity task failed: ${detail}`,
      userMessage: "Background sync encountered an issue. Your data will sync when you open the app.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "BackgroundFailureError";
  }
}

// ─── Unknown ─────────────────────────────────────────────────────────────────

export class UnknownActivityError extends ActivityError {
  constructor(cause?: unknown) {
    const message =
      cause instanceof Error ? cause.message : "An unknown error occurred in the activity module.";
    super({
      code: "UNKNOWN",
      message,
      userMessage: "Something unexpected happened. Please try again.",
      retryable: true,
      recoverable: true,
      cause,
    });
    this.name = "UnknownActivityError";
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Wrap any unknown thrown value into a typed ActivityError.
 * Safe to call in catch blocks regardless of what was thrown.
 */
export function toActivityError(error: unknown): ActivityError {
  if (error instanceof ActivityError) return error;
  return new UnknownActivityError(error);
}

/**
 * Type guard: is the value an ActivityError?
 */
export function isActivityError(value: unknown): value is ActivityError {
  return value instanceof ActivityError;
}

/**
 * Returns true if the error is retryable and the caller should schedule
 * another attempt with exponential backoff.
 */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof ActivityError) return error.retryable;
  return false;
}

/**
 * Compute the delay for exponential backoff.
 *
 * @param attempt  — 0-indexed retry count
 * @param baseMs   — base delay in milliseconds (default 1000)
 * @param multiplier — backoff multiplier (default 2)
 * @param maxMs    — maximum delay cap in milliseconds (default 30000)
 * @returns delay in milliseconds with ±25% jitter
 */
export function computeBackoffDelay(
  attempt: number,
  baseMs: number = 1_000,
  multiplier: number = 2,
  maxMs: number = 30_000,
): number {
  const exponentialDelay = baseMs * Math.pow(multiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxMs);
  // Add ±25% jitter to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(cappedDelay + jitter));
}
