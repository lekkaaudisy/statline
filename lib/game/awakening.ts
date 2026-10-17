// Awakening: at least 7 inactive days in a row, then 14 days of steady
// quests (at least 12 active days in a 14-day window). Active means a quest
// cleared or a rest day taken that day. Days before the user started never
// count, and sick days count as inactive like any other day off.
// It happens once per account in the MVP.
import {
  AWAKENING_INACTIVE_DAYS,
  AWAKENING_MIN_ACTIVE_DAYS,
  AWAKENING_STEADY_DAYS,
} from "./constants";
import { addDays, daysBetween } from "./dates";

// Active days from `from` to `to`, both included.
export function activeDaysBetween(
  active: ReadonlySet<string>,
  from: string,
  to: string,
): number {
  let count = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (active.has(day)) count += 1;
  }
  return count;
}

// The last day of the first run of 7 inactive days since the user started,
// or null if there has not been one.
export function firstGapEnd(
  active: ReadonlySet<string>,
  startedOn: string,
  today: string,
): string | null {
  let run = 0;
  for (let day = startedOn; day <= today; day = addDays(day, 1)) {
    run = active.has(day) ? 0 : run + 1;
    if (run >= AWAKENING_INACTIVE_DAYS) return day;
  }
  return null;
}

// The day Awakening was earned: the end of the first steady 14-day window
// after the gap. Null if it has not happened. The window may include today.
export function awakeningDay(
  active: ReadonlySet<string>,
  startedOn: string,
  today: string,
): string | null {
  const gapEnd = firstGapEnd(active, startedOn, today);
  if (!gapEnd) return null;
  for (
    let windowStart = addDays(gapEnd, 1);
    addDays(windowStart, AWAKENING_STEADY_DAYS - 1) <= today;
    windowStart = addDays(windowStart, 1)
  ) {
    const windowEnd = addDays(windowStart, AWAKENING_STEADY_DAYS - 1);
    if (activeDaysBetween(active, windowStart, windowEnd) >= AWAKENING_MIN_ACTIVE_DAYS) {
      return windowEnd;
    }
  }
  return null;
}

export type Comeback = {
  // Days since the gap ended, up to 14 (the window shown).
  days: number;
  // Active days in that window.
  activeDays: number;
};

// Progress toward Awakening after a gap, for the status window. Null when
// there has been no gap yet, or when the user is still inactive.
export function comebackProgress(
  active: ReadonlySet<string>,
  startedOn: string,
  today: string,
): Comeback | null {
  const gapEnd = firstGapEnd(active, startedOn, today);
  if (!gapEnd) return null;
  const days = Math.min(AWAKENING_STEADY_DAYS, daysBetween(gapEnd, today));
  if (days <= 0) return null;
  const activeDays = activeDaysBetween(active, addDays(today, -(days - 1)), today);
  return activeDays > 0 ? { days, activeDays } : null;
}
