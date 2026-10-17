// Decay: a stat left inactive slowly loses points, but never falls below the
// user's best-ever grade minus two steps. Paused while sick or injured.
import {
  DECAY_FLOOR_STEPS,
  DECAY_POINTS_PER_DAY,
  DECAY_START_DAYS,
} from "./constants";
import { daysBetween } from "./dates";
import { gradeToPoints, maxGrade, pointsToGrade, stepDown } from "./grades";
import type { Grade } from "./stats";

export type DecayInput = {
  // Points saved in the database (before decay).
  points: number;
  // Best grade ever reached. Empty means "use the current grade".
  bestGrade: Grade | null;
  lastActiveOn: string | null;
  today: string;
  // The day the user set "Sick or injured", or null if they are well.
  sickSince: string | null;
  // Provisional grades are not real yet, so they never decay.
  provisional: boolean;
};

// Inactive days that count toward decay: from the last active day until
// today, or until the user became sick, whichever is earlier.
export function countedInactiveDays(
  lastActiveOn: string | null,
  today: string,
  sickSince: string | null,
): number {
  if (!lastActiveOn) return 0;
  const end = sickSince && sickSince < today ? sickSince : today;
  return Math.max(0, daysBetween(lastActiveOn, end));
}

// The points after decay. Worked out fresh from the saved points each time,
// so it can be shown on every page load without ever counting twice.
export function applyDecay(input: DecayInput): number {
  const { points, bestGrade, lastActiveOn, today, sickSince, provisional } =
    input;
  if (provisional) return points;

  const days = countedInactiveDays(lastActiveOn, today, sickSince);
  if (days < DECAY_START_DAYS) return points;
  const lost = (days - DECAY_START_DAYS + 1) * DECAY_POINTS_PER_DAY;

  const best = maxGrade(bestGrade ?? "F", pointsToGrade(points));
  const floor = gradeToPoints(stepDown(best, DECAY_FLOOR_STEPS));
  if (points <= floor) return points;
  return Math.max(floor, points - lost);
}
