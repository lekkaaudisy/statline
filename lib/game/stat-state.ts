// Changes to one stat's saved state: adding points and coming back from
// "Sick or injured".
import { applyDecay, countedInactiveDays } from "./decay";
import { addDays } from "./dates";
import { maxGrade, pointsToGrade } from "./grades";
import type { Grade } from "./stats";

export type StatState = {
  points: number;
  bestGrade: Grade | null;
  lastActiveOn: string | null;
  provisional: boolean;
};

// Adds (or removes, if negative) points. Any decay so far is saved first, so
// it is not lost when the stat becomes active again.
export function addPoints(
  stat: StatState,
  amount: number,
  today: string,
  sickSince: string | null,
): StatState {
  const decayed = applyDecay({ ...stat, today, sickSince });
  const points = Math.max(0, decayed + amount);
  const bestGrade = stat.provisional
    ? stat.bestGrade
    : maxGrade(stat.bestGrade ?? "F", pointsToGrade(points));
  return {
    ...stat,
    points,
    bestGrade,
    lastActiveOn: amount > 0 ? today : stat.lastActiveOn,
  };
}

// When the user clears "Sick or injured", moves the last active day forward
// so the sick days never count toward decay.
export function resumeAfterSick(
  stat: StatState,
  sickSince: string,
  today: string,
): StatState {
  if (!stat.lastActiveOn) return stat;
  const countedDays = countedInactiveDays(stat.lastActiveOn, today, sickSince);
  const lastActiveOn = addDays(today, -countedDays);
  return { ...stat, lastActiveOn };
}
