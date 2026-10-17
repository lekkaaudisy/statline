// Potential is momentum: how fast the other four stats are rising. It is
// never earned directly. It is recalculated once a week from the weekly
// snapshots in stat_history, and starts at C for everyone.
import {
  POTENTIAL_BANDS,
  POTENTIAL_MAX_STEPS_PER_WEEK,
  POTENTIAL_START_GRADE,
  POTENTIAL_WINDOW_WEEKS,
} from "./constants";
import { daysBetween } from "./dates";
import { stepToward } from "./grades";
import { EARNED_STATS, type EarnedStat, type Grade } from "./stats";

// One row of stat_history: each stat's points at the start of a week.
export type WeeklySnapshot = { weekStart: string; potential: number } & Record<
  EarnedStat,
  number
>;

function earnedTotal(snapshot: WeeklySnapshot): number {
  return EARNED_STATS.reduce((sum, stat) => sum + snapshot[stat], 0);
}

// The combined points gained per week by the four earned stats, over the
// last few weeks. Null when there are not yet two snapshots to compare.
export function weeklyGain(history: readonly WeeklySnapshot[]): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
  const latest = sorted[sorted.length - 1];
  const earliest = sorted.find(
    (s) => daysBetween(s.weekStart, latest.weekStart) <= POTENTIAL_WINDOW_WEEKS * 7,
  );
  if (!earliest || earliest === latest) return null;
  const weeks = daysBetween(earliest.weekStart, latest.weekStart) / 7;
  return (earnedTotal(latest) - earnedTotal(earliest)) / weeks;
}

// The grade a weekly gain points toward.
export function potentialBand(gain: number): Grade {
  const band = POTENTIAL_BANDS.find((b) => gain >= b.minWeeklyGain);
  return band ? band.grade : "F";
}

// The new Potential grade: a step toward the band the recent gain earns.
export function calculatePotential(
  history: readonly WeeklySnapshot[],
  current: Grade = POTENTIAL_START_GRADE,
): Grade {
  const gain = weeklyGain(history);
  if (gain === null) return current;
  return stepToward(current, potentialBand(gain), POTENTIAL_MAX_STEPS_PER_WEEK);
}

export type Momentum = {
  trend: "Rising" | "Steady" | "Slowing";
  perWeek: number;
};

// A plain description of the weekly gain for the status window.
export function momentumOf(gain: number | null): Momentum | null {
  if (gain === null) return null;
  const perWeek = Math.round(gain) || 0; // || 0 turns -0 into 0
  const trend = perWeek > 0 ? "Rising" : perWeek < 0 ? "Slowing" : "Steady";
  return { trend, perWeek };
}
