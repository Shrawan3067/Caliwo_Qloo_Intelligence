/**
 * Date and time formatting utilities for Caliwo.
 */

/**
 * Formats an ISO datetime string into a localized time string (e.g. "5:25 PM").
 *
 * Backend datetimes for meals are stored in UTC. If the returned string
 * is naive (e.g. "2026-10-25T11:55:00" without "Z"), standard JavaScript
 * parses it as local time, causing a timezone offset error (e.g. 5.5 hours behind in IST).
 * This helper ensures naive UTC datetimes are properly parsed as UTC before
 * converting to the user's local device time.
 */
export function formatMealTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const trimmed = String(dateStr).trim();
    if (!trimmed) return "";

    // If no timezone specifier is present, append "Z" to treat as UTC
    const hasTz =
      trimmed.endsWith("Z") ||
      trimmed.includes("+") ||
      (trimmed.includes("T") && /T.*[+-]\d{2}:?\d{2}$/.test(trimmed));

    const normalized = hasTz ? trimmed : `${trimmed}Z`;
    const d = new Date(normalized);

    if (isNaN(d.getTime())) {
      // Fallback: try raw date parse
      const rawD = new Date(trimmed);
      if (isNaN(rawD.getTime())) return "";
      return rawD.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
