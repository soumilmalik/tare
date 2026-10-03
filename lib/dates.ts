export const DEFAULT_TZ = "Asia/Kolkata";
export const DEFAULT_DAY_START_HOUR = 3;

/**
 * The user's "logical" date as YYYY-MM-DD: the day resets at their chosen hour
 * (3:00 AM by default) in their timezone, so 1:30 AM still counts as yesterday.
 */
export function logicalDate(
  now: Date = new Date(),
  timeZone = DEFAULT_TZ,
  dayStartHour = DEFAULT_DAY_START_HOUR,
): string {
  const shifted = new Date(now.getTime() - dayStartHour * 60 * 60 * 1000);
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/** "Saturday, 3 October" for a YYYY-MM-DD logical date. */
export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
