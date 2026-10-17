// The weekly rest day. Every week includes one, and it counts as progress.
// The user can take any day of the week as their rest day. If they have not
// taken one by Sunday, Sunday becomes the rest day.
import { addDays, weekStart } from "./dates";

// This week's rest day (Monday to Sunday), or null if none is taken yet.
export function restDayThisWeek(
  restDays: readonly string[],
  today: string,
): string | null {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  return restDays.find((day) => day >= monday && day <= sunday) ?? null;
}

export function canTakeRestDay(restDays: readonly string[], today: string): boolean {
  return restDayThisWeek(restDays, today) === null;
}

// Sunday with no rest day yet this week: today becomes the rest day.
export function shouldAutoRest(restDays: readonly string[], today: string): boolean {
  return addDays(weekStart(today), 6) === today && canTakeRestDay(restDays, today);
}

export function isRestDay(restDays: readonly string[], today: string): boolean {
  return restDays.includes(today);
}
