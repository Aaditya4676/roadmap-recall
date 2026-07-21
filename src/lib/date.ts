export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export function dateKey(date: Date | string, timeZone = DEFAULT_TIME_ZONE): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addCalendarDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function dayDifference(from: string, to: string): number {
  const parse = (day: string) => Date.parse(`${day}T00:00:00.000Z`);
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function zonedNoonTimestamp(day: string, timeZone = DEFAULT_TIME_ZONE): string {
  const [year, month, date] = day.split("-").map(Number);
  const targetWallClock = Date.UTC(year, month - 1, date, 12, 0, 0);
  let instant = targetWallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const representedAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    const offset = representedAsUtc - instant;
    const corrected = targetWallClock - offset;
    if (corrected === instant) break;
    instant = corrected;
  }
  return new Date(instant).toISOString();
}

export function isDue(dueOn: string, today: string): boolean {
  return dueOn <= today;
}

export function isOverdue(dueOn: string, today: string): boolean {
  return dueOn < today;
}

export function humanDate(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
