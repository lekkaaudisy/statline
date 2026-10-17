// Calendar dates as "YYYY-MM-DD" strings, in UTC for now. Weeks start on
// Monday.

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

// Today's date (or any moment's date) in UTC.
export function toIsoDate(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

// Whole days from `from` to `to`. Negative if `to` is earlier.
export function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return toIsoDate(new Date(toTime(date) + days * DAY_MS));
}

// The Monday on or before the date.
export function weekStart(date: string): string {
  const dayOfWeek = new Date(toTime(date)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dayOfWeek + 6) % 7));
}
