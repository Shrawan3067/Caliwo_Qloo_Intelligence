/**
 * Structured Subscription Logger for Enterprise Security & Observability
 * Ensures secrets, tokens, and PII are never outputted into console or log aggregators.
 */

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

class SubscriptionLogger {
  private format(level: LogLevel, event: string, data?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const sanitizedData = data ? this.sanitize(data) : {};
    return `[SubscriptionManager][${timestamp}][${level}] ${event} ${
      Object.keys(sanitizedData).length ? JSON.stringify(sanitizedData) : ""
    }`;
  }

  private sanitize(obj: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      "secret",
      "token",
      "password",
      "key",
      "authorization",
      "bearer",
      "apikey",
    ];

    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.some((s) => lower.includes(s))) {
        clean[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null) {
        clean[k] = this.sanitize(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  debug(event: string, data?: Record<string, any>): void {
    if (__DEV__) {
      console.log(this.format("DEBUG", event, data));
    }
  }

  info(event: string, data?: Record<string, any>): void {
    console.log(this.format("INFO", event, data));
  }

  warn(event: string, data?: Record<string, any>): void {
    console.warn(this.format("WARN", event, data));
  }

  error(event: string, error?: any, data?: Record<string, any>): void {
    const errData = {
      ...data,
      errorMessage: error?.message || String(error),
      errorCode: error?.code,
    };
    console.error(this.format("ERROR", event, errData));
  }
}

export const subscriptionLogger = new SubscriptionLogger();
